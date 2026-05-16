import * as THREE from 'three';
import { PALETTES, type PaletteName } from '../state/store';

const cache = new Map<string, [THREE.Color, THREE.Color, THREE.Color]>();

/** Returns the 3 palette colors as cached THREE.Color objects. */
export function paletteColors(
  name: PaletteName,
): [THREE.Color, THREE.Color, THREE.Color] {
  let c = cache.get(name);
  if (!c) {
    const [a, b, d] = PALETTES[name];
    c = [new THREE.Color(a), new THREE.Color(b), new THREE.Color(d)];
    cache.set(name, c);
  }
  return c;
}
