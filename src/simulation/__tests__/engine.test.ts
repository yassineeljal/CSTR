import { describe, expect, it } from 'vitest';
import { SimulationEngine, type EngineEvent } from '../engine';
import { SNAPSHOT_LAYOUT, SNAPSHOT_SIZE, decodeSnapshot } from '../protocol';
import {
  SEBORG_COLD_STATE,
  SEBORG_PARAMS,
  SEBORG_PID,
  SEBORG_STEADY_STATE,
} from '../presets/seborgBenchmark';
import type { ReactorParams, ReactorState } from '../types';

const make = (
  over: { params?: Partial<ReactorParams>; state?: Partial<ReactorState> } = {},
): SimulationEngine =>
  new SimulationEngine({
    params: { ...SEBORG_PARAMS, ...over.params },
    initialState: { ...SEBORG_STEADY_STATE, ...over.state },
    pid: SEBORG_PID,
  });

/** Fait tourner le moteur en temps réel simulé accéléré ×1, par pas de 1 s réelle. */
function run(e: SimulationEngine, seconds: number, onSecond?: (t: number) => void): void {
  e.setTimeScale(1);
  e.start();
  for (let i = 0; i < seconds && e.status === 'running'; i++) {
    e.step(1);
    onSecond?.(e.simTimeS);
  }
}
const T = (e: SimulationEngine): number => e.state[1] as number;
const CA = (e: SimulationEngine): number => e.state[0] as number;

describe('SimulationEngine — cycle de vie', () => {
  it('démarre en « ready », n’avance pas tant qu’il n’est pas lancé, puis pause/reprise', () => {
    const e = make();
    expect(e.status).toBe('ready');
    expect(e.step(1)).toBe(0);
    expect(e.simTimeS).toBe(0);
    e.start();
    expect(e.status).toBe('running');
    e.setTimeScale(1);
    expect(e.step(1)).toBe(100);
    e.pause();
    expect(e.status).toBe('paused');
    expect(e.step(1)).toBe(0);
    e.start();
    expect(e.step(1)).toBe(100);
    expect(e.simTimeS).toBeCloseTo(2, 12);
  });

  it('reset() restaure l’état initial et le temps', () => {
    const e = make({ state: { T: 353 } });
    run(e, 5);
    e.reset();
    expect(e.status).toBe('ready');
    expect(e.simTimeS).toBe(0);
    expect(T(e)).toBe(353);
  });

  it('plafonne le nombre de pas par tick (anti « spirale de la mort »)', () => {
    const e = make();
    e.setTimeScale(60);
    e.start();
    expect(e.step(1000)).toBe(2000);
    expect(e.simTimeS).toBeCloseTo(20, 9);
    // le retard accumulé est abandonné : le tick suivant revient à la normale
    expect(e.step(0.01)).toBe(60);
  });

  it('ignore un dt réel négatif', () => {
    const e = make();
    e.start();
    expect(e.step(-5)).toBe(0);
  });
});

