import { describe, expect, it } from 'vitest';
import { PROPYLENE_OXIDE_PARAMS } from '../presets/propyleneOxide';
import { SEBORG_PARAMS } from '../presets/seborgBenchmark';
import {
  heatGeneratedW,
  heatRemovedW,
  quasiSteadyCA,
  steadyStates,
  vanHeerdenCurves,
  type VanHeerdenContext,
} from '../vanHeerden';

const ctx = (over: Partial<VanHeerdenContext> = {}): VanHeerdenContext => ({
  sinkTempK: 300,
  fouling: 1,
  inhibitorFactor: 1,
  feedFactor: 1,
  ...over,
});

describe('diagramme de Van Heerden', () => {
  it('Seborg : 3 états stationnaires identiques à SciPy (324,475 / 350,006 / 369,705 K)', () => {
    const ss = steadyStates(SEBORG_PARAMS, ctx());
    expect(ss).toHaveLength(3);
    expect(ss[0]?.tempK).toBeCloseTo(324.4754, 2);
    expect(ss[1]?.tempK).toBeCloseTo(350.0055, 2);
    expect(ss[2]?.tempK).toBeCloseTo(369.7049, 2);
    expect(ss.map((s) => s.stable)).toEqual([true, false, true]);
    expect(ss[1]?.caMolL).toBeCloseTo(0.4999, 3);
  });

  it('oxyde de propylène : 3 états (302,5 / 326,8 / 353,7 K), le milieu instable', () => {
    const ss = steadyStates(PROPYLENE_OXIDE_PARAMS, ctx({ sinkTempK: 285 }));
    expect(ss).toHaveLength(3);
    expect(ss.map((s) => s.tempK.toFixed(1))).toEqual(['302.5', '326.8', '353.7']);
    expect(ss.map((s) => s.stable)).toEqual([true, false, true]);
  });

  it('les stationnaires bougent quand on change UA ou T_c (S6-L04)', () => {
    const base = steadyStates(SEBORG_PARAMS, ctx());
    const fouled = steadyStates(SEBORG_PARAMS, ctx({ fouling: 0.4 }));
    const hotter = steadyStates(SEBORG_PARAMS, ctx({ sinkTempK: 310 }));
    // encrassement : le refroidissement faiblit → un seul état (haut) subsiste
    expect(fouled.length).toBe(1);
    expect(fouled[0]?.tempK).toBeGreaterThan((base[2]?.tempK ?? 0) - 1);
    // eau plus chaude (310 K > T_c,ign ≈ 303 K) : l'état bas disparaît, seul l'état haut reste
    expect(hotter.length).toBe(1);
    expect(hotter[0]?.tempK).toBeGreaterThan(375);
    // eau plus froide (290 K < T_c,ext ≈ 298 K) : l'état haut disparaît, seul l'état bas reste
    const colder = steadyStates(SEBORG_PARAMS, ctx({ sinkTempK: 290 }));
    expect(colder.length).toBe(1);
    expect(colder[0]?.tempK).toBeLessThan(320);
    expect(colder[0]?.stable).toBe(true);
  });

  it('les états stationnaires annulent bien dT/dt (Q_gén = Q_évac)', () => {
    for (const s of steadyStates(SEBORG_PARAMS, ctx())) {
      const gen = heatGeneratedW(s.tempK, SEBORG_PARAMS, ctx());
      const rem = heatRemovedW(s.tempK, SEBORG_PARAMS, ctx());
      expect(Math.abs(gen - rem) / gen).toBeLessThan(1e-9);
    }
  });

  it('au point nominal : Q_gén ≈ 41,7 kW (= UA·(T − T_c) + terme d’alimentation nul)', () => {
    expect(heatGeneratedW(350, SEBORG_PARAMS, ctx())).toBeGreaterThan(41_000);
    expect(heatGeneratedW(350, SEBORG_PARAMS, ctx())).toBeLessThan(42_500);
  });

  it('C_A quasi-stationnaire : → C_A,in à basse T (pas de réaction), → 0 à haute T', () => {
    expect(quasiSteadyCA(250, SEBORG_PARAMS, ctx())).toBeCloseTo(SEBORG_PARAMS.caInMolL, 4);
    expect(quasiSteadyCA(600, SEBORG_PARAMS, ctx())).toBeLessThan(1e-3);
  });

  it('l’alimentation coupée annule le terme convectif et la dilution', () => {
    const off = ctx({ feedFactor: 0 });
    expect(heatRemovedW(350, SEBORG_PARAMS, off)).toBeCloseTo(SEBORG_PARAMS.uaRefWK * 50, 6);
  });

  it('balayage : 200 points, bornes exactes, grille croissante', () => {
    const c = vanHeerdenCurves(SEBORG_PARAMS, ctx(), 290, 420, 200);
    expect(c.tempK).toHaveLength(200);
    expect(c.tempK[0]).toBe(290);
    expect(c.tempK[199]).toBeCloseTo(420, 12);
    for (let i = 1; i < 200; i++) expect(c.tempK[i]!).toBeGreaterThan(c.tempK[i - 1]!);
    expect(c.qRem[199]!).toBeGreaterThan(c.qRem[0]!);
  });

  it('un puits très chaud sans réaction : aucun état stationnaire dans la plage', () => {
    const p = { ...SEBORG_PARAMS, k0PerS: 0 };
    expect(steadyStates(p, ctx({ sinkTempK: 500 }), 285, 420)).toHaveLength(0);
  });
});
