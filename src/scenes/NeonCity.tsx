import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { useStore } from '../state/store';
import { paletteColors } from '../lib/palette';

/** "Ciudad Neón" — synthwave: endless glowing grid floor, a banded sun on the
 *  horizon and wireframe buildings rising/scrolling with the spectrum. */

const ROWS = 22;
const PER_ROW = 2;
const COUNT = ROWS * PER_ROW;
const SPACING = 7;
const RUN = ROWS * SPACING;

const floorFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime, uBass, uBeat;
  uniform vec3 uColor, uColor2;
  void main(){
    vec2 g = vec2(vUv.x * 60.0, vUv.y * 120.0 - uTime);
    vec2 f = abs(fract(g) - 0.5);
    float line = min(f.x, f.y);
    float grid = smoothstep(0.045, 0.0, line);
    float glow = 0.25 + uBass * 1.4 + uBeat * 0.6;
    float depth = smoothstep(0.0, 0.45, vUv.y); // fade to horizon
    vec3 col = mix(uColor, uColor2, vUv.y) * grid * glow * depth;
    gl_FragColor = vec4(col, grid * depth);
  }
`;
const floorVert = /* glsl */ `
  varying vec2 vUv;
  void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
`;

const sunFrag = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTreble, uMid;
  uniform vec3 uColorA, uColorB;
  void main(){
    vec2 p = vUv * 2.0 - 1.0;
    float d = length(p);
    if (d > 1.0) discard;
    vec3 col = mix(uColorB, uColorA, vUv.y);
    // horizontal bands, thicker toward the bottom, pulsing with treble
    float band = smoothstep(0.0, 0.5, vUv.y);
    float stripes = step(0.5, fract(vUv.y * 22.0 + uMid * 4.0));
    float mask = mix(1.0, stripes, 1.0 - band) ;
    float halo = smoothstep(1.0, 0.2, d) * (1.2 + uTreble);
    gl_FragColor = vec4(col * halo * mask, (1.0 - d) * mask);
  }
`;

export function NeonCity() {
  const palette = useStore((s) => s.settings.palette);
  const colors = paletteColors(palette);

  const inst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const offset = useRef(0);

  const blds = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const row = Math.floor(i / PER_ROW);
        const side = i % PER_ROW === 0 ? -1 : 1;
        return {
          x: side * (6 + Math.random() * 9),
          z: -row * SPACING - Math.random() * 2,
          w: 2 + Math.random() * 2.5,
          bin: 2 + ((i * 5) % 40),
          h: 3 + Math.random() * 6,
        };
      }),
    [],
  );

  const floorU = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uBeat: { value: 0 },
      uColor: { value: colors[0].clone() },
      uColor2: { value: colors[1].clone() },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const sunU = useMemo(
    () => ({
      uTreble: { value: 0 },
      uMid: { value: 0 },
      uColorA: { value: colors[1].clone() },
      uColorB: { value: colors[2].clone() },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame((state, delta) => {
    const b = audioEngine.bands;
    const s = useStore.getState().settings;
    const react = s.reactivity;

    const speed =
      delta * (8 + b.level * 26 * react + b.kickLevel * 30 * s.bassPunch);
    offset.current += speed;

    floorU.uTime.value = (offset.current % RUN) * (120 / RUN) * 0.5 + b.time * 2;
    floorU.uBass.value = b.bass * react;
    floorU.uBeat.value = b.beatLevel;
    floorU.uColor.value.copy(colors[0]);
    floorU.uColor2.value.copy(colors[1]);
    sunU.uTreble.value = b.treble * react;
    sunU.uMid.value = b.mid;
    sunU.uColorA.value.copy(colors[1]);
    sunU.uColorB.value.copy(colors[2]);

    const m = inst.current;
    if (m) {
      for (let i = 0; i < COUNT; i++) {
        const d = blds[i];
        let z = d.z + (offset.current % RUN);
        if (z > 8) z -= RUN;
        const sp = b.spectrum[d.bin] || 0;
        const h =
          1 + Math.pow(sp, 1.3) * d.h * (1 + react) + b.kickLevel * 3 * s.bassPunch;
        dummy.position.set(d.x, h / 2, z);
        dummy.scale.set(d.w, h, d.w);
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        m.setMatrixAt(i, dummy.matrix);
      }
      m.instanceMatrix.needsUpdate = true;
    }

    const a = Math.sin(state.clock.elapsedTime * 0.1) * 0.6 * s.rotation;
    state.camera.position.set(a, 2.4 + b.bass * 0.8, 9);
    state.camera.lookAt(a * 0.5, 2.2, -40);
    state.camera.rotation.z = a * 0.04;
  });

  return (
    <>
      <fog attach="fog" args={['#000000', 20, 90]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -38]}>
        <planeGeometry args={[160, 200, 1, 1]} />
        <shaderMaterial
          vertexShader={floorVert}
          fragmentShader={floorFrag}
          uniforms={floorU}
          transparent
          depthWrite={false}
        />
      </mesh>

      <mesh position={[0, 7, -78]}>
        <circleGeometry args={[13, 64]} />
        <shaderMaterial
          vertexShader={floorVert}
          fragmentShader={sunFrag}
          uniforms={sunU}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      <instancedMesh
        ref={inst}
        args={[undefined, undefined, COUNT]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial
          color={colors[0]}
          wireframe
          toneMapped={false}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </instancedMesh>
    </>
  );
}
