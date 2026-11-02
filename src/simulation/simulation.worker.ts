/// <reference lib="webworker" />
import type { WorkerCommand, WorkerEvent } from './protocol';
import { SimulationHost } from './workerCore';

/** Période de la boucle du worker [ms] (≈ 60 Hz, PLAN §5.1). */
const TICK_MS = 16;

const scope = self as unknown as DedicatedWorkerGlobalScope;
const host = new SimulationHost((event: WorkerEvent, transfer?: Transferable[]) => {
  scope.postMessage(event, transfer ?? []);
});

scope.onmessage = (message: MessageEvent<WorkerCommand>) => host.handle(message.data);
setInterval(() => host.tick(performance.now()), TICK_MS);
