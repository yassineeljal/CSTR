'use client';

import { useEffect, useState } from 'react';
import { acquireSimulationClient, releaseSimulationClient } from '@/client';
import type { SimulationClient } from '@/client/SimulationClient';

/**
 * Donne accès au client de simulation (créé après le montage : le Worker n'existe pas côté
 * serveur). Retourne `null` pendant le rendu serveur et le premier rendu client.
 */
export function useSimulation(): SimulationClient | null {
  const [client, setClient] = useState<SimulationClient | null>(null);
  useEffect(() => {
    const c = acquireSimulationClient();
    // Initialisation unique après montage (le Worker n'existe pas côté serveur).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClient(c);
    return () => releaseSimulationClient();
  }, []);
  return client;
}
