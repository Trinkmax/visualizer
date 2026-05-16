import { useEffect, useRef, useState } from 'react';
import { Visualizer } from './components/Visualizer';
import { StartOverlay } from './components/StartOverlay';
import { ControlPanel } from './components/ControlPanel';
import { Hud } from './components/Hud';
import { PALETTES, useStore, type PaletteName } from './state/store';

const PALETTE_KEYS = Object.keys(PALETTES) as PaletteName[];

export function App() {
  const started = useStore((s) => s.started);
  const [idle, setIdle] = useState(false);
  const idleTimer = useRef<number>(0);

  // ---- keyboard shortcuts ----
  useEffect(() => {
    if (!started) return;
    const st = useStore.getState;

    function onKey(e: KeyboardEvent) {
      // don't hijack typing inside the Leva panel
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key >= '1' && e.key <= '9') {
        st().setScene(Number(e.key) - 1);
      } else if (e.key === '0') {
        st().setScene(9); // 10th scene
      } else if (e.code === 'Space' || e.key === 'ArrowRight') {
        e.preventDefault();
        st().nextScene();
      } else if (e.key === 'ArrowLeft') {
        st().prevScene();
      } else if (e.key === 'h' || e.key === 'H') {
        st().toggleUI();
      } else if (e.key === 'r' || e.key === 'R') {
        const cur = st().settings.palette;
        const opts = PALETTE_KEYS.filter((p) => p !== cur);
        st().patch({ palette: opts[(Math.random() * opts.length) | 0] });
      } else if (e.key === 'c' || e.key === 'C') {
        st().patch({ autoCycle: !st().settings.autoCycle });
      } else if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement)
          document.documentElement.requestFullscreen?.().catch(() => {});
        else document.exitFullscreen?.().catch(() => {});
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [started]);

  // ---- auto-hide cursor when idle ----
  useEffect(() => {
    if (!started) return;
    function bump() {
      setIdle(false);
      window.clearTimeout(idleTimer.current);
      idleTimer.current = window.setTimeout(() => setIdle(true), 2800);
    }
    bump();
    window.addEventListener('mousemove', bump);
    window.addEventListener('keydown', bump);
    return () => {
      window.removeEventListener('mousemove', bump);
      window.removeEventListener('keydown', bump);
      window.clearTimeout(idleTimer.current);
    };
  }, [started]);

  return (
    <div className={`app${idle ? ' idle' : ''}`}>
      {started && (
        <>
          <Visualizer />
          <Hud />
          <ControlPanel />
        </>
      )}
      {!started && <StartOverlay />}
    </div>
  );
}
