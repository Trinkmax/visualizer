import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { useStore } from '../state/store';
import { paletteColors } from '../lib/palette';

/**
 * "Hyper Tunnel" — flight through neon rings. Speed warps on the kick, a shock
 * wave-front is launched on every kick and races toward you, and the whole
 * tube barrel-rolls a step on each beat.
 */

const RINGS = 64;
const SPACING = 2.2;
const DEPTH = RINGS * SPACING;
const WAVES = 4;

export function HyperTunnel() {
  const palette = useStore((s) => s.settings.palette);
  const colors = paletteColors(palette);

  const ringGeo = useMemo(() => new THREE.TorusGeometry(3, 0.06, 8, 64), []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const mats = useRef<THREE.MeshBasicMaterial[]>([]);
  const offset = useRef(0);

  // travelling shock wave-fronts (z position), launched on kicks
  const waveZ = useRef<number[]>(Array(WAVES).fill(999));
  const waveNext = useRef(0);
  const wasKick = useRef(false);
  const roll = useRef({ a: 0, v: 0 });
  const wasBeat = useRef(false);

  const data = useMemo(
    () =>
      Array.from({ length: RINGS }, (_, i) => ({
        z: -i * SPACING,
        baseRoll: Math.random() * Math.PI,
        ci: i % 3,
      })),
    [],
  );

  useFrame((state, delta) => {
    const b = audioEngine.bands;
    const s = useStore.getState().settings;

    // forward speed: base + level + huge kick warp
    const speed =
      (8 + b.level * 34 * s.reactivity + b.kickLevel * 70 * s.bassPunch) * delta;
    offset.current += speed;

    // launch a wave-front on each kick (spawns far, travels toward camera)
    if (b.kick && !wasKick.current) {
      waveZ.current[waveNext.current] = -DEPTH;
      waveNext.current = (waveNext.current + 1) % WAVES;
    }
    wasKick.current = b.kick;
    for (let w = 0; w < WAVES; w++) {
      if (waveZ.current[w] < 8) waveZ.current[w] += speed * 2.4;
    }

    // barrel-roll: a quantised step on every beat + drift
    if (b.beat && !wasBeat.current) roll.current.v += 1.6 + b.beatLevel * 2;
    wasBeat.current = b.beat;
    roll.current.v *= 0.9;
    roll.current.a +=
      roll.current.v * 0.05 + delta * (0.15 + b.mid) * s.rotation;

    state.camera.position.x = Math.sin(state.clock.elapsedTime * 0.4) * b.lowMid * 1.4;
    state.camera.position.y = Math.cos(state.clock.elapsedTime * 0.3) * b.treble * 1.4;
    state.camera.rotation.z = roll.current.a;
    state.camera.rotation.x = 0;
    state.camera.rotation.y = 0;

    for (let i = 0; i < RINGS; i++) {
      const m = refs.current[i];
      if (!m) continue;
      let z = data[i].z + (offset.current % DEPTH);
      if (z > 4) z -= DEPTH;
      m.position.z = z;

      // proximity to any wave-front → fat glowing pulse ring
      let waveBoost = 0;
      for (let w = 0; w < WAVES; w++) {
        const d = Math.abs(z - waveZ.current[w]);
        if (d < 3) waveBoost = Math.max(waveBoost, (1 - d / 3) ** 2);
      }

      const r =
        1 +
        b.bass * 0.5 * s.reactivity +
        b.kickLevel * 0.45 * s.bassPunch +
        waveBoost * 0.9;
      m.scale.set(r, r, 1);
      m.rotation.z =
        data[i].baseRoll + b.time * (0.2 + b.mid) * (i % 2 ? 1 : -1);

      const fade = THREE.MathUtils.clamp(1 - Math.abs(z + 6) / 64, 0.04, 1);
      const mat = mats.current[i];
      if (mat) {
        mat.color
          .copy(colors[data[i].ci])
          .lerp(colors[1], waveBoost * 0.8 + b.beatLevel * 0.3);
        mat.opacity = fade * (0.8 + waveBoost + b.beatLevel * 0.4);
      }
    }
  });

  return (
    <>
      <fog attach="fog" args={['#000000', 6, 70]} />
      {data.map((d, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          geometry={ringGeo}
          position={[0, 0, d.z]}
        >
          <meshBasicMaterial
            ref={(m) => {
              if (m) mats.current[i] = m;
            }}
            color={colors[d.ci]}
            transparent
            toneMapped={false}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}
    </>
  );
}
