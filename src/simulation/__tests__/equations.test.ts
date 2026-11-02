import { describe, expect, it } from 'vitest';
import { coolingFlowLps, derivatives, heatGenerationW, heatRemovalW } from '../equations';
import { SEBORG_PARAMS as P, SEBORG_STEADY_STATE as SS } from '../presets/seborgBenchmark';
import type { Inputs, ReactorParams } from '../types';

const inputs = (over: Partial<Inputs> = {}): Inputs => ({
  valveCmd: 0.3,
  pumpEfficiency: 1,
  fouling: 1,
  inhibitorFactor: 1,
  reliefOpen: 0,
  ...over,
});
const deriv = (x: number[], p: ReactorParams, u: Inputs): Float64Array => {
  const out = new Float64Array(4);
  derivatives(Float64Array.from(x), p, u, out);
  return out;
};

describe('derivatives', () => {
  it('niveau 1 : (0,5 mol/L, 350 K, T_c = 300 K) est stationnaire (benchmark Seborg)', () => {
    const d = deriv([0.5, 350, 300, 0], { ...P, modelLevel: 1 }, inputs());
    expect(Math.abs(d[0] as number)).toBeLessThan(1e-4);
    // k₀ du plan (1,2·10⁹) est arrondi : résidu ≈ 1,2·10⁻⁴ K/s, soit 7·10⁻⁶ de la chaleur échangée
    expect(Math.abs(d[1] as number)).toBeLessThan(5e-4);
    expect(d[2]).toBe(0);
    expect(d[3]).toBe(0);
  });

  it('niveau 2 : le même point est stationnaire avec T_j = 300 K et v = 0,3 (S1-C04)', () => {
    const d = deriv([SS.CA, SS.T, SS.Tj, SS.v], P, inputs());
    expect(Math.abs(d[0] as number)).toBeLessThan(1e-4);
    expect(Math.abs(d[1] as number)).toBeLessThan(5e-4);
    expect(Math.abs(d[2] as number)).toBeLessThan(1e-3);
    expect(d[3]).toBe(0);
  });

  it('bilan de matière : sans réaction, dC_A/dt = (F/V)(C_A,in − C_A)', () => {
    const d = deriv([0.2, 300, 300, 0], { ...P, modelLevel: 1, k0PerS: 0 }, inputs());
    expect(d[0]).toBeCloseTo((P.feedFlowLps / P.volumeL) * (P.caInMolL - 0.2), 12);
  });

  it('sans réaction ni échange, T relaxe vers T_in avec la constante F/V', () => {
    const p = { ...P, modelLevel: 1 as const, k0PerS: 0, uaRefWK: 0, uaMinWK: 0 };
    const d = deriv([0, 300, 300, 0], p, inputs());
    expect(d[1]).toBeCloseTo((P.feedFlowLps / P.volumeL) * (P.tInK - 300), 12);
  });

  it("la panne de pompe supprime l'apport d'eau froide : T_j monte plus vite", () => {
    const ok = deriv([SS.CA, SS.T, SS.Tj, SS.v], P, inputs());
    const down = deriv([SS.CA, SS.T, SS.Tj, SS.v], P, inputs({ pumpEfficiency: 0 }));
    expect(down[2] as number).toBeGreaterThan((ok[2] as number) + 0.5);
  });

  it('la dynamique de la vanne est du 1er ordre limitée en vitesse', () => {
    const small = deriv([0.5, 350, 300, 0.3], P, inputs({ valveCmd: 0.4 }));
    expect(small[3]).toBeCloseTo(0.1 / P.valveTauS, 12);
    const large = deriv([0.5, 350, 300, 0], P, inputs({ valveCmd: 1 }));
    expect(large[3]).toBeCloseTo(P.valveRateMaxPerS, 12);
    const down = deriv([0.5, 350, 300, 1], P, inputs({ valveCmd: 0 }));
    expect(down[3]).toBeCloseTo(-P.valveRateMaxPerS, 12);
  });

  it("l'inhibiteur réduit la chaleur générée proportionnellement", () => {
    const full = heatGenerationW(350, 0.5, P, inputs());
    const inhibited = heatGenerationW(350, 0.5, P, inputs({ inhibitorFactor: 0.05 }));
    expect(inhibited / full).toBeCloseTo(0.05, 10);
  });

  it('soupape ouverte : refroidit (dT/dt plus faible) à haute température', () => {
    const closed = deriv([0.1, 420, 300, 0.3], P, inputs({ reliefOpen: 0 }));
    const open = deriv([0.1, 420, 300, 0.3], P, inputs({ reliefOpen: 1 }));
    expect(open[1] as number).toBeLessThan(closed[1] as number);
    const disabled = deriv(
      [0.1, 420, 300, 0.3],
      { ...P, reliefEnabled: false },
      inputs({ reliefOpen: 1 }),
    );
    expect(disabled[1]).toBe(closed[1]);
  });

  it("baisser l'agitation réduit l'évacuation thermique", () => {
    const slow = heatRemovalW(350, 300, { ...P, rpm: 40 }, inputs());
    const nominal = heatRemovalW(350, 300, P, inputs());
    expect(slow).toBeLessThan(nominal);
  });

  it("le débit d'eau froide vaut v·F_c,max·η", () => {
    expect(coolingFlowLps(0.5, P, inputs({ pumpEfficiency: 0.5 }))).toBeCloseTo(
      0.25 * P.fcMaxLps,
      12,
    );
  });
});
