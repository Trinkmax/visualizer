import { create } from 'zustand';
import type { AudioSource } from '../audio/AudioEngine';

export const SCENES = [
  'Alien Rave',
  'Hyper Tunnel',
  'Particle Nebula',
  'Kaleido Fractal',
  'Audio Terrain',
] as const;

export type SceneName = (typeof SCENES)[number];

export const PALETTES: Record<string, [string, string, string]> = {
  'Alien Green': ['#39ff88', '#00ffd0', '#0aff5b'],
  'Acid Trip': ['#ff2bd6', '#00e0ff', '#fff200'],
  'Plasma': ['#ff5e00', '#ff00a8', '#7a00ff'],
  'UV Mono': ['#b6a0ff', '#7c4dff', '#e0d4ff'],
  'Infrared': ['#ff0040', '#ff7a00', '#ffe600'],
};

export type PaletteName = keyof typeof PALETTES;

export type Settings = {
  // look
  palette: PaletteName;
  hueCycle: number; // deg/sec
  bloom: number;
  bloomThreshold: number;
  chroma: number;
  vignette: number;
  grain: number;
  trails: number; // afterimage 0..0.95
  flash: number; // beat brightness pop 0..1
  glitch: number; // kick-triggered glitch 0..1

  // reactivity
  reactivity: number; // master multiplier
  bassPunch: number;
  rotation: number; // global auto-rotate speed

  // scene-specific
  nebulaParticles: number; // Particle Nebula point count

  // engine
  gain: number;
  smoothing: number;
  beatSensitivity: number;

  // VJ
  autoCycle: boolean;
  cycleSeconds: number;
};

type State = {
  started: boolean;
  audioSource: AudioSource | null;
  sceneIndex: number;
  uiHidden: boolean;
  settings: Settings;

  setStarted: (v: boolean, src?: AudioSource) => void;
  setScene: (i: number) => void;
  nextScene: () => void;
  prevScene: () => void;
  toggleUI: () => void;
  patch: (p: Partial<Settings>) => void;
  reset: () => void;
};

/** Friendly Spanish labels + descriptions for the scene picker. */
export const SCENE_INFO: Record<SceneName, { label: string; desc: string }> = {
  'Alien Rave': { label: 'Rave Alien', desc: 'Multitud de aliens neón bailando al ritmo' },
  'Hyper Tunnel': { label: 'Túnel Hiper', desc: 'Vuelo infinito por anillos de luz' },
  'Particle Nebula': { label: 'Nebulosa', desc: 'Galaxia de partículas que respira' },
  'Kaleido Fractal': { label: 'Caleidoscopio', desc: 'Fractal psicodélico que late' },
  'Audio Terrain': { label: 'Paisaje', desc: 'Montañas neón esculpidas por la música' },
};

/** One-click vibes. Each applies a bundle of settings over the current ones. */
export const PRESETS: Record<string, Partial<Settings>> = {
  Suave: {
    reactivity: 0.75,
    bassPunch: 0.6,
    bloom: 1.0,
    bloomThreshold: 0.22,
    chroma: 0.0006,
    grain: 0.03,
    trails: 0.2,
    rotation: 0.15,
    hueCycle: 3,
    flash: 0,
    glitch: 0,
  },
  Equilibrado: {
    reactivity: 1.1,
    bassPunch: 1.1,
    bloom: 1.3,
    bloomThreshold: 0.12,
    chroma: 0.001,
    grain: 0.05,
    trails: 0.35,
    rotation: 0.22,
    hueCycle: 5,
    flash: 0,
    glitch: 0,
  },
  Fiesta: {
    reactivity: 1.6,
    bassPunch: 1.7,
    bloom: 1.9,
    bloomThreshold: 0.05,
    chroma: 0.002,
    grain: 0.07,
    trails: 0.45,
    rotation: 0.45,
    hueCycle: 12,
    flash: 0.25,
    glitch: 0.15,
  },
  'Viaje total': {
    reactivity: 2.2,
    bassPunch: 2.2,
    bloom: 2.5,
    bloomThreshold: 0.0,
    chroma: 0.003,
    grain: 0.1,
    trails: 0.6,
    rotation: 0.8,
    hueCycle: 22,
    flash: 0.4,
    glitch: 0.3,
  },
};

export const defaultSettings: Settings = {
  palette: 'Alien Green',
  hueCycle: 5,
  bloom: 1.3,
  bloomThreshold: 0.12,
  chroma: 0.001,
  vignette: 0.45,
  grain: 0.05,
  trails: 0.35,
  flash: 0, // strobe OFF by default (opt-in via "Modo fiesta")
  glitch: 0,

  reactivity: 1.1,
  bassPunch: 1.1,
  rotation: 0.22,

  nebulaParticles: 28000,

  gain: 1,
  smoothing: 0.78,
  beatSensitivity: 1.32,

  autoCycle: false,
  cycleSeconds: 22,
};

export const useStore = create<State>((set) => ({
  started: false,
  audioSource: null,
  sceneIndex: 0,
  uiHidden: false,
  settings: defaultSettings,

  setStarted: (v, src) => set({ started: v, audioSource: src ?? null }),
  setScene: (i) => set({ sceneIndex: ((i % SCENES.length) + SCENES.length) % SCENES.length }),
  nextScene: () => set((s) => ({ sceneIndex: (s.sceneIndex + 1) % SCENES.length })),
  prevScene: () =>
    set((s) => ({ sceneIndex: (s.sceneIndex - 1 + SCENES.length) % SCENES.length })),
  toggleUI: () => set((s) => ({ uiHidden: !s.uiHidden })),
  patch: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
  reset: () => set({ settings: defaultSettings }),
}));
