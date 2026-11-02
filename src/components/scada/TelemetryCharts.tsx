'use client';

import { useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { telemetry, telemetryIndex, type TelemetryChannel } from '@/client/telemetry';
import { Panel } from '@/components/ui/Panel';
import { Segmented } from '@/components/ui/Segmented';
import { formatSimTime, kelvinToCelsius } from '@/lib/units';

const COLORS = { grid: '#2a333c', axis: '#8b98a5' };
/** Fenêtres glissantes proposées [s simulées]. */
const WINDOWS = ['30', '60', '120', '300'] as const;
/** Fréquence maximale de redessin des graphes [Hz]. */
const CHART_FPS = 30;

interface SeriesDef {
  channel: TelemetryChannel;
  label: string;
  stroke: string;
  dash?: number[];
}
interface ChartDef {
  id: string;
  title: string;
  description: string;
  series: SeriesDef[];
  /** Convertit une valeur moteur en valeur d'affichage (axe). */
  toDisplay: (v: number) => number;
  decimals: number;
  unit: string;
  /** Étendue minimale de l'axe Y en unités MOTEUR (évite d'amplifier le bruit). */
  minSpan: number;
}

const CHARTS: ChartDef[] = [
  {
    id: 'temperature',
    title: 'Température & consigne',
    description: 'Température du réacteur et consigne en degrés Celsius',
    series: [
      { channel: 'T', label: 'T', stroke: '#22d3ee' },
      { channel: 'setpoint', label: 'Consigne', stroke: '#fbbf24', dash: [5, 4] },
    ],
    toDisplay: kelvinToCelsius,
    decimals: 0,
    unit: '°C',
    minSpan: 8,
  },
  {
    id: 'concentration',
    title: 'Concentration C_A',
    description: 'Concentration du réactif A en mol/L',
    series: [{ channel: 'CA', label: 'C_A', stroke: '#c084fc' }],
    toDisplay: (v) => v,
    decimals: 2,
    unit: 'mol/L',
    minSpan: 0.2,
  },
  {
    id: 'valve',
    title: 'Vanne : commandée / réelle',
    description: 'Ouverture de la vanne d’eau froide, commandée et réelle, en pourcentage',
    series: [
      { channel: 'valveCmd', label: 'Commande', stroke: '#fbbf24', dash: [5, 4] },
      { channel: 'valve', label: 'Réelle', stroke: '#34d399' },
    ],
    toDisplay: (v) => v * 100,
    decimals: 0,
    unit: '%',
    minSpan: 0.2,
  },
  {
    id: 'heat',
    title: 'Q générée / Q évacuée',
    description: 'Chaleur générée par la réaction et chaleur évacuée, en kilowatts',
    series: [
      { channel: 'Qgen', label: 'Générée', stroke: '#f43f5e' },
      { channel: 'Qremoval', label: 'Évacuée', stroke: '#60a5fa' },
    ],
    toDisplay: (v) => v / 1000,
    decimals: 0,
    unit: 'kW',
    minSpan: 10_000,
  },
];

function makeOptions(def: ChartDef, width: number): uPlot.Options {
  const axisBase = {
    stroke: COLORS.axis,
    grid: { stroke: COLORS.grid, width: 1 },
    ticks: { stroke: COLORS.grid, width: 1 },
    font: '10px ui-monospace, monospace',
  };
  return {
    width,
    height: 128,
    padding: [6, 6, 0, 0],
    legend: { show: false },
    cursor: { show: false },
    scales: {
      x: { time: false },
      y: {
        range: (_u, min, max) => {
          const span = Math.max(max - min, def.minSpan);
          const mid = (max + min) / 2;
          return [mid - span * 0.6, mid + span * 0.6];
        },
      },
    },
    axes: [
      { ...axisBase, size: 22, values: (_u, vals) => vals.map((v) => formatSimTime(v)) },
      {
        ...axisBase,
        size: 46,
        values: (_u, vals) => vals.map((v) => def.toDisplay(v).toFixed(def.decimals)),
      },
    ],
    series: [
      {},
      ...def.series.map((s) => ({
        label: s.label,
        stroke: s.stroke,
        width: 1.6,
        dash: s.dash,
        points: { show: false },
      })),
    ],
  };
}

/**
 * 4 graphes temps réel (S5-L05) : uPlot, fenêtre glissante, tampon préalloué (`telemetry`),
 * redessin dans un rAF propre limité à 30 Hz et seulement si de nouvelles données existent.
 */
export function TelemetryCharts() {
  const [windowS, setWindowS] = useState<(typeof WINDOWS)[number]>('60');
  const windowRef = useRef(Number(windowS));
  const containers = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    windowRef.current = Number(windowS);
  }, [windowS]);

  useEffect(() => {
    const plots: uPlot[] = [];
    const observers: ResizeObserver[] = [];
    CHARTS.forEach((def, i) => {
      const el = containers.current[i];
      if (!el) return;
      const plot = new uPlot(
        makeOptions(def, Math.max(el.clientWidth, 200)),
        [[], ...def.series.map(() => [])],
        el,
      );
      plots.push(plot);
      const ro = new ResizeObserver(() =>
        plot.setSize({ width: Math.max(el.clientWidth, 200), height: 128 }),
      );
      ro.observe(el);
      observers.push(ro);
    });

    let raf = 0;
    let lastDraw = 0;
    let lastSize = -1;
    let lastTime = Number.NaN;
    let lastWindow = -1;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || now - lastDraw < 1000 / CHART_FPS) return;
      const w = windowRef.current;
      // aucun redessin sans nouvelle donnée ni changement de fenêtre (simulation en pause)
      if (telemetry.size === lastSize && telemetry.lastTime === lastTime && w === lastWindow)
        return;
      lastDraw = now;
      lastSize = telemetry.size;
      lastTime = telemetry.lastTime;
      lastWindow = w;
      if (telemetry.size < 2) {
        plots.forEach((p, i) => p.setData([[], ...(CHARTS[i] as ChartDef).series.map(() => [])]));
        return;
      }
      plots.forEach((plot, i) => {
        const def = CHARTS[i] as ChartDef;
        const data: uPlot.AlignedData = [
          telemetry.window(0, w),
          ...def.series.map((s) => telemetry.window(telemetryIndex(s.channel), w)),
        ] as unknown as uPlot.AlignedData;
        plot.setData(data);
      });
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observers.forEach((o) => o.disconnect());
      plots.forEach((p) => p.destroy());
    };
  }, []);

  return (
    <Panel
      id="panel-charts"
      title="Courbes"
      action={
        <Segmented
          label="Fenêtre de temps"
          value={windowS}
          options={WINDOWS.map((w) => ({ value: w, label: `${w} s` }))}
          onChange={setWindowS}
        />
      }
    >
      <div className="space-y-2">
        {CHARTS.map((def, i) => (
          <figure key={def.id} className="m-0">
            <figcaption className="text-muted mb-0.5 flex items-center justify-between font-mono text-[10px]">
              <span>
                {def.title} <span>[{def.unit}]</span>
              </span>
              <span className="flex gap-2">
                {def.series.map((s) => (
                  <span key={s.channel} className="flex items-center gap-1">
                    <span
                      aria-hidden
                      className="inline-block h-0.5 w-3"
                      style={{ background: s.stroke }}
                    />
                    {s.label}
                  </span>
                ))}
              </span>
            </figcaption>
            <div
              ref={(el) => {
                containers.current[i] = el;
              }}
              role="img"
              aria-label={def.description}
              data-testid={`chart-${def.id}`}
              className="min-h-[128px] w-full"
            />
          </figure>
        ))}
      </div>
    </Panel>
  );
}
