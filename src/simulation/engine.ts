import {
  DEFAULT_DT_S,
  DEFAULT_PID_PERIOD_S,
  MAX_DELTA_T_PER_STEP_K,
  MAX_STEPS_PER_TICK,
  MAX_SUBSTEP_DEPTH,
} from './constants';
import { derivatives, coolingFlowLps, heatGenerationW } from './equations';
import { arrhenius, damkohler, heatTransferUA } from './kinetics';
import { PidController } from './pid';
import { SEBORG_QUENCH } from './presets/seborgBenchmark';
import { nextReliefOpen, pressurePa, reliefHeatW, reliefMassFlowKgS } from './relief';
import { Rk4Integrator } from './rk4';
import { SCENARIOS, type ScenarioAction, type ScenarioDefinition } from './scenarios';
import { SNAPSHOT_LAYOUT, SNAPSHOT_SIZE, STATUS_CODE } from './protocol';
import {
  STATE_INDEX,
  STATE_SIZE,
  type AlarmEvent,
  type AlarmLevel,
  type ControlMode,
  type EngineStatus,
  type Inputs,
  type PidSettings,
  type QuenchParams,
  type ReactorParams,
  type ReactorState,
  type ScenarioId,
} from './types';

const { CA: I_CA, T: I_T, Tj: I_TJ, v: I_V } = STATE_INDEX;
const S = SNAPSHOT_LAYOUT;

/** Événements produits par le moteur, à relayer vers l'UI. */
export type EngineEvent =
  | { type: 'alarm'; alarm: AlarmEvent }
  | { type: 'scenarioEvent'; label: string; simTimeS: number }
  | { type: 'rupture'; simTimeS: number; tempK: number }
  | { type: 'error'; message: string };

export interface EngineConfig {
  params: ReactorParams;
  initialState: ReactorState;
  pid: PidSettings;
  quench?: QuenchParams;
  /** Pas RK4 [s simulées]. */
  dtS?: number;
  /** Période du PID [s simulées] (multiple entier de dtS). */
  pidPeriodS?: number;
  maxStepsPerTick?: number;
}

interface ActiveRamp {
  variable: 'fouling';
  from: number;
  to: number;
  startS: number;
  durationS: number;
}

/**
 * Moteur de simulation du CSTR. Classe pure : testable sous Node, sans Worker ni React.
 *
 * Le temps simulé est compté en nombre entier de pas (`stepCount × dtS`) : il ne dérive pas et
 * le résultat ne dépend pas du framerate d'appel (PLAN §8.2 test 7).
 */
export class SimulationEngine {
  /** Vecteur d'état x = [C_A, T, T_j, v]. */
  readonly state = new Float64Array(STATE_SIZE);
  readonly inputs: Inputs = {
    valveCmd: 0.3,
    pumpEfficiency: 1,
    fouling: 1,
    inhibitorFactor: 1,
    reliefOpen: 0,
    feedFactor: 1,
  };

  params: ReactorParams;
  readonly dtS: number;
  readonly pidPeriodS: number;
  statusValue: EngineStatus = 'ready';
  modeValue: ControlMode = 'auto';
  timeScale = 10;

  private readonly pid: PidController;
  private readonly pidSteps: number;
  private readonly maxSteps: number;
  private readonly integrator: Rk4Integrator;
  private readonly scratch: Float64Array;
  private readonly events: EngineEvent[] = [];
  private readonly quenchParams: QuenchParams;

  private initialState: ReactorState;
  private accumulatorS = 0;
  private stepCount = 0;
  private stepsSincePid = 0;
  private manualValve = 0.3;

  // Scénario
  private scenario: ScenarioDefinition | null = null;
  private nextEventIndex = 0;
  private ramp: ActiveRamp | null = null;

  // Quench
  private quenchStepsLeft = 0;
  private quenchStepsTotal = 0;
  /** Volume de diluant déjà injecté pendant le quench en cours [L]. */
  private quenchInjectedL = 0;
  private inhibitorUntilS = 0;

  // Alarmes
  private readonly alarmActive: Record<'LL' | 'H' | 'HH', boolean> = {
    LL: false,
    H: false,
    HH: false,
  };
  private llArmed = false;

