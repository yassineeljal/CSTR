import { create } from 'zustand';
import { SEBORG_PARAMS, SEBORG_PID } from '@/simulation/presets/seborgBenchmark';
import type { SheetId } from '@/components/academic/sheets/types';
import type {
  AlarmEvent,
  AlarmLevel,
  ControlMode,
  EngineStatus,
  PidSettings,
  ReactorParams,
  ScenarioId,
} from '@/simulation/types';

/**
 * Store « lent » (PLAN §5.4 règle 5, ADR-005) : paramètres, gains, mode, scénario, alarmes,
 * statut, préférences UI. L'état physique rapide (60 Hz) n'est JAMAIS ici : voir `simRef`.
 */

export interface AlarmRecord extends AlarmEvent {
  id: number;
  acknowledged: boolean;
}

export interface LogEntry {
  id: number;
  simTimeS: number;
  label: string;
}

export type QualityPreference = 'auto' | 'high' | 'low';
export type QualityTier = 'high' | 'low';

export interface UiPreferences {
  /** Mode « Inspection académique » (étiquettes + panneau théorie). */
  inspectionMode: boolean;
  /** Vue en coupe (true) ou cuve complète (false). */
  cutaway: boolean;
  /** Réduit les animations (vibrations, flash) — accessibilité. */
  reducedMotion: boolean;
  quality: QualityPreference;
  /** Fiche théorique ouverte dans le tiroir (null = tiroir fermé). */
  theorySheet: SheetId | null;
  /** Met la simulation en pause quand l'onglet est masqué, la relance au retour (S7-L04). */
  autoPauseHidden: boolean;
}

export const MAX_ALARM_HISTORY = 200;
export const MAX_LOG_HISTORY = 200;

export interface ReactorStoreState {
  params: ReactorParams;
  pid: PidSettings;
  mode: ControlMode;
  status: EngineStatus;
  timeScale: number;
  manualValve: number;
  scenarioId: ScenarioId | null;
  /** Niveaux d'alarme actuellement actifs. */
  activeAlarms: Readonly<Record<Exclude<AlarmLevel, 'RUPTURE'>, boolean>>;
  alarms: AlarmRecord[];
  log: LogEntry[];
  rupture: { simTimeS: number; tempK: number } | null;
  error: string | null;
  /** Quench armé (premier clic) mais pas encore déclenché. */
  quenchArmed: boolean;
  /** État de l'installation notifié par le moteur (pompe, alimentation, quench). */
  plant: { pumpOn: boolean; feedFactor: number; quenchActive: boolean };
  ui: UiPreferences;
  /** Niveau de qualité effectif mesuré à l'exécution (qualité adaptative, S7-L02). */
  qualityTier: QualityTier;
}

export interface ReactorStoreActions {
  patchParams(patch: Partial<ReactorParams>): void;
  patchPid(patch: Partial<PidSettings>): void;
  setMode(mode: ControlMode): void;
  setStatus(status: EngineStatus, mode?: ControlMode): void;
  setPlant(plant: Partial<ReactorStoreState['plant']>): void;
  setTimeScale(value: number): void;
  setManualValve(value: number): void;
  setScenario(id: ScenarioId | null): void;
  pushAlarm(event: AlarmEvent): void;
  acknowledgeAlarms(): void;
  pushLog(simTimeS: number, label: string): void;
  setRupture(info: { simTimeS: number; tempK: number } | null): void;
  setError(message: string | null): void;
  setQuenchArmed(armed: boolean): void;
  patchUi(patch: Partial<UiPreferences>): void;
  setQualityTier(tier: QualityTier): void;
  /** Efface alarmes, journal, rupture et erreur (nouvelle session de simulation). */
  clearSession(): void;
}

let nextId = 1;

const initialState = (): ReactorStoreState => ({
  params: { ...SEBORG_PARAMS },
  pid: { ...SEBORG_PID },
  mode: 'auto',
  status: 'ready',
  timeScale: 10,
  manualValve: SEBORG_PID.bias,
  scenarioId: null,
  activeAlarms: { LL: false, H: false, HH: false },
  alarms: [],
  log: [],
  rupture: null,
  error: null,
  quenchArmed: false,
  plant: { pumpOn: true, feedFactor: 1, quenchActive: false },
  ui: {
    inspectionMode: false,
    cutaway: true,
    reducedMotion: false,
    quality: 'auto',
    theorySheet: null,
    autoPauseHidden: true,
  },
  qualityTier: 'high',
});

export const useReactorStore = create<ReactorStoreState & ReactorStoreActions>()((set) => ({
  ...initialState(),

  patchParams: (patch) => set((s) => ({ params: { ...s.params, ...patch } })),
  patchPid: (patch) => set((s) => ({ pid: { ...s.pid, ...patch } })),
  setMode: (mode) => set({ mode }),
  setStatus: (status, mode) => set((s) => ({ status, mode: mode ?? s.mode })),
  setPlant: (plant) => set((s) => ({ plant: { ...s.plant, ...plant } })),
  setTimeScale: (timeScale) => set({ timeScale }),
  setManualValve: (manualValve) => set({ manualValve }),
  setScenario: (scenarioId) => set({ scenarioId }),

  pushAlarm: (event) =>
    set((s) => {
      const record: AlarmRecord = { ...event, id: nextId++, acknowledged: false };
      const alarms = [record, ...s.alarms].slice(0, MAX_ALARM_HISTORY);
      if (event.level === 'RUPTURE') return { alarms };
      return { alarms, activeAlarms: { ...s.activeAlarms, [event.level]: event.active } };
    }),
  acknowledgeAlarms: () =>
    set((s) => ({
      alarms: s.alarms.map((a) => (a.acknowledged ? a : { ...a, acknowledged: true })),
    })),

  pushLog: (simTimeS, label) =>
    set((s) => ({ log: [{ id: nextId++, simTimeS, label }, ...s.log].slice(0, MAX_LOG_HISTORY) })),
  setRupture: (rupture) => set({ rupture }),
  setError: (error) => set({ error }),
  setQuenchArmed: (quenchArmed) => set({ quenchArmed }),
  patchUi: (patch) => set((s) => ({ ui: { ...s.ui, ...patch } })),
  setQualityTier: (qualityTier) => set({ qualityTier }),

  clearSession: () =>
    set({
      activeAlarms: { LL: false, H: false, HH: false },
      alarms: [],
      log: [],
      rupture: null,
      error: null,
      quenchArmed: false,
    }),
}));

/** Remet le store à son état initial (tests). */
export function resetReactorStore(): void {
  useReactorStore.setState(initialState());
}
