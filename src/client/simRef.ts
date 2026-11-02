import { SNAPSHOT_SIZE } from '@/simulation/protocol';

/**
 * Tampon mutable partagé de l'état rapide (≈ 60 Hz). Lu dans `useFrame` et dans les boucles
 * rAF des graphes ; jamais via React state (PLAN §5.4, ADR-005).
 */
export const simRef: { current: Float64Array } = { current: new Float64Array(SNAPSHOT_SIZE) };

/** Compteur incrémenté à chaque snapshot reçu (détection de nouvelles données sans allocation). */
export const simVersion: { current: number } = { current: 0 };
