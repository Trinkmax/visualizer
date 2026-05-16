import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { useStore } from '../state/store';
import { paletteColors } from '../lib/palette';

/**
 * "Alien Rave" — a crowd of glowing wireframe humanoids dancing *in tempo*.
 * Bounce locks to the beat phase, big jumps + squash fire on the kick, arms
 * throw up on broadband onsets, and shock rings burst from the floor on hits.
 */

const COUNT = 26;
const SHOCKS = 5;

type FigureDef = {
  x: number;
  z: number;
  scale: number;
  phase: number;
  speed: number;
  colorIdx: number;
};

function buildCrowd(): FigureDef[] {
  const out: FigureDef[] = [];
  for (let i = 0; i < COUNT; i++) {
    const ring = Math.floor(i / 7);
    const a = (i * 2.39996) % (Math.PI * 2);
    const r = 2.2 + ring * 2.4 + Math.random() * 1.3;
    out.push({
      x: Math.cos(a) * r,
      z: -2 - Math.sin(a) * r - ring * 1.5,
      scale: 0.85 + Math.random() * 0.9 - ring * 0.06,
      phase: Math.random() * Math.PI * 2,
      speed: 0.7 + Math.random() * 0.7,
      colorIdx: i % 3,
    });
  }
  return out;
}

function Figure({
  def,
  geos,
  color,
}: {
  def: FigureDef;
  geos: {
    head: THREE.BufferGeometry;
    body: THREE.BufferGeometry;
    limb: THREE.BufferGeometry;
    core: THREE.BufferGeometry;
  };
  color: THREE.Color;
}) {
  const root = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const spin = useRef({ a: 0, v: 0 });
  const wasBeat = useRef(false);

  useFrame(() => {
    const b = audioEngine.bands;
    const s = useStore.getState().settings;
    const react = s.reactivity;
    const g = root.current;
    if (!g) return;

    // tempo-locked bounce: rides the beat-phase grid, not random sine
    const ph = b.beatPhase * Math.PI * 2 + def.phase * 0.6;
    const tempoBob = Math.abs(Math.sin(ph));
    const groove = b.bass * 1.2 + b.kickLevel * 0.8;
    const pop = b.kickLevel * s.bassPunch;

    g.position.y =
      -0.2 + tempoBob * (0.16 + groove * 0.5 * react) + pop * 0.45;

    // squash & stretch on the kick
    const sx = 1 - pop * 0.14 + b.treble * 0.06 * react;
    const sy = 1 + pop * 0.26 + groove * 0.12 * react;
    g.scale.set(def.scale * sx, def.scale * sy, def.scale * sx);

    // spin: continuous groove + an angular kick on every beat
    if (b.beat && !wasBeat.current) spin.current.v += (def.colorIdx % 2 ? 1 : -1) * (1.4 + b.beatLevel * 2.5) * react;
    wasBeat.current = b.beat;
    spin.current.v *= 0.92;
    spin.current.a += spin.current.v * 0.03 + Math.sin(ph) * 0.01;
    g.rotation.y = spin.current.a + b.time * s.rotation * 0.1;
    g.rotation.z = Math.sin(ph * 0.5 + def.phase) * 0.14 * (1 + groove);

    // arms thrown up on the beat / treble
    const swing = 0.5 + (b.beatLevel + b.treble) * 2.6 * react + pop * 1.1;
    if (armL.current)
      armL.current.rotation.z = -0.5 - Math.abs(Math.sin(ph)) * swing;
    if (armR.current)
      armR.current.rotation.z = 0.5 + Math.abs(Math.sin(ph + 1)) * swing;

    // big alien head-bang on tempo
    if (head.current) {
      head.current.rotation.x = Math.sin(ph) * 0.28 * (1 + groove);
      head.current.rotation.z = Math.sin(ph * 0.5) * 0.22;
    }
  });

  const wire = useMemo(
    () => (
      <meshBasicMaterial
        color={color}
        wireframe
        transparent
        opacity={0.95}
        toneMapped={false}
      />
    ),
    [color],
  );
  const glow = useMemo(
    () => (
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.18}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    ),
    [color],
  );

  return (
    <group ref={root} position={[def.x, 0, def.z]}>
      <mesh geometry={geos.body} position={[0, 0.55, 0]}>{wire}</mesh>
      <mesh geometry={geos.core} position={[0, 0.55, 0]} scale={[0.34, 0.62, 0.26]}>
        {glow}
      </mesh>
      <group ref={head} position={[0, 1.32, 0]}>
        <mesh geometry={geos.head}>{wire}</mesh>
        <mesh geometry={geos.core} scale={0.46}>
          {glow}
        </mesh>
      </group>
      <group ref={armL} position={[-0.34, 0.92, 0]}>
        <mesh geometry={geos.limb} position={[0, -0.42, 0]}>{wire}</mesh>
      </group>
      <group ref={armR} position={[0.34, 0.92, 0]}>
        <mesh geometry={geos.limb} position={[0, -0.42, 0]}>{wire}</mesh>
      </group>
      <mesh geometry={geos.limb} position={[-0.15, -0.18, 0]}>{wire}</mesh>
      <mesh geometry={geos.limb} position={[0.15, -0.18, 0]}>{wire}</mesh>
    </group>
  );
}

