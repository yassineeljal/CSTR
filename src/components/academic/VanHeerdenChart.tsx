'use client';

import { useEffect, useRef } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { simRef } from '@/client/simRef';
import { Panel } from '@/components/ui/Panel';
import { kelvinToCelsius } from '@/lib/units';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import type { ReactorParams } from '@/simulation/types';
import {
  steadyStates,
  vanHeerdenCurves,
  type SteadyState,
  type VanHeerdenContext,
} from '@/simulation/vanHeerden';
import { useReactorStore } from '@/store/useReactorStore';

const S = SNAPSHOT_LAYOUT;
const T_MIN_K = 285;
const T_MAX_K = 460;
const POINTS = 200;
const HEIGHT_PX = 190;
/** Fréquence de réévaluation des paramètres et de redessin du point de fonctionnement [Hz]. */
const REFRESH_HZ = 20;

const axis = (size: number, values?: uPlot.Axis.Values): uPlot.Axis => ({
  stroke: '#8b98a5',
  grid: { stroke: '#2a333c' },
  ticks: { stroke: '#2a333c' },
  size,
  font: '10px ui-monospace, monospace',
  ...(values ? { values } : {}),
});

/** Contexte de l'analyse : puits de chaleur = T_c (niveau 1) ou T_j courante (niveau 2). */
function currentContext(p: ReactorParams): VanHeerdenContext {
  const s = simRef.current;
  return {
    sinkTempK: p.modelLevel === 1 ? p.tcK : (s[S.Tj] as number),
    fouling: s[S.fouling] as number,
    inhibitorFactor: s[S.inhibitor] as number,
    feedFactor: useReactorStore.getState().plant.feedFactor,
  };
}

/** Empreinte des entrées pertinentes : le balayage n'est recalculé que si elle change. */
function signature(p: ReactorParams, c: VanHeerdenContext): string {
  return [
    p.uaRefWK,
    p.uaMinWK,
    p.uExponent,
    p.rpm,
    p.rpmRef,
    p.feedFlowLps,
    p.caInMolL,
    p.tInK,
    p.deltaHrJMol,
    p.k0PerS,
    p.eaOverRK,
    p.volumeL,
    p.rhoGL,
    p.cpJGK,
    c.sinkTempK.toFixed(1),
    c.fouling.toFixed(3),
    c.inhibitorFactor,
    c.feedFactor,
  ].join('|');
}

function drawMarkers(u: uPlot, states: SteadyState[]): void {
  const ctx = u.ctx;
  const dpr = devicePixelRatio;
  const pos = (tempK: number, heatW: number) =>
    [u.valToPos(tempK, 'x', true), u.valToPos(heatW / 1000, 'y', true)] as const;
  ctx.save();
  ctx.lineWidth = 2 * dpr;
  for (const s of states) {
    const [x, y] = pos(s.tempK, s.heatW);
    const r = 4 * dpr;
    ctx.beginPath();
    if (s.stable) {
      ctx.fillStyle = '#34d399';
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#fbbf24';
      ctx.moveTo(x - r, y - r);
      ctx.lineTo(x + r, y + r);
      ctx.moveTo(x + r, y - r);
      ctx.lineTo(x - r, y + r);
      ctx.stroke();
    }
  }
  // point de fonctionnement animé
  const [ox, oy] = pos(simRef.current[S.T] as number, simRef.current[S.Qgen] as number);
  ctx.beginPath();
  ctx.fillStyle = '#22d3ee';
  ctx.strokeStyle = '#ffffff';
  ctx.arc(ox, oy, 5.5 * dpr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Diagramme de Van Heerden en direct (S6-L04) : 200 points recalculés **uniquement quand les
 * paramètres changent** (empreinte comparée), états stationnaires (● stable, ✖ instable) et point
 * de fonctionnement animé. Niveau 2 : T_puits = T_j courante (analyse quasi-statique).
 */
export function VanHeerdenChart() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let states: SteadyState[] = [];

    const plot = new uPlot(
      {
        width: Math.max(el.clientWidth, 220),
        height: HEIGHT_PX,
        padding: [8, 8, 0, 0],
        legend: { show: false },
        cursor: { show: false },
        scales: {
          x: { time: false, range: [T_MIN_K, T_MAX_K] },
          y: { range: (_u, _min, max) => [0, Math.max(max * 1.1, 20)] },
        },
        axes: [axis(24, (_u, v) => v.map((t) => kelvinToCelsius(t).toFixed(0))), axis(40)],
        series: [
          {},
          { label: 'Q générée', stroke: '#f43f5e', width: 2, points: { show: false } },
          { label: 'Q évacuée', stroke: '#60a5fa', width: 2, points: { show: false } },
        ],
        hooks: { draw: [(u) => drawMarkers(u, states)] },
      },
      [[], [], []],
      el,
    );
    const ro = new ResizeObserver(() =>
      plot.setSize({ width: Math.max(el.clientWidth, 220), height: HEIGHT_PX }),
    );
    ro.observe(el);

    let raf = 0;
    let lastFrame = 0;
    let lastSignature = '';
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || now - lastFrame < 1000 / REFRESH_HZ) return;
      lastFrame = now;
      const p = useReactorStore.getState().params;
      const ctx = currentContext(p);
      const sig = signature(p, ctx);
      if (sig !== lastSignature) {
        lastSignature = sig;
        const c = vanHeerdenCurves(p, ctx, T_MIN_K, T_MAX_K, POINTS);
        states = steadyStates(p, ctx, T_MIN_K, T_MAX_K);
        plot.setData([
          Array.from(c.tempK),
          Array.from(c.qGen, (w) => w / 1000),
          Array.from(c.qRem, (w) => w / 1000),
        ] as uPlot.AlignedData);
      } else {
        plot.redraw(false, false); // seul le point de fonctionnement bouge
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      plot.destroy();
    };
  }, []);

  return (
    <Panel id="panel-vanheerden" title="Van Heerden (direct)">
      <div
        ref={host}
        role="img"
        aria-label="Diagramme de Van Heerden : chaleur générée et évacuée en fonction de la température, états stationnaires et point de fonctionnement"
        data-testid="vanheerden"
      />
      <p className="text-muted mt-1 flex flex-wrap gap-x-3 font-mono text-[10px]">
        <span className="text-alarm">━ Q générée</span>
        <span className="text-[#60a5fa]">━ Q évacuée</span>
        <span className="text-ok">● stable</span>
        <span className="text-warn">✖ instable</span>
        <span className="text-accent">● point de fonctionnement</span>
        <span>Axes : T [°C], Q [kW]</span>
      </p>
    </Panel>
  );
}
