'use client';

import { useEffect } from 'react';
import type { SimulationClient } from '@/client/SimulationClient';
import { resolveShortcut } from '@/lib/shortcuts';
import { useReactorStore } from '@/store/useReactorStore';

/** Raccourcis clavier globaux (S5-L10). Le quench n'est jamais déclenché au clavier : seulement armé. */
export function useKeyboardShortcuts(sim: SimulationClient | null): void {
  useEffect(() => {
    if (!sim) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target instanceof HTMLElement ? e.target : null;
      const action = resolveShortcut({
        key: e.key,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        altKey: e.altKey,
        targetTag: target?.tagName,
        targetEditable: target?.isContentEditable,
      });
      if (!action) return;
      const store = useReactorStore.getState();
      switch (action.type) {
        case 'toggleRun':
          e.preventDefault();
          if (store.status === 'running') sim.pause();
          else if (store.status === 'ready' || store.status === 'paused') sim.start();
          break;
        case 'armQuench':
          if (store.status === 'running' || store.status === 'paused') store.setQuenchArmed(true);
          break;
        case 'reset':
          sim.reset();
          break;
        case 'toggleCutaway':
          store.patchUi({ cutaway: !store.ui.cutaway });
          break;
        case 'toggleInspection':
          store.patchUi({ inspectionMode: !store.ui.inspectionMode, theorySheet: null });
          break;
        case 'loadScenario':
          sim.loadScenario(action.id);
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sim]);
}
