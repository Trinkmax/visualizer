import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { useStore } from '../state/store';
import { paletteColors } from '../lib/palette';

/** "Ecualizador" — a circular spectrum analyser: bars radiate from a ring and
 *  a live waveform loop pulses inside. The most literally audio-reactive one. */

const BARS = 64;
const WAVEN = 128;
const R = 3.2;

export function RadialEQ() {
  const palette = useStore((s) => s.settings.palette);
  const colors = paletteColors(palette);

  const inst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const grp = useRef<THREE.Group>(null);

  const waveGeo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array((WAVEN + 1) * 3), 3),
    );
    return g;
  }, []);

  useFrame(({ camera, clock }) => {
    const b = audioEngine.bands;
    const s = useStore.getState().settings;
    const react = s.reactivity;
    const kick = b.kickLevel * s.bassPunch;

    const m = inst.current;
    if (m) {
      for (let i = 0; i < BARS; i++) {
        const ang = (i / BARS) * Math.PI * 2;
        const v = b.spectrum[i] || 0;
        const h = 0.15 + Math.pow(v, 1.2) * (5 + react * 3) + kick * 0.6;
        const rr = R + h / 2;
        dummy.position.set(Math.cos(ang) * rr, Math.sin(ang) * rr, 0);
        dummy.rotation.set(0, 0, ang - Math.PI / 2);
        dummy.scale.set(0.12, h, 0.12);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
        const t = i / BARS;
        tmp
          .copy(colors[0])
          .lerp(colors[1], t)
          .lerp(colors[2], v);
        m.setColorAt(i, tmp);
      }
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }

    // inner waveform ring
    const wp = waveGeo.attributes.position.array as Float32Array;
    for (let i = 0; i <= WAVEN; i++) {
      const k = i % WAVEN;
      const ang = (i / WAVEN) * Math.PI * 2;
      const rr = R - 0.5 + b.wave[k] * (1.4 + react);
      wp[i * 3] = Math.cos(ang) * rr;
      wp[i * 3 + 1] = Math.sin(ang) * rr;
      wp[i * 3 + 2] = 0;
    }
    waveGeo.attributes.position.needsUpdate = true;

    if (grp.current) {
      grp.current.rotation.z += 0.0015 + b.mid * 0.02 * s.rotation;
      grp.current.scale.setScalar(1 + kick * 0.12);
    }
    const a = Math.sin(clock.elapsedTime * 0.1) * 0.4 * s.rotation;
    camera.position.set(Math.sin(a) * 2, 0, 11 - b.bass * 2);
    camera.lookAt(0, 0, 0);
    camera.rotation.z = 0;
  });

  return (
    <group ref={grp}>
      <instancedMesh
        ref={inst}
        args={[undefined, undefined, BARS]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>

      <lineLoop geometry={waveGeo} frustumCulled={false}>
        <lineBasicMaterial
          color={colors[1]}
          toneMapped={false}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineLoop>

      {/* faint core */}
      <mesh>
        <circleGeometry args={[R - 0.6, 64]} />
        <meshBasicMaterial
          color={colors[0]}
          transparent
          opacity={0.06}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
