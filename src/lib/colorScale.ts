/**
 * Rampe température → couleur, partagée entre le JavaScript (HUD, matériaux) et le GLSL
 * (shaders du fluide, S4-L01). Les couleurs sont en espace linéaire (workflow Three.js).
 *
 * 300 K bleu/cyan → 330 K vert-jaune → 360 K orange → ≥ 400 K rouge incandescent.
 */

export interface ColorStop {
  /** Température [K]. */
  tempK: number;
  /** Couleur linéaire RGB [0..1]. */
  rgb: readonly [number, number, number];
}

export const COLOR_STOPS: readonly ColorStop[] = [
  { tempK: 290, rgb: [0.01, 0.06, 0.3] }, // bleu profond
  { tempK: 300, rgb: [0.015, 0.2, 0.62] }, // bleu
  { tempK: 315, rgb: [0.02, 0.55, 0.8] }, // cyan
  { tempK: 330, rgb: [0.3, 0.8, 0.3] }, // vert-jaune
  { tempK: 345, rgb: [0.85, 0.75, 0.08] }, // jaune
  { tempK: 360, rgb: [1.0, 0.4, 0.03] }, // orange
  { tempK: 385, rgb: [1.0, 0.12, 0.02] }, // rouge
  { tempK: 400, rgb: [1.0, 0.04, 0.015] }, // rouge vif
];

/** Température sous laquelle l'émission est nulle [K]. */
export const EMISSION_START_K = 380;
/** Température à laquelle l'émission atteint son maximum [K]. */
export const EMISSION_FULL_K = 440;
/** Intensité d'émission maximale (> 1 pour déclencher le Bloom, luminanceThreshold ≈ 0,9). */
export const EMISSION_MAX = 3.2;

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Écrit dans `out` la couleur linéaire correspondant à `tempK` (interpolation linéaire entre
 * points de contrôle, saturée aux extrémités). Sans allocation.
 */
export function temperatureToRgb(
  tempK: number,
  out: [number, number, number],
): [number, number, number] {
  const first = COLOR_STOPS[0] as ColorStop;
  const last = COLOR_STOPS[COLOR_STOPS.length - 1] as ColorStop;
  if (!(tempK > first.tempK)) {
    out[0] = first.rgb[0];
    out[1] = first.rgb[1];
    out[2] = first.rgb[2];
    return out;
  }
  if (tempK >= last.tempK) {
    out[0] = last.rgb[0];
    out[1] = last.rgb[1];
    out[2] = last.rgb[2];
    return out;
  }
  for (let i = 1; i < COLOR_STOPS.length; i++) {
    const b = COLOR_STOPS[i] as ColorStop;
    if (tempK <= b.tempK) {
      const a = COLOR_STOPS[i - 1] as ColorStop;
      const f = (tempK - a.tempK) / (b.tempK - a.tempK);
      out[0] = a.rgb[0] + (b.rgb[0] - a.rgb[0]) * f;
      out[1] = a.rgb[1] + (b.rgb[1] - a.rgb[1]) * f;
      out[2] = a.rgb[2] + (b.rgb[2] - a.rgb[2]) * f;
      return out;
    }
  }
  return out;
}

/**
 * Facteur d'émission (0 … EMISSION_MAX) : nul sous 380 K, croissant ensuite (smoothstep) pour
 * que seul le fluide très chaud déclenche le Bloom (S4-L05).
 */
export function temperatureToEmission(tempK: number): number {
  const x = clamp01((tempK - EMISSION_START_K) / (EMISSION_FULL_K - EMISSION_START_K));
  return EMISSION_MAX * x * x * (3 - 2 * x);
}

/** Code GLSL de la rampe (même table que `COLOR_STOPS`) — fonction `vec3 thermalRamp(float tempK)`. */
export function glslThermalRamp(): string {
  const n = COLOR_STOPS.length;
  const temps = COLOR_STOPS.map((s) => s.tempK.toFixed(1)).join(', ');
  const cols = COLOR_STOPS.map((s) => `vec3(${s.rgb.map((v) => v.toFixed(4)).join(', ')})`).join(
    ',\n    ',
  );
  return `
const float RAMP_T[${n}] = float[${n}](${temps});
const vec3 RAMP_C[${n}] = vec3[${n}](
    ${cols}
);
vec3 thermalRamp(float tempK) {
  if (tempK <= RAMP_T[0]) return RAMP_C[0];
  for (int i = 1; i < ${n}; i++) {
    if (tempK <= RAMP_T[i]) {
      float f = (tempK - RAMP_T[i - 1]) / (RAMP_T[i] - RAMP_T[i - 1]);
      return mix(RAMP_C[i - 1], RAMP_C[i], f);
    }
  }
  return RAMP_C[${n - 1}];
}
float thermalEmission(float tempK) {
  float x = clamp((tempK - ${EMISSION_START_K.toFixed(1)}) / ${(EMISSION_FULL_K - EMISSION_START_K).toFixed(1)}, 0.0, 1.0);
  return ${EMISSION_MAX.toFixed(2)} * x * x * (3.0 - 2.0 * x);
}
`;
}
