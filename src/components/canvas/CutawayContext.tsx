'use client';

import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import { useReactorStore } from '@/store/useReactorStore';
import { createWedgeUniforms, setWedgeAngle, type WedgeUniforms } from './wedge';

export interface CutawayState {
  uniforms: WedgeUniforms;
  /** Angle de coupe courant w ∈ [0, π/2] (mutable, lu dans useFrame). */
  angle: { current: number };
}

const CutawayContext = createContext<CutawayState | null>(null);

const FULL_CUT = Math.PI / 2;
/** Raideur de l'animation d'ouverture/fermeture de la coupe [s⁻¹]. */
const CUT_RATE = 5;

/**
 * Anime l'angle de coupe vers sa cible (store `ui.cutaway`) et alimente les uniforms de tous les
 * matériaux découpés. Lecture transitoire du store : aucun re-rendu React (ADR-005).
 */
export function CutawayProvider({ children }: { children: ReactNode }) {
  const uniforms = useMemo(() => createWedgeUniforms(), []);
  const angle = useRef(FULL_CUT);
  const state = useMemo<CutawayState>(() => ({ uniforms, angle }), [uniforms, angle]);
  useFrame((_, delta) => {
    const target = useReactorStore.getState().ui.cutaway ? FULL_CUT : 0;
    const a = angle.current;
    const next = a + (target - a) * (1 - Math.exp(-CUT_RATE * Math.min(delta, 0.1)));
    angle.current = Math.abs(next - target) < 1e-3 ? target : next;
    setWedgeAngle(uniforms, angle.current);
  });
  return <CutawayContext.Provider value={state}>{children}</CutawayContext.Provider>;
}

export function useCutaway(): CutawayState {
  const ctx = useContext(CutawayContext);
  if (!ctx) throw new Error('useCutaway doit être utilisé dans <CutawayProvider>');
  return ctx;
}
