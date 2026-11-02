import type { WorkerCommand, WorkerEvent } from '@/simulation/protocol';

/**
 * Abstraction du transport de simulation (PLAN §5.3). v1 : Web Worker local ; futur : WebSocket
 * vers un moteur distant (architecture B), même contrat de messages.
 */
export interface SimulationTransport {
  send(cmd: WorkerCommand): void;
  onEvent(cb: (event: WorkerEvent) => void): () => void;
  dispose(): void;
}
