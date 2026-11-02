import { describe, expect, it } from 'vitest';
import {
  BOIL_START_K,
  boilingFactor,
  bubbleDensity,
  normalizedJacketFlow,
  normalizedReliefFlow,
  vibrationAmplitude,
  vortexDepthM,
} from './visuals';

describe('visuals', () => {
  it('ébullition nulle sous le seuil, pleine au-delà, monotone', () => {
    expect(boilingFactor(BOIL_START_K - 1)).toBe(0);
    expect(boilingFactor(BOIL_START_K + 30)).toBe(1);
    expect(boilingFactor(500)).toBe(1);
    let prev = -1;
    for (let t = 340; t <= 420; t++) {
      const b = boilingFactor(t);
      expect(b).toBeGreaterThanOrEqual(prev);
      prev = b;
    }
  });

  it('densité de bulles ∝ (T − 370 K)⁺, saturée à 1', () => {
    expect(bubbleDensity(350)).toBe(0);
    expect(bubbleDensity(370)).toBe(0);
    expect(bubbleDensity(385)).toBeCloseTo(0.5, 12);
    expect(bubbleDensity(450)).toBe(1);
  });

  it('vortex ∝ rpm², nul à l’arrêt, borné', () => {
    expect(vortexDepthM(0, 120, 0.03, 0.08)).toBe(0);
    expect(vortexDepthM(120, 120, 0.03, 0.08)).toBeCloseTo(0.03, 12);
    expect(vortexDepthM(60, 120, 0.03, 0.08)).toBeCloseTo(0.0075, 12); // ÷4
    expect(vortexDepthM(1000, 120, 0.03, 0.08)).toBe(0.08);
    expect(vortexDepthM(-10, 120, 0.03, 0.08)).toBe(0);
  });

  it('débits normalisés bornés ; jamais de NaN si F_c,max = 0', () => {
    expect(normalizedReliefFlow(0.01, 0.005)).toBe(1);
    expect(normalizedReliefFlow(-1, 0.005)).toBe(0);
    expect(normalizedJacketFlow(0.75, 1.5)).toBeCloseTo(0.5, 12);
    expect(normalizedJacketFlow(1, 0)).toBe(0);
  });

  it('vibration : nulle sous HH, croissante, 1 à la rupture, renforcée par la pression', () => {
    expect(vibrationAmplitude(350, 380, 450, 1)).toBe(0);
    expect(vibrationAmplitude(380, 380, 450, 1)).toBe(0);
    const mid = vibrationAmplitude(415, 380, 450, 1);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(0.5);
    expect(vibrationAmplitude(450, 380, 450, 1)).toBe(1);
    expect(vibrationAmplitude(415, 380, 450, 2)).toBeGreaterThan(mid);
    let prev = -1;
    for (let t = 370; t <= 460; t++) {
      const a = vibrationAmplitude(t, 380, 450, 1.3);
      expect(a).toBeGreaterThanOrEqual(prev);
      prev = a;
    }
  });
});
