import { kelvinToCelsius, paToBar, wattsToKilowatts } from '@/lib/units';
import { nozzleLayout, type ReactorGeometry } from '@/simulation/geometry';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import type { SheetId } from './sheets/types';

const S = SNAPSHOT_LAYOUT;

/** Étiquette 3D du mode Inspection : formule KaTeX + valeur vivante (S6-L01). */
export interface InspectionLabelSpec {
  id: string;
  title: string;
  /** Formule LaTeX (mode inline). */
  tex: string;
  /** Ancrage dans le repère du réacteur [m]. */
  position: [number, number, number];
  /** Valeur vivante, formatée depuis le snapshot (10 Hz). */
  value: (s: Float64Array) => string;
  unit: string;
  sheet: SheetId;
}

/**
 * Étiquettes ancrées sur cuve, enveloppe, turbine, soupape et entrée. Positions calculées depuis
 * la géométrie : elles suivent un changement de volume.
 */
export function inspectionLabels(g: ReactorGeometry): InspectionLabelSpec[] {
  const nozzles = new Map(nozzleLayout(g).map((n) => [n.id, n]));
  const feed = nozzles.get('feed');
  const relief = nozzles.get('reliefValve');
  const at = (radiusFrac: number, angleDeg: number, y: number): [number, number, number] => {
    const a = (angleDeg * Math.PI) / 180;
    return [g.tankRadius * radiusFrac * Math.sin(a), y, g.tankRadius * radiusFrac * Math.cos(a)];
  };
  return [
    {
      id: 'matter',
      title: 'Bilan de matière',
      tex: String.raw`\frac{dC_A}{dt} = \frac{F}{V}(C_{A,in}-C_A) - k\,C_A`,
      position: at(0.62, 165, g.liquidHeight * 0.9),
      value: (s) => (s[S.CA] as number).toFixed(3),
      unit: 'mol/L',
      sheet: 'bilans',
    },
    {
      id: 'energy',
      title: 'Chaleur générée',
      tex: String.raw`\dot Q_{g\acute{e}n} = (-\Delta H_r)\,k(T)\,C_A\,V`,
      position: at(0.3, 250, g.liquidHeight + g.shellHeight * 0.16),
      value: (s) => wattsToKilowatts(s[S.Qgen] as number).toFixed(1),
      unit: 'kW',
      sheet: 'arrhenius',
    },
    {
      id: 'jacket',
      title: 'Enveloppe',
      tex: String.raw`\dot Q = U A\,(T - T_j)`,
      position: [
        g.jacketOuterRadius * Math.sin((300 * Math.PI) / 180),
        g.jacketBottom + (g.jacketTop - g.jacketBottom) * 0.28,
        g.jacketOuterRadius * Math.cos((300 * Math.PI) / 180),
      ],
      value: (s) => kelvinToCelsius(s[S.Tj] as number).toFixed(1),
      unit: '°C (T_j)',
      sheet: 'bilans',
    },
    {
      id: 'turbine',
      title: 'Turbine Rushton',
      tex: String.raw`U A \propto N^{2/3}`,
      position: [g.turbineRadius * 0.9, g.turbineHeight * 0.85, 0],
      value: (s) => (s[S.U] as number).toFixed(0),
      unit: 'W/K (U·A)',
      sheet: 'damkohler',
    },
    {
      id: 'relief',
      title: 'Soupape de sécurité',
      tex: String.raw`\dot m_v = C_d A_s\sqrt{2\rho_v(P-P_{atm})}`,
      position: relief
        ? [relief.position[0], relief.position[1] + relief.length * 5.5, relief.position[2]]
        : [0, g.shellHeight + g.headDepth, 0],
      value: (s) => paToBar(s[S.pressure] as number).toFixed(2),
      unit: 'bar',
      sheet: 'securite',
    },
    {
      id: 'feed',
      title: 'Alimentation',
      tex: String.raw`Da = \frac{k(T)\,V}{F}`,
      position: feed
        ? [feed.position[0], feed.position[1] + g.tankDiameter * 0.34, feed.position[2]]
        : [0, g.shellHeight + g.headDepth, 0],
      value: (s) => (s[S.Da] as number).toFixed(2),
      unit: '(Da)',
      sheet: 'damkohler',
    },
  ];
}
