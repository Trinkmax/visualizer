import { useEffect } from 'react';
import { Leva, useControls, folder, button } from 'leva';
import {
  PALETTES,
  SCENES,
  useStore,
  type PaletteName,
  type SceneName,
  type Settings,
} from '../state/store';

const paletteOptions = Object.keys(PALETTES) as PaletteName[];

/** leva onChange fires on init + programmatic set() too; only write to the
 *  store when the change actually came from the panel (`fromPanel`). This is
 *  what prevents the store<->leva feedback loop that made scenes auto-advance. */
type Ctx = { fromPanel: boolean };
const patchOn =
  <K extends keyof Settings>(key: K) =>
  (v: unknown, _p: string, { fromPanel }: Ctx) => {
    if (fromPanel)
      useStore.getState().patch({ [key]: v as Settings[K] } as Partial<Settings>);
  };

/** Leva-powered live config for every scene + the global look. */
export function ControlPanel() {
  const uiHidden = useStore((s) => s.uiHidden);
  const sceneIndex = useStore((s) => s.sceneIndex);
  const palette = useStore((s) => s.settings.palette);
  const autoCycle = useStore((s) => s.settings.autoCycle);

  const [, set] = useControls(() => {
    const init = useStore.getState().settings;
    return {
      Scene: folder({
        scene: {
          value: SCENES[useStore.getState().sceneIndex],
          options: [...SCENES],
          onChange: (v: string, _p: string, { fromPanel }: Ctx) => {
            if (!fromPanel) return;
            const i = SCENES.indexOf(v as SceneName);
            if (i >= 0) useStore.getState().setScene(i);
          },
        },
        '◂ prev': button(() => useStore.getState().prevScene()),
        'next ▸': button(() => useStore.getState().nextScene()),
        autoCycle: {
          value: init.autoCycle,
          label: 'VJ auto-cycle',
          onChange: patchOn('autoCycle'),
        },
        cycleSeconds: {
          value: init.cycleSeconds,
          min: 4,
          max: 90,
          step: 1,
          label: 'cycle (s)',
          onChange: patchOn('cycleSeconds'),
        },
      }),
      'Particle Nebula': folder({
        nebulaParticles: {
          value: init.nebulaParticles,
          min: 1000,
          max: 80000,
          step: 500,
          label: 'particles',
          onChange: patchOn('nebulaParticles'),
          render: (get) => get('Scene.scene') === 'Particle Nebula',
        },
      }),
      Look: folder({
        palette: {
          value: init.palette,
          options: paletteOptions,
          onChange: patchOn('palette'),
        },
        hueCycle: {
          value: init.hueCycle,
          min: 0,
          max: 90,
          step: 1,
          label: 'hue °/s',
          onChange: patchOn('hueCycle'),
        },
        bloom: { value: init.bloom, min: 0, max: 5, step: 0.05, onChange: patchOn('bloom') },
        bloomThreshold: {
          value: init.bloomThreshold,
          min: 0,
          max: 1,
          step: 0.01,
          onChange: patchOn('bloomThreshold'),
        },
        trails: {
          value: init.trails,
          min: 0,
          max: 1,
          step: 0.01,
          label: 'glow smear',
          onChange: patchOn('trails'),
        },
        chroma: {
          value: init.chroma,
          min: 0,
          max: 0.02,
          step: 0.0005,
          label: 'chromatic',
          onChange: patchOn('chroma'),
        },
        vignette: {
          value: init.vignette,
          min: 0,
          max: 1.5,
          step: 0.05,
          onChange: patchOn('vignette'),
        },
        grain: {
          value: init.grain,
          min: 0,
          max: 0.4,
          step: 0.01,
          onChange: patchOn('grain'),
        },
        flash: {
          value: init.flash,
          min: 0,
          max: 1,
          step: 0.01,
          label: 'beat flash',
          onChange: patchOn('flash'),
        },
        glitch: {
          value: init.glitch,
          min: 0,
          max: 1,
          step: 0.01,
          label: 'kick glitch',
          onChange: patchOn('glitch'),
        },
      }),
      Reactivity: folder({
        reactivity: {
          value: init.reactivity,
          min: 0,
          max: 3,
          step: 0.05,
          onChange: patchOn('reactivity'),
        },
        bassPunch: {
          value: init.bassPunch,
          min: 0,
          max: 3,
          step: 0.05,
          onChange: patchOn('bassPunch'),
        },
        rotation: {
          value: init.rotation,
          min: -2,
          max: 2,
          step: 0.05,
          onChange: patchOn('rotation'),
        },
      }),
      'Audio engine': folder(
        {
          gain: { value: init.gain, min: 0.2, max: 4, step: 0.05, onChange: patchOn('gain') },
          smoothing: {
            value: init.smoothing,
            min: 0,
            max: 0.96,
            step: 0.01,
            onChange: patchOn('smoothing'),
          },
          beatSensitivity: {
            value: init.beatSensitivity,
            min: 1.02,
            max: 2.2,
            step: 0.01,
            label: 'beat sens.',
            onChange: patchOn('beatSensitivity'),
          },
        },
        { collapsed: true },
      ),
    };
  });

  // store → Leva (one-way; keyboard shortcuts for scene / palette / cycle).
  // These programmatic set() calls fire onChange with fromPanel=false, which
  // patchOn ignores — so there is no loop back into the store.
  // leva types `set` against folder keys but accepts flat leaf paths at
  // runtime, so we cast to a permissive setter.
  const setLeva = set as unknown as (v: Record<string, unknown>) => void;

  useEffect(() => {
    setLeva({ scene: SCENES[sceneIndex] });
  }, [sceneIndex, set]);

  useEffect(() => {
    setLeva({ palette });
  }, [palette, set]);

  useEffect(() => {
    setLeva({ autoCycle });
  }, [autoCycle, set]);

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
