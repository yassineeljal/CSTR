import { SimulationClient } from './SimulationClient';
import { WorkerTransport } from './WorkerTransport';

let instance: SimulationClient | null = null;
let refCount = 0;

/**
 * Singleton du client de simulation, partagé par tous les composants. Compté en références :
 * le worker est arrêté quand le dernier consommateur se démonte (compatible React StrictMode).
 */
export function acquireSimulationClient(): SimulationClient {
  if (typeof window === 'undefined') throw new Error('SimulationClient: navigateur requis');
  instance ??= new SimulationClient(new WorkerTransport());
  refCount++;
  return instance;
}

export function releaseSimulationClient(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && instance) {
    // Différé : en StrictMode, le remontage immédiat réutilise l'instance.
    const toDispose = instance;
    queueMicrotask(() => {
      if (refCount === 0 && instance === toDispose) {
        toDispose.dispose();
        instance = null;
      }
    });
  }
}
