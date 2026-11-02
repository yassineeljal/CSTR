import { describe, expect, it } from 'vitest';
import {
  COLOR_STOPS,
  EMISSION_MAX,
  glslThermalRamp,
  temperatureToEmission,
  temperatureToRgb,
} from './colorScale';

const rgb = (t: number) => temperatureToRgb(t, [0, 0, 0]);

describe('colorScale', () => {
  it('retourne exactement les points de contrôle', () => {
    for (const s of COLOR_STOPS) {
      const c = rgb(s.tempK);
      expect(c[0]).toBeCloseTo(s.rgb[0], 12);
      expect(c[1]).toBeCloseTo(s.rgb[1], 12);
      expect(c[2]).toBeCloseTo(s.rgb[2], 12);
    }
  });

  it('300 K est bleu, 330 K vert-jaune, 360 K orange, 400 K rouge', () => {
    const [r300, g300, b300] = rgb(300);
    expect(b300).toBeGreaterThan(r300);
    expect(b300).toBeGreaterThan(g300);
    const [r330, g330, b330] = rgb(330);
    expect(g330).toBeGreaterThan(r330);
    expect(g330).toBeGreaterThan(b330);
    const [r360, g360, b360] = rgb(360);
    expect(r360).toBeGreaterThan(0.9);
    expect(g360).toBeGreaterThan(b360);
    expect(g360).toBeLessThan(0.6);
    const [r400, g400, b400] = rgb(400);
    expect(r400).toBeGreaterThan(0.95);
    expect(g400).toBeLessThan(0.1);
    expect(b400).toBeLessThan(0.1);
  });

  it('sature en dehors de la plage', () => {
    expect(rgb(100)).toEqual(rgb(290));
    expect(rgb(900)).toEqual(rgb(400));
  });

  it('est continue : pas de saut entre deux températures voisines', () => {
    let prev = rgb(285);
    for (let t = 285.5; t <= 410; t += 0.5) {
      const c = rgb(t);
      const jump = Math.max(
        Math.abs(c[0] - prev[0]),
        Math.abs(c[1] - prev[1]),
        Math.abs(c[2] - prev[2]),
      );
      expect(jump).toBeLessThan(0.06);
      prev = [...c];
    }
  });

  it('réutilise le tableau de sortie (aucune allocation)', () => {
    const out: [number, number, number] = [0, 0, 0];
    expect(temperatureToRgb(350, out)).toBe(out);
  });

  it('émission nulle sous 380 K, > 1 (Bloom) vers 410 K, maximale à 440 K', () => {
    expect(temperatureToEmission(300)).toBe(0);
    expect(temperatureToEmission(380)).toBe(0);
    expect(temperatureToEmission(360)).toBe(0);
    expect(temperatureToEmission(410)).toBeGreaterThan(1);
    expect(temperatureToEmission(440)).toBeCloseTo(EMISSION_MAX, 12);
    expect(temperatureToEmission(600)).toBeCloseTo(EMISSION_MAX, 12);
  });

  it('émission monotone', () => {
    let prev = -1;
    for (let t = 300; t <= 460; t += 1) {
      const e = temperatureToEmission(t);
      expect(e).toBeGreaterThanOrEqual(prev);
      prev = e;
    }
  });

  it('le GLSL généré contient la même table que le JS', () => {
    const glsl = glslThermalRamp();
    for (const s of COLOR_STOPS) {
      expect(glsl).toContain(s.tempK.toFixed(1));
      expect(glsl).toContain(s.rgb[0].toFixed(4));
    }
    expect(glsl).toContain('vec3 thermalRamp(float tempK)');
    expect(glsl).toContain('float thermalEmission(float tempK)');
  });
});
