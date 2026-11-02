import { beforeEach, describe, expect, it } from 'vitest';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import { resetReactorStore, useReactorStore } from '@/store/useReactorStore';
import { LoopbackTransport } from './LoopbackTransport';
import { SimulationClient } from './SimulationClient';
import { simRef, simVersion } from './simRef';

function setup(): { client: SimulationClient; transport: LoopbackTransport } {
  const transport = new LoopbackTransport();
  return { client: new SimulationClient(transport), transport };
}

describe('SimulationClient (transport en mémoire)', () => {
  beforeEach(() => {
    resetReactorStore();
    simRef.current.fill(0);
    simVersion.current = 0;
  });

  it('copie les snapshots dans simRef sans toucher au store', () => {
    const { client, transport } = setup();
    client.setTimeScale(1);
    client.start();
    const before = simVersion.current;
    transport.tick(0);
    transport.tick(500);
    expect(simVersion.current).toBeGreaterThan(before);
    expect(simRef.current[SNAPSHOT_LAYOUT.T]).toBeCloseTo(350, 0);
    expect(simRef.current[SNAPSHOT_LAYOUT.simTime]).toBeCloseTo(0.25, 9);
    expect(useReactorStore.getState().status).toBe('running');
  });

  it('ping → pong résout la promesse', async () => {
    const { client } = setup();
    await expect(client.ping(100)).resolves.toBeUndefined();
  });

  it('une commande invalide positionne store.error', () => {
    const { client } = setup();
    client.setManualValve(5);
    expect(useReactorStore.getState().error).toMatch(/setManualValve/);
  });

  it('loadScenario efface la session, charge le scénario et relaie alarmes/rupture', () => {
    const { client, transport } = setup();
    client.loadScenario('pump-failure');
    expect(useReactorStore.getState().scenarioId).toBe('pump-failure');
    client.setTimeScale(60);
    client.start();
    let t = 0;
    for (let i = 0; i < 2000 && useReactorStore.getState().status === 'running'; i++)
      transport.tick((t += 16));
    const st = useReactorStore.getState();
    expect(st.status).toBe('ruptured');
    expect(st.rupture?.tempK).toBeGreaterThanOrEqual(450);
    expect(st.alarms.some((a) => a.level === 'HH')).toBe(true);
    expect(st.log.some((l) => l.label.includes('pompe'))).toBe(true);
  });

  it('quench désarme le bouton et sauve le scénario', () => {
    const { client, transport } = setup();
    client.loadScenario('emergency-quench');
    useReactorStore.getState().setQuenchArmed(true);
    client.setTimeScale(10);
    client.start();
    client.quench();
    expect(useReactorStore.getState().quenchArmed).toBe(false);
    let t = 0;
    for (let i = 0; i < 600; i++) transport.tick((t += 16));
    expect(useReactorStore.getState().status).not.toBe('ruptured');
  });

  it('setMode / setParams / setPid mettent à jour le store ET le moteur', () => {
    const { client, transport } = setup();
    client.setMode('manual');
    client.setManualValve(0.9);
    client.setParams({ rpm: 60 });
    client.setPid({ setpointK: 345 });
    const st = useReactorStore.getState();
    expect(st.mode).toBe('manual');
    expect(st.manualValve).toBe(0.9);
    expect(st.params.rpm).toBe(60);
    expect(st.pid.setpointK).toBe(345);
    client.start();
    transport.tick(0);
    expect(simRef.current[SNAPSHOT_LAYOUT.rpm]).toBe(60);
    expect(simRef.current[SNAPSHOT_LAYOUT.setpoint]).toBe(345);
    expect(simRef.current[SNAPSHOT_LAYOUT.mode]).toBe(0);
  });

  it('dispose détache les écouteurs', () => {
    const { client, transport } = setup();
    client.dispose();
    const v = simVersion.current;
    transport.send({ type: 'start' });
    expect(simVersion.current).toBe(v);
  });
});
