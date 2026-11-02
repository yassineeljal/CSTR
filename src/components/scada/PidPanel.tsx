'use client';

import { NumberField } from '@/components/ui/NumberField';
import { Panel } from '@/components/ui/Panel';
import { Readout } from '@/components/ui/Readout';
import { Segmented } from '@/components/ui/Segmented';
import { celsiusToKelvin, kelvinToCelsius } from '@/lib/units';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import { useReactorStore } from '@/store/useReactorStore';
import { UI_RANGES, rangeAround } from './controlRanges';
import { useSim } from './SimulationContext';

const S = SNAPSHOT_LAYOUT;

/** Régulateur PID : mode Manuel/Auto (transfert sans à-coup), consigne, gains (S5-L03). */
export function PidPanel() {
  const sim = useSim();
  const pid = useReactorStore((s) => s.pid);
  const mode = useReactorStore((s) => s.mode);
  const manualValve = useReactorStore((s) => s.manualValve);
  const level = useReactorStore((s) => s.params.modelLevel);
  const off = !sim;

  return (
    <Panel
      id="panel-pid"
      title="Régulation de température"
      action={
        <Segmented
          label="Mode de régulation"
          value={mode}
          disabled={off || level === 1}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'manual', label: 'Manuel' },
          ]}
          onChange={(m) => sim?.setMode(m)}
        />
      }
    >
      {level === 1 && (
        <p className="text-muted mb-2 font-mono text-[10px]">
          Niveau 1 : eau à température imposée, pas de vanne.
        </p>
      )}
      <NumberField
        label="Consigne T"
        unit="°C"
        value={kelvinToCelsius(pid.setpointK)}
        {...rangeAround(kelvinToCelsius(pid.setpointK), ...UI_RANGES.setpointC)}
        step={0.5}
        disabled={off}
        onCommit={(c) => sim?.setPid({ setpointK: celsiusToKelvin(c) })}
      />

      {mode === 'manual' ? (
        <NumberField
          label="Ouverture de vanne"
          unit="%"
          value={manualValve * 100}
          min={0}
          max={100}
          step={1}
          decimals={0}
          disabled={off}
          onCommit={(v) => sim?.setManualValve(v / 100)}
        />
      ) : (
        <details className="border-line mt-2 rounded border">
          <summary className="text-muted cursor-pointer px-2 py-1 font-mono text-[11px] hover:text-zinc-200">
            Gains PID
          </summary>
          <div className="p-2">
            <NumberField
              label="K_p"
              unit="1/K"
              value={pid.kp}
              {...rangeAround(pid.kp, ...UI_RANGES.kp)}
              step={0.01}
              decimals={3}
              disabled={off}
              onCommit={(v) => sim?.setPid({ kp: v })}
            />
            <NumberField
              label="K_i"
              unit="1/K·s"
              value={pid.ki}
              {...rangeAround(pid.ki, ...UI_RANGES.ki)}
              step={0.001}
              decimals={4}
              disabled={off}
              onCommit={(v) => sim?.setPid({ ki: v })}
            />
            <NumberField
              label="K_d"
              unit="s/K"
              value={pid.kd}
              {...rangeAround(pid.kd, ...UI_RANGES.kd)}
              step={0.5}
              decimals={1}
              disabled={off}
              onCommit={(v) => sim?.setPid({ kd: v })}
            />
            <NumberField
              label="τ filtre D"
              unit="s"
              value={pid.tauFilterS}
              {...rangeAround(pid.tauFilterS, ...UI_RANGES.tauFilter)}
              step={0.1}
              decimals={1}
              disabled={off}
              onCommit={(v) => sim?.setPid({ tauFilterS: v })}
            />
          </div>
        </details>
      )}

      <dl className="border-line mt-3 grid grid-cols-2 gap-x-3 gap-y-1 border-t pt-2 font-mono text-[11px]">
        <dt className="text-muted">Vanne commandée</dt>
        <dd className="text-right text-zinc-100 tabular-nums">
          <Readout format={(s) => `${((s[S.valveCmd] as number) * 100).toFixed(1)} %`} />
        </dd>
        <dt className="text-muted">Vanne réelle</dt>
        <dd className="text-right text-zinc-100 tabular-nums">
          <Readout format={(s) => `${((s[S.valve] as number) * 100).toFixed(1)} %`} />
        </dd>
        <dt className="text-muted">Erreur T − T_sp</dt>
        <dd className="text-right text-zinc-100 tabular-nums">
          <Readout format={(s) => `${(s[S.error] as number).toFixed(2)} K`} />
        </dd>
      </dl>
    </Panel>
  );
}
