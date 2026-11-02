'use client';

import { Panel } from '@/components/ui/Panel';
import { SCENARIOS, SCENARIO_IDS } from '@/simulation/scenarios';
import { useReactorStore } from '@/store/useReactorStore';
import { useSim } from './SimulationContext';

/** Liste des 4 scénarios, description et objectifs ; le chargement = reset + init + script (S5-L08). */
export function ScenarioSelector() {
  const sim = useSim();
  const active = useReactorStore((s) => s.scenarioId);
  const def = active ? SCENARIOS[active] : null;

  return (
    <Panel id="panel-scenarios" title="Scénarios">
      <ul className="space-y-1" aria-label="Scénarios disponibles">
        {SCENARIO_IDS.map((id, i) => {
          const s = SCENARIOS[id];
          const isActive = active === id;
          return (
            <li key={id}>
              <button
                type="button"
                disabled={!sim}
                aria-pressed={isActive}
                data-testid={`scenario-${id}`}
                onClick={() => {
                  sim?.loadScenario(id);
                  // le focus passe à l'action logique suivante : Espace / Entrée démarre la simulation
                  document.querySelector<HTMLElement>('[data-testid="run-toggle"]')?.focus();
                }}
                className={`focus-visible:outline-accent flex w-full items-start gap-2 rounded border px-2 py-1.5 text-left font-mono text-xs focus-visible:outline focus-visible:outline-2 disabled:opacity-40 ${isActive ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-panel-2 hover:bg-line text-zinc-200'}`}
              >
                <kbd className="border-line text-muted mt-0.5 rounded border px-1 text-[10px]">
                  {i + 1}
                </kbd>
                <span>{s.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {def ? (
        <div
          className="border-line mt-3 space-y-2 border-t pt-3 font-mono text-[11px] leading-snug"
          data-testid="scenario-detail"
        >
          <p className="text-zinc-300">{def.description}</p>
          <div>
            <p className="text-muted">Objectifs</p>
            <ul className="mt-0.5 list-disc pl-4 text-zinc-300">
              {def.objectives.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
          <p>
            <span className="text-muted">Issue attendue : </span>
            <span className="text-zinc-300">{def.expectedOutcome}</span>
          </p>
        </div>
      ) : (
        <p className="text-muted mt-2 font-mono text-[11px]">
          Choisissez un scénario pour le charger.
        </p>
      )}
    </Panel>
  );
}
