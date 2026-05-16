import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { useStore } from '../state/store';
import { paletteColors } from '../lib/palette';

/**
 * "Audio Terrain" — a neon wireframe landscape sculpted from the spectrum,
 * scrolling endlessly toward the camera, mirrored above into a tunnel/cave of
 * light you fly through. Scroll is locked to the song tempo; the kick slams a
 * ridge across the row and the camera bobs on the beat phase.
 */

const COLS = 96; // along X (spectrum, mirrored)
const ROWS = 120; // along Z (scrolling history)
const SIZE_X = 34;
const SIZE_Z = 60;

export function AudioTerrain() {
  const palette = useStore((s) => s.settings.palette);
  const colors = paletteColors(palette);
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, heights } = useMemo(() => {
    const g = new THREE.PlaneGeometry(SIZE_X, SIZE_Z, COLS - 1, ROWS - 1);
    g.rotateX(-Math.PI / 2);
    return { geometry: g, heights: new Float32Array(COLS * ROWS) };
  }, []);

  const accum = useRef(0);

  useFrame((state, delta) => {
    const b = audioEngine.bands;
    const s = useStore.getState().settings;
    const pos = geometry.attributes.position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;

    // scroll locked to the song tempo: rows advance with the BPM so ridges
    // line up with the beat (plus a touch of loudness for feel)
    const bps = (b.bpm > 0 ? b.bpm : 120) / 60;
    accum.current += delta * (bps * 7 + b.level * 6 * s.reactivity);
    while (accum.current >= 1) {
      accum.current -= 1;
      heights.copyWithin(COLS, 0, COLS * (ROWS - 1));
      // new front row: spectrum shape + a kick ridge slamming the whole row
      const ridge = b.kickLevel * 9 * s.bassPunch;
      for (let x = 0; x < COLS; x++) {
        const m = Math.abs(x - COLS / 2) / (COLS / 2); // 0 center -> 1 edge
        const idx = Math.floor(m * (b.spectrum.length - 1));
        const h =
          (Math.pow(b.spectrum[idx], 1.4) * (7 + b.beatLevel * 6) +
            ridge * (1.0 - m * 0.5)) *
          s.reactivity;
        heights[x] = h;
      }
    }

    // write heights into geometry with a little live shimmer
    const t = b.time;
    for (let z = 0; z < ROWS; z++) {
      for (let x = 0; x < COLS; x++) {
        const i = z * COLS + x;
        const shimmer = Math.sin(x * 0.4 + t * 6 + z * 0.2) * b.treble * 0.4;
        arr[i * 3 + 1] = heights[i] + shimmer;
      }
    }
    pos.needsUpdate = true;
    geometry.computeBoundingSphere();

    // fly low through the cave — bob on the tempo phase, dive on the kick
    const bob = Math.sin(b.beatPhase * Math.PI * 2);
    state.camera.position.set(
      Math.sin(t * 0.2) * 3,
      6 + b.bass * 2 + bob * 0.7 - b.kickLevel * 1.2,
      14,
    );
    state.camera.lookAt(0, 1 + b.bass * 2, -14);
    state.camera.rotation.z =
      Math.sin(t * 0.3) * 0.06 * s.rotation + bob * 0.03;
  });

  return (
    <>
      <fog attach="fog" args={['#000000', 20, 60]} />
      <mesh ref={meshRef} geometry={geometry} position={[0, 0, -10]}>
        <meshBasicMaterial
          color={colors[0]}
          wireframe
          transparent
          opacity={0.9}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      {/* mirrored ceiling for a tunnel-of-light / cave feel */}
      <mesh geometry={geometry} position={[0, 16, -10]} scale={[1, -1, 1]}>
        <meshBasicMaterial
          color={colors[1]}
          wireframe
          transparent
          opacity={0.28}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
