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
};

export const defaultSettings: Settings = {
  palette: 'Alien Green',
  hueCycle: 6,
  bloom: 1.6,
  bloomThreshold: 0.0,
  chroma: 0.0016,
  vignette: 0.5,
  grain: 0.06,
  trails: 0.4,
  flash: 0.35,
  glitch: 0.18,

  reactivity: 1,
  bassPunch: 1,
  rotation: 0.25,

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
}));
