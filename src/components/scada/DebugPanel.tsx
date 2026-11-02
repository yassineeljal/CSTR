'use client';

import { useEffect, useState } from 'react';
import { simRef, simVersion } from '@/client/simRef';
import { Readout } from '@/components/ui/Readout';
import { useSimulation } from '@/hooks/useSimulation';
import { kelvinToCelsius, paToBar, formatSimTime } from '@/lib/units';
import { SNAPSHOT_LAYOUT, STATUS_CODE, TIME_SCALES } from '@/simulation/protocol';
import { SCENARIOS, SCENARIO_IDS } from '@/simulation/scenarios';
import { useReactorStore } from '@/store/useReactorStore';

const S = SNAPSHOT_LAYOUT;
const num = (d: number) => (s: Float64Array, i: number) => (s[i] as number).toFixed(d);

interface Row {
  label: string;
  unit: string;
  format: (s: Float64Array) => string;
}

const ROWS: Row[] = [
  { label: 'Temps simulé', unit: 'mm:ss', format: (s) => formatSimTime(s[S.simTime] as number) },
  { label: 'C_A', unit: 'mol/L', format: (s) => num(4)(s, S.CA) },
  { label: 'T réacteur', unit: '°C', format: (s) => kelvinToCelsius(s[S.T] as number).toFixed(2) },
  { label: 'T réacteur', unit: 'K', format: (s) => num(2)(s, S.T) },
  { label: 'T enveloppe', unit: 'K', format: (s) => num(2)(s, S.Tj) },
  { label: 'Consigne', unit: 'K', format: (s) => num(1)(s, S.setpoint) },
  { label: 'Erreur T − T_sp', unit: 'K', format: (s) => num(3)(s, S.error) },
  { label: 'Vanne (réelle)', unit: '%', format: (s) => ((s[S.valve] as number) * 100).toFixed(1) },
  {
    label: 'Vanne (commandée)',
    unit: '%',
    format: (s) => ((s[S.valveCmd] as number) * 100).toFixed(1),
  },
  { label: 'k(T)', unit: 's⁻¹', format: (s) => (s[S.k] as number).toExponential(3) },
  { label: 'Q gén.', unit: 'kW', format: (s) => ((s[S.Qgen] as number) / 1000).toFixed(2) },
  { label: 'Q évac.', unit: 'kW', format: (s) => ((s[S.Qremoval] as number) / 1000).toFixed(2) },
  { label: 'Pression', unit: 'bar', format: (s) => paToBar(s[S.pressure] as number).toFixed(3) },
  {
    label: 'Débit soupape',
    unit: 'g/s',
    format: (s) => ((s[S.reliefFlow] as number) * 1000).toFixed(2),
  },
  { label: 'U·A effectif', unit: 'W/K', format: (s) => num(1)(s, S.U) },
  { label: 'Agitation', unit: 'tr/min', format: (s) => num(0)(s, S.rpm) },
  { label: 'Damköhler', unit: '—', format: (s) => num(3)(s, S.Da) },
  { label: 'Débit eau froide', unit: 'L/s', format: (s) => num(3)(s, S.Fc) },
  {
    label: 'Rendement pompe',
    unit: '%',
    format: (s) => ((s[S.pumpEff] as number) * 100).toFixed(0),
  },
  { label: 'Encrassement f', unit: '—', format: (s) => num(2)(s, S.fouling) },
  { label: 'Inhibiteur (×k₀)', unit: '—', format: (s) => num(2)(s, S.inhibitor) },
  { label: 'Quench', unit: '%', format: (s) => ((s[S.quench] as number) * 100).toFixed(0) },
];

const STATUS_LABEL = Object.fromEntries(Object.entries(STATUS_CODE).map(([k, v]) => [v, k]));

const btn =
  'rounded border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-sm font-medium hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400 disabled:opacity-40';