  constructor(config: EngineConfig) {
    this.params = { ...config.params };
    this.dtS = config.dtS ?? DEFAULT_DT_S;
    this.pidPeriodS = config.pidPeriodS ?? DEFAULT_PID_PERIOD_S;
    this.pidSteps = Math.max(1, Math.round(this.pidPeriodS / this.dtS));
    this.maxSteps = config.maxStepsPerTick ?? MAX_STEPS_PER_TICK;
    this.quenchParams = { ...(config.quench ?? SEBORG_QUENCH) };
    this.pid = new PidController(config.pid, this.pidSteps * this.dtS);
    this.scratch = new Float64Array(STATE_SIZE);
    this.integrator = new Rk4Integrator(STATE_SIZE, (x, _t, out) =>
      derivatives(x, this.params, this.inputs, out),
    );
    this.initialState = { ...config.initialState };
    this.applyState(config.initialState);
    if (this.modeValue === 'auto') this.pid.engage(this.inputs.valveCmd, this.state[I_T] as number);
  }

  // ------------------------------------------------------------------ accès
  get simTimeS(): number {
    return this.stepCount * this.dtS;
  }
  get status(): EngineStatus {
    return this.statusValue;
  }
  get mode(): ControlMode {
    return this.modeValue;
  }
  get pidSettings(): Readonly<PidSettings> {
    return this.pid.currentSettings;
  }
  get pidIntegral(): number {
    return this.pid.integralState;
  }
  get activeScenario(): ScenarioDefinition | null {
    return this.scenario;
  }

  /** Récupère et vide la file d'événements. */
  takeEvents(): EngineEvent[] {
    if (this.events.length === 0) return this.events;
    return this.events.splice(0, this.events.length);
  }

  // ------------------------------------------------------------- commandes
  start(): void {
    if (this.statusValue === 'ready' || this.statusValue === 'paused') this.statusValue = 'running';
  }

  pause(): void {
    if (this.statusValue === 'running') this.statusValue = 'paused';
  }

  /** Ré-initialise l'état (et le scénario actif) sans changer les paramètres. */
  reset(initialState?: ReactorState): void {
    if (initialState) this.initialState = { ...initialState };
    if (this.scenario) {
      this.loadScenario(this.scenario.id);
      return;
    }
    this.resetRuntime();
    this.applyState(this.initialState);
    this.statusValue = 'ready';
  }

  setParams(patch: Partial<ReactorParams>): void {
    this.params = { ...this.params, ...patch };
    if (this.params.modelLevel === 1) this.state[I_TJ] = this.params.tcK;
  }

  setPid(patch: Partial<PidSettings>): void {
    this.pid.configure(patch);
  }

  /** Active/désactive l'anti-windup du PID (démonstration pédagogique, tests). */
  setAntiWindup(enabled: boolean): void {
    this.pid.antiWindup = enabled;
  }

  setTimeScale(value: number): void {
    this.timeScale = value;
  }

  setMode(mode: ControlMode): void {
    if (mode === this.modeValue) return;
    this.modeValue = mode;
    if (mode === 'auto') {
      this.pid.engage(this.inputs.valveCmd, this.state[I_T] as number);
      this.stepsSincePid = 0;
    } else {
      this.manualValve = this.inputs.valveCmd;
    }
  }

  setManualValve(value: number): void {
    this.manualValve = clamp(value, 0, 1);
    if (this.modeValue === 'manual') this.inputs.valveCmd = this.manualValve;
  }

  setPumpEfficiency(value: number): void {
    this.inputs.pumpEfficiency = clamp(value, 0, 1);
  }

  /** Ouverture de la vanne d'alimentation [0..1] (le quench la ferme). */
  setFeedFactor(value: number): void {
    this.inputs.feedFactor = clamp(value, 0, 1);
  }

  /** Déclenche le quench (injection de diluant froid, PLAN §4.8). Sans effet si déjà actif. */
  quench(): void {
    if (this.quenchStepsLeft > 0 || this.statusValue === 'ruptured') return;
    this.quenchStepsTotal = Math.max(1, Math.round(this.quenchParams.durationS / this.dtS));
    this.quenchStepsLeft = this.quenchStepsTotal;
    if (this.quenchParams.cutFeed) this.inputs.feedFactor = 0;
    if (this.quenchParams.inhibitorFactor < 1) {
      this.inputs.inhibitorFactor = this.quenchParams.inhibitorFactor;
      this.inhibitorUntilS = this.simTimeS + this.quenchParams.inhibitorDurationS;
    }
    this.emit({ type: 'scenarioEvent', label: 'Quench déclenché', simTimeS: this.simTimeS });
  }

