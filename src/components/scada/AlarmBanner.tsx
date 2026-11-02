'use client';

import { Panel } from '@/components/ui/Panel';
import { formatSimTime, kelvinToCelsius } from '@/lib/units';
import { useReactorStore, type AlarmRecord } from '@/store/useReactorStore';
import type { AlarmLevel } from '@/simulation/types';

const LEVEL_STYLE: Record<
  Exclude<AlarmLevel, 'RUPTURE'>,
  { label: string; text: string; box: string }
> = {
  HH: {
    label: 'HH — Température très haute',
    text: 'text-white',
    box: 'border-red-300 bg-red-700',
  },
  H: { label: 'H — Température haute', text: 'text-black', box: 'border-amber-200 bg-amber-400' },
  LL: {
    label: 'LL — Température très basse',
    text: 'text-black',
    box: 'border-cyan-200 bg-cyan-400',
  },
};
/** Ordre d'affichage : le plus grave d'abord. */
const ORDER = ['HH', 'H', 'LL'] as const;

/** Dernier enregistrement d'un niveau d'alarme (les enregistrements sont du plus récent au plus ancien). */
function latestByLevel(alarms: AlarmRecord[], level: string): AlarmRecord | undefined {
  return alarms.find((a) => a.level === level);
}

/**
 * Bandeau d'alarmes (S5-L06), selon ISA-18.2 : une alarme reste affichée tant qu'elle est active
 * **ou** qu'elle n'a pas été acquittée (retour à la normale non acquitté). HH rouge, H ambre, LL
 * cyan ; clignotement tant que non acquittée ; région `aria-live` pour l'annonce textuelle.
 */
export function AlarmBanner() {
  const alarms = useReactorStore((s) => s.alarms);
  const ack = useReactorStore((s) => s.acknowledgeAlarms);
  const shown = ORDER.flatMap((level) => {
    const rec = latestByLevel(alarms, level);
    return rec && (rec.active || !rec.acknowledged) ? [{ level, rec }] : [];
  });
  const unacked = shown.some(({ rec }) => !rec.acknowledged);

  return (
    <div
      role="region"
      aria-label="Alarmes"
      className="pointer-events-none absolute top-2 left-1/2 z-20 flex max-w-[92%] -translate-x-1/2 flex-col items-center gap-1"
    >
      <div aria-live="assertive" aria-atomic="true" className="sr-only" data-testid="alarm-live">
        {shown.length === 0
          ? 'Aucune alarme.'
          : shown
              .map(
                ({ level, rec }) =>
                  `${rec.active ? 'Alarme' : 'Retour à la normale de l’alarme'} ${LEVEL_STYLE[level].label}, ${kelvinToCelsius(rec.tempK).toFixed(1)} degrés Celsius.`,
              )
              .join(' ')}
      </div>
      {shown.length > 0 && (
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
          {shown.map(({ level, rec }) => {
            const st = LEVEL_STYLE[level];
            const blink = !rec.acknowledged;
            return (
              <span
                key={level}
                data-testid={`alarm-${level}`}
                data-active={rec.active ? 'true' : 'false'}
                data-acknowledged={rec.acknowledged ? 'true' : 'false'}
                className={`rounded border-2 px-3 py-1 font-mono text-xs font-bold tracking-wide shadow-lg ${st.box} ${st.text} ${blink ? 'alarm-unacked' : ''} ${rec.active ? '' : 'border-dashed'}`}
              >
                {st.label}
                {rec.active ? '' : ' — retour à la normale'}
              </span>
            );
          })}
          <button
            type="button"
            onClick={ack}
            disabled={!unacked}
            data-testid="alarm-ack"
            className="focus-visible:outline-accent rounded border border-zinc-300 bg-zinc-900 px-3 py-1 font-mono text-xs font-medium text-zinc-100 hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 disabled:opacity-40"
          >
            Acquitter
          </button>
        </div>
      )}
    </div>
  );
}

/** Historique horodaté (temps simulé) des alarmes et événements de scénario. */
export function AlarmHistory() {
  const alarms = useReactorStore((s) => s.alarms);
  const log = useReactorStore((s) => s.log);

  type Row = { id: number; t: number; text: string; tone: string };
  const rows: Row[] = [
    ...alarms.map((a) => ({
      id: a.id,
      t: a.simTimeS,
      text: `${a.level} ${a.active ? '▲ apparition' : '▼ retour'} — ${kelvinToCelsius(a.tempK).toFixed(1)} °C${a.acknowledged ? '' : ' (non acquittée)'}`,
      tone:
        a.level === 'HH' || a.level === 'RUPTURE'
          ? 'text-alarm'
          : a.level === 'H'
            ? 'text-warn'
            : 'text-accent',
    })),
    ...log.map((l) => ({ id: l.id, t: l.simTimeS, text: l.label, tone: 'text-zinc-300' })),
  ]
    .sort((a, b) => b.t - a.t || b.id - a.id)
    .slice(0, 14);

  return (
    <Panel id="panel-history" title="Journal">
      {rows.length === 0 ? (
        <p className="text-muted font-mono text-[11px]">Aucun événement.</p>
      ) : (
        <ol
          className="max-h-44 space-y-0.5 overflow-y-auto font-mono text-[11px]"
          data-testid="alarm-history"
          aria-label="Historique des alarmes et événements"
        >
          {rows.map((r) => (
            <li key={`${r.id}-${r.t}`} className={`flex gap-2 ${r.tone}`}>
              <time className="text-muted shrink-0 tabular-nums">{formatSimTime(r.t)}</time>
              <span>{r.text}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
