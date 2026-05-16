import type { ComponentType } from 'react';
import { AlienRave } from './AlienRave';
import { HyperTunnel } from './HyperTunnel';
import { ParticleNebula } from './ParticleNebula';
import { KaleidoFractal } from './KaleidoFractal';
import { AudioTerrain } from './AudioTerrain';
import { SCENES } from '../state/store';

export const SCENE_COMPONENTS: ComponentType[] = [
  AlienRave,
  HyperTunnel,
  ParticleNebula,
  KaleidoFractal,
  AudioTerrain,
];

export { SCENES };
