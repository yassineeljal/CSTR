import { describe, expect, it } from 'vitest';
import {
  SNAPSHOT_LAYOUT,
  SNAPSHOT_SIZE,
  decodeSnapshot,
  encodeSnapshot,
  validateCommand,
  type SnapshotData,
} from '../protocol';
import { SEBORG_PARAMS, SEBORG_PID, SEBORG_STEADY_STATE } from '../presets/seborgBenchmark';

describe('SNAPSHOT_LAYOUT', () => {
  it('a des indices uniques et contigus 0..SNAPSHOT_SIZE−1', () => {
    const idx = Object.values(SNAPSHOT_LAYOUT).sort((a, b) => a - b);
    expect(idx).toEqual(Array.from({ length: SNAPSHOT_SIZE }, (_, i) => i));
  });

  it('aller-retour encode → decode sans perte', () => {
    const data = {} as SnapshotData;
    (Object.keys(SNAPSHOT_LAYOUT) as (keyof SnapshotData)[]).forEach((k, i) => {
      data[k] = i * 1.25 + 0.001;
    });
    expect(decodeSnapshot(encodeSnapshot(data))).toEqual(data);
  });

  it('decode rejette un buffer trop court', () => {
    expect(() => decodeSnapshot(new Float64Array(3))).toThrow(RangeError);
  });
});

describe('validateCommand', () => {
  it('accepte les commandes valides', () => {
    expect(validateCommand({ type: 'start' })).toBeNull();
    expect(validateCommand({ type: 'setManualValve', value: 0.4 })).toBeNull();
    expect(validateCommand({ type: 'setFeedFactor', value: 0 })).toBeNull();
    expect(validateCommand({ type: 'setTimeScale', value: 10 })).toBeNull();
    expect(
      validateCommand({ type: 'setParams', patch: { rpm: 100, reliefEnabled: false } }),
    ).toBeNull();
    expect(validateCommand({ type: 'setPid', patch: { kp: 0.2, setpointK: 345 } })).toBeNull();
  });

  it('rejette NaN, Infinity et valeurs hors bornes', () => {
    expect(validateCommand({ type: 'setManualValve', value: Number.NaN })).not.toBeNull();
    expect(validateCommand({ type: 'setManualValve', value: 1.2 })).not.toBeNull();
    expect(validateCommand({ type: 'setPumpEfficiency', value: -0.1 })).not.toBeNull();
    expect(validateCommand({ type: 'setFeedFactor', value: 1.5 })).not.toBeNull();
    expect(validateCommand({ type: 'setTimeScale', value: 0 })).not.toBeNull();
    expect(
      validateCommand({ type: 'setTimeScale', value: Number.POSITIVE_INFINITY }),
    ).not.toBeNull();
    expect(validateCommand({ type: 'setParams', patch: { rpm: -5 } })).not.toBeNull();
    expect(
      validateCommand({ type: 'setParams', patch: { feedFlowLps: Number.NaN } }),
    ).not.toBeNull();
    expect(validateCommand({ type: 'setPid', patch: { kp: -1 } })).not.toBeNull();
    expect(validateCommand({ type: 'setPid', patch: { bias: 2 } })).not.toBeNull();
    expect(
      validateCommand({
        type: 'init',
        params: SEBORG_PARAMS,
        pid: SEBORG_PID,
        initialState: { ...SEBORG_STEADY_STATE, T: Number.NaN },
      }),
    ).not.toBeNull();
  });
});
