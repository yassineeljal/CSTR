import { ATMOSPHERIC_PRESSURE_PA, WATER_LATENT_HEAT_J_KG } from '../constants';
import type { PidSettings, QuenchParams, ReactorParams, ReactorState } from '../types';

/**
 * Benchmark CSTR de Seborg, Edgar, Mellichamp & Doyle (« Process Dynamics and Control »),
 * converti en secondes (PLAN §4.6).
 *
 * Point stationnaire exact (niveau 1, T_c = 300 K) : C_A = 0,5 mol/L ; T = 350 K,
 * instable en boucle ouverte. Le niveau 2 est dimensionné (S1-C04, notebook 02) pour que le
 * même point reste stationnaire avec T_j = 300 K et la vanne à 50 %.
 */

/** Diamètre de cuve pour H/D = 1 et V = 100 L : D = (4V/π)^{1/3} ≈ 0,503 m. */
const TANK_DIAMETER_M = Math.cbrt((4 * 0.1) / Math.PI);

export const SEBORG_PARAMS: ReactorParams = {
  modelLevel: 2,

  volumeL: 100, // V — Seborg
  feedFlowLps: 100 / 60, // F = 100 L/min — Seborg
  caInMolL: 1.0, // C_A,in — Seborg
  tInK: 350, // T_in — Seborg

  k0PerS: 7.2e10 / 60, // k₀ = 7,2·10¹⁰ min⁻¹ — Seborg
  eaOverRK: 8750, // E_a/R — Seborg
  deltaHrJMol: -5.0e4, // ΔH_r — Seborg

  rhoGL: 1000, // ρ — Seborg
  cpJGK: 0.239, // C_p — Seborg
  viscosityPaS: 1.0e-3, // TODO(chem): valider (eau à 20 °C ; dépend du milieu réel)

  uaRefWK: 5.0e4 / 60, // UA = 5·10⁴ J/(min·K) — Seborg
  uaMinWK: (5.0e4 / 60) * 0.1, // TODO(chem): valider U_min (S4-C01) — 10 % de UA_ref
  uExponent: 2 / 3, // Nu ∝ Re^{2/3}·Pr^{1/3}

  rpm: 120,
  rpmRef: 120, // N_ref — PLAN §4.6
  turbineDiameterM: TANK_DIAMETER_M / 3, // D_turbine/D_cuve ≈ 1/3

  tcK: 300, // T_c niveau 1 — Seborg

  // Enveloppe dimensionnée en S1-C04 (notebook 02) : une enveloppe lente (V_j = 20 L,
  // T_c,in = 285 K) ne peut pas stabiliser le pôle instable (τ ≈ 21 s) et l'autorité de
  // refroidissement serait trop faible. V_j = 5 L, eau glacée à 5 °C, vanne nominale à 30 %.
  jacketVolumeL: 5, // TODO(chem): valider (S1-C04)
  jacketRhoGL: 1000, // eau
  jacketCpJGK: 4.18, // eau
  tcInK: 278, // T_c,in niveau 2 (5 °C)
  // F_c,max : à v = 0,3 et η = 1, F_c = Q/(ρ_j·C_p,j·(T_j − T_c,in)) avec
  // Q = UA·(T − T_j) = 41 667 W, T_j = 300 K ⇒ F_c = 0,4531 L/s ⇒ F_c,max = 1,5103 L/s.
  fcMaxLps: 1.5103,
  valveTauS: 2,
  valveRateMaxPerS: 0.25,

  inertPressurePa: 1.013e5,
  atmPressurePa: ATMOSPHERIC_PRESSURE_PA,
  reliefSetPressurePa: 3.0e5,
  reliefResetFraction: 0.9,
  reliefCd: 0.65, // TODO(chem): valider (S4-C02)
  reliefAreaM2: 1.5e-5, // TODO(chem): valider (S4-C02)
  latentHeatJKg: WATER_LATENT_HEAT_J_KG,
  reliefEnabled: true,

  // Seuils d'alarme (S2-C03). Les valeurs du plan (H = 370 K, HH = 400 K) arrivent trop tard :
  // la simulation montre qu'au-delà de ~385 K le pic d'emballement atteint 450 K en ~3 s.
  // H/HH sont donc abaissés à 365/380 K pour laisser une fenêtre d'intervention.
  tLLK: 330,
  tHK: 365,
  tHHK: 380,
  tRuptureK: 450,
  alarmDeadbandK: 2,
};

/** État stationnaire nominal (niveau 2, v = 0,3). */
export const SEBORG_STEADY_STATE: ReactorState = { CA: 0.5, T: 350, Tj: 300, v: 0.3 };

/** Démarrage à froid (PLAN §4.8 scénario 1). */
export const SEBORG_COLD_STATE: ReactorState = { CA: 0, T: 300, Tj: 300, v: 0 };

/** Réglages PID par défaut, issus de l'accord du notebook 03 (S2-C02). TODO(chem): valider. */
export const SEBORG_PID: PidSettings = {
  kp: 0.25, // 1/K
  ki: 0.01, // 1/(K·s)
  kd: 3, // s/K
  tauFilterS: 2, // s
  bias: 0.3, // ouverture nominale de la vanne
  setpointK: 350,
};

/** Quench par défaut. TODO(chem): valider (S5-C02). */
export const SEBORG_QUENCH: QuenchParams = {
  volumeL: 60,
  tempK: 280,
  durationS: 2,
  inhibitorFactor: 0.05,
  inhibitorDurationS: 180,
};