  loadScenario(id: ScenarioId): void {
    const def = SCENARIOS[id];
    this.scenario = def;
    this.resetRuntime();
    if (def.paramsPatch) this.setParams(def.paramsPatch);
    this.initialState = { ...def.initialState };
    this.applyState(def.initialState);
    this.pid.configure({ setpointK: def.setpointK });
    this.modeValue = def.mode;
    if (def.mode === 'auto') this.pid.engage(this.inputs.valveCmd, this.state[I_T] as number);
    this.statusValue = 'ready';

    if (def.advanceUntilTempK !== undefined) this.fastForwardTo(def.advanceUntilTempK);
  }

  // ----------------------------------------------------------- avancement
  /**
   * Avance la simulation d'un intervalle de temps réel (PLAN §4.7).
   * @param realDtS durée réelle écoulée [s]
   * @returns nombre de pas RK4 effectués
   */
  step(realDtS: number): number {
    if (this.statusValue !== 'running') return 0;
    this.accumulatorS += Math.max(0, realDtS) * this.timeScale;
    let n = Math.floor(this.accumulatorS / this.dtS + 1e-9);
    if (n > this.maxSteps) {
      n = this.maxSteps;
      this.accumulatorS = 0; // abandon du retard accumulé : évite la spirale de la mort
    } else {
      this.accumulatorS -= n * this.dtS;
    }
    let done = 0;
    while (done < n && this.statusValue === 'running') {
      this.advanceOneStep();
      done++;
    }
    return done;
  }

  /** Avance d'un nombre exact de pas (tests, pré-roulement des scénarios). */
  advanceSteps(count: number): void {
    const wasReady = this.statusValue === 'ready' || this.statusValue === 'paused';
    if (wasReady) this.statusValue = 'running';
    for (let i = 0; i < count && this.statusValue === 'running'; i++) this.advanceOneStep();
    if (wasReady && this.statusValue === 'running') this.statusValue = 'paused';
  }

  // --------------------------------------------------------------- snapshot
  /** Écrit l'état courant dans `out` selon `SNAPSHOT_LAYOUT` (sans allocation). */
  writeSnapshot(out: Float64Array): void {
    const p = this.params;
    const x = this.state;
    const ca = x[I_CA] as number;
    const t = x[I_T] as number;
    const tj = p.modelLevel === 1 ? p.tcK : (x[I_TJ] as number);
    const v = p.modelLevel === 1 ? 0 : (x[I_V] as number);
    const k = arrhenius(t, p.k0PerS * this.inputs.inhibitorFactor, p.eaOverRK);
    const ua = heatTransferUA(p.rpm, this.inputs.fouling, p);
    const reliefOpen = p.reliefEnabled && this.inputs.reliefOpen === 1;
    const qRelief = reliefOpen ? reliefHeatW(t, p) : 0;
    const qFeed = p.feedFlowLps * this.inputs.feedFactor * p.rhoGL * p.cpJGK * (t - p.tInK);

    out[S.simTime] = this.simTimeS;
    out[S.CA] = ca;
    out[S.T] = t;
    out[S.Tj] = tj;
    out[S.valve] = v;
    out[S.valveCmd] = this.inputs.valveCmd;
    out[S.k] = k;
    out[S.Qgen] = heatGenerationW(t, ca, p, this.inputs);
    out[S.Qremoval] = qFeed + ua * (t - tj) + qRelief;
    out[S.pressure] = pressurePa(t, p);
    out[S.reliefFlow] = reliefOpen ? reliefMassFlowKgS(t, p) : 0;
    out[S.U] = ua;
    out[S.rpm] = p.rpm;
    out[S.setpoint] = this.pid.currentSettings.setpointK;
    out[S.error] = t - this.pid.currentSettings.setpointK;
    out[S.Da] = damkohler(t, p, this.inputs.inhibitorFactor);
    out[S.Fc] = p.modelLevel === 1 ? 0 : coolingFlowLps(v, p, this.inputs);
    out[S.pumpEff] = this.inputs.pumpEfficiency;
    out[S.fouling] = this.inputs.fouling;
    out[S.mode] = this.modeValue === 'auto' ? 1 : 0;
    out[S.status] = STATUS_CODE[this.statusValue];
    out[S.timeScale] = this.timeScale;
    out[S.inhibitor] = this.inputs.inhibitorFactor;
    out[S.feed] = this.inputs.feedFactor;
    out[S.quench] = this.quenchStepsLeft > 0 ? 1 - this.quenchStepsLeft / this.quenchStepsTotal : 0;
  }

