'use client';

import { Readout } from '@/components/ui/Readout';
import { formatSimTime } from '@/lib/units';
import { SNAPSHOT_LAYOUT, TIME_SCALES } from '@/simulation/protocol';
import { useReactorStore } from '@/store/useReactorStore';
import type { EngineStatus } from '@/simulation/types';
import { useSim } from './SimulationContext';

const btn =
  'rounded border border-line bg-panel-2 px-3 py-1.5 font-mono text-xs font-medium text-zinc-200 hover:bg-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-40';

const STATUS_LABEL: Record<EngineStatus, { text: string; tone: string }> = {
  ready: { text: 'PRÊT', tone: 'text-muted' },
  running: { text: 'EN COURS', tone: 'text-ok' },
  paused: { text: 'PAUSE', tone: 'text-warn' },
  ruptured: { text: 'RUPTURE', tone: 'text-alarm' },
  error: { text: 'ERREUR', tone: 'text-alarm' },
};

/** Lecture/pause, reset, facteur d'accélération, temps simulé (S5-L09). */
export function TimeControls() {
  const sim = useSim();
  const status = useReactorStore((s) => s.status);
  const timeScale = useReactorStore((s) => s.timeScale);
  const canRun = status === 'ready' || status === 'paused' || status === 'running';
  const st = STATUS_LABEL[status];

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Contrôle du temps">
      <button
        type="button"
        className={btn}
        disabled={!sim || !canRun}
        data-testid="run-toggle"
        onClick={() => (status === 'running' ? sim?.pause() : sim?.start())}
      >
        {status === 'running' ? '❚❚ Pause' : '▶ Démarrer'}
      </button>
      <button
        type="button"
        className={btn}
        disabled={!sim}
        data-testid="reset"
        onClick={() => sim?.reset()}
      >
        ↺ Réinitialiser
      </button>
      <div className="flex" role="radiogroup" aria-label="Facteur d’accélération">
        {TIME_SCALES.map((ts) => (
          <button
            key={ts}
            type="button"
            role="radio"
            aria-checked={timeScale === ts}
            disabled={!sim}
            onClick={() => sim?.setTimeScale(ts)}
            className={`border-line focus-visible:outline-accent border px-2.5 py-1.5 font-mono text-xs first:rounded-l last:rounded-r focus-visible:outline focus-visible:outline-2 disabled:opacity-40 ${timeScale === ts ? 'bg-accent/20 text-accent' : 'bg-panel-2 text-muted hover:text-zinc-200'}`}
          >
            ×{ts}
          </button>
        ))}
      </div>
      <span className="font-mono text-sm text-zinc-100 tabular-nums" aria-label="Temps simulé">
        t = <Readout format={(s) => formatSimTime(s[SNAPSHOT_LAYOUT.simTime] as number)} />
      </span>
      <span
        data-testid="engine-status"
        className={`border-line rounded border px-2 py-0.5 font-mono text-[11px] font-semibold ${st.tone}`}
      >
        {st.text}
      </span>
    </div>
  );
}
