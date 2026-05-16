/**
 * AudioEngine — musical audio analysis for the visualizer.
 *
 * Captures the audio the computer is playing (a browser tab / screen via
 * getDisplayMedia) or the microphone, then extracts *musically meaningful*
 * features so the scenes can truly lock to the groove:
 *
 *  - Per-band auto-gain (so quiet and loud tracks both react well).
 *  - Asymmetric envelope followers (fast attack / slow release) → punches.
 *  - Dedicated sub-bass KICK detector with its own envelope.
 *  - Spectral-flux ONSET detection (catches snares/hats, not just bass).
 *  - Tempo estimation + a continuous beat PHASE so motion grooves *in time*
 *    even between detected hits.
 *  - Everything is delta-time based → identical at 60 / 120 / 144 Hz.
 *
 * One shared instance. Scenes read `engine.bands` inside useFrame, so there
 * are zero React re-renders in the hot path.
 */

export type AudioSource = 'system' | 'mic';

export type Bands = {
  /** Overall normalised loudness 0..1 (enveloped). */
  level: number;
  /** Sub/low bass 0..1 (auto-gained, enveloped). */
  bass: number;
  lowMid: number;
  mid: number;
  highMid: number;
  treble: number;

  /** True only on the frame a sub-bass kick is detected. */
  kick: boolean;
  /** Decaying kick envelope 0..1 — use this for "los graves hacen cosas". */
  kickLevel: number;

  /** True only on the frame a broadband onset (beat) is detected. */
  beat: boolean;
  /** Decaying beat envelope 0..1 — snappy for pops/flashes. */
  beatLevel: number;

  /** Estimated tempo in BPM (smoothed, octave-corrected). */
  bpm: number;
  /** Continuous tempo phase 0..1, resynced on every beat. */
  beatPhase: number;
  /** 0.5 + 0.5*sin(phase) — a ready-to-use on-tempo LFO. */
  groove: number;

  /** Log-scaled normalised spectrum, 64 bins, 0..1 (enveloped). */
  spectrum: Float32Array;
  /** Time-domain waveform, 128 samples, -1..1. */
  wave: Float32Array;
  /** Seconds since the engine started (for shader uTime). */
  time: number;
};

const SPECTRUM_BINS = 64;
const WAVE_SAMPLES = 128;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Frame-rate independent smoothing toward `target` with time-constant `tau`. */
const approach = (prev: number, target: number, tau: number, dt: number) =>
  prev + (target - prev) * (1 - Math.exp(-dt / Math.max(tau, 1e-4)));

type BandState = { peak: number; env: number };

export class AudioEngine {
  source: AudioSource | null = null;
  running = false;
  hasAudio = false;

  /** Master input gain (boost quiet sources). */
  gain = 1;
  /** 0..0.96 — maps to envelope release time (visual smoothness). */
  smoothing = 0.78;
  /** Onset threshold multiplier (higher = fewer, only strong beats). */
  beatSensitivity = 1.32;

  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private freq = new Uint8Array(0);
  private timeData = new Uint8Array(0);
  private prevMag = new Float32Array(0);
  private startedAt = 0;

  // band auto-gain + envelope state
  private S: Record<string, BandState> = {
    bass: { peak: 0.15, env: 0 },
    lowMid: { peak: 0.15, env: 0 },
    mid: { peak: 0.15, env: 0 },
    highMid: { peak: 0.15, env: 0 },
    treble: { peak: 0.15, env: 0 },
    level: { peak: 0.15, env: 0 },
    kick: { peak: 0.2, env: 0 },
  };

  // beat / kick detection state
  private fMean = 0;
  private fDev = 0;
  private kickMean = 0;
  private prevKick = 0;
  private kickLevel = 0;
  private beatLevel = 0;
  private lastBeatMs = -1e9;
  private lastKickMs = -1e9;

  // tempo tracking
  private onsets: number[] = [];
  private bpm = 0;
  private phase = 0;

  readonly bands: Bands = {
    level: 0,
    bass: 0,
    lowMid: 0,
    mid: 0,
    highMid: 0,
    treble: 0,
    kick: false,
    kickLevel: 0,
    beat: false,
    beatLevel: 0,
    bpm: 0,
    beatPhase: 0,
    groove: 0,
    spectrum: new Float32Array(SPECTRUM_BINS),
    wave: new Float32Array(WAVE_SAMPLES),
    time: 0,
  };

