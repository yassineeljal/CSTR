'use client';

import { useEffect } from 'react';
import { Panel } from '@/components/ui/Panel';
import { Readout } from '@/components/ui/Readout';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import { useReactorStore } from '@/store/useReactorStore';
import { useSim } from './SimulationContext';

/** Durée pendant laquelle le quench reste armé sans action [ms]. */
export const QUENCH_ARM_TIMEOUT_MS = 6000;

/**
 * Quench d'urgence en deux temps (S5-L07) : 1) armer (le couvercle se soulève), 2) déclencher.
 * L'armement expire seul après 6 s. Le raccourci clavier Q arme ; il ne déclenche jamais.
 */
export function QuenchButton() {
  const sim = useSim();
  const armed = useReactorStore((s) => s.quenchArmed);
  const active = useReactorStore((s) => s.plant.quenchActive);
  const status = useReactorStore((s) => s.status);
  const setArmed = useReactorStore((s) => s.setQuenchArmed);
  const usable = !!sim && (status === 'running' || status === 'paused') && !active;

  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), QUENCH_ARM_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [armed, setArmed]);

  // Un armement ne survit pas à la perte de disponibilité (pause → rupture, etc.)
  useEffect(() => {
    if (armed && !usable) setArmed(false);
  }, [armed, usable, setArmed]);

  return (
    <Panel id="panel-quench" title="Arrêt d’urgence">
      <div className="relative">
        <button
          type="button"
          data-testid="quench-arm"
          aria-pressed={armed}
          disabled={!usable || armed}
          onClick={() => setArmed(true)}
          className="border-line bg-panel-2 hover:bg-line focus-visible:outline-accent w-full rounded border px-3 py-2 font-mono text-xs font-medium text-zinc-200 focus-visible:outline focus-visible:outline-2 disabled:opacity-40"
        >
          {armed ? 'Quench armé' : 'Armer le quench  [Q]'}
        </button>
        <button
          type="button"
          data-testid="quench-fire"
          disabled={!armed}
          onClick={() => sim?.quench()}
          aria-label="Déclencher le quench d’urgence"
          className={`focus-visible:outline-accent mt-2 w-full rounded border-2 px-3 py-3 font-mono text-sm font-bold tracking-wider transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
            armed
              ? 'border-red-300 bg-red-600 text-white shadow-[0_0_18px_rgba(244,63,94,0.55)] hover:bg-red-500'
              : 'cursor-not-allowed border-red-950 bg-red-950/60 text-red-900'
          }`}
        >
          DÉCLENCHER LE QUENCH
        </button>
      </div>
      <p className="text-muted mt-2 font-mono text-[10px] leading-snug">
        Injecte un diluant froid, ajoute un inhibiteur et coupe l’alimentation. Rétablissez ensuite
        le refroidissement.
      </p>
      {active && (
        <div className="mt-2" role="status" aria-live="polite">
          <div className="text-warn flex justify-between font-mono text-[11px]">
            <span>Injection en cours…</span>
            <Readout
              format={(s) => `${((s[SNAPSHOT_LAYOUT.quench] as number) * 100).toFixed(0)} %`}
            />
          </div>
        </div>
      )}
    </Panel>
  );
}
