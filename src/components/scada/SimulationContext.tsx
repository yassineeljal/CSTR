'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { SimulationClient } from '@/client/SimulationClient';
import { useSimulation } from '@/hooks/useSimulation';

const SimulationContext = createContext<SimulationClient | null>(null);

/** Crée le client de simulation une fois et le met à disposition de tous les panneaux. */
export function SimulationProvider({ children }: { children: ReactNode }) {
  const sim = useSimulation();
  return <SimulationContext.Provider value={sim}>{children}</SimulationContext.Provider>;
}

/** Client de simulation, ou `null` tant que le Worker n'est pas prêt (rendu serveur compris). */
export function useSim(): SimulationClient | null {
  return useContext(SimulationContext);
}
