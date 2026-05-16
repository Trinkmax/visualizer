import type { ComponentType } from 'react';
import { AlienRave } from './AlienRave';
import { HyperTunnel } from './HyperTunnel';
import { ParticleNebula } from './ParticleNebula';
import { KaleidoFractal } from './KaleidoFractal';
import { AudioTerrain } from './AudioTerrain';
import { NeonCity } from './NeonCity';
import { AudioSphere } from './AudioSphere';
import { Hyperdrive } from './Hyperdrive';
import { PlasmaFlow } from './PlasmaFlow';
import { RadialEQ } from './RadialEQ';
import { SCENES } from '../state/store';

export const SCENE_COMPONENTS: ComponentType[] = [
  AlienRave,
  HyperTunnel,
  ParticleNebula,
  KaleidoFractal,
  AudioTerrain,
  NeonCity,
  AudioSphere,
  Hyperdrive,
  PlasmaFlow,
  RadialEQ,
];

export { SCENES };