  /** Taille requise du tampon de snapshot. */
  static readonly SNAPSHOT_SIZE = SNAPSHOT_SIZE;

  // ------------------------------------------------------------- internes
  private emit(e: EngineEvent): void {
    this.events.push(e);
  }

  private applyState(s: ReactorState): void {
    this.state[I_CA] = s.CA;
    this.state[I_T] = s.T;
    this.state[I_TJ] = this.params.modelLevel === 1 ? this.params.tcK : s.Tj;
    this.state[I_V] = s.v;
    this.inputs.valveCmd = s.v;
    this.manualValve = s.v;
  }

  /** Remet à zéro tout ce qui est temporel (sans toucher aux paramètres). */
  private resetRuntime(): void {
    this.accumulatorS = 0;
    this.stepCount = 0;
    this.stepsSincePid = 0;
    this.nextEventIndex = 0;
    this.ramp = null;
    this.quenchStepsLeft = 0;
    this.quenchStepsTotal = 0;
    this.quenchInjectedL = 0;
    this.inhibitorUntilS = 0;
    this.inputs.pumpEfficiency = 1;
    this.inputs.fouling = 1;
    this.inputs.inhibitorFactor = 1;
    this.inputs.reliefOpen = 0;
    this.inputs.feedFactor = 1;
    this.alarmActive.LL = this.alarmActive.H = this.alarmActive.HH = false;
    this.llArmed = false;
    this.pid.reset();
    this.events.length = 0;
  }

  private fastForwardTo(tempK: number): void {
    const maxSteps = Math.round(3600 / this.dtS);
    this.statusValue = 'running';
    for (let i = 0; i < maxSteps && this.statusValue === 'running'; i++) {
      this.advanceOneStep();
      if ((this.state[I_T] as number) >= tempK) break;
    }
    if (this.statusValue === 'running') this.statusValue = 'paused';
    this.events.length = 0; // le pré-roulement est silencieux
    this.alarmActive.LL = this.alarmActive.H = this.alarmActive.HH = false;
  }

  /** Un pas de temps fixe `dtS` : contrôle, soupape, intégration, scénario, alarmes. */
  private advanceOneStep(): void {
    const x = this.state;

    // 1. Contrôleur échantillonné (PLAN §4.5)
    this.stepsSincePid++;
    if (this.stepsSincePid >= this.pidSteps) {
      this.stepsSincePid = 0;
      if (this.modeValue === 'auto' && this.params.modelLevel === 2) {
        this.inputs.valveCmd = this.pid.update(x[I_T] as number);
      } else if (this.modeValue === 'manual') {
        this.inputs.valveCmd = this.manualValve;
      }
    }

    // 2. Soupape (hystérésis)
    const pressure = pressurePa(x[I_T] as number, this.params);
    this.inputs.reliefOpen = nextReliefOpen(this.inputs.reliefOpen === 1, pressure, this.params)
      ? 1
      : 0;

    // 3. Intégration RK4 avec sous-découpage de sécurité
    this.integrate(this.simTimeS, this.dtS, 0);

    // 4. Garde-fous numériques (PLAN S2-L04)
    if (!this.sanitize()) return;

    this.stepCount++;
    const now = this.simTimeS;

    // 5. Quench, inhibiteur, scénario
    this.applyQuenchStep();
    if (this.inhibitorUntilS > 0 && now >= this.inhibitorUntilS) {
      this.inputs.inhibitorFactor = 1;
      this.inhibitorUntilS = 0;
    }
    this.processScenario(now);

    // 6. Alarmes et rupture
    this.updateAlarms(now);
  }

  /** Intègre un pas h ; le coupe en deux si |ΔT| dépasse le seuil (PLAN §12). */
  private integrate(t: number, h: number, depth: number): void {
    const x = this.state;
    if (depth >= MAX_SUBSTEP_DEPTH) {
      this.integrator.step(x, t, h);
      return;
    }
    const s = this.scratch;
    s.set(x);
    this.integrator.step(x, t, h);
    const dT = Math.abs((x[I_T] as number) - (s[I_T] as number));
    if (dT > MAX_DELTA_T_PER_STEP_K || !Number.isFinite(dT)) {
      x.set(s);
      const half = h / 2;
      this.integrate(t, half, depth + 1);
      this.integrate(t + half, half, depth + 1);
    }
  }

