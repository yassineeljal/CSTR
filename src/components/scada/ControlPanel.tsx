'use client';

import { NumberField } from '@/components/ui/NumberField';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { celsiusToKelvin, kelvinToCelsius, lpmToLps, lpsToLpm } from '@/lib/units';
import { useReactorStore } from '@/store/useReactorStore';
import { UI_RANGES, rangeAround } from './controlRanges';
import { useSim } from './SimulationContext';

/** Alimentation, agitation, eau de refroidissement : commandes de l'installation (S5-L02). */
export function ControlPanel() {
  const sim = useSim();
  const params = useReactorStore((s) => s.params);
  const plant = useReactorStore((s) => s.plant);
  const off = !sim;

  const tIn = kelvinToCelsius(params.tInK);
  const flowLpm = lpsToLpm(params.feedFlowLps);
  const tInR = rangeAround(tIn, ...UI_RANGES.feedTempC);
  const caR = rangeAround(params.caInMolL, ...UI_RANGES.feedConcentration);
  const flowR = rangeAround(flowLpm, ...UI_RANGES.feedFlowLpm);
  const rpmR = rangeAround(params.rpm, ...UI_RANGES.rpm);

  return (
    <Panel id="panel-process" title="Procédé">
      <NumberField
        label="T alimentation"
        unit="°C"
        value={tIn}
        {...tInR}
        step={0.5}
        disabled={off}
        onCommit={(c) => sim?.setParams({ tInK: celsiusToKelvin(c) })}
      />
      <NumberField
        label="C_A d’entrée"
        unit="mol/L"
        value={params.caInMolL}
        {...caR}
        step={0.05}
        decimals={2}
        disabled={off}
        onCommit={(v) => sim?.setParams({ caInMolL: v })}
      />
      <NumberField
        label="Débit d’alimentation"
        unit="L/min"
        value={flowLpm}
        {...flowR}
        step={1}
        decimals={0}
        disabled={off}
        onCommit={(v) => sim?.setParams({ feedFlowLps: lpmToLps(v) })}
      />
      <NumberField
        label="Agitation"
        unit="tr/min"
        value={params.rpm}
        {...rpmR}
        step={1}
        decimals={0}
        disabled={off}
        onCommit={(v) => sim?.setParams({ rpm: v })}
      />
      {params.modelLevel === 1 && (
        <NumberField
          label="T eau de refroidissement"
          unit="°C"
          value={kelvinToCelsius(params.tcK)}
          {...rangeAround(kelvinToCelsius(params.tcK), ...UI_RANGES.coolantTempC)}
          step={0.5}
          disabled={off}
          onCommit={(c) => sim?.setParams({ tcK: celsiusToKelvin(c) })}
        />
      )}

      <div className="border-line mt-3 flex items-center justify-between gap-2 border-t pt-3">
        <span id="pump-label" className="text-muted font-mono text-[11px]">
          Pompe d’eau froide
        </span>
        <Segmented
          label="Pompe d’eau froide"
          value={plant.pumpOn ? 'on' : 'off'}
          disabled={off}
          options={[
            { value: 'on', label: 'Marche' },
            { value: 'off', label: 'Arrêt' },
          ]}
          onChange={(v) => sim?.setPumpEfficiency(v === 'on' ? 1 : 0)}
        />
      </div>
      <div className="mt-3">
        <NumberField
          label="Vanne d’alimentation"
          unit="%"
          value={plant.feedFactor * 100}
          min={0}
          max={100}
          step={1}
          decimals={0}
          disabled={off}
          hint={
            plant.feedFactor === 0
              ? 'Alimentation coupée — rouvrir pour reprendre la production.'
              : undefined
          }
          onCommit={(v) => sim?.setFeedFactor(v / 100)}
        />
      </div>
    </Panel>
  );
}
