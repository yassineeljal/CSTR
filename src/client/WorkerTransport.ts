import type { WorkerCommand, WorkerEvent } from '@/simulation/protocol';
import type { SimulationTransport } from './transport';

/** Transport v1 : moteur dans un Web Worker dédié (ADR-001). */
export class WorkerTransport implements SimulationTransport {
  private readonly worker: Worker;
  private readonly listeners = new Set<(event: WorkerEvent) => void>();

  constructor() {
    this.worker = new Worker(new URL('../simulation/simulation.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (message: MessageEvent<WorkerEvent>) => {
      for (const cb of this.listeners) cb(message.data);
    };
  }

  send(cmd: WorkerCommand): void {
    this.worker.postMessage(cmd);
  }

  onEvent(cb: (event: WorkerEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  dispose(): void {
    this.listeners.clear();
    this.worker.terminate();
  }
}
