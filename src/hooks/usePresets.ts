'use client';

import { useSyncExternalStore } from 'react';
import { STORAGE_KEY, defaultStorage, listPresets, type StoredPreset } from '@/lib/presetsStorage';

const EMPTY: StoredPreset[] = [];
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedList: StoredPreset[] = EMPTY;

/** À appeler après toute écriture dans le stockage : notifie les composants abonnés. */
export function notifyPresetsChanged(): void {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) cb();
  };
  window.addEventListener('storage', onStorage); // modifications depuis un autre onglet
  return () => {
    listeners.delete(cb);
    window.removeEventListener('storage', onStorage);
  };
}

/** Instantané mémoïsé : `useSyncExternalStore` exige une référence stable tant que rien ne change. */
function getSnapshot(): StoredPreset[] {
  const storage = defaultStorage();
  let raw: string | null = null;
  try {
    raw = storage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    raw = null;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedList = listPresets(storage);
  }
  return cachedList;
}

/** Presets sauvegardés (localStorage), sans désaccord d'hydratation (serveur : liste vide). */
export function usePresets(): StoredPreset[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}