  /** Borne l'état et détecte NaN/Infinity. Retourne `false` si le moteur passe en erreur. */
  private sanitize(): boolean {
    const x = this.state;
    for (let i = 0; i < STATE_SIZE; i++) {
      if (!Number.isFinite(x[i] as number)) {
        this.statusValue = 'error';
        this.emit({ type: 'error', message: `Valeur non finie dans l'état (indice ${i})` });
        return false;
      }
    }
    if ((x[I_CA] as number) < 0) x[I_CA] = 0;
    x[I_V] = clamp(x[I_V] as number, 0, 1);
    return true;
  }

  private applyQuenchStep(): void {
    if (this.quenchStepsLeft <= 0) return;
    const q = this.quenchParams;
    const x = this.state;
    const dV = q.volumeL / this.quenchStepsTotal; // volume injecté à ce pas [L]
    // Le diluant s'accumule dans la cuve pendant l'injection (volume V + V_inj), puis l'excédent
    // déborde. Le cumul des mélanges donne exactement la formule du PLAN §4.8 :
    //   C_A ← C_A·V/(V+V_q),  T ← (V·T + V_q·T_q)/(V+V_q).
    const volume = this.params.volumeL + this.quenchInjectedL;
    x[I_CA] = (x[I_CA] as number) * (volume / (volume + dV));
    x[I_T] = (volume * (x[I_T] as number) + dV * q.tempK) / (volume + dV);
    this.quenchInjectedL += dV;
    this.quenchStepsLeft--;
    if (this.quenchStepsLeft === 0) this.quenchInjectedL = 0; // débordement du surplus
  }

  private processScenario(now: number): void {
    const def = this.scenario;
    if (!def) return;
    while (this.nextEventIndex < def.events.length) {
      const ev = def.events[this.nextEventIndex];
      if (!ev || ev.atS > now + 1e-9) break;
      this.applyAction(ev.action, now);
      this.emit({ type: 'scenarioEvent', label: ev.label, simTimeS: now });
      this.nextEventIndex++;
    }
    const r = this.ramp;
    if (r) {
      const frac = clamp((now - r.startS) / r.durationS, 0, 1);
      this.inputs.fouling = r.from + (r.to - r.from) * frac;
      if (frac >= 1) this.ramp = null;
    }
  }

  private applyAction(action: ScenarioAction, now: number): void {
    switch (action.kind) {
      case 'setPumpEfficiency':
        this.inputs.pumpEfficiency = action.value;
        break;
      case 'rampFouling':
        this.ramp = {
          variable: 'fouling',
          from: action.from,
          to: action.to,
          startS: now,
          durationS: action.durationS,
        };
        break;
    }
  }

  private updateAlarms(now: number): void {
    const p = this.params;
    const t = this.state[I_T] as number;
    const db = p.alarmDeadbandK;

    this.checkAlarm('H', t > p.tHK, t < p.tHK - db, now, t);
    this.checkAlarm('HH', t > p.tHHK, t < p.tHHK - db, now, t);
    if (t > p.tLLK + db) this.llArmed = true; // LL armée après le démarrage
    if (this.llArmed) this.checkAlarm('LL', t < p.tLLK, t > p.tLLK + db, now, t);

    if (t >= p.tRuptureK) {
      this.statusValue = 'ruptured';
      this.emit({
        type: 'alarm',
        alarm: { level: 'RUPTURE', active: true, simTimeS: now, tempK: t },
      });
      this.emit({ type: 'rupture', simTimeS: now, tempK: t });
    }
  }

  private checkAlarm(
    level: Exclude<AlarmLevel, 'RUPTURE'>,
    trip: boolean,
    clear: boolean,
    now: number,
    t: number,
  ): void {
    const active = this.alarmActive[level];
    if (!active && trip) {
      this.alarmActive[level] = true;
      this.emit({ type: 'alarm', alarm: { level, active: true, simTimeS: now, tempK: t } });
    } else if (active && clear) {
      this.alarmActive[level] = false;
      this.emit({ type: 'alarm', alarm: { level, active: false, simTimeS: now, tempK: t } });
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