describe('SimulationEngine — physique', () => {
  it('maintient le point stationnaire nominal avec le PID (niveau 2)', () => {
    const e = make();
    run(e, 120);
    expect(Math.abs(T(e) - 350)).toBeLessThan(0.05);
    expect(Math.abs(CA(e) - 0.5)).toBeLessThan(0.01);
  });

  it('S2-L08 : niveau 1, PID off, +0,5 K ⇒ divergence vers l’état stationnaire haut (≈ 370 K)', () => {
    const e = make({ params: { modelLevel: 1 }, state: { T: 350.5, v: 0 } });
    e.setMode('manual');
    run(e, 900);
    // le point à 350 K est instable : l'écart de 0,5 K est amplifié ×40 (bistabilité 324,5 / 370 K)
    expect(T(e)).toBeGreaterThan(369);
    expect(T(e)).toBeLessThan(371);
  });

  it('S2-L08 : niveau 1, −0,5 K ⇒ extinction vers l’état stationnaire bas (≈ 324,5 K)', () => {
    const e = make({ params: { modelLevel: 1 }, state: { T: 349.5, v: 0 } });
    e.setMode('manual');
    run(e, 1500);
    expect(T(e)).toBeGreaterThan(324);
    expect(T(e)).toBeLessThan(325.5);
  });

  it('S2-L09 : niveau 2, PID on, perturbation de +3,5 K ⇒ retour à ±1 K en < 300 s', () => {
    const e = make({ state: { T: 353.5 } });
    let settledAt = Infinity;
    let worstAfter = 0;
    run(e, 300, (t) => {
      if (Math.abs(T(e) - 350) < 1 && settledAt === Infinity) settledAt = t;
      if (t > 150) worstAfter = Math.max(worstAfter, Math.abs(T(e) - 350));
    });
    expect(settledAt).toBeLessThan(300);
    expect(worstAfter).toBeLessThan(1);
    expect(e.status).toBe('running');
  });

  it('suit un échelon de consigne 350 → 354 K sans diverger', () => {
    const e = make();
    e.setPid({ setpointK: 354 });
    run(e, 200);
    expect(Math.abs(T(e) - 354)).toBeLessThan(0.3);
  });

  it('conservation : sans réaction ni échange, C_A et T relaxent vers l’entrée', () => {
    const e = make({
      params: { modelLevel: 1, k0PerS: 0, uaRefWK: 0, uaMinWK: 0 },
      state: { CA: 0, T: 300, v: 0 },
    });
    e.setMode('manual');
    const p = SEBORG_PARAMS;
    const tauCA = p.volumeL / p.feedFlowLps; // 60 s
    // T : capacité thermique liquide + paroi, alimentée par F·ρ·C_p
    const tauT =
      (p.volumeL * p.rhoGL * p.cpJGK + p.vesselHeatCapacityJK) /
      (p.feedFlowLps * p.rhoGL * p.cpJGK);
    run(e, 60);
    expect(CA(e)).toBeCloseTo(p.caInMolL * (1 - Math.exp(-e.simTimeS / tauCA)), 6);
    expect(T(e)).toBeCloseTo(p.tInK + (300 - p.tInK) * Math.exp(-e.simTimeS / tauT), 5);
    run(e, 2500); // ≈ 13 τ_T
    expect(CA(e)).toBeCloseTo(p.caInMolL, 6);
    expect(T(e)).toBeCloseTo(p.tInK, 2);
  });

  it('S4-L10 : baisser l’agitation fait monter T (boucle ouverte, niveau 2)', () => {
    const slow = make();
    slow.setMode('manual');
    slow.setManualValve(0.3);
    slow.setParams({ rpm: 30 });
    run(slow, 40);
    const nominal = make();
    nominal.setMode('manual');
    nominal.setManualValve(0.3);
    run(nominal, 40);
    expect(T(slow)).toBeGreaterThan(T(nominal) + 3);
  });

  it('mode manuel : la vanne suit la consigne manuelle', () => {
    const e = make();
    e.setMode('manual');
    e.setManualValve(0.8);
    run(e, 30);
    expect(e.state[3] as number).toBeCloseTo(0.8, 2);
    expect(e.inputs.valveCmd).toBe(0.8);
  });

  it('bascule Manuel → Auto sans à-coup de la commande de vanne', () => {
    const e = make();
    e.setMode('manual');
    e.setManualValve(0.45);
    run(e, 5);
    e.setMode('auto');
    expect(e.pidSettings.setpointK).toBe(350);
    e.step(0.1); // un échantillon PID
    expect(Math.abs(e.inputs.valveCmd - 0.45)).toBeLessThan(0.05);
  });

  it('PLAN §8.2-6 : l’anti-windup réduit le dépassement après une saturation prolongée', () => {
    const scenario = (antiWindup: boolean): number => {
      const e = make();
      e.setAntiWindup(antiWindup);
      e.setPid({ setpointK: 340 }); // consigne atteignable seulement si le refroidissement est fort
      e.setParams({ tInK: 360 }); // charge thermique élevée ⇒ saturation de la vanne
      let minT = Infinity;
      run(e, 150, (t) => {
        if (t === 60) e.setParams({ tInK: 340 }); // la charge disparaît, la vanne désature
        if (t > 60) minT = Math.min(minT, T(e));
      });
      return minT;
    };
    const withAw = scenario(true);
    const withoutAw = scenario(false);
    // Sans anti-windup l'intégrale accumulée sur-refroidit le réacteur (sous-dépassement plus fort)
    expect(withoutAw).toBeLessThan(withAw);
  });
});

describe('SimulationEngine — indépendance au framerate (PLAN §8.2-7)', () => {
  const finalState = (fps: number): { state: Float64Array; t: number } => {
    const e = make({ state: { T: 352 } });
    e.setTimeScale(10);
    e.start();
    const frames = Math.round(6 * fps); // 6 s réelles × 10 = 60 s simulées
    for (let i = 0; i < frames; i++) e.step(1 / fps);
    return { state: Float64Array.from(e.state), t: e.simTimeS };
  };

  it('même état à t = 60 s simulées pour 30, 60 et 144 Hz (écart < 1e-9)', () => {
    const a = finalState(30);
    const b = finalState(60);
    const c = finalState(144);
    expect(a.t).toBeCloseTo(60, 9);
    expect(b.t).toBeCloseTo(60, 9);
    expect(c.t).toBeCloseTo(60, 9);
    for (let i = 0; i < 4; i++) {
      expect(Math.abs((a.state[i] as number) - (b.state[i] as number))).toBeLessThan(1e-9);
      expect(Math.abs((a.state[i] as number) - (c.state[i] as number))).toBeLessThan(1e-9);
    }
  });
});

