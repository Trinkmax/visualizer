import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { useStore } from '../state/store';
import { paletteColors } from '../lib/palette';

/** "Hiperdrive" — a warp-speed starfield. Lines stretch with the speed, the
 *  beat lengthens the streaks and the kick punches a hyperspace jump. */

const STARS = 1400;
const FAR = 220;

export function Hyperdrive() {
  const palette = useStore((s) => s.settings.palette);
  const colors = paletteColors(palette);

  const { geometry, data } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(STARS * 6);
    const col = new Float32Array(STARS * 6);
    const d = Array.from({ length: STARS }, () => {
      const a = Math.random() * Math.PI * 2;
      const r = 2 + Math.random() * 60;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, z: -Math.random() * FAR };
    });
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return { geometry: g, data: d };
  }, []);

  const speed = useRef(0);

  useFrame((state, delta) => {
    const b = audioEngine.bands;
    const s = useStore.getState().settings;
    const react = s.reactivity;

    const target = 30 + b.level * 220 * react + b.kickLevel * 360 * s.bassPunch;
    speed.current += (target - speed.current) * 0.12;
    const v = speed.current * Math.min(0.05, delta);
    const streak = 1.5 + speed.current * 0.05 + b.beatLevel * 14;

    const pos = geometry.attributes.position.array as Float32Array;
    const col = geometry.attributes.color.array as Float32Array;
    const c0 = colors[0];
    const c1 = colors[1];
    const c2 = colors[2];

    for (let i = 0; i < STARS; i++) {
      const p = data[i];
      p.z += v;
      if (p.z > 6) {
        const a = Math.random() * Math.PI * 2;
        const r = 2 + Math.random() * 60;
        p.x = Math.cos(a) * r;
        p.y = Math.sin(a) * r;
        p.z = -FAR;
      }
      const o = i * 6;
      pos[o] = p.x;
      pos[o + 1] = p.y;
      pos[o + 2] = p.z;
      pos[o + 3] = p.x;
      pos[o + 4] = p.y;
      pos[o + 5] = p.z - streak;

      // brighter as it gets closer; hue shifts with depth
      const near = THREE.MathUtils.clamp(1 + p.z / FAR, 0, 1);
      const cc = near < 0.5 ? c0 : near < 0.8 ? c1 : c2;
      const g = 0.2 + near * (1.4 + b.beatLevel);
      col[o] = col[o + 3] = cc.r * g;
      col[o + 1] = col[o + 4] = cc.g * g;
      col[o + 2] = col[o + 5] = cc.b * g;
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.color.needsUpdate = true;

    // subtle barrel roll
    state.camera.position.set(0, 0, 6);
    state.camera.lookAt(0, 0, -50);
    state.camera.rotation.z =
      Math.sin(b.time * 0.4) * 0.12 * s.rotation + b.beatLevel * 0.05;
  });

  return (
    <>
      <fog attach="fog" args={['#000000', 40, FAR]} />
      <lineSegments geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial
          vertexColors
          transparent
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </>
  );
}
