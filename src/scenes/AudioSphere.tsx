import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { useStore } from '../state/store';
import { paletteColors } from '../lib/palette';
import { SIMPLEX3 } from '../lib/glsl';

/** "Esfera" — a breathing wireframe icosphere: bass inflates it, treble grows
 *  spikes, and the kick fires an outward shock pulse. */

const vertex = /* glsl */ `
  uniform float uTime, uBass, uTreble, uKick, uReact;
  varying float vDisp;
  ${SIMPLEX3}
  void main(){
    vec3 n = normalize(position);
    float t = uTime * 0.4;
    float big = snoise(n * 1.4 + t);
    float fine = snoise(n * 4.0 - t * 1.3);
    float disp =
      big * (0.5 + uBass * 2.2 * uReact) +
      fine * (0.15 + uTreble * 1.4 * uReact) +
      uKick * 1.4;
    vDisp = disp;
    vec3 p = position + n * disp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const fragment = /* glsl */ `
  precision highp float;
  uniform vec3 uA, uB, uC;
  uniform float uKick;
  varying float vDisp;
  void main(){
    float k = clamp(vDisp * 0.6 + 0.5, 0.0, 1.0);
    vec3 col = mix(uA, uB, k);
    col = mix(col, uC, smoothstep(0.6, 1.1, k + uKick));
    gl_FragColor = vec4(col * (1.1 + uKick * 1.5), 1.0);
  }
`;

export function AudioSphere() {
  const palette = useStore((s) => s.settings.palette);
  const colors = paletteColors(palette);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(2.4, 24), []);
  const core = useMemo(() => new THREE.IcosahedronGeometry(1, 3), []);
  const grp = useRef<THREE.Group>(null);

  const u = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uTreble: { value: 0 },
      uKick: { value: 0 },
      uReact: { value: 1 },
      uA: { value: colors[0].clone() },
      uB: { value: colors[1].clone() },
      uC: { value: colors[2].clone() },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ camera, clock }) => {
    const b = audioEngine.bands;
    const s = useStore.getState().settings;
    u.uTime.value = b.time;
    u.uBass.value = b.bass;
    u.uTreble.value = b.treble;
    u.uKick.value = b.kickLevel;
    u.uReact.value = s.reactivity;
    u.uA.value.copy(colors[0]);
    u.uB.value.copy(colors[1]);
    u.uC.value.copy(colors[2]);

    if (grp.current) {
      grp.current.rotation.y += 0.0025 + b.mid * 0.04 * s.rotation;
      grp.current.rotation.x = Math.sin(b.time * 0.2) * 0.3;
      const sc = 1 + b.kickLevel * 0.18 * s.bassPunch;
      grp.current.scale.setScalar(sc);
    }
    const a = clock.elapsedTime * 0.15 * s.rotation;
    const dist = 8.5 - b.bass * 1.5;
    camera.position.set(Math.sin(a) * dist, Math.sin(a * 0.5) * 2, Math.cos(a) * dist);
    camera.lookAt(0, 0, 0);
  });

  return (
    <group ref={grp}>
      <mesh geometry={geo}>
        <shaderMaterial
          uniforms={u}
          vertexShader={vertex}
          fragmentShader={fragment}
          wireframe
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={core}>
        <meshBasicMaterial
          color={colors[1]}
          transparent
          opacity={0.12}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