  async start(source: AudioSource, deviceId?: string): Promise<void> {
    await this.stop();

    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    const ctx = new Ctx();
    this.ctx = ctx;

    let stream: MediaStream;
    if (source === 'system') {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as MediaTrackConstraints,
      });
      stream.getVideoTracks().forEach((t) => t.stop());
      if (stream.getAudioTracks().length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error(
          'No se compartió audio. Al elegir la fuente, activá "Compartir audio de la pestaña/sistema".',
        );
      }
    } else {
      // mic OR a virtual loopback device (e.g. BlackHole) selected by id
      const audio: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      };
      if (deviceId) audio.deviceId = { exact: deviceId };
      stream = await navigator.mediaDevices.getUserMedia({ audio });
    }

    this.stream = stream;
    this.hasAudio = stream.getAudioTracks().length > 0;

    const sourceNode = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;
    sourceNode.connect(analyser);
    // Intentionally NOT connected to destination (would echo to speakers).

    this.analyser = analyser;
    this.freq = new Uint8Array(analyser.frequencyBinCount);
    this.timeData = new Uint8Array(analyser.fftSize);
    this.prevMag = new Float32Array(analyser.frequencyBinCount);

    if (ctx.state === 'suspended') await ctx.resume();
    stream.getAudioTracks()[0]?.addEventListener('ended', () => {
      this.running = false;
    });

    this.source = source;
    this.startedAt = performance.now();
    this.running = true;
  }

  async stop(): Promise<void> {
    this.running = false;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.ctx) {
      try {
        await this.ctx.close();
      } catch {
        /* already closed */
      }
    }
    this.ctx = null;
    this.analyser = null;
    this.onsets = [];
  }

  /** Map the smoothing setting (0..0.96) to an envelope release time. */
  private get releaseTau() {
    return 0.05 + (this.smoothing / 0.96) * 0.42; // 0.05s .. 0.47s
  }

  /** Auto-gained + enveloped band value. */
  private trackBand(key: string, raw: number, dt: number): number {
    const s = this.S[key];
    const g = raw * this.gain;
    // running peak: instant rise, slow decay → adaptive normalisation
    s.peak =
      g > s.peak ? g : Math.max(g, s.peak * Math.exp(-dt / 4.0));
    const norm =
      g < 0.012 ? 0 : clamp01(g / Math.max(s.peak, 0.06));
    // asymmetric envelope: fast attack, user-tuned release
    s.env =
      norm > s.env
        ? approach(s.env, norm, 0.012, dt)
        : approach(s.env, norm, this.releaseTau, dt);
    return s.env;
  }

  /** Call once per animation frame with the frame delta (seconds). */
  update(deltaSeconds: number): void {
    const dt = Math.min(0.1, Math.max(0.001, deltaSeconds || 0.016));
    const b = this.bands;
    const now = performance.now();

    if (!this.analyser || !this.running) {
      const d = Math.exp(-dt / 0.4);
      b.level *= d;
      b.bass *= d;
      b.lowMid *= d;
      b.mid *= d;
      b.highMid *= d;
      b.treble *= d;
      b.kickLevel *= d;
      b.beatLevel *= d;
      b.kick = false;
      b.beat = false;
      b.groove = 0.5 + 0.5 * Math.sin(b.beatPhase * Math.PI * 2);
      b.time = (now - this.startedAt) / 1000;
      return;
    }

    const analyser = this.analyser;
    analyser.getByteFrequencyData(this.freq);
    analyser.getByteTimeDomainData(this.timeData);

    const bins = this.freq.length;
    const nyquist = this.ctx!.sampleRate / 2;
    const hzPerBin = nyquist / bins;
    const binAt = (hz: number) =>
      Math.min(bins - 1, Math.max(0, Math.round(hz / hzPerBin)));

    const avg = (lo: number, hi: number) => {
      const a = binAt(lo);
      const c = binAt(hi);
      let sum = 0;
      for (let i = a; i <= c; i++) sum += this.freq[i];
      return sum / (c - a + 1) / 255;
    };

    // ---- bands (auto-gained + enveloped) ----
    b.bass = this.trackBand('bass', avg(20, 140), dt);
    b.lowMid = this.trackBand('lowMid', avg(140, 400), dt);
    b.mid = this.trackBand('mid', avg(400, 2000), dt);
    b.highMid = this.trackBand('highMid', avg(2000, 6000), dt);
    b.treble = this.trackBand('treble', avg(6000, 16000), dt);
    b.level = this.trackBand('level', avg(30, 16000), dt);

    // ---- spectrum (log scale, enveloped) ----
    const spec = b.spectrum;
    const minHz = 30;
    const maxHz = 17000;
    for (let i = 0; i < SPECTRUM_BINS; i++) {
      const f0 = minHz * Math.pow(maxHz / minHz, i / SPECTRUM_BINS);
      const f1 = minHz * Math.pow(maxHz / minHz, (i + 1) / SPECTRUM_BINS);
      const a = binAt(f0);
      const c = Math.max(a, binAt(f1));
      let m = 0;
      for (let j = a; j <= c; j++) m = Math.max(m, this.freq[j]);
      const t = clamp01((m / 255) * this.gain);
      spec[i] =
        t > spec[i] ? approach(spec[i], t, 0.02, dt) : approach(spec[i], t, 0.12, dt);
    }

    // ---- waveform ----
    const wave = b.wave;
    const step = Math.floor(this.timeData.length / WAVE_SAMPLES);
    for (let i = 0; i < WAVE_SAMPLES; i++)
      wave[i] = (this.timeData[i * step] - 128) / 128;

    // ---- KICK detector (dedicated sub-bass transient) ----
    const kickRaw = avg(30, 110) * this.gain;
    const ks = this.S.kick;
    ks.peak =
      kickRaw > ks.peak ? kickRaw : Math.max(kickRaw, ks.peak * Math.exp(-dt / 3));
    const kickNorm = kickRaw < 0.015 ? 0 : clamp01(kickRaw / Math.max(ks.peak, 0.07));
    this.kickMean = approach(this.kickMean, kickNorm, 0.35, dt);
    const kickRising = kickNorm - this.prevKick;
    const kickHit =
      kickNorm > this.kickMean * this.beatSensitivity + 0.06 &&
      kickRising > 0.012 &&
      kickNorm > 0.2 &&
      now - this.lastKickMs > 110;
    this.prevKick = kickNorm;

    this.kickLevel *= Math.exp(-dt / 0.17);
    if (kickHit) {
      this.kickLevel = 1;
      this.lastKickMs = now;
      this.registerOnset(now, true);
    }
    b.kick = kickHit;
    b.kickLevel = this.kickLevel;

    // ---- BEAT detector (broadband spectral flux) ----
    let flux = 0;
    const maxBin = binAt(maxHz);
    for (let i = 2; i < maxBin; i++) {
      const mag = (this.freq[i] / 255) * this.gain;
      const d = mag - this.prevMag[i];
      if (d > 0) flux += d;
      this.prevMag[i] = mag;
    }
    flux /= maxBin - 2;
    this.fMean = approach(this.fMean, flux, 0.5, dt);
    this.fDev = approach(this.fDev, Math.abs(flux - this.fMean), 0.5, dt);
    const thr = this.fMean + this.fDev * this.beatSensitivity * 1.6 + 0.0006;
    const beatHit =
      flux > thr && flux > this.fMean && now - this.lastBeatMs > 130;

    this.beatLevel *= Math.exp(-dt / 0.14);
    if (beatHit) {
      this.beatLevel = 1;
      this.lastBeatMs = now;
      this.registerOnset(now, false);
      this.phase = 0; // resync the groove to the music
    }
    b.beat = beatHit;
    b.beatLevel = this.beatLevel;

    // ---- tempo + continuous phase ----
    if (this.bpm > 0) this.phase = (this.phase + dt * (this.bpm / 60)) % 1;
    b.bpm = Math.round(this.bpm);
    b.beatPhase = this.phase;
    b.groove = 0.5 + 0.5 * Math.sin(this.phase * Math.PI * 2);

    b.time = (now - this.startedAt) / 1000;
  }

  /** Feed onsets (kicks + beats) to the tempo estimator. */
  private registerOnset(now: number, _isKick: boolean): void {
    const last = this.onsets[this.onsets.length - 1];
    if (last !== undefined && now - last < 70) return; // dedupe near-simultaneous
    this.onsets.push(now);
    if (this.onsets.length > 24) this.onsets.shift();
    if (this.onsets.length < 5) return;

    const deltas: number[] = [];
    for (let i = 1; i < this.onsets.length; i++) {
      let d = this.onsets[i] - this.onsets[i - 1];
      // fold into a musical range (~70–176 BPM)
      while (d > 860) d /= 2;
      while (d < 340) d *= 2;
      deltas.push(d);
    }
    deltas.sort((a, c) => a - c);
    const med = deltas[Math.floor(deltas.length / 2)];
    if (med > 0) {
      const est = 60000 / med;
      this.bpm = this.bpm > 0 ? this.bpm + (est - this.bpm) * 0.18 : est;
    }
  }
}

export const audioEngine = new AudioEngine();

export type AudioInput = { deviceId: string; label: string };

/**
 * Lists audio input devices. Device labels are only exposed by the browser
 * after microphone permission is granted, so we request it first (and stop the
 * probe stream immediately). Use this to let the user pick a virtual loopback
 * device (BlackHole / Loopback / VB-Cable) that carries the system output.
 */
export async function listAudioInputs(): Promise<AudioInput[]> {
  const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
  probe.getTracks().forEach((t) => t.stop());
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'audioinput')
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || `Entrada de audio ${i + 1}`,
    }));
}
