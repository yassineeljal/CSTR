import { describe, expect, it } from 'vitest';
import { nextReliefOpen, pressurePa, reliefHeatW, reliefMassFlowKgS } from '../relief';
import { SEBORG_PARAMS as P } from '../presets/seborgBenchmark';

describe('soupape de sécurité', () => {
  it('P(T) = P_inerte + P_sat(T) et croît avec T', () => {
    expect(pressurePa(300, P)).toBeGreaterThan(P.inertPressurePa);
    expect(pressurePa(400, P)).toBeGreaterThan(pressurePa(350, P));
  });

  it('s’ouvre au-dessus du tarage et se referme sous 90 % du tarage (hystérésis)', () => {
    const set = P.reliefSetPressurePa;
    expect(nextReliefOpen(false, set - 1, P)).toBe(false);
    expect(nextReliefOpen(false, set + 1, P)).toBe(true);
    expect(nextReliefOpen(true, set - 1, P)).toBe(true); // reste ouverte dans la bande
    expect(nextReliefOpen(true, 0.95 * set, P)).toBe(true);
    expect(nextReliefOpen(true, 0.89 * set, P)).toBe(false);
  });

  it('débit nul quand la pression interne ne dépasse pas l’atmosphère', () => {
    expect(reliefMassFlowKgS(250, { ...P, inertPressurePa: 0 })).toBe(0);
  });

  it('débit croissant avec T, et chaleur = ṁ·L_v', () => {
    const lo = reliefMassFlowKgS(395, P);
    const hi = reliefMassFlowKgS(440, P);
    expect(lo).toBeGreaterThan(0);
    expect(hi).toBeGreaterThan(lo);
    expect(reliefHeatW(440, P)).toBeCloseTo(hi * P.latentHeatJKg, 6);
  });

  it('ordre de grandeur : quelques centièmes de kg/s à ~120 °C pour A_s = 15 mm²', () => {
    const m = reliefMassFlowKgS(393, P);
    expect(m).toBeGreaterThan(0.001);
    expect(m).toBeLessThan(0.05);
  });
});
