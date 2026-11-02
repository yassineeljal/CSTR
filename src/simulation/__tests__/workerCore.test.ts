import { describe, expect, it } from 'vitest';
import { SNAPSHOT_LAYOUT, type WorkerEvent } from '../protocol';
import { MAX_TICK_DT_S, SimulationHost } from '../workerCore';

function setup(): { host: SimulationHost; events: WorkerEvent[]; snapshots: () => Float64Array[] } {
  const events: WorkerEvent[] = [];
  const host = new SimulationHost((e) => events.push(e));
  return {
    host,
    events,
    snapshots: () => events.flatMap((e) => (e.type === 'snapshot' ? [e.buffer] : [])),
  };
}

describe('SimulationHost', () => {
  it('répond pong à ping avec le même jeton (S1-L05)', () => {
    const { host, events } = setup();
    host.handle({ type: 'ping', token: 42 });
    expect(events).toEqual([{ type: 'pong', token: 42 }]);
  });

  it('rejette une commande invalide par un événement error, sans changer d’état', () => {
    const { host, events } = setup();
    host.handle({ type: 'setManualValve', value: 7 });
    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('error');
    expect(host.status).toBe('ready');
  });

  it('ne produit rien tant que la simulation ne tourne pas', () => {
    const { host, events } = setup();
    host.tick(0);
    host.tick(16);
    expect(events).toHaveLength(0);
  });

  it('publie statut puis snapshot au démarrage, puis un snapshot par tick', () => {
    const { host, events, snapshots } = setup();
    host.handle({ type: 'setTimeScale', value: 1 });
    events.length = 0;
    host.handle({ type: 'start' });
    expect(events.map((e) => e.type)).toEqual(['status', 'snapshot']);
    host.tick(1000); // premier tick : dt = 0
    host.tick(1016);
    host.tick(1032);
    expect(snapshots()).toHaveLength(4);
    const last = snapshots().at(-1) as Float64Array;
    expect(last[SNAPSHOT_LAYOUT.simTime]).toBeCloseTo(0.03, 9); // 3 pas ; le reliquat de 2 ms est reporté
  });

  it('plafonne le dt réel d’un tick (onglet en arrière-plan)', () => {
    const { host, snapshots } = setup();
    host.handle({ type: 'setTimeScale', value: 1 });
    host.handle({ type: 'start' });
    host.tick(0);
    host.tick(60_000); // 60 s sans tick
    const last = snapshots().at(-1) as Float64Array;
    expect(last[SNAPSHOT_LAYOUT.simTime]).toBeCloseTo(MAX_TICK_DT_S, 9);
  });

  it('transfère un buffer neuf à chaque snapshot (pas d’aliasing)', () => {
    const { host, snapshots } = setup();
    host.handle({ type: 'start' });
    host.tick(0);
    host.tick(16);
    const [a, b] = snapshots().slice(-2);
    expect(a?.buffer).not.toBe(b?.buffer);
  });

  it('relaie les événements du moteur (alarme, rupture) et le changement de statut', () => {
    const { host, events } = setup();
    host.handle({ type: 'loadScenario', id: 'pump-failure' });
    host.handle({ type: 'setTimeScale', value: 60 });
    host.handle({ type: 'start' });
    let t = 0;
    for (let i = 0; i < 2000 && host.status === 'running'; i++) host.tick((t += 16));
    const types = new Set(events.map((e) => e.type));
    expect(types.has('alarm')).toBe(true);
    expect(types.has('scenarioEvent')).toBe(true);
    expect(types.has('rupture')).toBe(true);
    const statuses = events.flatMap((e) => (e.type === 'status' ? [e.status] : []));
    expect(statuses).toContain('running');
    expect(statuses.at(-1)).toBe('ruptured');
  });

  it('init remplace le moteur ; pause fige le temps', () => {
    const { host, snapshots } = setup();
    host.handle({ type: 'start' });
    host.tick(0);
    host.tick(100);
    host.handle({ type: 'pause' });
    const frozen = (snapshots().at(-1) as Float64Array)[SNAPSHOT_LAYOUT.simTime];
    host.tick(200);
    host.tick(300);
    expect((snapshots().at(-1) as Float64Array)[SNAPSHOT_LAYOUT.simTime]).toBe(frozen);
  });
});
