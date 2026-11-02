'use client';

import { useEffect } from 'react';
import type { SimulationClient } from '@/client/SimulationClient';
import { visibilityAction } from '@/lib/quality';
import { useReactorStore } from '@/store/useReactorStore';

/**
 * Pause automatique quand l'onglet est masqué, reprise au retour (S7-L04). La simulation n'avance
 * donc pas dans le vide et aucune « spirale de pas » n'est possible au retour (le worker plafonne
 * déjà le dt réel d'un tick). Ne relance que ce qu'elle a elle-même mis en pause.
 */
export function useAutoPauseOnHidden(sim: SimulationClient | null): void {
  useEffect(() => {
    if (!sim) return;
    let pausedByUs = false;
    const onChange = () => {
      const { status, ui } = useReactorStore.getState();
      const action = visibilityAction({
        hidden: document.hidden,
        enabled: ui.autoPauseHidden,
        status,
        pausedByUs,
      });
      if (action === 'pause') {
        sim.pause();
        pausedByUs = true;
      } else if (action === 'resume') {
        sim.start();
        pausedByUs = false;
      } else if (!document.hidden) {
        pausedByUs = false;
      }
    };
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, [sim]);
}
