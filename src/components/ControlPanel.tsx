import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  PALETTES,
  PRESETS,
  SCENES,
  SCENE_INFO,
  useStore,
  type PaletteName,
} from '../state/store';

/* ---------- small building blocks ---------- */

function Slider({
  label,
  value,
  min,
  max,
  step,
  left,
  right,
  fmt,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  left?: string;
  right?: string;
  fmt?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const fill: CSSProperties = {
    background: `linear-gradient(to right, var(--neon) 0%, var(--neon) ${pct}%, rgba(255,255,255,0.1) ${pct}%, rgba(255,255,255,0.1) 100%)`,
  };
  return (
    <div className="ctl">
      <div className="ctl-row">
        <span className="ctl-label">{label}</span>
        <span className="ctl-val">{fmt ? fmt(value) : value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={fill}
      />
      {(left || right) && (
        <div className="ctl-ends">
          <span>{left}</span>
          <span>{right}</span>
        </div>
      )}
    </div>
  );
}

function Toggle({
  label,
  on,
  onChange,
}: {
  label: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className={`toggle${on ? ' on' : ''}`}
      onClick={() => onChange(!on)}
      type="button"
    >
      <span className="knob" />
      <span>{label}</span>
    </button>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="sec">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

/* ---------- the panel ---------- */

export function ControlPanel() {
  const uiHidden = useStore((s) => s.uiHidden);
  const sceneIndex = useStore((s) => s.sceneIndex);
  const s = useStore((st) => st.settings);
  const setScene = useStore((st) => st.setScene);
  const patch = useStore((st) => st.patch);
  const reset = useStore((st) => st.reset);

  const [open, setOpen] = useState(true);
  const [advanced, setAdvanced] = useState(false);

  if (uiHidden) return null;

  const partyOn = s.flash > 0 || s.glitch > 0;

  function fullscreen() {
    if (!document.fullscreenElement)
      document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }

  if (!open) {
    return (
      <button className="panel-fab" onClick={() => setOpen(true)} type="button">
        🎛
      </button>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">🎛 FIESTA INFINITA</span>
        <button className="x" onClick={() => setOpen(false)} type="button">
          ✕
        </button>
      </div>

      <div className="panel-body">
        <Section title="Escena">
          <div className="grid">
            {SCENES.map((name, i) => (
              <button
                key={name}
                type="button"
                className={`tile${i === sceneIndex ? ' active' : ''}`}
                onClick={() => setScene(i)}
              >
                {SCENE_INFO[name].label}
              </button>
            ))}
          </div>
          <p className="desc">{SCENE_INFO[SCENES[sceneIndex]].desc}</p>
        </Section>

        <Section title="Vibe (1 clic)">
          <div className="chips">
            {Object.keys(PRESETS).map((name) => (
              <button
                key={name}
                type="button"
                className="chip"
                onClick={() => patch(PRESETS[name])}
              >
                {name}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Color">
          <div className="palettes">
            {(Object.keys(PALETTES) as PaletteName[]).map((name) => (
              <button
                key={name}
                type="button"
                title={name}
                className={`sw${s.palette === name ? ' active' : ''}`}
                style={{
                  background: `linear-gradient(135deg, ${PALETTES[name][0]}, ${PALETTES[name][1]}, ${PALETTES[name][2]})`,
                }}
                onClick={() => patch({ palette: name })}
              />
            ))}
          </div>
        </Section>

        <Section title="Ajustes principales">
          <Slider
            label="Reacción a la música"
            value={s.reactivity}
            min={0}
            max={3}
            step={0.05}
            left="Sutil"
            right="Intenso"
            onChange={(v) => patch({ reactivity: v })}
          />
          <Slider
            label="Golpe de graves"
            value={s.bassPunch}
            min={0}
            max={3}
            step={0.05}
            left="Suave"
            right="Brutal"
            onChange={(v) => patch({ bassPunch: v })}
          />
          <Slider
            label="Brillo / Glow"
            value={s.bloom}
            min={0}
            max={4}
            step={0.05}
            left="Tenue"
            right="Cegador"
            onChange={(v) => patch({ bloom: v })}
          />
          <Slider
            label="Movimiento de cámara"
            value={s.rotation}
            min={0}
            max={1.6}
            step={0.05}
            left="Quieto"
            right="Rápido"
            onChange={(v) => patch({ rotation: v })}
          />
          <Slider
            label="Sensibilidad del ritmo"
            value={s.beatSensitivity}
            min={1.02}
            max={2.2}
            step={0.01}
            left="Detecta todo"
            right="Solo fuertes"
            onChange={(v) => patch({ beatSensitivity: v })}
          />
        </Section>

        {sceneIndex === 2 && (
          <Section title="Nebulosa">
            <Slider
              label="Cantidad de partículas"
              value={s.nebulaParticles}
              min={1000}
              max={80000}
              step={500}
              fmt={(v) => `${Math.round(v / 1000)}k`}
              onChange={(v) => patch({ nebulaParticles: v })}
            />
          </Section>
        )}

        <Section title="Efectos locos">
          <Toggle
            label="Modo fiesta (strobe + glitch)"
            on={partyOn}
            onChange={(v) =>
              patch(
                v
                  ? { flash: 0.28, glitch: 0.16, chroma: Math.max(s.chroma, 0.0018) }
                  : { flash: 0, glitch: 0 },
              )
            }
          />
          <Toggle
            label="Cambiar de escena solo (VJ)"
            on={s.autoCycle}
            onChange={(v) => patch({ autoCycle: v })}
          />
          {s.autoCycle && (
            <Slider
              label="Cada cuánto cambia"
              value={s.cycleSeconds}
              min={4}
              max={90}
              step={1}
              fmt={(v) => `${v | 0}s`}
              onChange={(v) => patch({ cycleSeconds: v })}
            />
          )}
        </Section>

        <button
          className="more"
          type="button"
          onClick={() => setAdvanced((a) => !a)}
        >
          {advanced ? '▾ Ocultar avanzado' : '▸ Ajustes avanzados'}
        </button>

        {advanced && (
          <Section title="Avanzado">
            <Slider
              label="Captación de audio (volumen)"
              value={s.gain}
              min={0.2}
              max={4}
              step={0.05}
              left="Bajo"
              right="Alto"
              onChange={(v) => patch({ gain: v })}
            />
            <Slider
              label="Suavidad del movimiento"
              value={s.smoothing}
              min={0}
              max={0.96}
              step={0.01}
              left="Nervioso"
              right="Fluido"
              onChange={(v) => patch({ smoothing: v })}
            />
            <Slider
              label="Estela / smear"
              value={s.trails}
              min={0}
              max={1}
              step={0.01}
              onChange={(v) => patch({ trails: v })}
            />
            <Slider
              label="Aberración cromática"
              value={s.chroma}
              min={0}
              max={0.02}
              step={0.0005}
              fmt={(v) => v.toFixed(4)}
              onChange={(v) => patch({ chroma: v })}
            />
            <Slider
              label="Giro de color (°/s)"
              value={s.hueCycle}
              min={0}
              max={60}
              step={1}
              fmt={(v) => `${v | 0}°`}
              onChange={(v) => patch({ hueCycle: v })}
            />
            <Slider
              label="Viñeta (bordes oscuros)"
              value={s.vignette}
              min={0}
              max={1.5}
              step={0.05}
              onChange={(v) => patch({ vignette: v })}
            />
            <Slider
              label="Grano de película"
              value={s.grain}
              min={0}
              max={0.4}
              step={0.01}
              onChange={(v) => patch({ grain: v })}
            />
            {(s.flash > 0 || s.glitch > 0) && (
              <>
                <Slider
                  label="Flash en el beat"
                  value={s.flash}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => patch({ flash: v })}
                />
                <Slider
                  label="Glitch en el kick"
                  value={s.glitch}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(v) => patch({ glitch: v })}
                />
              </>
            )}
          </Section>
        )}

        <div className="panel-foot">
          <button type="button" onClick={fullscreen}>
            ⛶ Pantalla completa
          </button>
          <button type="button" onClick={reset}>
            ↺ Reiniciar
          </button>
        </div>
        <p className="kbd-hint">
          Atajos: <b>1–5</b> escenas · <b>Espacio</b> siguiente · <b>H</b>{' '}
          ocultar todo · <b>F</b> pantalla completa
        </p>
      </div>
    </div>
  );
}
