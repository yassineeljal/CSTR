import { GAS_CONSTANT_J_MOL_K, WATER_MOLAR_MASS_KG_MOL } from './constants';
import { antoineWaterPa } from './kinetics';
import type { ReactorParams } from './types';

type ReliefParams = Pick<
  ReactorParams,
  | 'inertPressurePa'
  | 'atmPressurePa'
  | 'reliefSetPressurePa'
  | 'reliefResetFraction'
  | 'reliefCd'
  | 'reliefAreaM2'
  | 'latentHeatJKg'
>;

/** Pression totale P(T) = P_inerte + P_sat(T) [Pa] (PLAN §4.4). */
export function pressurePa(tempK: number, p: Pick<ReactorParams, 'inertPressurePa'>): number {
  return p.inertPressurePa + antoineWaterPa(tempK);
}

/**
 * Débit massique de vapeur évacué par la soupape ouverte [kg/s] (PLAN §4.4) :
 * ṁ_v = C_d·A_s·√(2·ρ_v·(P − P_atm)), avec ρ_v la masse volumique de la vapeur saturante
 * (gaz parfait). Nul si P ≤ P_atm.
 */
export function reliefMassFlowKgS(tempK: number, p: ReliefParams): number {
  const psat = antoineWaterPa(tempK);
  const overPressure = p.inertPressurePa + psat - p.atmPressurePa;
  if (!(overPressure > 0) || !(tempK > 0)) return 0;
  const rhoVapor = (psat * WATER_MOLAR_MASS_KG_MOL) / (GAS_CONSTANT_J_MOL_K * tempK);
  return p.reliefCd * p.reliefAreaM2 * Math.sqrt(2 * rhoVapor * overPressure);
}

/** Puissance thermique évacuée par la soupape ouverte Q̇_relief = ṁ_v·L_v [W]. */
export function reliefHeatW(tempK: number, p: ReliefParams): number {
  return reliefMassFlowKgS(tempK, p) * p.latentHeatJKg;
}

/**
 * Logique d'hystérésis de la soupape : s'ouvre quand P > P_tarage, se referme sous
 * `reliefResetFraction`·P_tarage.
 */
export function nextReliefOpen(wasOpen: boolean, pressure: number, p: ReliefParams): boolean {
  if (wasOpen) return !(pressure < p.reliefResetFraction * p.reliefSetPressurePa);
  return pressure > p.reliefSetPressurePa;
}
