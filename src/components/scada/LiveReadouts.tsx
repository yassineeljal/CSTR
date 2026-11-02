'use client';

import { Panel } from '@/components/ui/Panel';
import { Readout } from '@/components/ui/Readout';
import { kelvinToCelsius, paToBar, wattsToKilowatts, lpsToLpm } from '@/lib/units';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import { useReactorStore } from '@/store/useReactorStore';

const S = SNAPSHOT_LAYOUT;

interface TileProps {
  label: string;
  unit: string;
  format: (s: Float64Array) => string;
  level?: (s: Float64Array) => 0 | 1 | 2;
  big?: boolean;
}

function Tile({ label, unit, format, level, big }: TileProps) {
  return (
    <div className={`border-line bg-panel-2 rounded border px-2 py-1.5 ${big ? 'col-span-2' : ''}`}>
      <div className="text-muted font-mono text-[10px] tracking-wide uppercase">{label}</div>
      <div className="flex items-baseline justify-end gap-1">
        <Readout
          format={format}
          level={level}
          className={`font-mono text-zinc-100 tabular-nums ${big ? 'text-2xl' : 'text-base'}`}
        />
        <span className="text-muted font-mono text-[10px]">{unit}</span>
      </div>
    </div>
  );
}

/** Valeurs vivantes à 10 Hz, écrites directement dans le DOM (S5-L04, sans re-rendu React). */
export function LiveReadouts() {
  const p = useReactorStore((s) => s.params);

  const tempLevel = (s: Float64Array): 0 | 1 | 2 => {
    const t = s[S.T] as number;
    if (t >= p.tHHK) return 2;
    if (t >= p.tHK || t <= p.tLLK) return 1;
    return 0;
  };
  const pressureLevel = (s: Float64Array): 0 | 1 | 2 => {
    const pr = s[S.pressure] as number;
    if (pr >= p.reliefSetPressurePa) return 2;
    if (pr >= 0.9 * p.reliefSetPressurePa) return 1;
    return 0;
  };

  return (
    <Panel id="panel-readouts" title="Mesures">
      <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Mesures en direct">
        <Tile
          big
          label="Température réacteur"
          unit="°C"
          format={(s) => kelvinToCelsius(s[S.T] as number).toFixed(1)}
          level={tempLevel}
        />
        <Tile
          label="T enveloppe"
          unit="°C"
          format={(s) => kelvinToCelsius(s[S.Tj] as number).toFixed(1)}
        />
        <Tile
          label="Consigne"
          unit="°C"
          format={(s) => kelvinToCelsius(s[S.setpoint] as number).toFixed(1)}
        />
        <Tile
          label="Concentration C_A"
          unit="mol/L"
          format={(s) => (s[S.CA] as number).toFixed(3)}
        />
        <Tile label="Vanne" unit="%" format={(s) => ((s[S.valve] as number) * 100).toFixed(0)} />
        <Tile
          label="Pression"
          unit="bar"
          format={(s) => paToBar(s[S.pressure] as number).toFixed(2)}
          level={pressureLevel}
        />
        <Tile label="Damköhler Da" unit="—" format={(s) => (s[S.Da] as number).toFixed(2)} />
        <Tile
          label="Q générée"
          unit="kW"
          format={(s) => wattsToKilowatts(s[S.Qgen] as number).toFixed(1)}
        />
        <Tile
          label="Q évacuée"
          unit="kW"
          format={(s) => wattsToKilowatts(s[S.Qremoval] as number).toFixed(1)}
        />
        <Tile
          label="Débit soupape"
          unit="g/s"
          format={(s) => ((s[S.reliefFlow] as number) * 1000).toFixed(1)}
          level={(s) => ((s[S.reliefFlow] as number) > 0 ? 1 : 0)}
        />
        <Tile
          label="Débit eau froide"
          unit="L/min"
          format={(s) => lpsToLpm(s[S.Fc] as number).toFixed(1)}
        />
        <Tile label="U·A effectif" unit="W/K" format={(s) => (s[S.U] as number).toFixed(0)} />
        <Tile
          label="Encrassement"
          unit="%"
          format={(s) => ((s[S.fouling] as number) * 100).toFixed(0)}
        />
      </div>
    </Panel>
  );
}
