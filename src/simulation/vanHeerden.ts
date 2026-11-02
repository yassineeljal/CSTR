import { arrhenius, heatTransferUA } from './kinetics';
import type { ReactorParams } from './types';

/**
 * Diagramme de Van Heerden (S6-L04) : chaleur générée Q_gén(T) et chaleur évacuée Q_évac(T) à
 * l'état quasi-stationnaire en C_A. Module pur, sans allocation superflue.
 *
 *   C_A(T)   = (F_eff/V)·C_A,in / (F_eff/V + k(T))
 *   Q_gén(T) = (−ΔH_r)·k(T)·C_A(T)·V
 *   Q_évac(T) = F_eff·ρ·C_p·(T − T_in) + U·A·(T − T_puits)
 *
 * T_puits est la température du fluide de refroidissement : T_c au niveau 1, T_j (courante) au
 * niveau 2 (analyse quasi-statique de l'enveloppe). La capacité thermique de paroi ne change pas
 * les états stationnaires : elle est absente de ces formules.
 */
export interface VanHeerdenContext {
  /** Température du puits de chaleur [K] : T_c (niveau 1) ou T_j (niveau 2). */
  sinkTempK: number;
  fouling: number;
  inhibitorFactor: number;
  feedFactor: number;
}

export interface VanHeerdenCurves {
  /** Températures balayées [K]. */
  tempK: Float64Array;
  /** Chaleur générée [W]. */
  qGen: Float64Array;
  /** Chaleur évacuée [W]. */
  qRem: Float64Array;
}

export interface SteadyState {
  tempK: number;
  caMolL: number;
  /** Chaleur échangée à cet état, Q_gén = Q_évac [W]. */
  heatW: number;
  /** Stable si dQ_évac/dT > dQ_gén/dT (critère de Van Heerden). */
  stable: boolean;
}

/** Concentration quasi-stationnaire C_A(T). */
export function quasiSteadyCA(tempK: number, p: ReactorParams, ctx: VanHeerdenContext): number {
  const dilution = (p.feedFlowLps * ctx.feedFactor) / p.volumeL;
  const k = arrhenius(tempK, p.k0PerS * ctx.inhibitorFactor, p.eaOverRK);
  return (dilution * p.caInMolL) / (dilution + k);
}

export function heatGeneratedW(tempK: number, p: ReactorParams, ctx: VanHeerdenContext): number {
  const k = arrhenius(tempK, p.k0PerS * ctx.inhibitorFactor, p.eaOverRK);
  return -p.deltaHrJMol * k * quasiSteadyCA(tempK, p, ctx) * p.volumeL;
}

export function heatRemovedW(tempK: number, p: ReactorParams, ctx: VanHeerdenContext): number {
  const ua = heatTransferUA(p.rpm, ctx.fouling, p);
  return (
    p.feedFlowLps * ctx.feedFactor * p.rhoGL * p.cpJGK * (tempK - p.tInK) +
    ua * (tempK - ctx.sinkTempK)
  );
}

/**
 * Balaie [tMinK, tMaxK] avec `points` points (200 par défaut, PLAN S6-L04). À recalculer
 * uniquement quand les paramètres changent.
 */
export function vanHeerdenCurves(
  p: ReactorParams,
  ctx: VanHeerdenContext,
  tMinK = 285,
  tMaxK = 460,
  points = 200,
): VanHeerdenCurves {
  const tempK = new Float64Array(points);
  const qGen = new Float64Array(points);
  const qRem = new Float64Array(points);
  for (let i = 0; i < points; i++) {
    const t = tMinK + ((tMaxK - tMinK) * i) / (points - 1);
    tempK[i] = t;
    qGen[i] = heatGeneratedW(t, p, ctx);
    qRem[i] = heatRemovedW(t, p, ctx);
  }
  return { tempK, qGen, qRem };
}

/**
 * États stationnaires : racines de Q_gén − Q_évac (changements de signe sur la grille, affinés par
 * bissection) et stabilité par comparaison des pentes.
 */
export function steadyStates(
  p: ReactorParams,
  ctx: VanHeerdenContext,
  tMinK = 285,
  tMaxK = 460,
  scanPoints = 800,
): SteadyState[] {
  const g = (t: number) => heatGeneratedW(t, p, ctx) - heatRemovedW(t, p, ctx);
  const out: SteadyState[] = [];
  let prevT = tMinK;
  let prevG = g(prevT);
  for (let i = 1; i < scanPoints; i++) {
    const t = tMinK + ((tMaxK - tMinK) * i) / (scanPoints - 1);
    const gt = g(t);
    if (prevG === 0) {
      out.push(makeState(prevT, p, ctx));
    } else if (prevG * gt < 0) {
      let lo = prevT;
      let hi = t;
      let glo = prevG;
      for (let it = 0; it < 60; it++) {
        const mid = 0.5 * (lo + hi);
        const gm = g(mid);
        if (glo * gm <= 0) hi = mid;
        else {
          lo = mid;
          glo = gm;
        }
      }
      out.push(makeState(0.5 * (lo + hi), p, ctx));
    }
    prevT = t;
    prevG = gt;
  }
  return out;
}

function makeState(tempK: number, p: ReactorParams, ctx: VanHeerdenContext): SteadyState {
  const h = 1e-3;
  const slopeGen =
    (heatGeneratedW(tempK + h, p, ctx) - heatGeneratedW(tempK - h, p, ctx)) / (2 * h);
  const slopeRem = (heatRemovedW(tempK + h, p, ctx) - heatRemovedW(tempK - h, p, ctx)) / (2 * h);
  return {
    tempK,
    caMolL: quasiSteadyCA(tempK, p, ctx),
    heatW: heatGeneratedW(tempK, p, ctx),
    stable: slopeRem > slopeGen,
  };
}
