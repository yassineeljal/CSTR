import { SNAPSHOT_SIZE, type WorkerCommand, type WorkerEvent } from '@/simulation/protocol';
import type {
  ControlMode,
  PidSettings,
  ReactorParams,
  ReactorState,
  ScenarioId,
} from '@/simulation/types';
import { SEBORG_STEADY_STATE } from '@/simulation/presets/seborgBenchmark';
import { useReactorStore } from '@/store/useReactorStore';
import { notifySnapshot, simRef, simVersion } from './simRef';
import { sampleTelemetry } from './telemetry';
import type { SimulationTransport } from './transport';

/**
 * Façade côté UI : relie un `SimulationTransport` au store lent et au tampon rapide `simRef`.
 * Les commandes mettent à jour le store (état « voulu ») puis partent vers le worker.
 */
export class SimulationClient {
  private readonly unsubscribe: () => void;
  private readonly pings = new Map<number, () => void>();
  private pingToken = 0;

  constructor(private readonly transport: SimulationTransport) {
    this.unsubscribe = transport.onEvent((e) => this.onEvent(e));
    const { params, pid } = useReactorStore.getState();
    this.send({ type: 'init', params, pid, initialState: SEBORG_STEADY_STATE });
  }

  // ------------------------------------------------------------- événements
  private onEvent(e: WorkerEvent): void {
    const store = useReactorStore.getState();
    switch (e.type) {
      case 'snapshot':
        // Copie dans le tampon réutilisé : pas d'allocation, pas de setState (PLAN §5.4).
        simRef.current.set(e.buffer.subarray(0, SNAPSHOT_SIZE));
        simVersion.current++;
        sampleTelemetry(simRef.current);
        notifySnapshot();
        break;
      case 'status':
        store.setStatus(e.status, e.mode);
        store.setPlant({
          pumpOn: e.pumpOn,
          feedFactor: e.feedFactor,
          quenchActive: e.quenchActive,
        });
        break;
      case 'alarm':
        store.pushAlarm(e.alarm);
        break;
      case 'scenarioEvent':
        store.pushLog(e.simTimeS, e.label);
        break;
      case 'rupture':
        store.setRupture({ simTimeS: e.simTimeS, tempK: e.tempK });
        break;
      case 'error':
        store.setError(e.message);
        break;
      case 'pong':
        this.pings.get(e.token)?.();
        this.pings.delete(e.token);
        break;
    }
  }

  private send(cmd: WorkerCommand): void {
    this.transport.send(cmd);
  }

  // --------------------------------------------------------------- commandes
  /** Vérifie que le worker répond (S1-L05). Rejette après `timeoutMs`. */
  ping(timeoutMs = 2000): Promise<void> {
    const token = ++this.pingToken;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pings.delete(token);
        reject(new Error('Le worker ne répond pas'));
      }, timeoutMs);
      this.pings.set(token, () => {
        clearTimeout(timer);
        resolve();
      });
      this.send({ type: 'ping', token });
    });
  }

  start(): void {
    this.send({ type: 'start' });
  }
  pause(): void {
    this.send({ type: 'pause' });
  }
  reset(initialState?: ReactorState): void {
    useReactorStore.getState().clearSession();
    this.send({ type: 'reset', ...(initialState ? { initialState } : {}) });
  }
  setParams(patch: Partial<ReactorParams>): void {
    useReactorStore.getState().patchParams(patch);
    this.send({ type: 'setParams', patch });
  }
  setPid(patch: Partial<PidSettings>): void {
    useReactorStore.getState().patchPid(patch);
    this.send({ type: 'setPid', patch });
  }
  setMode(mode: ControlMode): void {
    useReactorStore.getState().setMode(mode);
    this.send({ type: 'setMode', mode });
  }
  setManualValve(value: number): void {
    useReactorStore.getState().setManualValve(value);
    this.send({ type: 'setManualValve', value });
  }
  setTimeScale(value: number): void {
    useReactorStore.getState().setTimeScale(value);
    this.send({ type: 'setTimeScale', value });
  }
  setPumpEfficiency(value: number): void {
    this.send({ type: 'setPumpEfficiency', value });
  }
  setFeedFactor(value: number): void {
    this.send({ type: 'setFeedFactor', value });
  }
  loadScenario(id: ScenarioId): void {
    const store = useReactorStore.getState();
    store.clearSession();
    store.setScenario(id);
    this.send({ type: 'loadScenario', id });
  }
  quench(): void {
    useReactorStore.getState().setQuenchArmed(false);
    this.send({ type: 'quench' });
  }

  dispose(): void {
    this.unsubscribe();
    this.pings.clear();
    this.transport.dispose();
  }
}
