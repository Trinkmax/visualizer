import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ScreenQuad } from '@react-three/drei';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { useStore } from '../state/store';
import { paletteColors } from '../lib/palette';

/** "Kaleido Fractal" — full-screen kaleidoscopic fractal melt. */

const fragment = /* glsl */ `
  precision highp float;
  uniform vec2  uRes;
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uBeat;
  uniform float uKick;
  uniform float uPhase;
  uniform float uReact;
  uniform vec3  uColorA;
  uniform vec3  uColorB;
  uniform vec3  uColorC;

  mat2 rot(float a){ return mat2(cos(a), -sin(a), sin(a), cos(a)); }

  void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float t = uTime * 0.25;

    // kaleidoscope fold — segment count pulses with mids
    float seg = 6.0 + floor(uMid * 8.0 * uReact);
    float a = atan(uv.y, uv.x);
    float r = length(uv);
    a = mod(a, 6.28318 / seg);
    a = abs(a - 3.14159 / seg);
    uv = vec2(cos(a), sin(a)) * r;

    // fractal zoom: bass swells, KICK punches it in hard
    uv *= 1.4 + sin(t) * 0.3 - uBass * 0.6 * uReact - uKick * 0.7;
    // rotation locked to tempo phase, with a snap on the kick
    uv *= rot(uPhase * 6.2831 + uBeat * 0.6 + uKick * 1.4);

    float fold = 0.7 + uBass * 0.5 * uReact + uKick * 0.35;
    float acc = 0.0;
    vec2 p = uv;
    for (int i = 0; i < 7; i++) {
      p = abs(p) / dot(p, p) - fold;
      p *= rot(t * 0.2 + float(i) * 0.3 + uPhase * 1.5);
      acc += exp(-length(p) * 1.6);
    }
    acc *= 0.5 + uTreble * 2.0 * uReact + uKick * 1.5;

    // cosine palette through the 3 brand colors
    vec3 col = mix(uColorA, uColorB, sin(acc * 3.0 + t * 2.0) * 0.5 + 0.5);
    col = mix(col, uColorC, sin(acc * 1.3 - t) * 0.5 + 0.5);
    col *= 0.25 + acc * (0.8 + uBeat * 1.2 + uKick * 2.0);
    // color strobe burst on the kick
    col += mix(uColorB, uColorC, uPhase) * uKick * 0.9;

    // soft vignette
    col *= 1.0 - r * 0.35;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const vertex = /* glsl */ `
  void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export function KaleidoFractal() {
  const palette = useStore((s) => s.settings.palette);
  const colors = paletteColors(palette);
  const { size, viewport } = useThree();
  const ref = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uBeat: { value: 0 },
      uKick: { value: 0 },
      uPhase: { value: 0 },
      uReact: { value: 1 },
      uColorA: { value: colors[0].clone() },
      uColorB: { value: colors[1].clone() },
      uColorC: { value: colors[2].clone() },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(() => {
    const b = audioEngine.bands;
    const s = useStore.getState().settings;
    const u = uniforms;
    u.uRes.value.set(size.width * viewport.dpr, size.height * viewport.dpr);
    u.uTime.value = b.time;
    u.uBass.value = b.bass;
    u.uMid.value = b.mid;
    u.uTreble.value = b.treble;
    u.uBeat.value = b.beatLevel;
    u.uKick.value = b.kickLevel;
    u.uPhase.value = b.beatPhase;
    u.uReact.value = s.reactivity;
    u.uColorA.value.copy(colors[0]);
    u.uColorB.value.copy(colors[1]);
    u.uColorC.value.copy(colors[2]);
  });

  return (
    <ScreenQuad>
      <shaderMaterial
        ref={ref}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        depthWrite={false}
        depthTest={false}
      />
    </ScreenQuad>
  );
}
