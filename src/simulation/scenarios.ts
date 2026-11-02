import { SEBORG_COLD_STATE, SEBORG_STEADY_STATE } from './presets/seborgBenchmark';
import type { ControlMode, ReactorParams, ReactorState, ScenarioId } from './types';

/** Action scriptée, purement déclarative (sérialisable, testable). */
export type ScenarioAction =
  | { kind: 'setPumpEfficiency'; value: number }
  /** Rampe linéaire de l'encrassement de `from` à `to` sur `durationS`. */
  | { kind: 'rampFouling'; from: number; to: number; durationS: number };

export interface ScenarioEvent {
  /** Instant de déclenchement [s simulées]. */
  atS: number;
  /** Libellé affiché dans l'historique. */
  label: string;
  action: ScenarioAction;
}

export interface ScenarioDefinition {
  id: ScenarioId;
  name: string;
  description: string;
  /** Objectifs pédagogiques. */
  objectives: string[];
  /** Indication de la « solution » attendue. */
  expectedOutcome: string;
  initialState: ReactorState;
  mode: ControlMode;
  setpointK: number;
  /** Surcharge de paramètres (optionnelle). */
  paramsPatch?: Partial<ReactorParams>;
  events: ScenarioEvent[];
  /**
   * Si défini, le moteur pré-avance la simulation (en silence) jusqu'à ce que T atteigne cette
   * valeur, puis se met en pause (scénario du quench).
   */
  advanceUntilTempK?: number;
}

export const SCENARIOS: Readonly<Record<ScenarioId, ScenarioDefinition>> = {
  'cold-start': {
    id: 'cold-start',
    name: 'Démarrage à froid',
    description:
      'Le réacteur est froid et vide de produit (C_A = 0, T = 300 K). Le PID est en automatique avec une consigne de 350 K.',
    objectives: [
      'Observer la montée en température et le dépassement',
      'Voir la stabilisation autour de la consigne',
    ],
    expectedOutcome: 'La température se stabilise à 350 K sans déclencher d’alarme haute.',
    initialState: SEBORG_COLD_STATE,
    mode: 'auto',
    setpointK: 350,
    events: [],
  },
  'pump-failure': {
    id: 'pump-failure',
    name: 'Panne de la pompe de refroidissement',
    description:
      'Régime stationnaire à 350 K. À t = 20 s, la pompe d’eau de refroidissement s’arrête (η = 0).',
    objectives: [
      'Comprendre la boucle d’emballement (Arrhenius)',
      'Observer l’ouverture de la soupape',
      'Reconnaître le moment où le quench devient nécessaire',
    ],
    expectedOutcome:
      'Sans intervention, la température diverge. Un quench à temps (avant ~400 K) sauve le réacteur.',
    initialState: SEBORG_STEADY_STATE,
    mode: 'auto',
    setpointK: 350,
    events: [
      {
        atS: 20,
        label: 'Panne de la pompe de refroidissement',
        action: { kind: 'setPumpEfficiency', value: 0 },
      },
    ],
  },
  fouling: {
    id: 'fouling',
    name: 'Encrassement de la paroi',
    description:
      'Régime stationnaire à 350 K. À t = 10 s, l’encrassement réduit le transfert thermique de 100 % à 40 % en 120 s.',
    objectives: [
      'Voir la vanne saturer à mesure que le transfert se dégrade',
      'Constater que l’anti-windup évite l’emballement de l’intégrale',
      'Observer la perte de contrôle progressive',
    ],
    expectedOutcome:
      'La vanne s’ouvre jusqu’à saturation puis la température dérive : il faut réduire la charge (débit, C_A,in).',
    initialState: SEBORG_STEADY_STATE,
    mode: 'auto',
    setpointK: 350,
    events: [
      {
        atS: 10,
        label: 'Début de l’encrassement',
        action: { kind: 'rampFouling', from: 1, to: 0.4, durationS: 120 },
      },
    ],
  },
  'emergency-quench': {
    id: 'emergency-quench',
    name: 'Quench d’urgence',
    description:
      'La panne de pompe a déjà eu lieu : le réacteur est à 390 K et monte. Déclenchez le quench pour tenter de le sauver.',
    objectives: [
      'Décider du moment et de la manière de déclencher le quench',
      'Mesurer l’effet du diluant froid sur la cinétique',
    ],
    expectedOutcome: 'Le quench dilue A et refroidit le milieu : la réaction s’éteint.',
    initialState: SEBORG_STEADY_STATE,
    mode: 'auto',
    setpointK: 350,
    events: [
      {
        atS: 5,
        label: 'Panne de la pompe de refroidissement',
        action: { kind: 'setPumpEfficiency', value: 0 },
      },
    ],
    advanceUntilTempK: 390,
  },
};

export const SCENARIO_IDS = Object.keys(SCENARIOS) as ScenarioId[];