/** Page de debug (S2-L12) : valeurs vivantes à 10 Hz et pilotage minimal. */
export function DebugPanel() {
  const sim = useSimulation();
  const status = useReactorStore((s) => s.status);
  const mode = useReactorStore((s) => s.mode);
  const timeScale = useReactorStore((s) => s.timeScale);
  const error = useReactorStore((s) => s.error);
  const rupture = useReactorStore((s) => s.rupture);
  const alarms = useReactorStore((s) => s.alarms);
  const log = useReactorStore((s) => s.log);
  const pid = useReactorStore((s) => s.pid);
  const manualValve = useReactorStore((s) => s.manualValve);
  const [workerOk, setWorkerOk] = useState<'pending' | 'ok' | 'fail'>('pending');

  useEffect(() => {
    if (!sim) return;
    sim.ping().then(
      () => setWorkerOk('ok'),
      () => setWorkerOk('fail'),
    );
  }, [sim]);

  // Exposé pour les tests e2e (cadence des snapshots, S2-L10) — page de debug uniquement.
  useEffect(() => {
    (window as unknown as { __cstrDebug?: unknown }).__cstrDebug = { simRef, simVersion };
    return () => {
      delete (window as unknown as { __cstrDebug?: unknown }).__cstrDebug;
    };
  }, []);

  const disabled = !sim;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6 font-mono text-sm">
      <header className="flex flex-wrap items-center gap-4">
        <h1 className="text-xl font-semibold">CSTR — debug moteur</h1>
        <span data-testid="worker-status" className="rounded bg-zinc-800 px-2 py-1">
          worker : {workerOk === 'ok' ? 'OK' : workerOk === 'fail' ? 'ÉCHEC' : '…'}
        </span>
        <span data-testid="engine-status" className="rounded bg-zinc-800 px-2 py-1">
          état : {status} · mode : {mode}
        </span>
        <Readout
          className="rounded bg-zinc-800 px-2 py-1"
          format={(s) => `statut snapshot : ${STATUS_LABEL[s[S.status] as number] ?? '?'}`}
        />
      </header>

      {error && (
        <p
          role="alert"
          data-testid="error-banner"
          className="rounded border border-red-500 bg-red-950 p-2 text-red-200"
        >
          Erreur : {error}
        </p>
      )}
      {rupture && (
        <p
          role="alert"
          data-testid="rupture-banner"
          className="rounded border border-red-500 bg-red-950 p-2 text-red-200"
        >
          Rupture : T = {rupture.tempK.toFixed(1)} K à t = {formatSimTime(rupture.simTimeS)}
        </p>
      )}

      <section aria-label="Commandes" className="flex flex-wrap items-center gap-2">
        <button className={btn} disabled={disabled} onClick={() => sim?.start()}>
          Start
        </button>
        <button className={btn} disabled={disabled} onClick={() => sim?.pause()}>
          Pause
        </button>
        <button className={btn} disabled={disabled} onClick={() => sim?.reset()}>
          Reset
        </button>
        <span className="mx-2 text-zinc-400">×</span>
        {TIME_SCALES.map((ts) => (
          <button
            key={ts}
            className={`${btn} ${timeScale === ts ? 'border-cyan-400 text-cyan-300' : ''}`}
            disabled={disabled}
            aria-pressed={timeScale === ts}
            onClick={() => sim?.setTimeScale(ts)}
          >
            {ts}
          </button>
        ))}
        <span className="mx-2 text-zinc-400">|</span>
        <button
          className={btn}
          disabled={disabled}
          onClick={() => sim?.setMode(mode === 'auto' ? 'manual' : 'auto')}
        >
          Mode : {mode === 'auto' ? 'Auto' : 'Manuel'}
        </button>
        <button className={btn} disabled={disabled} onClick={() => sim?.setPumpEfficiency(0)}>
          Panne pompe
        </button>
        <button className={btn} disabled={disabled} onClick={() => sim?.setPumpEfficiency(1)}>
          Pompe OK
        </button>
        <button className={btn} disabled={disabled} onClick={() => sim?.quench()}>
          Quench
        </button>
      </section>

      <section aria-label="Réglages" className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2">
          Vanne manuelle {(manualValve * 100).toFixed(0)} %
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={manualValve}
            disabled={disabled || mode !== 'manual'}
            onChange={(e) => sim?.setManualValve(Number(e.target.value))}
          />
        </label>
        <label className="flex items-center gap-2">
          Consigne {pid.setpointK.toFixed(1)} K
          <input
            type="range"
            min={320}
            max={380}
            step={0.5}
            value={pid.setpointK}
            disabled={disabled}
            onChange={(e) => sim?.setPid({ setpointK: Number(e.target.value) })}
          />
        </label>
      </section>

      <section aria-label="Scénarios" className="flex flex-wrap gap-2">
        {SCENARIO_IDS.map((id) => (
          <button
            key={id}
            className={btn}
            disabled={disabled}
            onClick={() => sim?.loadScenario(id)}
          >
            {SCENARIOS[id].name}
          </button>
        ))}
      </section>

      <table className="w-full max-w-xl border-collapse" aria-label="Valeurs en direct">
        <tbody>
          {ROWS.map((row) => (
            <tr key={`${row.label}-${row.unit}`} className="border-b border-zinc-800">
              <th scope="row" className="py-1 pr-4 text-left font-normal text-zinc-400">
                {row.label}
              </th>
              <td className="py-1 pr-2 text-right text-cyan-300 tabular-nums">
                <Readout format={row.format} />
              </td>
              <td className="py-1 text-zinc-500">{row.unit}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section aria-label="Journal" className="grid gap-4 md:grid-cols-2">
        <div>
          <h2 className="mb-1 font-semibold">Alarmes</h2>
          <ul>
            {alarms.slice(0, 8).map((a) => (
              <li key={a.id}>
                {formatSimTime(a.simTimeS)} {a.level} {a.active ? '▲' : '▼'} {a.tempK.toFixed(1)} K
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-1 font-semibold">Événements</h2>
          <ul>
            {log.slice(0, 8).map((l) => (
              <li key={l.id}>
                {formatSimTime(l.simTimeS)} {l.label}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