/** Expanding light rings that burst from the floor on every kick. */
function ShockRings({ color }: { color: THREE.Color }) {
  const ring = useMemo(() => new THREE.RingGeometry(1, 1.06, 96), []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  const life = useRef<number[]>(Array(SHOCKS).fill(99));
  const next = useRef(0);
  const wasKick = useRef(false);

  useFrame((_, dt) => {
    const b = audioEngine.bands;
    if (b.kick && !wasKick.current) {
      life.current[next.current] = 0;
      next.current = (next.current + 1) % SHOCKS;
    }
    wasKick.current = b.kick;

    for (let i = 0; i < SHOCKS; i++) {
      const m = refs.current[i];
      if (!m) continue;
      const t = (life.current[i] += dt);
      const k = Math.min(t / 1.1, 1);
      const visible = k < 1;
      m.visible = visible;
      if (visible) {
        const sc = 0.6 + k * 14;
        m.scale.set(sc, sc, sc);
        (m.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.7;
      }
    }
  });

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.58, -4]}>
      {Array.from({ length: SHOCKS }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          geometry={ring}
          visible={false}
        >
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export function AlienRave() {
  const palette = useStore((s) => s.settings.palette);
  const colors = paletteColors(palette);

  const geos = useMemo(
    () => ({
      head: new THREE.IcosahedronGeometry(0.42, 3),
      body: new THREE.CapsuleGeometry(0.28, 0.7, 6, 14),
      limb: new THREE.CapsuleGeometry(0.085, 0.62, 4, 8),
      core: new THREE.IcosahedronGeometry(1, 2),
    }),
    [],
  );

  const crowd = useMemo(buildCrowd, []);
  const group = useRef<THREE.Group>(null);
  const shake = useRef(0);
  const wasKick = useRef(false);

  useFrame(({ camera, clock }) => {
    const b = audioEngine.bands;
    const s = useStore.getState().settings;

    if (b.kick && !wasKick.current) shake.current = 1;
    wasKick.current = b.kick;
    shake.current *= 0.86;

    const a = clock.elapsedTime * 0.06 * s.rotation;
    const dist = 11 - b.kickLevel * 3 * s.reactivity;
    camera.position.x =
      Math.sin(a) * dist + (Math.random() - 0.5) * shake.current * 0.5;
    camera.position.z = Math.cos(a) * dist + 4;
    camera.position.y =
      1.6 + Math.sin(clock.elapsedTime * 0.2) * 0.5 + b.kickLevel * 0.6;
    camera.lookAt(0, 0.8, -3);
    if (group.current)
      group.current.rotation.y = Math.sin(a * 0.5) * 0.1;
  });

  return (
    <>
      <fog attach="fog" args={['#000000', 9, 26]} />
      <group ref={group}>
        {crowd.map((d, i) => (
          <Figure key={i} def={d} geos={geos} color={colors[d.colorIdx]} />
        ))}
        <ShockRings color={colors[1]} />
        <gridHelper
          args={[60, 60, colors[0], colors[0]]}
          position={[0, -0.6, -4]}
        />
      </group>
    </>
  );
}
