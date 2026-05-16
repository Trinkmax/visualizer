import { useEffect } from 'react';
import { Leva, useControls, folder, button } from 'leva';
import {
  PALETTES,
  SCENES,
  useStore,
  type PaletteName,
} from '../state/store';

const paletteOptions = Object.keys(PALETTES) as PaletteName[];

/** Leva-powered live config for every scene + the global look. */
export function ControlPanel() {
  const uiHidden = useStore((s) => s.uiHidden);
  const sceneIndex = useStore((s) => s.sceneIndex);
  const settings = useStore((s) => s.settings);
  const setScene = useStore((s) => s.setScene);
  const nextScene = useStore((s) => s.nextScene);
  const prevScene = useStore((s) => s.prevScene);
  const patch = useStore((s) => s.patch);

  const [vals, set] = useControls(() => ({
    Scene: folder({
      scene: { value: SCENES[sceneIndex], options: [...SCENES] },
      '◂ prev': button(() => prevScene()),
      'next ▸': button(() => nextScene()),
      autoCycle: { value: settings.autoCycle, label: 'VJ auto-cycle' },
      cycleSeconds: {
        value: settings.cycleSeconds,
        min: 4,
        max: 90,
        step: 1,
        label: 'cycle (s)',
      },
    }),
    'Particle Nebula': folder({
      nebulaParticles: {
        value: settings.nebulaParticles,
        min: 1000,
        max: 80000,
        step: 500,
        label: 'particles',
        render: (get) => get('Scene.scene') === 'Particle Nebula',
      },
    }),
    Look: folder({
      palette: { value: settings.palette, options: paletteOptions },
      hueCycle: { value: settings.hueCycle, min: 0, max: 90, step: 1, label: 'hue °/s' },
      bloom: { value: settings.bloom, min: 0, max: 5, step: 0.05 },
      bloomThreshold: { value: settings.bloomThreshold, min: 0, max: 1, step: 0.01 },
      trails: { value: settings.trails, min: 0, max: 1, step: 0.01, label: 'glow smear' },
      chroma: { value: settings.chroma, min: 0, max: 0.02, step: 0.0005, label: 'chromatic' },
      vignette: { value: settings.vignette, min: 0, max: 1.5, step: 0.05 },
      grain: { value: settings.grain, min: 0, max: 0.4, step: 0.01 },
      flash: { value: settings.flash, min: 0, max: 1, step: 0.01, label: 'beat flash' },
      glitch: { value: settings.glitch, min: 0, max: 1, step: 0.01, label: 'kick glitch' },
    }),
    Reactivity: folder({
      reactivity: { value: settings.reactivity, min: 0, max: 3, step: 0.05 },
      bassPunch: { value: settings.bassPunch, min: 0, max: 3, step: 0.05 },
      rotation: { value: settings.rotation, min: -2, max: 2, step: 0.05 },
    }),
    'Audio engine': folder(
      {
        gain: { value: settings.gain, min: 0.2, max: 4, step: 0.05 },
        smoothing: { value: settings.smoothing, min: 0, max: 0.96, step: 0.01 },
        beatSensitivity: {
          value: settings.beatSensitivity,
          min: 1.02,
          max: 2.2,
          step: 0.01,
          label: 'beat sens.',
        },
      },
      { collapsed: true },
    ),
  }));

  // Leva → store
  useEffect(() => {
    const idx = SCENES.indexOf(vals.scene as (typeof SCENES)[number]);
    if (idx >= 0 && idx !== useStore.getState().sceneIndex) setScene(idx);
    patch({
      autoCycle: vals.autoCycle,
      cycleSeconds: vals.cycleSeconds,
      palette: vals.palette as PaletteName,
      hueCycle: vals.hueCycle,
      bloom: vals.bloom,
      bloomThreshold: vals.bloomThreshold,
      trails: vals.trails,
      chroma: vals.chroma,
      vignette: vals.vignette,
      grain: vals.grain,
      flash: vals.flash,
      glitch: vals.glitch,
      reactivity: vals.reactivity,
      bassPunch: vals.bassPunch,
      rotation: vals.rotation,
      nebulaParticles: vals.nebulaParticles,
      gain: vals.gain,
      smoothing: vals.smoothing,
      beatSensitivity: vals.beatSensitivity,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vals]);

  // store → Leva (keyboard shortcuts: scene + random palette)
  useEffect(() => {
    if (vals.scene !== SCENES[sceneIndex]) set({ scene: SCENES[sceneIndex] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneIndex]);

  useEffect(() => {
    if (vals.palette !== settings.palette) set({ palette: settings.palette });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.palette]);

  return (
    <Leva
      hidden={uiHidden}
      collapsed={false}
      oneLineLabels
      titleBar={{ title: 'NEON ▸ CONTROL', filter: false }}
      theme={{
        colors: {
          accent1: '#39ff88',
          accent2: '#39ff88',
          accent3: '#00ffd0',
          highlight1: '#0a0f0c',
          highlight2: '#39ff88',
          highlight3: '#eafff3',
          elevation1: '#05080699',
          elevation2: '#05080699',
          elevation3: '#0c1310',
        },
        radii: { xs: '4px', sm: '6px', lg: '10px' },
        fontSizes: { root: '11px' },
      }}
    />
  );
}
