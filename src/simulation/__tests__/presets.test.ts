import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../engine';
import { derivatives } from '../equations';
import { arrhenius } from '../kinetics';
import {
  PROPYLENE_OXIDE_PARAMS as PO,
  PROPYLENE_OXIDE_PID,
  PROPYLENE_OXIDE_STEADY_STATE as PO_SS,
} from '../presets/propyleneOxide';
import { SEBORG_PARAMS } from '../presets/seborgBenchmark';
import type { Inputs } from '../types';

const inputs: Inputs = {
  valveCmd: 0.3,
  pumpEfficiency: 1,
  fouling: 1,
  inhibitorFactor: 1,
  reliefOpen: 0,
  feedFactor: 1,
};

describe('preset hydrolyse de l’oxyde de propylène (Fogler)', () => {
  it('reproduit la cinétique de la littérature : k(300 K) ≈ 1,28 h⁻¹, k(330 K) ≈ 20 h⁻¹', () => {
    expect(arrhenius(300, PO.k0PerS, PO.eaOverRK) * 3600).toBeCloseTo(1.282, 2);
    expect(arrhenius(330, PO.k0PerS, PO.eaOverRK) * 3600).toBeCloseTo(19.99, 1);
  });

  it('convertit correctement les unités anglo-saxonnes (E_a ≈ 75,4 kJ/mol, ΔH ≈ −83,7 kJ/mol)', () => {
    expect(PO.eaOverRK * 8.314462618).toBeCloseTo(75362, -1);
    expect(PO.deltaHrJMol).toBeCloseTo(-83736, -1);
  });

  it('l’état stationnaire du niveau 2 est stationnaire (dérivées ≈ 0)', () => {
    const out = new Float64Array(4);
    derivatives(Float64Array.of(PO_SS.CA, PO_SS.T, PO_SS.Tj, PO_SS.v), PO, inputs, out);
    expect(Math.abs(out[0] as number)).toBeLessThan(1e-7);
    expect(Math.abs(out[1] as number)).toBeLessThan(1e-6);
    expect(Math.abs(out[2] as number)).toBeLessThan(1e-5);
  });

  it('est instable en boucle ouverte : +0,3 K ⇒ allumage, −0,3 K ⇒ extinction (niveau 1)', () => {
    const run = (dT: number): number => {
      const e = new SimulationEngine({
        params: { ...PO, modelLevel: 1 },
        initialState: { ...PO_SS, T: PO_SS.T + dT, v: 0 },
        pid: PROPYLENE_OXIDE_PID,
      });
      e.setMode('manual');
      e.setTimeScale(60);
      e.start();
      for (let i = 0; i < 1500 && e.status === 'running'; i++) e.step(1 / 60);
      return e.state[1] as number;
    };
    expect(run(+0.3)).toBeGreaterThan(350);
    expect(run(-0.3)).toBeLessThan(310);
  });

  it('le PID du preset rétablit le point instable après +1 K', () => {
    const e = new SimulationEngine({
      params: PO,
      initialState: { ...PO_SS, T: PO_SS.T + 1 },
      pid: PROPYLENE_OXIDE_PID,
    });
    e.setTimeScale(60);
    e.start();
    for (let i = 0; i < 900 && e.status === 'running'; i++) e.step(1 / 60);
    expect(e.status).toBe('running');
    expect(Math.abs((e.state[1] as number) - PO_SS.T)).toBeLessThan(0.2);
  });

  it('partage la géométrie et les paramètres non réactionnels du benchmark', () => {
    expect(PO.volumeL).toBe(SEBORG_PARAMS.volumeL);
    expect(PO.rpmRef).toBe(SEBORG_PARAMS.rpmRef);
    expect(PO.valveTauS).toBe(SEBORG_PARAMS.valveTauS);
  });
});
