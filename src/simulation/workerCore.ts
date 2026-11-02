import { SimulationEngine } from './engine';
import { SEBORG_PARAMS, SEBORG_PID, SEBORG_STEADY_STATE } from './presets/seborgBenchmark';
import { SNAPSHOT_SIZE, validateCommand, type WorkerCommand, type WorkerEvent } from './protocol';
import type { ControlMode, EngineStatus } from './types';

/** Plafond du dt réel d'un tick [s] : un onglet en arrière-plan ne doit pas provoquer de rafale. */
export const MAX_TICK_DT_S = 0.25;

export type PostFn = (event: WorkerEvent, transfer?: Transferable[]) => void;

/**
 * Logique du worker, indépendante de l'environnement (testable sous Node). `simulation.worker.ts`
 * n'est qu'une fine couche qui relie `handle`/`tick` à `postMessage`/`setInterval`.
 */
export class SimulationHost {
  private engine: SimulationEngine;
  private lastTickMs: number | null = null;
  private lastStatus: EngineStatus | null = null;
  private lastMode: ControlMode | null = null;

  constructor(private readonly post: PostFn) {
    this.engine = SimulationHost.defaultEngine();
  }

  private static defaultEngine(): SimulationEngine {
    return new SimulationEngine({
      params: SEBORG_PARAMS,
      initialState: SEBORG_STEADY_STATE,
      pid: SEBORG_PID,
    });
  }

  get status(): EngineStatus {
    return this.engine.status;
  }

  /** Traite une commande de l'UI. Une commande invalide est rejetée par un événement `error`. */
  handle(cmd: WorkerCommand): void {
    const problem = validateCommand(cmd);
    if (problem) {
      this.post({ type: 'error', message: problem });
      return;
    }
    const e = this.engine;
    switch (cmd.type) {
      case 'ping':
        this.post({ type: 'pong', token: cmd.token });
        return;
      case 'init':
        this.engine = new SimulationEngine({
          params: cmd.params,
          initialState: cmd.initialState,
          pid: cmd.pid,
        });
        break;
      case 'start':
        e.start();
        this.lastTickMs = null;
        break;
      case 'pause':
        e.pause();
        break;
      case 'reset':
        e.reset(cmd.initialState);
        break;
      case 'setParams':
        e.setParams(cmd.patch);
        break;
      case 'setPid':
        e.setPid(cmd.patch);
        break;
      case 'setMode':
        e.setMode(cmd.mode);
        break;
      case 'setManualValve':
        e.setManualValve(cmd.value);
        break;
      case 'setTimeScale':
        e.setTimeScale(cmd.value);
        break;
      case 'setPumpEfficiency':
        e.setPumpEfficiency(cmd.value);
        break;
      case 'setFeedFactor':
        e.setFeedFactor(cmd.value);
        break;
      case 'loadScenario':
        e.loadScenario(cmd.id);
        break;
      case 'quench':
        e.quench();
        break;
    }
    this.flush();
  }

  /**
   * Un tick de la boucle (~16 ms). Avance la simulation selon le temps réel écoulé puis publie
   * un snapshot. Sans effet tant que la simulation n'est pas en cours.
   * @param nowMs horloge monotone (performance.now())
   */
  tick(nowMs: number): void {
    if (this.engine.status !== 'running') {
      this.lastTickMs = null;
      return;
    }
    const dt = this.lastTickMs === null ? 0 : (nowMs - this.lastTickMs) / 1000;
    this.lastTickMs = nowMs;
    this.engine.step(Math.min(dt, MAX_TICK_DT_S));
    this.flush();
  }

  /** Publie événements, changement de statut et snapshot. */
  private flush(): void {
    for (const ev of this.engine.takeEvents()) this.post(ev);
    if (this.engine.status !== this.lastStatus || this.engine.mode !== this.lastMode) {
      this.lastStatus = this.engine.status;
      this.lastMode = this.engine.mode;
      this.post({ type: 'status', status: this.lastStatus, mode: this.lastMode });
    }
    const buffer = new Float64Array(SNAPSHOT_SIZE);
    this.engine.writeSnapshot(buffer);
    this.post({ type: 'snapshot', buffer }, [buffer.buffer]);
  }
}
