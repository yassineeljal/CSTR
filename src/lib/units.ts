/**
 * Conversions d'unités. Le moteur est en SI/unités moteur ; les conversions d'affichage
 * se font uniquement ici (PLAN §0.1 règle 5).
 */
import { ZERO_CELSIUS_K } from '@/simulation/constants';

export const kelvinToCelsius = (k: number): number => k - ZERO_CELSIUS_K;
export const celsiusToKelvin = (c: number): number => c + ZERO_CELSIUS_K;

export const PA_PER_BAR = 1e5;
export const paToBar = (pa: number): number => pa / PA_PER_BAR;
export const barToPa = (bar: number): number => bar * PA_PER_BAR;

export const secondsToMinutes = (s: number): number => s / 60;
export const minutesToSeconds = (m: number): number => m * 60;

/** tr/min → rad/s. */
export const rpmToRadPerS = (rpm: number): number => (rpm * 2 * Math.PI) / 60;

/** mol/L → mol/m³ (identique à ×1000). */
export const molPerLToMolPerM3 = (c: number): number => c * 1000;
export const molPerM3ToMolPerL = (c: number): number => c / 1000;

/** Fraction [0..1] → pourcentage. */
export const fractionToPercent = (f: number): number => f * 100;

/** W → kW. */
export const wattsToKilowatts = (w: number): number => w / 1000;

/**
 * Formate un temps simulé [s] en « mm:ss ».
 * @param seconds temps ≥ 0 (les valeurs négatives sont ramenées à 0)
 */
export function formatSimTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
