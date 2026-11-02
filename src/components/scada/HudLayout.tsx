'use client';

import { useEffect } from 'react';
import { useSimulation } from '@/hooks/useSimulation';
import { TIME_SCALES } from '@/simulation/protocol';
import { useReactorStore } from '@/store/useReactorStore';
import { ReactorStage } from './ReactorStage';

const btn =
  'rounded border border-zinc-600 bg-zinc-900/80 px-3 py-1.5 font-mono text-xs font-medium text-zinc-200 backdrop-blur hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-40';

/** Mise en page plein écran : scène 3D en fond, commandes superposées (le HUD complet = Sprint 5). */
export function HudLayout() {
  const sim = useSimulation();
  const status = useReactorStore((s) => s.status);
  const cutaway = useReactorStore((s) => s.ui.cutaway);
  const timeScale = useReactorStore((s) => s.timeScale);
  const patchUi = useReactorStore((s) => s.patchUi);

  useEffect(() => {
    sim?.setTimeScale(10);
  }, [sim]);

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#0d1013]">
      <div className="absolute inset-0">
        <ReactorStage />
      </div>
      <header className="pointer-events-none absolute top-4 left-4 font-mono">
        <h1 className="text-lg font-semibold tracking-tight text-zinc-100">CSTR Digital Twin</h1>
        <p className="text-xs text-zinc-400">Réacteur agité continu — jumeau numérique 3D</p>
      </header>
      <nav
        aria-label="Commandes de simulation"
        className="absolute bottom-4 left-1/2 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2"
      >
        <button
          className={btn}
          disabled={!sim}
          onClick={() => (status === 'running' ? sim?.pause() : sim?.start())}
        >
          {status === 'running' ? 'Pause' : 'Démarrer'}
        </button>
        <button className={btn} disabled={!sim} onClick={() => sim?.reset()}>
          Réinitialiser
        </button>
        {TIME_SCALES.map((ts) => (
          <button
            key={ts}
            className={`${btn} ${timeScale === ts ? 'border-cyan-400 text-cyan-300' : ''}`}
            aria-pressed={timeScale === ts}
            disabled={!sim}
            onClick={() => sim?.setTimeScale(ts)}
          >
            ×{ts}
          </button>
        ))}
        <button
          className={btn}
          aria-pressed={cutaway}
          onClick={() => patchUi({ cutaway: !cutaway })}
        >
          {cutaway ? 'Vue complète' : 'Vue en coupe'}
        </button>
      </nav>
    </div>
  );
}
