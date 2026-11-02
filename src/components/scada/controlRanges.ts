/**
 * Plages des curseurs de l'interface. Les bornes dures de sécurité sont celles du protocole
 * (`PARAM_BOUNDS`, validées dans le worker) ; ici ce sont des plages d'utilisation confortables,
 * élargies automatiquement si un preset dépasse (ex. C_A,in = 4 mol/L pour l'oxyde de propylène).
 */
export interface Range {
  min: number;
  max: number;
}

/** Plage `[lo, hi]` élargie pour contenir `value` (jamais d'arrondi qui exclurait la valeur courante). */
export function rangeAround(value: number, lo: number, hi: number): Range {
  return { min: Math.min(lo, value), max: Math.max(hi, value) };
}

/** Plages en unités d'AFFICHAGE (°C, L/min, tr/min…). */
export const UI_RANGES = {
  feedTempC: [10, 130],
  feedConcentration: [0, 3],
  feedFlowLpm: [12, 240],
  rpm: [0, 240],
  coolantTempC: [5, 60],
  setpointC: [20, 125],
  kp: [0, 3],
  ki: [0, 0.3],
  kd: [0, 40],
  tauFilter: [0.1, 20],
} as const satisfies Record<string, readonly [number, number]>;
