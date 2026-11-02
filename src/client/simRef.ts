import { SNAPSHOT_SIZE } from '@/simulation/protocol';

/**
 * Tampon mutable partagé de l'état rapide (≈ 60 Hz). Lu dans `useFrame` et dans les boucles
 * rAF des graphes ; jamais via React state (PLAN §5.4, ADR-005).
 */
export const simRef: { current: Float64Array } = { current: new Float64Array(SNAPSHOT_SIZE) };

/** Compteur incrémenté à chaque snapshot reçu (détection de nouvelles données sans allocation). */
export const simVersion: { current: number } = { current: 0 };

const snapshotListeners: Array<() => void> = [];

/**
 * Abonnement aux snapshots (≈ 60 Hz tant que la simulation tourne). Utilisé par la scène 3D en
 * rendu « à la demande » : une image n'est produite que si l'état change (zéro coût au repos).
 * @returns fonction de désabonnement
 */
export function subscribeSnapshots(cb: () => void): () => void {
  snapshotListeners.push(cb);
  return () => {
    const i = snapshotListeners.indexOf(cb);
    if (i >= 0) snapshotListeners.splice(i, 1);
  };
}

/** Appelé par le client après chaque copie de snapshot. Boucle indexée : aucune allocation. */
export function notifySnapshot(): void {
  for (let i = 0; i < snapshotListeners.length; i++) (snapshotListeners[i] as () => void)();
}
