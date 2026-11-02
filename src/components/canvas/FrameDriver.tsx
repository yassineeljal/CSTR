'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { subscribeSnapshots } from '@/client/simRef';
import { useReactorStore } from '@/store/useReactorStore';

/**
 * Pilote le rendu « à la demande » (`frameloop="demand"`) : une image n'est produite que lorsque
 * l'état change — chaque snapshot du moteur (≈ 60 Hz en simulation) ou chaque modification de
 * l'état lent (coupe, mode inspection, qualité…). Caméra : OrbitControls invalide lui-même.
 * Au repos (simulation arrêtée, caméra immobile) le coût CPU/GPU est nul.
 */
export function FrameDriver() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const offSnapshots = subscribeSnapshots(() => invalidate());
    const offStore = useReactorStore.subscribe(() => invalidate());
    invalidate();
    return () => {
      offSnapshots();
      offStore();
    };
  }, [invalidate]);
  return null;
}
