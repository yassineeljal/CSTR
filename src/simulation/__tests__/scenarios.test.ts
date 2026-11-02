import { describe, expect, it } from 'vitest';
import { SimulationEngine, type EngineEvent } from '../engine';
import { SCENARIOS, SCENARIO_IDS } from '../scenarios';
import { SEBORG_PARAMS, SEBORG_PID, SEBORG_STEADY_STATE } from '../presets/seborgBenchmark';
import type { ScenarioId } from '../types';

const make = (): SimulationEngine =>
  new SimulationEngine({
    params: SEBORG_PARAMS,
    initialState: SEBORG_STEADY_STATE,
    pid: SEBORG_PID,
  });

interface Trace {
  events: EngineEvent[];
  maxT: number;
  maxValve: number;
  endT: number;
  rupturedAt: number | null;
}
function play(
  e: SimulationEngine,
  seconds: number,
  hook?: (t: number, events: EngineEvent[]) => void,
): Trace {
  const trace: Trace = { events: [], maxT: 0, maxValve: 0, endT: 0, rupturedAt: null };
  e.setTimeScale(1);
  e.start();
  for (let i = 0; i < seconds && e.status === 'running'; i++) {
    e.step(1);
    const evs = e.takeEvents();
    trace.events.push(...evs);
    trace.maxT = Math.max(trace.maxT, e.state[1] as number);
    trace.maxValve = Math.max(trace.maxValve, e.state[3] as number);
    hook?.(e.simTimeS, evs);
  }
  trace.endT = e.state[1] as number;
  if (e.status === 'ruptured') trace.rupturedAt = e.simTimeS;
  return trace;
}
const alarms = (t: Trace, level: string): boolean =>
  t.events.some((e) => e.type === 'alarm' && e.alarm.level === level && e.alarm.active);

describe('définition des scénarios', () => {
  it('expose les 4 scénarios du plan, complets', () => {
    expect(SCENARIO_IDS).toEqual(['cold-start', 'pump-failure', 'fouling', 'emergency-quench']);
    for (const id of SCENARIO_IDS) {
      const s = SCENARIOS[id];
      expect(s.id).toBe(id);
      expect(s.name.length).toBeGreaterThan(3);
      expect(s.objectives.length).toBeGreaterThan(0);
      expect(s.expectedOutcome.length).toBeGreaterThan(10);
    }
  });
});

describe('scénario 1 — démarrage à froid', () => {
  it('monte à la consigne (350 K), sans alarme HH ni rupture', () => {
    const e = make();
    e.loadScenario('cold-start');
    expect(e.state[1]).toBe(300);
    const tr = play(e, 900);
    expect(alarms(tr, 'HH')).toBe(false);
    expect(tr.rupturedAt).toBeNull();
    expect(Math.abs(tr.endT - 350)).toBeLessThan(1);
  });
});

describe('scénario 2 — panne de la pompe de refroidissement', () => {
  it('l’événement scripté survient à t = 20 s', () => {
    const e = make();
    e.loadScenario('pump-failure');
    const tr = play(e, 25);
    const ev = tr.events.find((x) => x.type === 'scenarioEvent');
    expect(ev).toBeDefined();
    expect(ev && ev.type === 'scenarioEvent' ? ev.simTimeS : -1).toBeCloseTo(20, 1);
    expect(e.inputs.pumpEfficiency).toBe(0);
  });

  it('sans intervention : alarmes H puis HH, soupape ouverte, puis rupture', () => {
    const e = make();
    e.loadScenario('pump-failure');
    let reliefSeen = false;
    const tr = play(e, 120, () => (reliefSeen ||= e.inputs.reliefOpen === 1));
    expect(alarms(tr, 'H')).toBe(true);
    expect(alarms(tr, 'HH')).toBe(true);
    expect(reliefSeen).toBe(true);
    expect(tr.rupturedAt).not.toBeNull();
  });

  it('S5-L12 : quench déclenché à l’alarme HH ⇒ pas de rupture', () => {
    const e = make();
    e.loadScenario('pump-failure');
    let quenched = false;
    const tr = play(e, 150, (_t, evs) => {
      if (
        !quenched &&
        evs.some((x) => x.type === 'alarm' && x.alarm.level === 'HH' && x.alarm.active)
      ) {
        e.quench();
        quenched = true;
      }
    });
    expect(quenched).toBe(true);
    expect(tr.rupturedAt).toBeNull();
    expect(tr.maxT).toBeLessThan(450);
  });
});

