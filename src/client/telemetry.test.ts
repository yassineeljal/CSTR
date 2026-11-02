import { beforeEach, describe, expect, it } from 'vitest';
import { SNAPSHOT_LAYOUT, SNAPSHOT_SIZE } from '@/simulation/protocol';
import {
  SAMPLE_INTERVAL_S,
  TELEMETRY_CAPACITY,
  resetTelemetry,
  sampleTelemetry,
  telemetry,
  telemetryIndex,
} from './telemetry';

const snap = (t: number, T = 350): Float64Array => {
  const s = new Float64Array(SNAPSHOT_SIZE);
  s[SNAPSHOT_LAYOUT.simTime] = t;
  s[SNAPSHOT_LAYOUT.T] = T;
  s[SNAPSHOT_LAYOUT.setpoint] = 350;
  s[SNAPSHOT_LAYOUT.Qgen] = 41_667;
  return s;
};

describe('télémétrie', () => {
  beforeEach(() => resetTelemetry());

  it('échantillonne au pas de temps simulé, pas à chaque snapshot', () => {
    for (let i = 0; i < 100; i++) sampleTelemetry(snap(i * 0.016)); // 60 Hz sur 1,6 s
    expect(telemetry.size).toBe(Math.floor(1.584 / SAMPLE_INTERVAL_S) + 1);
  });

  it('un seul snapshot par intervalle à ×60 (≈ 1 s simulée par snapshot)', () => {
    for (let i = 0; i < 10; i++) sampleTelemetry(snap(i * 0.96));
    expect(telemetry.size).toBe(10);
  });

  it('range les canaux aux bons indices, en unités moteur', () => {
    sampleTelemetry(snap(0, 351.5));
    expect(telemetry.channel(0)[0]).toBe(0);
    expect(telemetry.channel(telemetryIndex('T'))[0]).toBe(351.5);
    expect(telemetry.channel(telemetryIndex('setpoint'))[0]).toBe(350);
    expect(telemetry.channel(telemetryIndex('Qgen'))[0]).toBe(41_667);
  });

  it('efface le tampon quand le temps simulé recule (reset, nouveau scénario)', () => {
    for (let i = 0; i < 20; i++) sampleTelemetry(snap(i));
    sampleTelemetry(snap(0.5));
    expect(telemetry.size).toBe(1);
    expect(telemetry.lastTime).toBe(0.5);
  });

  it('ne dépasse jamais la capacité sur une longue session', () => {
    for (let i = 0; i < TELEMETRY_CAPACITY * 2; i++) sampleTelemetry(snap(i * SAMPLE_INTERVAL_S));
    expect(telemetry.size).toBeLessThanOrEqual(TELEMETRY_CAPACITY);
  });
});
