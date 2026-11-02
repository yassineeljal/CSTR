/**
 * Contrat de messages UI ↔ Worker (PLAN §5.2). Module pur.
 */
import type {
  AlarmEvent,
  ControlMode,
  PidSettings,
  ReactorParams,
  ReactorState,
  ScenarioId,
} from './types';

// ---------------------------------------------------------------- UI → Worker
export type WorkerCommand =
  | { type: 'ping'; token: number }
  | { type: 'init'; params: ReactorParams; initialState: ReactorState; pid: PidSettings }
  | { type: 'start' }
  | { type: 'pause' }
  | { type: 'reset'; initialState?: ReactorState }
  | { type: 'setParams'; patch: Partial<ReactorParams> }
  | { type: 'setPid'; patch: Partial<PidSettings> }
  | { type: 'setMode'; mode: ControlMode }
  | { type: 'setManualValve'; value: number } // 0..1
  | { type: 'setTimeScale'; value: number }
  | { type: 'setPumpEfficiency'; value: number } // 0..1
  | { type: 'loadScenario'; id: ScenarioId }
  | { type: 'quench' };

// ---------------------------------------------------------------- Worker → UI
export type WorkerEvent =
  | { type: 'pong'; token: number }
  | { type: 'snapshot'; buffer: Float64Array } // disposition SNAPSHOT_LAYOUT
  | { type: 'alarm'; alarm: AlarmEvent }
  | { type: 'scenarioEvent'; label: string; simTimeS: number }
  | { type: 'rupture'; simTimeS: number; tempK: number }
  | { type: 'error'; message: string };

/**
 * Disposition fixe du snapshot (indices dans le Float64Array).
 * Extension du PLAN §5.2 : Fc, pumpEff, fouling, mode, status, timeScale, inhibitor, quench.
 */
export const SNAPSHOT_LAYOUT = {
  /** Temps simulé [s]. */
  simTime: 0,
  /** C_A [mol/L]. */
  CA: 1,
  /** T [K]. */
  T: 2,
  /** T_j [K]. */
  Tj: 3,
  /** Ouverture réelle de la vanne v [0..1]. */
  valve: 4,
  /** Ouverture commandée v_cmd [0..1]. */
  valveCmd: 5,
  /** k(T) [s⁻¹]. */
  k: 6,
  /** Chaleur générée par la réaction [W]. */
  Qgen: 7,
  /** Chaleur évacuée totale (alimentation + enveloppe + soupape) [W]. */
  Qremoval: 8,
  /** Pression totale [Pa]. */
  pressure: 9,
  /** Débit massique de vapeur à la soupape [kg/s]. */
  reliefFlow: 10,
  /** Produit U·A effectif [W/K]. */
  U: 11,
  /** Vitesse d'agitation [tr/min]. */
  rpm: 12,
  /** Consigne T_sp [K]. */
  setpoint: 13,
  /** Erreur e = T − T_sp [K]. */
  error: 14,
  /** Nombre de Damköhler [—]. */
  Da: 15,
  /** Débit d'eau froide F_c [L/s]. */
  Fc: 16,
  /** Rendement de pompe η [0..1]. */
  pumpEff: 17,
  /** Facteur d'encrassement [0..1]. */
  fouling: 18,
  /** Mode : 0 = manuel, 1 = auto. */
  mode: 19,
  /** Statut : voir `STATUS_CODE`. */
  status: 20,
  /** Facteur d'accélération temporelle. */
  timeScale: 21,
  /** Multiplicateur de k₀ (inhibiteur). */
  inhibitor: 22,
  /** Avancement du quench [0..1] (0 = inactif). */
  quench: 23,
} as const;
export const SNAPSHOT_SIZE = 24;

export const STATUS_CODE = { ready: 0, running: 1, paused: 2, ruptured: 3, error: 4 } as const;

export const TIME_SCALES = [1, 5, 10, 30, 60] as const;

