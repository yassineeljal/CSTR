import { beforeEach, describe, expect, it } from 'vitest';
import { SEBORG_PARAMS, SEBORG_PID } from '@/simulation/presets/seborgBenchmark';
import {
  MAX_NAME_LENGTH,
  MAX_PRESETS,
  PresetError,
  STORAGE_KEY,
  deletePreset,
  exportPresetJson,
  listPresets,
  parsePresetJson,
  savePreset,
  validateParams,
  validatePid,
  type KeyValueStorage,
} from './presetsStorage';

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>();
  getItem(k: string) {
    return this.data.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.data.set(k, v);
  }
}

describe('validateParams / validatePid', () => {
  it('accepte le preset Seborg tel quel', () => {
    expect(validateParams(SEBORG_PARAMS)).toEqual(SEBORG_PARAMS);
    expect(validatePid(SEBORG_PID)).toEqual(SEBORG_PID);
  });
  it('rejette un champ manquant, inconnu, non fini ou hors bornes', () => {
    const missing: Partial<typeof SEBORG_PARAMS> = { ...SEBORG_PARAMS };
    delete missing.rpm;
    expect(() => validateParams(missing)).toThrow(/manquant/);
    expect(() => validateParams({ ...SEBORG_PARAMS, evil: 1 })).toThrow(/inconnu/);
    expect(() => validateParams({ ...SEBORG_PARAMS, rpm: Number.NaN })).toThrow(/fini/);
    expect(() => validateParams({ ...SEBORG_PARAMS, rpm: 9999 })).toThrow(/bornes/);
    expect(() => validateParams({ ...SEBORG_PARAMS, reliefEnabled: 1 })).toThrow(/booléen/);
    expect(() => validateParams({ ...SEBORG_PARAMS, modelLevel: 3 })).toThrow(PresetError);
    expect(() => validateParams('x')).toThrow(PresetError);
    expect(() => validateParams([])).toThrow(PresetError);
  });
  it('PID : gains négatifs, biais > 1, clés inconnues rejetés', () => {
    expect(() => validatePid({ ...SEBORG_PID, kp: -1 })).toThrow(/≥ 0/);
    expect(() => validatePid({ ...SEBORG_PID, bias: 1.5 })).toThrow(/bias/);
    expect(() => validatePid({ ...SEBORG_PID, x: 1 })).toThrow(/inconnu/);
    expect(() => validatePid({ ...SEBORG_PID, ki: undefined })).toThrow(/fini/);
  });
});

describe('export / import JSON', () => {
  it('aller-retour sans perte', () => {
    const text = exportPresetJson('Mon essai', SEBORG_PARAMS, SEBORG_PID);
    const back = parsePresetJson(text);
    expect(back.name).toBe('Mon essai');
    expect(back.params).toEqual(SEBORG_PARAMS);
    expect(back.pid).toEqual(SEBORG_PID);
  });
  it('rejette JSON invalide, mauvais format, mauvaise version, contenu piégé', () => {
    expect(() => parsePresetJson('{pas du json')).toThrow(/invalide/);
    expect(() => parsePresetJson('{"format":"autre"}')).toThrow(/non reconnu/);
    const ok = JSON.parse(exportPresetJson('a', SEBORG_PARAMS, SEBORG_PID));
    expect(() => parsePresetJson(JSON.stringify({ ...ok, version: 2 }))).toThrow(/Version/);
    expect(() =>
      parsePresetJson(
        JSON.stringify({ ...ok, params: { ...ok.params, __proto__: { x: 1 }, polluted: 1 } }),
      ),
    ).toThrow(PresetError);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('rejette un nom vide ou trop long', () => {
    expect(() => exportPresetJson('   ', SEBORG_PARAMS, SEBORG_PID)).toThrow(/vide/);
    expect(() =>
      exportPresetJson('x'.repeat(MAX_NAME_LENGTH + 1), SEBORG_PARAMS, SEBORG_PID),
    ).toThrow(/long/);
  });
});

describe('localStorage', () => {
  let storage: MemoryStorage;
  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('sauvegarde, liste (survit au « rechargement ») et supprime', () => {
    const a = savePreset('A', SEBORG_PARAMS, SEBORG_PID, storage);
    savePreset('B', { ...SEBORG_PARAMS, rpm: 80 }, SEBORG_PID, storage);
    const reloaded = listPresets(storage); // relecture depuis le stockage = rechargement
    expect(reloaded.map((p) => p.name)).toEqual(['A', 'B']);
    expect(reloaded[1]?.params.rpm).toBe(80);
    deletePreset(a.id, storage);
    expect(listPresets(storage).map((p) => p.name)).toEqual(['B']);
  });

  it('un même nom remplace l’ancien preset', () => {
    savePreset('A', SEBORG_PARAMS, SEBORG_PID, storage);
    savePreset('A', { ...SEBORG_PARAMS, rpm: 60 }, SEBORG_PID, storage);
    const list = listPresets(storage);
    expect(list).toHaveLength(1);
    expect(list[0]?.params.rpm).toBe(60);
  });

  it('ignore les entrées corrompues sans échouer', () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: 'x', createdAt: 'now', name: 'cassé', params: {}, pid: {} }, 42, null]),
    );
    expect(listPresets(storage)).toEqual([]);
    storage.setItem(STORAGE_KEY, '{pas json');
    expect(listPresets(storage)).toEqual([]);
    storage.setItem(STORAGE_KEY, '{"a":1}');
    expect(listPresets(storage)).toEqual([]);
  });

  it('stockage indisponible : lecture vide, écriture = PresetError explicite', () => {
    expect(listPresets(null)).toEqual([]);
    expect(() => savePreset('A', SEBORG_PARAMS, SEBORG_PID, null)).toThrow(/indisponible/);
  });

  it('quota dépassé / stockage bloqué → PresetError', () => {
    const full: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    };
    expect(() => savePreset('A', SEBORG_PARAMS, SEBORG_PID, full)).toThrow(/quota/);
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
    };
    expect(listPresets(broken)).toEqual([]);
  });

  it('limite le nombre de presets', () => {
    for (let i = 0; i < MAX_PRESETS; i++) savePreset(`p${i}`, SEBORG_PARAMS, SEBORG_PID, storage);
    expect(() => savePreset('un de trop', SEBORG_PARAMS, SEBORG_PID, storage)).toThrow(/Maximum/);
  });

  it('horodatage injectable', () => {
    const p = savePreset(
      'A',
      SEBORG_PARAMS,
      SEBORG_PID,
      storage,
      () => new Date('2026-01-02T03:04:05Z'),
    );
    expect(p.createdAt).toBe('2026-01-02T03:04:05.000Z');
  });
});
