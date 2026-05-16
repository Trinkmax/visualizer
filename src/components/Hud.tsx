import { useEffect, useRef } from 'react';
import { audioEngine } from '../audio/AudioEngine';
import { SCENES, useStore } from '../state/store';

const BARS = 40;

export function Hud() {
  const sceneIndex = useStore((s) => s.sceneIndex);
  const uiHidden = useStore((s) => s.uiHidden);
  const audioSource = useStore((s) => s.audioSource);

  const bars = useRef<(HTMLElement | null)[]>([]);
  const dot = useRef<HTMLDivElement>(null);
  const bpm = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastBpm = 0;
    const tick = () => {
      const b = audioEngine.bands;
      const spec = b.spectrum;
      for (let i = 0; i < BARS; i++) {
        const el = bars.current[i];
        if (!el) continue;
        const v = spec[Math.floor((i / BARS) * spec.length)] || 0;
        el.style.transform = `scaleY(${Math.max(0.04, v)})`;
      }
      if (dot.current) {
        dot.current.style.transform = `scale(${0.6 + b.beatLevel * 0.9})`;
        dot.current.style.opacity = `${0.25 + b.beatLevel * 0.75}`;
      }
      if (bpm.current && b.bpm !== lastBpm) {
        lastBpm = b.bpm;
        bpm.current.textContent = b.bpm ? `${b.bpm} BPM` : '— BPM';
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className={`hud${uiHidden ? ' hidden' : ''}`}>
      <div className="hud-top">
        <span className="hud-scene">{SCENES[sceneIndex]}</span>
        <span className="hud-index">
          {String(sceneIndex + 1).padStart(2, '0')} / {String(SCENES.length).padStart(2, '0')}
          {' · '}
          <span ref={bpm}>— BPM</span>
          {' · '}
          {audioSource === 'mic' ? 'MIC' : 'SYSTEM'}
        </span>
      </div>

      <div className="hud-bottom">
        <div className="hud-keys">
          <b>1–0</b> scenes &nbsp; <b>SPACE</b> next &nbsp; <b>R</b> palette
          <br />
          <b>H</b> hide ui &nbsp; <b>F</b> fullscreen &nbsp; <b>C</b> auto-cycle
        </div>
        <div className="spectrum" aria-hidden>
          <div ref={dot} className="beat-dot" />
          {Array.from({ length: BARS }, (_, i) => (
            <i
              key={i}
              ref={(el) => {
                bars.current[i] = el;
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
