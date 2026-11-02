import { arrhenius, heatTransferUA } from './kinetics';
import { reliefHeatW } from './relief';
import { STATE_INDEX, type Inputs, type ReactorParams } from './types';

const { CA: I_CA, T: I_T, Tj: I_TJ, v: I_V } = STATE_INDEX;

/** Température d'enveloppe effective : imposée au niveau 1, état au niveau 2. */
export function effectiveJacketTemp(x: ArrayLike<number>, p: ReactorParams): number {
  return p.modelLevel === 1 ? p.tcK : (x[I_TJ] ?? p.tcK);
}

/** Débit d'eau froide F_c = v·F_c,max·η_pompe [L/s] (PLAN §4.3). */
export function coolingFlowLps(v: number, p: ReactorParams, inputs: Inputs): number {
  return v * p.fcMaxLps * inputs.pumpEfficiency;
}

/**
 * Chaleur générée par la réaction Q_gén = (−ΔH_r)·k(T)·C_A·V [W] (PLAN §4.9, Van Heerden).
 */
export function heatGenerationW(
  tempK: number,
  caMolL: number,
  p: ReactorParams,
  inputs: Inputs,
): number {
  const k = arrhenius(tempK, p.k0PerS * inputs.inhibitorFactor, p.eaOverRK);
  return -p.deltaHrJMol * k * caMolL * p.volumeL;
}

/** Chaleur évacuée vers l'enveloppe Q_évac = U·A·(T − T_j) [W]. */
export function heatRemovalW(
  tempK: number,
  jacketTempK: number,
  p: ReactorParams,
  inputs: Inputs,
): number {
  return heatTransferUA(p.rpm, inputs.fouling, p) * (tempK - jacketTempK);
}

/**
 * Second membre de l'EDO : dx/dt = f(x) (PLAN §4.3). Sans allocation.
 * x = [C_A, T, T_j, v] ; `out` reçoit les dérivées (même disposition).
 *
 * @param x état courant
 * @param p paramètres
 * @param inputs entrées (v_cmd, η_pompe, encrassement, inhibiteur, soupape)
 * @param out tampon de sortie (longueur ≥ 4)
 */
export function derivatives(
  x: Float64Array,
  p: ReactorParams,
  inputs: Inputs,
  out: Float64Array,
): void {
  const ca = x[I_CA] ?? 0;
  const t = x[I_T] ?? 0;
  const tj = effectiveJacketTemp(x, p);

  const dilution = p.feedFlowLps / p.volumeL; // F/V [s⁻¹]
  const k = arrhenius(t, p.k0PerS * inputs.inhibitorFactor, p.eaOverRK);
  const rhoCp = p.rhoGL * p.cpJGK; // [J/(L·K)]
  const ua = heatTransferUA(p.rpm, inputs.fouling, p);

  // Bilan de matière — PLAN §4.3
  out[I_CA] = dilution * (p.caInMolL - ca) - k * ca;

  // Bilan d'énergie du réacteur — PLAN §4.3 (+ terme de soupape §4.4)
  const qRelief = p.reliefEnabled && inputs.reliefOpen === 1 ? reliefHeatW(t, p) : 0;
  out[I_T] =
    dilution * (p.tInK - t) +
    (-p.deltaHrJMol * k * ca) / rhoCp -
    (ua / (p.volumeL * rhoCp)) * (t - tj) -
    qRelief / (p.volumeL * rhoCp);

  if (p.modelLevel === 1) {
    out[I_TJ] = 0;
    out[I_V] = 0;
    return;
  }

  // Bilan d'énergie de l'enveloppe — PLAN §4.3
  const v = x[I_V] ?? 0;
  const fc = coolingFlowLps(v, p, inputs);
  out[I_TJ] =
    (fc / p.jacketVolumeL) * (p.tcInK - tj) +
    (ua / (p.jacketVolumeL * p.jacketRhoGL * p.jacketCpJGK)) * (t - tj);

  // Dynamique de la vanne : 1er ordre + limitation de vitesse — PLAN §4.3
  const rate = (inputs.valveCmd - v) / p.valveTauS;
  out[I_V] = Math.min(Math.max(rate, -p.valveRateMaxPerS), p.valveRateMaxPerS);
}
