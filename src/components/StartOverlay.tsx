import { useState } from 'react';
import {
  audioEngine,
  listAudioInputs,
  type AudioInput,
  type AudioSource,
} from '../audio/AudioEngine';
import { useStore } from '../state/store';

const LOOPBACK_RE = /blackhole|loopback|aggregate|multi|vb-?audio|vb-?cable|soundflower|stereo mix|mezcla est/i;

export function StartOverlay() {
  const setStarted = useStore((s) => s.setStarted);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<AudioInput[] | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [showHelp, setShowHelp] = useState(false);

  function fail(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    setError(
      /denied|dismissed|NotAllowed|Permission/i.test(msg)
        ? 'Permiso de audio denegado. Probá de nuevo y aceptá el acceso.'
        : msg,
    );
  }

  async function begin(source: AudioSource) {
    setError(null);
    setBusy(source);
    try {
      await audioEngine.start(source);
      setStarted(true, source);
    } catch (e) {
      setBusy(null);
      fail(e);
    }
  }

  async function loadDevices() {
    setError(null);
    setBusy('list');
    try {
      const list = await listAudioInputs();
      setDevices(list);
      const pref = list.find((d) => LOOPBACK_RE.test(d.label)) ?? list[0];
      setDeviceId(pref?.deviceId ?? '');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(null);
    }
  }

  async function beginDevice() {
    setError(null);
    setBusy('device');
    try {
      await audioEngine.start('mic', deviceId || undefined);
      setStarted(true, 'mic');
    } catch (e) {
      setBusy(null);
      fail(e);
    }
  }

  return (
    <div className="overlay">
      <div className="overlay-card">
        <h1 className="glitch" data-text="FIESTA INFINITA">
          FIESTA INFINITA
        </h1>
        <p className="subtitle">Audio-Reactive · Psychedelic · VJ Engine</p>

        {/* ---- system output (Bluetooth / Spotify / apps) ---- */}
        <div className="src">
          <div className="src-title">🔊 Salida del sistema (Spotify, Bluetooth, apps)</div>
          {devices === null ? (
            <button
              className="btn primary"
              disabled={busy !== null}
              onClick={loadDevices}
            >
              {busy === 'list' ? 'Pidiendo permiso…' : 'Elegir dispositivo de audio'}
            </button>
          ) : (
            <>
            {!devices.some((d) => LOOPBACK_RE.test(d.label)) && (
              <div className="warn">
                ⚠️ No hay un dispositivo de captura del sistema. Tu{' '}
                <b>parlante / auxiliar es una salida</b>, no aparece acá (esta
                lista es de <b>entradas</b>). Instalá <b>BlackHole</b> para que
                aparezca — mirá la guía 👇
              </div>
            )}
            <div className="field">
              <select
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
              >
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>
              <button
                className="btn primary"
                disabled={busy !== null}
                onClick={beginDevice}
              >
                {busy === 'device' ? 'Iniciando…' : '▸ Empezar'}
              </button>
            </div>
            </>
          )}
          <button className="link" onClick={() => setShowHelp((v) => !v)}>
            {showHelp ? '▾' : '▸'} ¿Cómo capturar el audio del sistema en Mac?
          </button>
          {showHelp && (
            <div className="helpbox">
              El navegador <b>no puede</b> tomar el audio del sistema en macOS
              directamente. Necesitás un “cable” de audio virtual (gratis):
              <ol>
                <li>
                  Instalá <b>BlackHole 2ch</b>:{' '}
                  <code>brew install blackhole-2ch</code> o desde{' '}
                  <a
                    href="https://existential.audio/blackhole/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    existential.audio/blackhole
                  </a>
                  .
                </li>
                <li>
                  Abrí <b>Configuración de Audio MIDI</b> → ＋ →{' '}
                  <b>Crear dispositivo de salida múltiple</b>. Tildá{' '}
                  <b>tu parlante</b> — el del auxiliar suele llamarse{' '}
                  <b>“Auriculares externos”</b> (o tu Bluetooth) — para seguir
                  escuchando, y también <b>BlackHole 2ch</b>. Poné tu parlante
                  como dispositivo maestro y activá{' '}
                  <b>corrección de deriva</b> en BlackHole.
                </li>
                <li>
                  En la barra de menú / Sonido, elegí ese{' '}
                  <b>Dispositivo de salida múltiple</b> como salida del Mac.
                </li>
                <li>
                  Acá arriba elegí <b>BlackHole 2ch</b> en la lista y{' '}
                  <b>Empezar</b>. ¡Listo, reacciona a todo lo que suene en la
                  PC!
                </li>
              </ol>
              <span className="muted">
                Windows: activá “Mezcla estéreo” o usá VB-Audio Cable y
                elegilo en la lista.
              </span>
            </div>
          )}
        </div>

        {/* ---- other sources ---- */}
        <div className="cta-row">
          <button
            className="btn"
            disabled={busy !== null}
            onClick={() => begin('system')}
          >
            {busy === 'system' ? 'Esperando…' : 'Pestaña del navegador'}
          </button>
          <button
            className="btn"
            disabled={busy !== null}
            onClick={() => begin('mic')}
          >
            {busy === 'mic' ? 'Esperando…' : '🎤 Micrófono'}
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <p className="hint">
          <kbd>1–5</kbd> escenas · <kbd>Espacio</kbd> siguiente ·{' '}
          <kbd>H</kbd> ocultar UI · <kbd>F</kbd> pantalla completa ·{' '}
          <kbd>R</kbd> paleta random
        </p>
      </div>
    </div>
  );
}