describe('scénario 3 — encrassement', () => {
  it('l’encrassement de 1 à 0,4 est linéaire sur 120 s (t = 10 → 130 s)', () => {
    const e = make();
    e.loadScenario('fouling');
    const samples = new Map<number, number>();
    play(e, 140, (t) => samples.set(Math.round(t), e.inputs.fouling));
    expect(samples.get(5)).toBe(1);
    expect(samples.get(70)).toBeCloseTo(0.7, 2);
    expect(samples.get(130)).toBeCloseTo(0.4, 2);
    expect(samples.get(140)).toBeCloseTo(0.4, 6);
  });

  it('la vanne sature à mesure que le transfert se dégrade', () => {
    const e = make();
    e.loadScenario('fouling');
    const tr = play(e, 200);
    expect(tr.maxValve).toBeGreaterThan(0.9);
  });
});

describe('scénario 4 — quench d’urgence', () => {
  it('démarre en pause à T ≥ 390 K, pompe en panne', () => {
    const e = make();
    e.loadScenario('emergency-quench');
    expect(e.status).toBe('paused');
    expect(e.state[1] as number).toBeGreaterThanOrEqual(390);
    expect(e.state[1] as number).toBeLessThan(400);
    expect(e.inputs.pumpEfficiency).toBe(0);
  });

  it('sans quench : le réacteur est perdu', () => {
    const e = make();
    e.loadScenario('emergency-quench');
    expect(play(e, 60).rupturedAt).not.toBeNull();
  });

  it('avec quench immédiat : T chute puis reste confiné pendant l’effet de l’inhibiteur', () => {
    const e = make();
    e.loadScenario('emergency-quench');
    e.start();
    e.quench();
    const tr = play(e, 150);
    expect(tr.rupturedAt).toBeNull();
    expect(e.state[1] as number).toBeLessThan(380);
  });

  it('le quench applique le bilan de mélange : C_A·V/(V+V_q) et (V·T+V_q·T_q)/(V+V_q)', () => {
    const e = make();
    e.loadScenario('emergency-quench');
    const ca0 = e.state[0] as number;
    const t0 = e.state[1] as number;
    e.quench();
    e.setTimeScale(1);
    e.start();
    e.advanceSteps(1);
    // après l'injection complète (2 s = 200 pas) le mélange cumulé suit la formule du plan (§4.8)
    e.advanceSteps(199);
    const V = SEBORG_PARAMS.volumeL;
    const Vq = 60;
    // 200 pas de réaction se superposent : on vérifie la dilution/le refroidissement avec marge
    expect(e.state[0] as number).toBeLessThan(ca0 * (V / (V + Vq)) * 1.05);
    expect(e.state[1] as number).toBeLessThan((V * t0 + Vq * 280) / (V + Vq) + 10);
    expect(e.state[1] as number).toBeGreaterThan(300);
  });

  it('un second quench pendant l’injection est ignoré', () => {
    const e = make();
    e.loadScenario('emergency-quench');
    e.quench();
    e.quench();
    const quenchEvents = e.takeEvents().filter((x) => x.type === 'scenarioEvent');
    expect(quenchEvents).toHaveLength(1);
  });
});

describe('chargement de scénario', () => {
  it('reset() après un scénario le recharge dans son état initial', () => {
    const e = make();
    const id: ScenarioId = 'pump-failure';
    e.loadScenario(id);
    play(e, 30);
    e.reset();
    expect(e.simTimeS).toBe(0);
    expect(e.inputs.pumpEfficiency).toBe(1);
    expect(e.status).toBe('ready');
    expect(e.activeScenario?.id).toBe(id);
  });
});
