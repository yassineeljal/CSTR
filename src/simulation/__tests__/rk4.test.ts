import { describe, expect, it } from 'vitest';
import { Rk4Integrator } from '../rk4';

/** dy/dt = −y, y(0) = 1 ⇒ y(1) = e⁻¹. Retourne l'erreur absolue à t = 1. */
function decayError(dt: number): number {
  const rk = new Rk4Integrator(1, (x, _t, out) => {
    out[0] = -(x[0] as number);
  });
  const x = Float64Array.of(1);
  const n = Math.round(1 / dt);
  for (let i = 0; i < n; i++) rk.step(x, i * dt, dt);
  return Math.abs((x[0] as number) - Math.exp(-1));
}

describe('Rk4Integrator', () => {
  it('atteint une erreur < 1e-9 sur dy/dt = −y avec dt = 0,01', () => {
    expect(decayError(0.01)).toBeLessThan(1e-9);
  });
  it("est d'ordre 4 : diviser dt par 2 divise l'erreur par ~16", () => {
    const ratio = decayError(0.1) / decayError(0.05);
    expect(ratio).toBeGreaterThan(14);
    expect(ratio).toBeLessThan(18);
  });
  it('intègre un système dépendant du temps : dy/dt = t ⇒ y = t²/2 (exact pour RK4)', () => {
    const rk = new Rk4Integrator(1, (_x, t, out) => {
      out[0] = t;
    });
    const x = Float64Array.of(0);
    for (let i = 0; i < 100; i++) rk.step(x, i * 0.01, 0.01);
    expect(x[0]).toBeCloseTo(0.5, 12);
  });
  it('conserve l’énergie d’un oscillateur harmonique à 1e-8 sur 10 périodes', () => {
    const rk = new Rk4Integrator(2, (x, _t, out) => {
      out[0] = x[1] as number;
      out[1] = -(x[0] as number);
    });
    const x = Float64Array.of(1, 0);
    const steps = Math.round((20 * Math.PI) / 0.01);
    for (let i = 0; i < steps; i++) rk.step(x, 0, 0.01);
    const energy = 0.5 * ((x[0] as number) ** 2 + (x[1] as number) ** 2);
    expect(Math.abs(energy - 0.5)).toBeLessThan(1e-8);
  });
});
