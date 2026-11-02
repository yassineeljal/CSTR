'use client';

import { useEffect, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import { useAutoPauseOnHidden } from '@/hooks/useAutoPauseOnHidden';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { SCENARIOS } from '@/simulation/scenarios';
import { TIME_SCALES } from '@/simulation/protocol';
import type { ScenarioId } from '@/simulation/types';
import { useReactorStore } from '@/store/useReactorStore';
import { Segmented } from '@/components/ui/Segmented';
import { AlarmBanner, AlarmHistory } from './AlarmBanner';
import { ControlPanel } from './ControlPanel';
import { LiveReadouts } from './LiveReadouts';
import { PidPanel } from './PidPanel';
import { PresetsPanel } from './PresetsPanel';
import { QuenchButton } from './QuenchButton';
import { ReactorStage } from './ReactorStage';
import { SimDataAttributes } from './SimDataAttributes';
import { RuptureOverlay } from './RuptureOverlay';
import { ScenarioSelector } from './ScenarioSelector';
import { ShortcutHelp } from './ShortcutHelp';
import { SimulationProvider, useSim } from './SimulationContext';
import { TelemetryCharts } from './TelemetryCharts';
import { TimeControls } from './TimeControls';

/**
 * Chargés à la demande (S7-L03) : KaTeX, react-markdown et les fiches ne pèsent pas dans le JS
 * initial ; ils ne sont téléchargés qu'à l'ouverture du mode Inspection ou d'une fiche.
 */
const InspectionOverlay = dynamic(
  () => import('@/components/academic/InspectionOverlay').then((m) => m.InspectionOverlay),
  { ssr: false },
);
const TheoryDrawer = dynamic(
  () => import('@/components/academic/TheoryDrawer').then((m) => m.TheoryDrawer),
  { ssr: false },
);
const VanHeerdenChart = dynamic(
  () => import('@/components/academic/VanHeerdenChart').then((m) => m.VanHeerdenChart),
  { ssr: false },
);

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
  const sim = useSim();
  useKeyboardShortcuts(sim);
  useAutoPauseOnHidden(sim);
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
  const inspection = useReactorStore((s) => s.ui.inspectionMode);
  const theory = useReactorStore((s) => s.ui.theorySheet !== null);
  const quality = useReactorStore((s) => s.ui.quality);
  const autoPause = useReactorStore((s) => s.ui.autoPauseHidden);
  const reducedMotion = useReactorStore((s) => s.ui.reducedMotion);
  const patchUi = useReactorStore((s) => s.patchUi);
  return (
    <main className="relative h-full min-h-[55vh] lg:min-h-0" aria-label="Vue 3D du réacteur">
      <div className="absolute inset-0">
        <ReactorStage />
      </div>
      {inspection && <InspectionOverlay />}
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
          aria-pressed={inspection}
          data-testid="inspection-toggle"
          onClick={() => patchUi({ inspectionMode: !inspection, theorySheet: null })}
        >
          Mode inspection [I]
        </button>
        {inspection && (
          <button
            type="button"
            className={btn}
            data-testid="theory-open"
            onClick={() => patchUi({ theorySheet: 'bilans' })}
          >
            Théorie
          </button>
        )}
        <button
          type="button"
          className={btn}
          aria-pressed={reducedMotion}
          onClick={() => patchUi({ reducedMotion: !reducedMotion })}
        >
          Réduire les animations
        </button>
        <div className="border-line bg-panel/90 flex items-center gap-1.5 rounded border px-2 py-1 backdrop-blur">
          <span className="text-muted font-mono text-[10px]">Qualité</span>
          <Segmented
            label="Qualité de rendu"
            value={quality}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'high', label: 'Haute' },
              { value: 'low', label: 'Basse' },
            ]}
            onChange={(q) => patchUi({ quality: q })}
          />
        </div>
        <button
          type="button"
          className={btn}
          aria-pressed={autoPause}
          data-testid="autopause-toggle"
          onClick={() => patchUi({ autoPauseHidden: !autoPause })}
        >
          Pause auto (onglet masqué)
        </button>
      </div>
      {theory && <TheoryDrawer />}
      <RuptureOverlay
        onRetry={() => {
          sim?.reset();
          sim?.start();
        }}
      />
    </main>
  );
}

const noopSubscribe = () => () => {};

/** Mode « kiosque » (`?kiosk=1`) : scène seule, plein cadre — présentations, intégrations, image de partage. */
function useKiosk(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).get('kiosk') === '1',
    () => false,
  );
}

/** Poste de contrôle : commandes à gauche, scène 3D au centre, mesures et courbes à droite. */
export function HudLayout() {
  const inspection = useReactorStore((s) => s.ui.inspectionMode);
  const kiosk = useKiosk();
  if (kiosk) {
    return (
      <SimulationProvider>
        <DeepLink />
        <div className="bg-background h-dvh w-full">
          <ReactorStage />
        </div>
      </SimulationProvider>
    );
  }
  return (
    <SimulationProvider>
      <DeepLink />
      <SimDataAttributes />
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
          <div className="flex flex-wrap items-center gap-3">
            <TimeControls />
            <a
              href="/about"
              className="text-muted focus-visible:outline-accent font-mono text-xs underline-offset-2 hover:text-zinc-200 hover:underline focus-visible:outline focus-visible:outline-2"
            >
              À propos
            </a>
          </div>
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
            {inspection && <VanHeerdenChart />}
            <TelemetryCharts />
            <AlarmHistory />
          </aside>
        </div>
      </div>
    </SimulationProvider>
  );
}
