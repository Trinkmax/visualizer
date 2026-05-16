import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { useStore } from '../state/store';
import { paletteColors } from '../lib/palette';

/** "Particle Nebula" — a curl-noise particle galaxy that breathes with the music.
 *  The full buffer is allocated once; the live count is controlled cheaply with
 *  geometry.setDrawRange (no re-allocation / GC while dragging the slider). */

const MAX_PARTICLES = 80000;

const vertex = /* glsl */ `
  uniform float uTime;
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uBeat;
  uniform float uKick;
  uniform float uPhase;
  uniform float uReact;
  uniform float uSize;
  attribute float aSeed;
  varying float vMix;
  varying float vGlow;

  // Ashima simplex noise (https://github.com/ashima/webgl-noise)
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod(i,289.0);
    vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=1.0/7.0;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  void main(){
    vec3 p = position;
    float t = uTime * 0.12;
    // domain-warped curl-ish flow
    vec3 q = p * 0.45 + vec3(t, t * 0.7, -t);
    float n1 = snoise(q);
    float n2 = snoise(q.yzx + 11.0);
    float n3 = snoise(q.zxy - 7.0);
    vec3 flow = vec3(n1, n2, n3);

    float bass = uBass * uReact;
    float radius = length(p);
    vec3 dir = normalize(p);

    // breathe out on bass, swirl by mids, shimmer by treble
    p += dir * bass * 3.4;
    p += flow * (1.4 + uMid * 4.0 * uReact);
    p += dir * uBeat * 1.8;

    // KICK shockwave: an expanding shell that shoves particles outward as the
    // wave-front (driven by the kick envelope) sweeps past their radius
    float front = uKick * 9.0;
    float shell = exp(-pow(radius - front, 2.0) * 0.5) * uKick;
    p += dir * shell * 4.5;

    // swirl locked to the tempo phase (grooves between hits)
    float ang = t + radius * 0.1 + uPhase * 6.2831 * 0.25 + uKick * 1.2;
    p.xz *= mat2(cos(ang), -sin(ang), sin(ang), cos(ang));

    vMix = clamp(radius / 9.0 + n1 * 0.3 + shell * 0.6, 0.0, 1.0);
    vGlow = 0.4 + uTreble * 1.6 + uBeat * 0.8 + shell * 2.5;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float size =
      uSize * (1.0 + bass * 2.0 + uBeat + uKick * 2.5 + shell * 3.0) *
      (300.0 / -mv.z);
    gl_PointSize = clamp(size * (0.6 + aSeed), 1.0, 42.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uColorC;
  varying float vMix;
  varying float vGlow;

  void main(){
    vec2 uv = gl_PointCoord - 0.5;
    float d = length(uv);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.0, d);
    vec3 col = mix(uColorA, uColorB, smoothstep(0.0, 0.55, vMix));
    col = mix(col, uColorC, smoothstep(0.55, 1.0, vMix));
    gl_FragColor = vec4(col * vGlow, soft * soft);
  }
`;

export function ParticleNebula() {
  const palette = useStore((s) => s.settings.palette);
  const count = useStore((s) => s.settings.nebulaParticles);
  const colors = paletteColors(palette);
  const mat = useRef<THREE.ShaderMaterial>(null);

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const pos = new Float32Array(MAX_PARTICLES * 3);
    const seed = new Float32Array(MAX_PARTICLES);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      // distribute through a fuzzy ball using gaussian-ish sampling
      const u = Math.random();
      const v = Math.random();
      const th = Math.acos(2 * u - 1);
      const ph = 2 * Math.PI * v;
      const r = 2 + Math.pow(Math.random(), 0.6) * 6;
      pos[i * 3] = r * Math.sin(th) * Math.cos(ph);
      pos[i * 3 + 1] = r * Math.sin(th) * Math.sin(ph) * 0.7;
      pos[i * 3 + 2] = r * Math.cos(th);
      seed[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    return g;
  }, []);

  // Live particle count — only draws the first `count` points of the buffer.
  useEffect(() => {
    geometry.setDrawRange(0, Math.min(count, MAX_PARTICLES));
  }, [count, geometry]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uTreble: { value: 0 },
      uBeat: { value: 0 },
      uKick: { value: 0 },
      uPhase: { value: 0 },
      uReact: { value: 1 },
      uSize: { value: 0.5 },
      uColorA: { value: colors[0].clone() },
      uColorB: { value: colors[1].clone() },
      uColorC: { value: colors[2].clone() },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useFrame(({ camera, clock }) => {
    const b = audioEngine.bands;
    const s = useStore.getState().settings;
    const u = uniforms;
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

    const a = clock.elapsedTime * 0.12 * s.rotation;
    const dist = 13 - b.kickLevel * 4 * s.reactivity;
    camera.position.set(
      Math.sin(a) * dist,
      Math.sin(a * 0.6) * 3 + b.beatLevel * 0.6,
      Math.cos(a) * dist,
    );
    camera.lookAt(0, 0, 0);
  });

  return (
    <points geometry={geometry}>
      <shaderMaterial
        ref={mat}
        uniforms={uniforms}
        vertexShader={vertex}
        fragmentShader={fragment}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
