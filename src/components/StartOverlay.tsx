import { useState } from 'react';
import { audioEngine, type AudioSource } from '../audio/AudioEngine';
import { useStore } from '../state/store';

export function StartOverlay() {
  const setStarted = useStore((s) => s.setStarted);
  const [busy, setBusy] = useState<AudioSource | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function begin(source: AudioSource) {
    setError(null);
    setBusy(source);
    try {
      await audioEngine.start(source);
      setStarted(true, source);
    } catch (e) {
      setBusy(null);
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /denied|dismissed|NotAllowed/i.test(msg)
          ? 'Permiso denegado. Probá de nuevo y aceptá el acceso al audio.'
          : msg,
      );
    }
  }

  return (
    <div className="overlay">
      <div className="overlay-card">
        <h1 className="glitch" data-text="NEON">
          NEON
        </h1>
        <p className="subtitle">Audio-Reactive · Psychedelic · VJ Engine</p>

        <div className="cta-row">
          <button
            className="btn primary"
            disabled={busy !== null}
            onClick={() => begin('system')}
          >
            {busy === 'system' ? 'Esperando…' : '▸ Audio de la compu'}
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
          <b>Audio de la compu:</b> elegí la pestaña/pantalla que reproduce
          música y <b>activá “Compartir audio”</b> en el selector del navegador
          (funciona mejor en Chrome / Edge).
          <br />
          <br />
          <kbd>1–5</kbd> escenas · <kbd>Espacio</kbd> siguiente ·{' '}
          <kbd>H</kbd> ocultar UI · <kbd>F</kbd> pantalla completa ·{' '}
          <kbd>R</kbd> paleta random
        </p>
      </div>
    </div>
  );
}
