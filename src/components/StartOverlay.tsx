import { useState } from 'react';
import {
  audioEngine,
  listAudioInputs,
  type AudioInput,
  type AudioSource,
} from '../audio/AudioEngine';
import { useStore } from '../state/store';

const LOOPBACK_RE = /blackhole|loopback|aggregate|multi|vb-?audio|vb-?cable|soundflower|stereo mix|mezcla est/i;

const IS_WIN = /Win/i.test(
  (navigator as Navigator & { userAgentData?: { platform?: string } })
    .userAgentData?.platform || navigator.platform || navigator.userAgent,
);

export function StartOverlay() {
  const setStarted = useStore((s) => s.setStarted);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<AudioInput[] | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [helpOS, setHelpOS] = useState<'win' | 'mac'>(IS_WIN ? 'win' : 'mac');

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
                <b>parlante/salida no aparece acá</b> (esta lista es de{' '}
                <b>entradas</b>).{' '}
                {IS_WIN ? (
                  <>
                    En Windows usá el botón <b>“Pantalla / pestaña”</b> de abajo
                    y compartí el audio del sistema, o activá{' '}
                    <b>“Mezcla estéreo”</b>. Mirá la guía 👇
                  </>
                ) : (
                  <>
                    Instalá <b>BlackHole</b> para que aparezca — mirá la guía 👇
                  </>
                )}
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
            {showHelp ? '▾' : '▸'} ¿Cómo capturar el audio del sistema?
          </button>
          {showHelp && (
            <div className="helpbox">
              <div className="os-tabs">
                <button
                  className={helpOS === 'win' ? 'on' : ''}
                  onClick={() => setHelpOS('win')}
                >
                  🪟 Windows
                </button>
                <button
                  className={helpOS === 'mac' ? 'on' : ''}
                  onClick={() => setHelpOS('mac')}
                >
                   macOS
                </button>
              </div>

              {helpOS === 'win' ? (
                <ol>
                  <li>
                    <b>Lo más fácil (sin instalar nada):</b> abajo tocá{' '}
                    <b>“Pantalla / pestaña”</b>, elegí <b>“Toda la pantalla”</b>{' '}
                    y tildá <b>“Compartir el audio del sistema”</b> (Chrome /
                    Edge). Listo: reacciona a todo lo que suene.
                  </li>
                  <li>
                    <b>Alternativa — Mezcla estéreo:</b> Configuración de sonido
                    → <b>Más opciones de sonido</b> → pestaña <b>Grabar</b> →
                    clic derecho → <b>Mostrar dispositivos deshabilitados</b> →
                    activá <b>“Mezcla estéreo”</b>. Después elegila acá arriba.
                  </li>
                  <li>
                    <b>Si no hay Mezcla estéreo:</b> instalá{' '}
                    <a
                      href="https://vb-audio.com/Cable/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      VB-Audio Cable
                    </a>{' '}
                    (gratis). Poné <b>CABLE Input</b> como salida de Windows y
                    en sus propiedades activá <b>“Escuchar este dispositivo”</b>{' '}
                    hacia tu parlante (para seguir oyendo). Acá elegí{' '}
                    <b>CABLE Output</b>.
                  </li>
                </ol>
              ) : (
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
                    <b>“Auriculares externos”</b> (o tu Bluetooth) — y también{' '}
                    <b>BlackHole 2ch</b>. Poné tu parlante como maestro y
                    activá <b>corrección de deriva</b> en BlackHole.
                  </li>
                  <li>
                    En Sonido del Mac, elegí ese{' '}
                    <b>Dispositivo de salida múltiple</b> como salida.
                  </li>
                  <li>
                    Acá arriba elegí <b>BlackHole 2ch</b> y <b>Empezar</b>.
                  </li>
                </ol>
              )}
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
            {busy === 'system' ? 'Esperando…' : '🖥️ Pantalla / pestaña'}
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
          <kbd>1–0</kbd> escenas · <kbd>Espacio</kbd> siguiente ·{' '}
          <kbd>H</kbd> ocultar UI · <kbd>F</kbd> pantalla completa ·{' '}
          <kbd>R</kbd> paleta random
        </p>
      </div>
    </div>
  );
}
