import { PARAM_BOUNDS } from '@/simulation/protocol';
import { SEBORG_PARAMS, SEBORG_PID } from '@/simulation/presets/seborgBenchmark';
import type { PidSettings, ReactorParams } from '@/simulation/types';

/**
 * Presets utilisateur (S5-L11) : jeux de paramètres sauvegardés dans localStorage (try/catch :
 * mode privé, quota, désactivation) et import/export JSON validé.
 */

export const PRESET_FORMAT_VERSION = 1;
export const STORAGE_KEY = 'cstr-digital-twin:presets:v1';
export const MAX_PRESETS = 50;
export const MAX_NAME_LENGTH = 60;

export interface StoredPreset {
  id: string;
  name: string;
  /** Date ISO de création. */
  createdAt: string;
  params: ReactorParams;
  pid: PidSettings;
}

/** Fichier JSON d'échange. */
export interface PresetFile {
  format: 'cstr-digital-twin-preset';
  version: typeof PRESET_FORMAT_VERSION;
  name: string;
  params: ReactorParams;
  pid: PidSettings;
}

export class PresetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PresetError';
  }
}

/** Sous-ensemble minimal de l'API Storage (injectable pour les tests). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PARAM_KEYS = Object.keys(SEBORG_PARAMS) as (keyof ReactorParams)[];
const PID_KEYS = Object.keys(SEBORG_PID) as (keyof PidSettings)[];
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valide et normalise un jeu de paramètres inconnu. @throws PresetError */
export function validateParams(raw: unknown): ReactorParams {
  if (!isRecord(raw)) throw new PresetError('« params » doit être un objet');
  const out: Record<string, unknown> = {};
  for (const key of PARAM_KEYS) {
    const value = raw[key];
    const ref = SEBORG_PARAMS[key];
    if (value === undefined) throw new PresetError(`Paramètre manquant : ${key}`);
    if (typeof ref === 'boolean') {
      if (typeof value !== 'boolean') throw new PresetError(`${key} doit être un booléen`);
    } else {
      if (typeof value !== 'number' || !Number.isFinite(value))
        throw new PresetError(`${key} doit être un nombre fini`);
      const bounds = PARAM_BOUNDS[key];
      if (bounds && (value < bounds[0] || value > bounds[1])) {
        throw new PresetError(`${key} hors bornes [${bounds[0]}, ${bounds[1]}]`);
      }
    }
    out[key] = value;
  }
  for (const key of Object.keys(raw)) {
    if (!(PARAM_KEYS as string[]).includes(key))
      throw new PresetError(`Paramètre inconnu : ${key}`);
  }
  if (out.modelLevel !== 1 && out.modelLevel !== 2)
    throw new PresetError('modelLevel doit valoir 1 ou 2');
  return out as unknown as ReactorParams;
}

/** Valide un réglage PID. @throws PresetError */
export function validatePid(raw: unknown): PidSettings {
  if (!isRecord(raw)) throw new PresetError('« pid » doit être un objet');
  const out: Record<string, number> = {};
  for (const key of PID_KEYS) {
    const value = raw[key];
    if (typeof value !== 'number' || !Number.isFinite(value))
      throw new PresetError(`pid.${key} doit être un nombre fini`);
    if (key !== 'setpointK' && value < 0) throw new PresetError(`pid.${key} doit être ≥ 0`);
    if (key === 'bias' && value > 1) throw new PresetError('pid.bias doit être ≤ 1');
    out[key] = value;
  }
  for (const key of Object.keys(raw)) {
    if (!(PID_KEYS as string[]).includes(key))
      throw new PresetError(`Réglage PID inconnu : ${key}`);
  }
  return out as unknown as PidSettings;
}

function validateName(name: unknown): string {
  if (typeof name !== 'string') throw new PresetError('Le nom est requis');
  const trimmed = name.trim();
  if (trimmed.length === 0) throw new PresetError('Le nom ne peut pas être vide');
  if (trimmed.length > MAX_NAME_LENGTH)
    throw new PresetError(`Nom trop long (max ${MAX_NAME_LENGTH})`);
  return trimmed;
}

/** Sérialise un preset au format d'échange. */
export function exportPresetJson(name: string, params: ReactorParams, pid: PidSettings): string {
  const file: PresetFile = {
    format: 'cstr-digital-twin-preset',
    version: PRESET_FORMAT_VERSION,
    name: validateName(name),
    params: validateParams(params),
    pid: validatePid(pid),
  };
  return JSON.stringify(file, null, 2);
}

/** Analyse un fichier d'échange. @throws PresetError */
export function parsePresetJson(text: string): PresetFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new PresetError('Fichier JSON invalide');
  }
  if (!isRecord(raw) || raw.format !== 'cstr-digital-twin-preset')
    throw new PresetError('Format de fichier non reconnu');
  if (raw.version !== PRESET_FORMAT_VERSION)
    throw new PresetError(`Version non supportée : ${String(raw.version)}`);
  return {
    format: 'cstr-digital-twin-preset',
    version: PRESET_FORMAT_VERSION,
    name: validateName(raw.name),
    params: validateParams(raw.params),
    pid: validatePid(raw.pid),
  };
}

/** Stockage par défaut : localStorage s'il est utilisable, sinon `null`. */
export function defaultStorage(): KeyValueStorage | null {
  try {
    if (typeof window === 'undefined') return null;
    const probe = '__cstr_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Liste les presets sauvegardés (ignore silencieusement les entrées corrompues). */
export function listPresets(storage: KeyValueStorage | null = defaultStorage()): StoredPreset[] {
  if (!storage) return [];
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  try {
    const arr: unknown = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    const out: StoredPreset[] = [];
    for (const item of arr) {
      if (!isRecord(item) || typeof item.id !== 'string' || typeof item.createdAt !== 'string')
        continue;
      try {
        out.push({
          id: item.id,
          createdAt: item.createdAt,
          name: validateName(item.name),
          params: validateParams(item.params),
          pid: validatePid(item.pid),
        });
      } catch {
        // entrée corrompue ou d'une ancienne version : ignorée
      }
    }
    return out;
  } catch {
    return [];
  }
}

function persist(presets: StoredPreset[], storage: KeyValueStorage | null): void {
  if (!storage) throw new PresetError('Stockage local indisponible');
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    throw new PresetError('Écriture impossible (quota dépassé ou stockage bloqué)');
  }
}

function newId(): string {
  const c = globalThis.crypto;
  return c?.randomUUID
    ? c.randomUUID()
    : `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Enregistre un preset (même nom → remplacé). @throws PresetError */
export function savePreset(
  name: string,
  params: ReactorParams,
  pid: PidSettings,
  storage: KeyValueStorage | null = defaultStorage(),
  now: () => Date = () => new Date(),
): StoredPreset {
  const clean = validateName(name);
  const preset: StoredPreset = {
    id: newId(),
    name: clean,
    createdAt: now().toISOString(),
    params: validateParams(params),
    pid: validatePid(pid),
  };
  const existing = listPresets(storage).filter((p) => p.name !== clean);
  if (existing.length >= MAX_PRESETS)
    throw new PresetError(`Maximum ${MAX_PRESETS} presets atteint`);
  persist([...existing, preset], storage);
  return preset;
}

export function deletePreset(id: string, storage: KeyValueStorage | null = defaultStorage()): void {
  persist(
    listPresets(storage).filter((p) => p.id !== id),
    storage,
  );
}
