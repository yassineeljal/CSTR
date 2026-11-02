/**
 * Horloge partagée à 10 Hz pour les lectures numériques (PLAN §5.4 règle 4) : les callbacks
 * écrivent directement dans le DOM (`el.textContent`), sans passer par React.
 */
const READOUT_HZ = 10;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

export function subscribeReadout(cb: () => void): () => void {
  listeners.add(cb);
  timer ??= setInterval(() => {
    for (const l of listeners) l();
  }, 1000 / READOUT_HZ);
  cb();
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };
}
