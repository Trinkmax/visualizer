import { Suspense, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise,
  HueSaturation,
  BrightnessContrast,
  Glitch,
} from '@react-three/postprocessing';
import { KernelSize, BlendFunction, GlitchMode } from 'postprocessing';
import * as THREE from 'three';
import { audioEngine } from '../audio/AudioEngine';
import { useStore } from '../state/store';
import { SCENE_COMPONENTS } from '../scenes';

/** Pumps the audio analyser once per frame (delta-timed), before scenes read it. */
function AudioPump() {
  useFrame((_, delta) => {
    const s = useStore.getState().settings;
    audioEngine.gain = s.gain;
    audioEngine.smoothing = s.smoothing;
    audioEngine.beatSensitivity = s.beatSensitivity;
    audioEngine.update(delta);
  });
  return null;
}

function SceneHost() {
  const idx = useStore((s) => s.sceneIndex);
  const Scene = SCENE_COMPONENTS[idx] ?? SCENE_COMPONENTS[0];
  return (
    <Suspense fallback={null}>
      <Scene />
    </Suspense>
  );
}

function Effects() {
  const bloom = useRef<any>(null);
  const chroma = useRef<any>(null);
  const hue = useRef<any>(null);
  const vignette = useRef<any>(null);
  const bright = useRef<any>(null);
  const glitch = useRef<any>(null);

  useFrame(() => {
    const b = audioEngine.bands;
    const s = useStore.getState().settings;

    if (bloom.current) {
      // bloom swells with the music, punches on the kick
      bloom.current.intensity =
        s.bloom +
        b.kickLevel * 1.7 * s.bassPunch +
        b.beatLevel * 0.7 +
        b.level * 0.4;
    }
    if (chroma.current?.offset) {
      const amt =
        s.chroma * (1 + b.kickLevel * 9 + b.beatLevel * 4 + b.treble * 3);
      chroma.current.offset.set(amt, amt * 0.6);
    }
    if (hue.current) {
      hue.current.hue =
        (b.time * s.hueCycle * (Math.PI / 180) +
          b.beatLevel * 0.55 +
          b.kickLevel * 0.3) %
        (Math.PI * 2);
    }
    if (vignette.current) {
      vignette.current.darkness = s.vignette + b.kickLevel * 0.22;
    }
    // strobe / flash pop on the beat (the "alucinar" hit)
    const bc = bright.current?.uniforms?.get?.('brightness');
    if (bc) {
      bc.value = (b.beatLevel * 0.45 + b.kickLevel * 0.7) * s.flash;
    }
    // glitch burst only on strong kicks, scaled by the setting
    if (glitch.current) {
      glitch.current.mode =
        s.glitch > 0.001 && b.kickLevel > 0.78 - s.glitch * 0.4
          ? GlitchMode.CONSTANT_MILD
          : GlitchMode.DISABLED;
    }
  });

  const s = useStore((st) => st.settings);

  return (
    <EffectComposer multisampling={4}>
      <Bloom
        ref={bloom}
        intensity={s.bloom}
        luminanceThreshold={s.bloomThreshold}
        luminanceSmoothing={0.4}
        mipmapBlur
        radius={0.7 + s.trails * 0.3}
        kernelSize={KernelSize.HUGE}
      />
      <ChromaticAberration
        ref={chroma}
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(s.chroma, s.chroma)}
        radialModulation={false}
        modulationOffset={0}
      />
      <HueSaturation ref={hue} hue={0} saturation={0.18} />
      <BrightnessContrast ref={bright} brightness={0} contrast={0.06} />
      <Vignette ref={vignette} eskil={false} offset={0.2} darkness={s.vignette} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={s.grain} />
      <Glitch
        ref={glitch}
        delay={new THREE.Vector2(10, 10)}
        duration={new THREE.Vector2(0.1, 0.25)}
        strength={new THREE.Vector2(0.1, 0.45)}
        mode={GlitchMode.DISABLED}
        active
        ratio={0.82}
      />
    </EffectComposer>
  );
}

function AutoCycle() {
  const autoCycle = useStore((s) => s.settings.autoCycle);
  const cycleSeconds = useStore((s) => s.settings.cycleSeconds);
  const nextScene = useStore((s) => s.nextScene);

  useEffect(() => {
    if (!autoCycle) return;
    const id = setInterval(nextScene, Math.max(4, cycleSeconds) * 1000);
    return () => clearInterval(id);
  }, [autoCycle, cycleSeconds, nextScene]);

  return null;
}

export function Visualizer() {
  return (
    <>
      <AutoCycle />
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.NoToneMapping,
        }}
        camera={{ fov: 62, position: [0, 1.5, 12], near: 0.1, far: 200 }}
      >
        <color attach="background" args={['#000000']} />
        <AudioPump />
        <SceneHost />
        <Effects />
      </Canvas>
    </>
  );
}
