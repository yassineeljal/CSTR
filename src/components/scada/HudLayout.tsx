'use client';

import { useEffect } from 'react';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SCENARIOS } from '@/simulation/scenarios';
import { TIME_SCALES } from '@/simulation/protocol';
import type { ScenarioId } from '@/simulation/types';
import { useReactorStore } from '@/store/useReactorStore';
import { AlarmBanner, AlarmHistory } from './AlarmBanner';
import { ControlPanel } from './ControlPanel';
import { LiveReadouts } from './LiveReadouts';
import { PidPanel } from './PidPanel';
import { PresetsPanel } from './PresetsPanel';
import { QuenchButton } from './QuenchButton';
import { ReactorStage } from './ReactorStage';
import { RuptureOverlay } from './RuptureOverlay';
import { ScenarioSelector } from './ScenarioSelector';
import { ShortcutHelp } from './ShortcutHelp';
import { SimulationProvider, useSim } from './SimulationContext';
import { TelemetryCharts } from './TelemetryCharts';
import { TimeControls } from './TimeControls';

const btn =
  'rounded border border-line bg-panel/90 px-3 py-1.5 font-mono text-xs font-medium text-zinc-200 backdrop-blur hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent';

/** Applique le lien direct (`?scenario=…&speed=…&autostart=1`) une fois le moteur prêt. */
function DeepLink() {
  const sim = useSim();
  useEffect(() => {
    if (!sim) return;
    const q = new URLSearchParams(window.location.search);
    const scenario = q.get('scenario');
    if (scenario && scenario in SCENARIOS) sim.loadScenario(scenario as ScenarioId);
    const speed = Number(q.get('speed') ?? 10);
    sim.setTimeScale((TIME_SCALES as readonly number[]).includes(speed) ? speed : 10);
    if (q.get('autostart') === '1') sim.start();
  }, [sim]);
  return null;
}

function Shortcuts() {
  useKeyboardShortcuts(useSim());
  return null;
}

/** Reflète « réduire les animations » sur <html> pour les règles CSS (clignotements, flash). */
function MotionPreference() {
  const reduced = useReactorStore((s) => s.ui.reducedMotion);
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reduced);
  }, [reduced]);
  return null;
}

function Scene() {
  const sim = useSim();
  const cutaway = useReactorStore((s) => s.ui.cutaway);
  const reducedMotion = useReactorStore((s) => s.ui.reducedMotion);
  const patchUi = useReactorStore((s) => s.patchUi);
  return (
    <main className="relative h-full min-h-[55vh] lg:min-h-0" aria-label="Vue 3D du réacteur">
      <div className="absolute inset-0">
        <ReactorStage />
      </div>
      <AlarmBanner />
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={btn}
          aria-pressed={cutaway}
          data-testid="cutaway-toggle"
          onClick={() => patchUi({ cutaway: !cutaway })}
        >
          {cutaway ? 'Vue complète  [C]' : 'Vue en coupe  [C]'}
        </button>
        <button
          type="button"
          className={btn}
          aria-pressed={reducedMotion}
          onClick={() => patchUi({ reducedMotion: !reducedMotion })}
        >
          Réduire les animations
        </button>
      </div>
      <RuptureOverlay
        onRetry={() => {
          sim?.reset();
          sim?.start();
        }}
      />
    </main>
  );
}

/** Poste de contrôle : commandes à gauche, scène 3D au centre, mesures et courbes à droite. */
export function HudLayout() {
  return (
    <SimulationProvider>
      <DeepLink />
      <Shortcuts />
      <MotionPreference />
      <div className="bg-background flex h-dvh flex-col overflow-y-auto text-zinc-200 lg:overflow-hidden">
        <header className="border-line bg-panel flex flex-wrap items-center justify-between gap-3 border-b px-3 py-2">
          <div className="font-mono">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              CSTR Digital Twin
            </h1>
            <p className="text-muted text-[10px]">
              Réacteur agité continu exothermique — poste de contrôle
            </p>
          </div>
          <TimeControls />
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_390px]">
          <aside
            aria-label="Commandes"
            className="order-2 space-y-2 overflow-y-auto p-2 lg:order-1"
          >
            <ScenarioSelector />
            <QuenchButton />
            <ControlPanel />
            <PidPanel />
            <PresetsPanel />
            <ShortcutHelp />
          </aside>
          <div className="order-1 h-[60vh] min-h-0 lg:order-2 lg:h-auto">
            <Scene />
          </div>
          <aside aria-label="Mesures et courbes" className="order-3 space-y-2 overflow-y-auto p-2">
            <LiveReadouts />
            <TelemetryCharts />
            <AlarmHistory />
          </aside>
        </div>
      </div>
    </SimulationProvider>
  );
}