describe('SimulationEngine — alarmes, rupture, garde-fous', () => {
  const collect = (e: SimulationEngine, seconds: number): EngineEvent[] => {
    const all: EngineEvent[] = [];
    run(e, seconds, () => all.push(...e.takeEvents()));
    return all;
  };

  it('émet H à la montée vers l’état haut (370 K) mais pas HH', () => {
    const e = make({ params: { modelLevel: 1 }, state: { T: 350.5, v: 0 } });
    e.setMode('manual');
    const events = collect(e, 900);
    const levels = events.flatMap((ev) =>
      ev.type === 'alarm' ? [`${ev.alarm.level}${ev.alarm.active ? '+' : '-'}`] : [],
    );
    expect(levels).toEqual(['H+']);
  });

  it('HH puis son retour à la normale (bande morte), H restant actif', () => {
    const e = make({ params: { modelLevel: 1 }, state: { CA: 0.2, T: 385, v: 0 } });
    e.setMode('manual');
    const events = collect(e, 300);
    const levels = events.flatMap((ev) =>
      ev.type === 'alarm' ? [`${ev.alarm.level}${ev.alarm.active ? '+' : '-'}`] : [],
    );
    expect(levels.slice(0, 2).sort()).toEqual(['H+', 'HH+']);
    expect(levels).toContain('HH-');
    expect(levels).not.toContain('H-');
  });

  it('l’alarme LL est armée seulement après le démarrage (pas d’alarme à froid)', () => {
    const e = make({ state: SEBORG_COLD_STATE });
    const events = collect(e, 3);
    expect(events.some((ev) => ev.type === 'alarm' && ev.alarm.level === 'LL')).toBe(false);
  });

  it('rupture : statut « ruptured », événement émis, simulation figée', () => {
    const e = make({ params: { modelLevel: 1, tRuptureK: 360 }, state: { T: 358, v: 0 } });
    e.setMode('manual');
    const events = collect(e, 400);
    expect(e.status).toBe('ruptured');
    expect(events.some((ev) => ev.type === 'rupture')).toBe(true);
    const t = e.simTimeS;
    e.start();
    expect(e.step(1)).toBe(0);
    expect(e.simTimeS).toBe(t);
  });

  it('NaN dans l’état ⇒ statut « error » et événement d’erreur', () => {
    const e = make();
    e.setParams({ feedFlowLps: Number.NaN });
    const events = collect(e, 2);
    expect(e.status).toBe('error');
    expect(events.some((ev) => ev.type === 'error')).toBe(true);
  });

  it('reste fini à température extrême (sous-découpage adaptatif, PLAN §12)', () => {
    const e = make({
      params: { modelLevel: 1, tRuptureK: 1e9, reliefEnabled: false },
      state: { CA: 1, T: 440, v: 0 },
    });
    e.setMode('manual');
    run(e, 30);
    expect(e.status).toBe('running');
    expect(Number.isFinite(T(e))).toBe(true);
    expect(CA(e)).toBeGreaterThanOrEqual(0);
  });

  it('C_A ne devient jamais négatif', () => {
    const e = make({ params: { modelLevel: 1 }, state: { CA: 0.001, T: 420, v: 0 } });
    e.setMode('manual');
    let minCa = Infinity;
    run(e, 20, () => (minCa = Math.min(minCa, CA(e))));
    expect(minCa).toBeGreaterThanOrEqual(0);
  });
});

describe('SimulationEngine — snapshot', () => {
  it('écrit une disposition cohérente et sans allocation', () => {
    const e = make();
    run(e, 30);
    const buf = new Float64Array(SNAPSHOT_SIZE);
    e.writeSnapshot(buf);
    const s = decodeSnapshot(buf);
    expect(s.simTime).toBeCloseTo(30, 9);
    expect(s.T).toBe(T(e));
    expect(s.setpoint).toBe(350);
    expect(s.mode).toBe(1);
    expect(s.status).toBe(1);
    expect(s.timeScale).toBe(1);
    expect(s.pumpEff).toBe(1);
    // à l'équilibre : chaleur générée ≈ chaleur évacuée (alimentation + enveloppe)
    expect(Math.abs(s.Qgen - s.Qremoval) / s.Qgen).toBeLessThan(0.02);
    expect(s.pressure).toBeGreaterThan(1.013e5);
    expect(s.reliefFlow).toBe(0);
    expect(s.Da).toBeCloseTo(1, 1);
    expect(s.Fc).toBeCloseTo(s.valve * SEBORG_PARAMS.fcMaxLps, 9);
    expect(Object.keys(SNAPSHOT_LAYOUT)).toHaveLength(SNAPSHOT_SIZE);
  });
});
