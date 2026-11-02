import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimulationEngine } from '../engine';
import { PROPYLENE_OXIDE_PARAMS } from '../presets/propyleneOxide';
import { SEBORG_PARAMS, SEBORG_PID } from '../presets/seborgBenchmark';
import type { ReactorParams, ReactorState } from '../types';

/**
 * Validation scientifique (PLAN §8.2-5) : le moteur RK4 TypeScript reproduit les trajectoires
 * de référence calculées par SciPy (LSODA, rtol 1e-10) dans `notebooks/export_golden.py`.
 */
interface Golden {
  name: string;
  preset: 'seborg' | 'propyleneOxide';
  params: ReactorParams;
  initialState: ReactorState;
  valveCmd: number;
  events: {
    t: number;
    set: Partial<{ pumpEfficiency: number; fouling: number; inhibitorFactor: number }>;
  }[];
  t: number[];
  CA: number[];
  T: number[];
  Tj: number[];
  v: number[];
}

const dir = path.resolve(import.meta.dirname, '../../../tests/golden');
const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

/** Erreur relative maximale tolérée sur T (le plan exige < 0,5 % ; on vise bien plus serré). */
const PLAN_TOLERANCE = 0.005;
const TIGHT_TOLERANCE = 1e-4;

describe('golden : moteur TS vs SciPy', () => {
  it('trouve au moins 5 trajectoires de référence', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  for (const file of files) {
    const g = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Golden;
    it(`${g.name}`, () => {
      const engine = new SimulationEngine({
        // Jamais de rupture ni de soupape pendant la comparaison.
        params: { ...g.params, tRuptureK: 1e9 },
        initialState: g.initialState,
        pid: SEBORG_PID,
      });
      engine.setMode('manual');
      engine.setManualValve(g.valveCmd);
      engine.inputs.valveCmd = g.valveCmd;

      const pending = [...g.events];
      let maxRelT = 0;
      let maxRelCA = 0;
      for (let i = 1; i < g.t.length; i++) {
        const target = g.t[i] as number;
        // Les événements sont appliqués exactement à leur instant (multiple du pas).
        while (pending.length && (pending[0] as { t: number }).t <= target) {
          const ev = pending.shift() as Golden['events'][number];
          engine.advanceSteps(
            Math.round(ev.t / engine.dtS) - Math.round(engine.simTimeS / engine.dtS),
          );
          Object.assign(engine.inputs, ev.set);
        }
        engine.advanceSteps(
          Math.round(target / engine.dtS) - Math.round(engine.simTimeS / engine.dtS),
        );
        const refT = g.T[i] as number;
        maxRelT = Math.max(maxRelT, Math.abs((engine.state[1] as number) - refT) / refT);
        const refCA = g.CA[i] as number;
        maxRelCA = Math.max(
          maxRelCA,
          Math.abs((engine.state[0] as number) - refCA) / Math.max(refCA, 0.05),
        );
      }
      expect(engine.status).not.toBe('error');
      expect(maxRelT).toBeLessThan(PLAN_TOLERANCE);
      expect(maxRelT).toBeLessThan(TIGHT_TOLERANCE);
      expect(maxRelCA).toBeLessThan(1e-3);
    });
  }

  const PRESETS = { seborg: SEBORG_PARAMS, propyleneOxide: PROPYLENE_OXIDE_PARAMS } as const;

  for (const file of files) {
    const g = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Golden;
    it(`${g.name} : le preset « ${g.preset} » TypeScript égale les paramètres Python`, () => {
      const ts = PRESETS[g.preset];
      const keys = Object.keys(g.params) as (keyof ReactorParams)[];
      expect(keys.length).toBeGreaterThan(25);
      for (const key of keys) {
        if (key === 'reliefEnabled' || key === 'rpm') continue; // surchargés volontairement par certains cas
        const tsValue = ts[key];
        const pyValue = g.params[key];
        if (typeof tsValue !== 'number' || typeof pyValue !== 'number') continue;
        const scale = Math.max(Math.abs(pyValue), 1e-300);
        // Cas qui surchargent un paramètre à dessein (F, rpm, niveau) : ignorés
        if (['feedFlowLps', 'modelLevel'].includes(key)) continue;
        expect(Math.abs(tsValue - pyValue) / scale, `${g.name}.${String(key)}`).toBeLessThan(1e-9);
      }
    });
  }
});
