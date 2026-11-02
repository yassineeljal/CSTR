'use client';

import { useEffect } from 'react';
import { simRef } from '@/client/simRef';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';

/**
 * Publie l'état de simulation (température, temps) dans `document.documentElement.dataset` toutes
 * les 500 ms : lecture seule pour les tests e2e et l'audit. Indépendant du Canvas : disponible
 * aussi en mode 2D (WebGL absent).
 */
export function SimDataAttributes() {
  useEffect(() => {
    const id = setInterval(() => {
      const d = document.documentElement.dataset;
      d.simTemp = (simRef.current[SNAPSHOT_LAYOUT.T] as number).toFixed(1);
      d.simTime = (simRef.current[SNAPSHOT_LAYOUT.simTime] as number).toFixed(1);
    }, 500);
    return () => clearInterval(id);
  }, []);
  return null;
}
