import { GAS_CONSTANT_J_MOL_K } from '../constants';
import type { PidSettings, ReactorParams, ReactorState } from '../types';
import { SEBORG_PARAMS } from './seborgBenchmark';

/**
 * Hydrolyse de l'oxyde de propylène (PO + H₂O → propylène glycol), pseudo-ordre 1 en PO
 * (eau en large excès). Cinétique de la littérature :
 *
 *   H. S. Fogler, « Elements of Chemical Reaction Engineering », 5e éd., chap. 12 (CSTR) :
 *   k = 16,96·10¹² · exp(−32 400 / (R·T)) h⁻¹   (R = 1,987 Btu/(lbmol·°R), T en °R)
 *   ΔH_rx = −36 000 Btu/lbmol
 *
 * Conversion : 1 Btu/lbmol = 1055,056 J / 453,59237 mol = 2,326 J/mol.
 * Les conditions opératoires (C_A,in, F, T_in, UA, T_c) sont des hypothèses pédagogiques
 * choisies pour que le réacteur présente 3 états stationnaires. TODO(chem): valider.
 */
const BTU_PER_LBMOL_TO_J_PER_MOL = 1055.056 / 453.59237;
const ACTIVATION_ENERGY_J_MOL = 32_400 * BTU_PER_LBMOL_TO_J_PER_MOL; // ≈ 75,4 kJ/mol
const REACTION_ENTHALPY_J_MOL = -36_000 * BTU_PER_LBMOL_TO_J_PER_MOL; // ≈ −83,7 kJ/mol
const PRE_EXPONENTIAL_PER_S = 16.96e12 / 3600; // ≈ 4,71·10⁹ s⁻¹

export const PROPYLENE_OXIDE_PARAMS: ReactorParams = {
  ...SEBORG_PARAMS,
  modelLevel: 2,

  volumeL: 100,
  feedFlowLps: 0.5, // τ = V/F = 200 s
  caInMolL: 4.0, // TODO(chem): ≈ 23 % vol. de PO, choisi pour la multiplicité d'états
  tInK: 300,

  k0PerS: PRE_EXPONENTIAL_PER_S, // Fogler
  eaOverRK: ACTIVATION_ENERGY_J_MOL / GAS_CONSTANT_J_MOL_K, // Fogler
  deltaHrJMol: REACTION_ENTHALPY_J_MOL, // Fogler

  rhoGL: 1000, // milieu essentiellement aqueux
  cpJGK: 4.18,
  vesselHeatCapacityJK: 5.0e4,

  uaRefWK: 500,
  uaMinWK: 50,
  tcK: 285,

  jacketVolumeL: 5,
  tcInK: 275,
  // Dimensionnement : Q = UA·(T − T_j) = 20 918 W à T = 326,84 K, T_j = 285 K, v = 0,3
  // ⇒ F_c = Q/(ρ_j·C_p,j·(T_j − T_c,in)) = 0,5004 L/s ⇒ F_c,max = 1,668 L/s.
  fcMaxLps: 1.668,

  // Pas de rupture atteignable : T_ad,max ≈ T_in + (−ΔH)·C_A,in/(ρ·C_p) ≈ 380 K.
  tLLK: 295,
  tHK: 340,
  tHHK: 350,
  tRuptureK: 400,
};

/** État stationnaire instable (niveau 2, v = 0,3) — point de fonctionnement régulé. */
export const PROPYLENE_OXIDE_STEADY_STATE: ReactorState = {
  CA: 2.160802,
  T: 326.835421,
  Tj: 285.000382,
  v: 0.3,
};

/** Gains issus de l'analyse linéaire du notebook 03 (marge ≈ 110 s). TODO(chem): valider. */
export const PROPYLENE_OXIDE_PID: PidSettings = {
  kp: 1.9,
  ki: 0.1,
  kd: 20,
  tauFilterS: 2,
  bias: 0.3,
  setpointK: 326.835421,
};
