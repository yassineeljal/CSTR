/**
 * Constantes physiques universelles et tables de référence.
 * Les constantes propres à une réaction/installation vivent dans `presets/`.
 * Aucune constante physique ne doit être codée en dur ailleurs (PLAN §0.1 règle 4).
 */

/** Constante des gaz parfaits [J/(mol·K)] — CODATA 2018 (valeur exacte SI). */
export const GAS_CONSTANT_J_MOL_K = 8.314462618;

/** 1 mmHg en pascals [Pa/mmHg] — définition conventionnelle (101325/760). */
export const MMHG_TO_PA = 101325 / 760;

/** Pression atmosphérique normale [Pa]. */
export const ATMOSPHERIC_PRESSURE_PA = 101325;

/** Masse molaire de l'eau [kg/mol]. */
export const WATER_MOLAR_MASS_KG_MOL = 0.01801528;

/** 0 °C en kelvins [K]. */
export const ZERO_CELSIUS_K = 273.15;

/** Température critique de l'eau [K] (374,0 °C) — borne haute de validité d'Antoine. */
export const WATER_CRITICAL_TEMP_K = 647.096;

/**
 * Coefficients d'Antoine de l'eau : log10(P[mmHg]) = A − B / (C + T[°C]).
 * Source : NIST Chemistry WebBook / tables usuelles (Dortmund Data Bank).
 * Deux plages : 1–100 °C et 100–374 °C (PLAN §4.4).
 */
export const ANTOINE_WATER = {
  /** Plage 1–100 °C. */
  low: { A: 8.07131, B: 1730.63, C: 233.426 },
  /** Plage 100–374 °C. */
  high: { A: 8.14019, B: 1810.94, C: 244.485 },
  /** Température de bascule entre les deux plages [°C]. */
  switchCelsius: 100,
} as const;

/**
 * Chaleur latente de vaporisation de l'eau [J/kg] — valeur à 100 °C, tenue constante
 * (simplification : elle décroît à ~1,95 MJ/kg vers 200 °C).
 */
export const WATER_LATENT_HEAT_J_KG = 2.257e6;

/** Pas d'intégration RK4 par défaut [s simulées] (PLAN §4.6). */
export const DEFAULT_DT_S = 0.01;

/** Période d'échantillonnage du PID [s simulées] (PLAN §4.5). */
export const DEFAULT_PID_PERIOD_S = 0.1;

/** Plafond de pas RK4 par appel à `step` pour éviter la « spirale de la mort » (PLAN §4.7). */
export const MAX_STEPS_PER_TICK = 2000;

/** Saut de température maximal toléré par pas avant sous-découpage [K] (PLAN §12). */
export const MAX_DELTA_T_PER_STEP_K = 5;

/** Profondeur maximale de sous-découpage récursif d'un pas (2^6 = 64 sous-pas). */
export const MAX_SUBSTEP_DEPTH = 6;
