import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { ScreenQuad } from '@react-three/drei';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { useStore } from '../state/store';
import { paletteColors } from '../lib/palette';
import { SIMPLEX3 } from '../lib/glsl';

/** "Plasma" — organic domain-warped lava that flows with the tempo and melts
 *  on the kick. (No kaleidoscope fold — pure liquid psychedelia.) */

const fragment = /* glsl */ `
  precision highp float;
  uniform vec2  uRes;
  uniform float uTime, uBass, uMid, uTreble, uKick, uPhase, uReact;
  uniform vec3  uA, uB, uC;
  ${SIMPLEX3}

  float fbm(vec3 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++){ v += a * snoise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  void main(){
    vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
    float t = uTime * 0.18 + uPhase * 0.6;
    uv *= 1.0 - uKick * 0.35;                 // zoom punch on the kick

    vec3 p = vec3(uv * (2.2 + uBass * 1.2 * uReact), t);
    // domain warp → swirling liquid
    vec3 q = vec3(fbm(p + 1.7), fbm(p + 9.2), fbm(p - 3.3));
    float n = fbm(p + q * (1.6 + uMid * 2.5 * uReact) + uKick);

    float v = n * 0.5 + 0.5;
    vec3 col = mix(uA, uB, smoothstep(0.2, 0.7, v));
    col = mix(col, uC, smoothstep(0.55, 1.0, v + uTreble * 0.4));
    col *= 0.5 + v * (1.0 + uBass * 1.6 * uReact) + uKick * 1.4;
    col += uC * pow(max(0.0, q.x), 3.0) * (0.4 + uTreble);

    float r = length(uv);
    col *= 1.0 - r * 0.28;
    gl_FragColor = vec4(col, 1.0);
  }
`;
const vertex = /* glsl */ `void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export function PlasmaFlow() {
  const palette = useStore((s) => s.settings.palette);
  const colors = paletteColors(palette);
  const { size, viewport } = useThree();
  const ref = useRef<THREE.ShaderMaterial>(null);

  const u = useMemo(
    () => ({
      uRes: { value: new THREE.Vector2(1, 1) },
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uKick: { value: 0 },
      uPhase: { value: 0 },
      uReact: { value: 1 },
      uA: { value: colors[0].clone() },
      uB: { value: colors[1].clone() },
      uC: { value: colors[2].clone() },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(() => {
    const b = audioEngine.bands;
    const s = useStore.getState().settings;
    u.uRes.value.set(size.width * viewport.dpr, size.height * viewport.dpr);
    u.uTime.value = b.time;
    u.uBass.value = b.bass;
    u.uMid.value = b.mid;
    u.uTreble.value = b.treble;
    u.uKick.value = b.kickLevel;
    u.uPhase.value = b.beatPhase;
    u.uReact.value = s.reactivity;
    u.uA.value.copy(colors[0]);
    u.uB.value.copy(colors[1]);
    u.uC.value.copy(colors[2]);
  });

  return (
    <ScreenQuad>
      <shaderMaterial
        ref={ref}
        uniforms={u}
        vertexShader={vertex}
        fragmentShader={fragment}
        depthWrite={false}
        depthTest={false}
      />
    </ScreenQuad>
  );
}