/** Ré-initialise `out` depuis un snapshot (copie sans allocation). */
export function copySnapshot(src: Float64Array, dst: Float64Array): void {
  dst.set(src.subarray(0, SNAPSHOT_SIZE));
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Bornes des paramètres réglables en direct (min, max inclus). */
export const PARAM_BOUNDS: Partial<Record<keyof ReactorParams, readonly [number, number]>> = {
  feedFlowLps: [0.01, 20],
  caInMolL: [0, 5],
  tInK: [250, 450],
  rpm: [0, 400],
  tcK: [250, 400],
  tcInK: [275, 330],
  fcMaxLps: [0.01, 20],
  uaRefWK: [1, 1e5],
  reliefSetPressurePa: [1.2e5, 2e6],
};

/**
 * Valide une commande entrante (bornes, NaN). Retourne un message d'erreur ou `null` si valide.
 */
export function validateCommand(cmd: WorkerCommand): string | null {
  switch (cmd.type) {
    case 'setManualValve':
      return isFiniteNumber(cmd.value) && cmd.value >= 0 && cmd.value <= 1
        ? null
        : 'setManualValve: valeur hors [0, 1]';
    case 'setPumpEfficiency':
      return isFiniteNumber(cmd.value) && cmd.value >= 0 && cmd.value <= 1
        ? null
        : 'setPumpEfficiency: valeur hors [0, 1]';
    case 'setTimeScale':
      return isFiniteNumber(cmd.value) && cmd.value > 0 && cmd.value <= 120
        ? null
        : 'setTimeScale: valeur hors ]0, 120]';
    case 'setMode':
      return cmd.mode === 'manual' || cmd.mode === 'auto' ? null : 'setMode: mode inconnu';
    case 'setParams': {
      for (const [key, value] of Object.entries(cmd.patch)) {
        if (typeof value === 'boolean') continue;
        if (!isFiniteNumber(value)) return `setParams: ${key} n'est pas un nombre fini`;
        const bounds = PARAM_BOUNDS[key as keyof ReactorParams];
        if (bounds && (value < bounds[0] || value > bounds[1]))
          return `setParams: ${key} hors [${bounds[0]}, ${bounds[1]}]`;
      }
      return null;
    }
    case 'setPid': {
      for (const [key, value] of Object.entries(cmd.patch)) {
        if (!isFiniteNumber(value)) return `setPid: ${key} n'est pas un nombre fini`;
        if (key === 'bias' && (value < 0 || value > 1)) return 'setPid: bias hors [0, 1]';
        if (['kp', 'ki', 'kd', 'tauFilterS'].includes(key) && value < 0)
          return `setPid: ${key} doit être ≥ 0`;
      }
      return null;
    }
    case 'init': {
      const s = cmd.initialState;
      return [s.CA, s.T, s.Tj, s.v].every(isFiniteNumber) ? null : 'init: état initial invalide';
    }
    default:
      return null;
  }
}

/** Snapshot décodé (noms de champs = clés de `SNAPSHOT_LAYOUT`). Pour tests et debug. */
export type SnapshotData = { -readonly [K in keyof typeof SNAPSHOT_LAYOUT]: number };

/** Encode un snapshot nommé vers un Float64Array de disposition fixe (alloue : hors boucle chaude). */
export function encodeSnapshot(data: SnapshotData): Float64Array {
  const out = new Float64Array(SNAPSHOT_SIZE);
  for (const key of Object.keys(SNAPSHOT_LAYOUT) as (keyof typeof SNAPSHOT_LAYOUT)[]) {
    out[SNAPSHOT_LAYOUT[key]] = data[key];
  }
  return out;
}

/** Décode un Float64Array de snapshot vers un objet nommé (alloue : hors boucle chaude). */
export function decodeSnapshot(buffer: Float64Array): SnapshotData {
  if (buffer.length < SNAPSHOT_SIZE) {
    throw new RangeError(`Snapshot trop court : ${buffer.length} < ${SNAPSHOT_SIZE}`);
  }
  const data = {} as SnapshotData;
  for (const key of Object.keys(SNAPSHOT_LAYOUT) as (keyof typeof SNAPSHOT_LAYOUT)[]) {
    data[key] = buffer[SNAPSHOT_LAYOUT[key]] as number;
  }
  return data;
}
