import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import { TelemetryBuffer } from './telemetryBuffer';

/**
 * Télémétrie des graphes : un point toutes les `SAMPLE_INTERVAL_S` secondes *simulées*, alimenté
 * directement par chaque snapshot reçu (pas par rAF : à ×60 un snapshot couvre ~1 s simulée).
 * Les valeurs restent en unités moteur (K, mol/L, W) ; les axes convertissent à l'affichage.
 */
export const TELEMETRY_CHANNELS = [
  'T',
  'setpoint',
  'CA',
  'valve',
  'valveCmd',
  'Qgen',
  'Qremoval',
] as const;
export type TelemetryChannel = (typeof TELEMETRY_CHANNELS)[number];

/** Indice de canal dans le tampon (0 = temps). */
export const telemetryIndex = (c: TelemetryChannel): number => TELEMETRY_CHANNELS.indexOf(c) + 1;

export const SAMPLE_INTERVAL_S = 0.25;
/** Capacité : 8192 points ≈ 34 min simulées. */
export const TELEMETRY_CAPACITY = 8192;

export const telemetry = new TelemetryBuffer(1 + TELEMETRY_CHANNELS.length, TELEMETRY_CAPACITY);

const scratch = new Float64Array(TELEMETRY_CHANNELS.length);
let lastSampleT = Number.NEGATIVE_INFINITY;

/** Enregistre un point si le temps simulé a avancé d'au moins `SAMPLE_INTERVAL_S`. Sans allocation. */
export function sampleTelemetry(snapshot: Float64Array): void {
  const t = snapshot[SNAPSHOT_LAYOUT.simTime] as number;
  if (t < lastSampleT) resetTelemetry(); // retour en arrière : reset / nouveau scénario
  if (t - lastSampleT < SAMPLE_INTERVAL_S) return;
  for (let i = 0; i < TELEMETRY_CHANNELS.length; i++) {
    scratch[i] = snapshot[SNAPSHOT_LAYOUT[TELEMETRY_CHANNELS[i] as TelemetryChannel]] as number;
  }
  telemetry.push(t, scratch);
  lastSampleT = t;
}

export function resetTelemetry(): void {
  telemetry.clear();
  lastSampleT = Number.NEGATIVE_INFINITY;
}
