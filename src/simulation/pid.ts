import type { PidSettings } from './types';

const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/**
 * Régulateur PID discret à action inverse (PLAN §4.5).
 *
 * - Erreur e = T − T_sp : quand T dépasse la consigne, la sortie (ouverture de vanne) augmente,
 *   ce qui permet des gains K_p, K_i, K_d positifs.
 * - Forme positionnelle, dérivée sur la mesure filtrée (pas de « derivative kick »).
 * - Anti-windup par intégration conditionnelle (clamping).
 * - Transfert sans à-coup Manuel → Auto (`engage`) et changement de gains sans à-coup.
 *
 * Aucune allocation dans `update`.
 */
export class PidController {
  private settings: PidSettings;
  private integral = 0; // I [K·s]
  private derivative = 0; // D filtrée [K/s]
  private prevMeasurement = Number.NaN;
  private lastError = 0;
  private lastOutput = 0;

  /**
   * Active l'anti-windup par clamping. Désactivable uniquement à des fins pédagogiques/tests
   * (comparaison avec/sans, PLAN §8.2 test 6).
   */
  antiWindup = true;

  /**
   * @param settings gains, biais et consigne
   * @param periodS période d'échantillonnage Δt_c [s simulées]
   */
  constructor(
    settings: PidSettings,
    readonly periodS: number,
  ) {
    this.settings = { ...settings };
  }

  get currentSettings(): Readonly<PidSettings> {
    return this.settings;
  }
  /** Intégrale de l'erreur I [K·s]. */
  get integralState(): number {
    return this.integral;
  }
  /** Dernière sortie saturée [0..1]. */
  get output(): number {
    return this.lastOutput;
  }
  /** Dernière erreur e = T − T_sp [K]. */
  get error(): number {
    return this.lastError;
  }

  /**
   * Met à jour gains/consigne. Si un gain ou le biais change, l'intégrale est recalée pour que la
   * sortie courante soit conservée (pas de saut). Un changement de consigne agit normalement.
   */
  configure(patch: Partial<PidSettings>): void {
    const next = { ...this.settings, ...patch };
    const gainsChanged =
      next.kp !== this.settings.kp ||
      next.ki !== this.settings.ki ||
      next.kd !== this.settings.kd ||
      next.bias !== this.settings.bias;
    this.settings = next;
    if (gainsChanged && next.ki > 0 && !Number.isNaN(this.prevMeasurement)) {
      this.integral = this.integralFor(this.lastOutput, this.lastError);
    }
  }

  /** Remise à zéro complète (intégrale, dérivée, mémoire de mesure). */
  reset(): void {
    this.integral = 0;
    this.derivative = 0;
    this.prevMeasurement = Number.NaN;
    this.lastError = 0;
    this.lastOutput = 0;
  }

  /**
   * Transfert sans à-coup Manuel → Auto : initialise l'intégrale pour que la première sortie
   * égale `currentOutput`.
   * @param currentOutput ouverture de vanne actuellement commandée [0..1]
   * @param measurementK température mesurée T [K]
   */
  engage(currentOutput: number, measurementK: number): void {
    const u = clamp01(currentOutput);
    this.prevMeasurement = measurementK;
    this.derivative = 0;
    this.lastError = measurementK - this.settings.setpointK;
    this.integral = this.integralFor(u, this.lastError);
    this.lastOutput = u;
  }

  /**
   * Un échantillon du contrôleur.
   * @param measurementK température mesurée T_k [K]
   * @returns ouverture de vanne commandée v_cmd ∈ [0, 1]
   */
  update(measurementK: number): number {
    const { kp, ki, kd, tauFilterS, bias, setpointK } = this.settings;
    const dt = this.periodS;
    const e = measurementK - setpointK;

    if (Number.isNaN(this.prevMeasurement)) this.prevMeasurement = measurementK;
    const alpha = tauFilterS / (tauFilterS + dt);
    this.derivative =
      alpha * this.derivative + (1 - alpha) * ((measurementK - this.prevMeasurement) / dt);
    this.prevMeasurement = measurementK;

    // 1. sortie non saturée avec l'intégrale candidate
    const candidate = this.integral + e * dt;
    const uUnsat = bias + kp * e + ki * candidate + kd * this.derivative;
    // 2-3. clamping conditionnel : on n'intègre pas si l'erreur pousse dans le sens de la saturation
    const pushesHigh = uUnsat > 1 && e > 0;
    const pushesLow = uUnsat < 0 && e < 0;
    if (!this.antiWindup || (!pushesHigh && !pushesLow)) this.integral = candidate;

    this.lastError = e;
    this.lastOutput = clamp01(bias + kp * e + ki * this.integral + kd * this.derivative);
    return this.lastOutput;
  }

  private integralFor(output: number, error: number): number {
    const { kp, ki, kd, bias } = this.settings;
    return ki > 0 ? (output - bias - kp * error - kd * this.derivative) / ki : 0;
  }
}
