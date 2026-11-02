import type { WorkerCommand, WorkerEvent } from '@/simulation/protocol';
import { SimulationHost } from '@/simulation/workerCore';
import type { SimulationTransport } from './transport';

/**
 * Transport « en mémoire » : exécute le moteur sur le thread appelant. Sert aux tests et de
 * repli si les Web Workers sont indisponibles. `tick()` est piloté par l'appelant.
 */
export class LoopbackTransport implements SimulationTransport {
  private readonly listeners = new Set<(event: WorkerEvent) => void>();
  private readonly host = new SimulationHost((event) => {
    for (const cb of this.listeners) cb(event);
  });

  send(cmd: WorkerCommand): void {
    this.host.handle(cmd);
  }

  tick(nowMs: number): void {
    this.host.tick(nowMs);
  }

  onEvent(cb: (event: WorkerEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  dispose(): void {
    this.listeners.clear();
  }
}
