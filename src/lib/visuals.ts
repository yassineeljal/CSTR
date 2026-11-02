/**
 * Lois de correspondance état physique → paramètres visuels (S4). Fonctions pures, bornées et
 * testées : les composants 3D ne contiennent aucun « nombre magique » (PLAN §11).
 */

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Température à partir de laquelle l'ébullition devient visible (nucléation) [K]. */
export const BOIL_START_K = 365;
/** Largeur de la rampe d'ébullition [K] : ébullition pleine à BOIL_START_K + BOIL_RANGE_K. */
export const BOIL_RANGE_K = 30;

/** Intensité d'ébullition ∈ [0, 1] : amplitude des vagues et agitation de la surface. */
export function boilingFactor(tempK: number): number {
  return smoothstep(BOIL_START_K, BOIL_START_K + BOIL_RANGE_K, tempK);
}

/**
 * Densité de bulles ∈ [0, 1] ∝ (T − T_ébullition)⁺ (PLAN S4-L06), linéaire jusqu'à saturation.
 * Température d'ébullition visuelle : 370 K (≈ point d'ébullition de l'eau sous la pression de
 * fonctionnement ; le modèle de pression complet n'est pas rétro-couplé à la cinétique).
 */
export const BUBBLE_START_K = 370;
export const BUBBLE_FULL_K = 400;
export function bubbleDensity(tempK: number): number {
  return clamp((tempK - BUBBLE_START_K) / (BUBBLE_FULL_K - BUBBLE_START_K), 0, 1);
}

/**
 * Profondeur du vortex [m] de la surface libre : ∝ rpm² (surface parabolique d'un liquide en
 * rotation solide), bornée à une fraction de la hauteur de liquide. Les chicanes d'une cuve
 * standard suppriment presque tout vortex réel : l'effet est volontairement atténué.
 * @param rpm vitesse d'agitation [tr/min]
 * @param rpmRef vitesse de référence [tr/min] pour laquelle la profondeur vaut `refDepthM`
 */
export function vortexDepthM(
  rpm: number,
  rpmRef: number,
  refDepthM: number,
  maxDepthM: number,
): number {
  const ratio = Math.max(rpm, 0) / rpmRef;
  return clamp(refDepthM * ratio * ratio, 0, maxDepthM);
}

/** Débit de soupape normalisé ∈ [0, 1] pour l'intensité du panache. */
export function normalizedReliefFlow(flowKgS: number, fullPlumeKgS: number): number {
  return clamp(flowKgS / fullPlumeKgS, 0, 1);
}

/** Débit d'enveloppe normalisé ∈ [0, 1]. */
export function normalizedJacketFlow(fcLps: number, fcMaxLps: number): number {
  return fcMaxLps > 0 ? clamp(fcLps / fcMaxLps, 0, 1) : 0;
}

/**
 * Amplitude de vibration ∈ [0, 1] : discrète à l'approche de HH, forte près de la rupture,
 * renforcée par la surpression (S4-L08).
 * @param tempK température [K]
 * @param tHHK seuil d'alarme haute-haute [K]
 * @param tRuptureK seuil de rupture [K]
 * @param pressureRatio P / P_tarage
 */
export function vibrationAmplitude(
  tempK: number,
  tHHK: number,
  tRuptureK: number,
  pressureRatio: number,
): number {
  const thermal = clamp((tempK - tHHK) / (tRuptureK - tHHK), 0, 1);
  const pressure = clamp((pressureRatio - 1) / 1.5, 0, 1);
  return clamp(Math.pow(thermal, 1.5) + 0.35 * pressure * thermal, 0, 1);
}

/** Vitesse de phase des bandes de l'enveloppe [rad/s] à débit normalisé 1. */
export const JACKET_PHASE_RATE = 9;
