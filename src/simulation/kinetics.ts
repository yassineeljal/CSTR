import { ANTOINE_WATER, MMHG_TO_PA, WATER_CRITICAL_TEMP_K, ZERO_CELSIUS_K } from './constants';
import type { ReactorParams } from './types';

/**
 * Loi d'Arrhenius k(T) = k₀·exp(−E_a/(R·T)) [s⁻¹] (PLAN §4.3).
 * @param tempK température [K] (≤ 0 ⇒ 0, protège contre une division par zéro)
 * @param k0PerS facteur pré-exponentiel [s⁻¹]
 * @param eaOverRK E_a/R [K]
 */
export function arrhenius(tempK: number, k0PerS: number, eaOverRK: number): number {
  if (!(tempK > 0)) return 0;
  return k0PerS * Math.exp(-eaOverRK / tempK);
}

/**
 * Produit U·A effectif [W/K] en fonction de l'agitation et de l'encrassement (PLAN §4.3).
 * UA = max(UA_ref·(N/N_ref)^n, UA_min) · f. Le plancher UA_min représente la convection
 * naturelle : le transfert ne tombe jamais à 0 quand N → 0.
 * @param fouling f_encrassement ∈ ]0..1]
 */
export function heatTransferUA(
  rpm: number,
  fouling: number,
  p: Pick<ReactorParams, 'uaRefWK' | 'uaMinWK' | 'rpmRef' | 'uExponent'>,
): number {
  const ratio = Math.max(rpm, 0) / p.rpmRef;
  const forced = p.uaRefWK * Math.pow(ratio, p.uExponent);
  return Math.max(forced, p.uaMinWK) * fouling;
}

/**
 * Pression de vapeur saturante de l'eau par l'équation d'Antoine [Pa] (PLAN §4.4).
 * Deux plages (1–100 °C et 100–374 °C). Hors plage : prolongement de la plage la plus proche,
 * borné à la température critique.
 * @param tempK température [K]
 */
export function antoineWaterPa(tempK: number): number {
  const clamped = Math.min(tempK, WATER_CRITICAL_TEMP_K);
  const tc = clamped - ZERO_CELSIUS_K;
  const c = tc <= ANTOINE_WATER.switchCelsius ? ANTOINE_WATER.low : ANTOINE_WATER.high;
  const log10Mmhg = c.A - c.B / (c.C + tc);
  return Math.pow(10, log10Mmhg) * MMHG_TO_PA;
}

/**
 * Nombre de Reynolds d'agitation Re = ρ·N·D²/μ [—] (PLAN §4.9).
 * @param rhoKgM3 masse volumique [kg/m³]
 * @param rpm vitesse [tr/min]
 * @param diameterM diamètre de turbine [m]
 * @param viscosityPaS viscosité [Pa·s]
 */
export function reynoldsStirred(
  rhoKgM3: number,
  rpm: number,
  diameterM: number,
  viscosityPaS: number,
): number {
  const nRevPerS = Math.max(rpm, 0) / 60;
  return (rhoKgM3 * nRevPerS * diameterM * diameterM) / viscosityPaS;
}

/**
 * Nombre de Damköhler Da = k(T)·τ avec τ = V/F (PLAN §4.9).
 */
export function damkohler(
  tempK: number,
  p: Pick<ReactorParams, 'k0PerS' | 'eaOverRK' | 'volumeL' | 'feedFlowLps'>,
  k0Factor = 1,
): number {
  const tau = p.volumeL / p.feedFlowLps;
  return arrhenius(tempK, p.k0PerS * k0Factor, p.eaOverRK) * tau;
}
