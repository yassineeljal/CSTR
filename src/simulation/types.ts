/**
 * Types du cœur physique. Module pur : aucun import React/Three (PLAN §6).
 * Chaque champ porte son unité moteur (PLAN §4.6) :
 *   s, K, mol/L, L, g/L, J, W, Pa, tr/min (rpm).
 */

/** Niveau de modèle (PLAN §4.3) : 1 = [C_A, T] avec T_j imposée ; 2 = [C_A, T, T_j, v]. */
export type ModelLevel = 1 | 2;

/** Indices du vecteur d'état de l'EDO x = [C_A, T, T_j, v]. */
export const STATE_INDEX = { CA: 0, T: 1, Tj: 2, v: 3 } as const;
export const STATE_SIZE = 4;

/** Paramètres du réacteur. Tous en unités moteur. */
export interface ReactorParams {
  /** Niveau de modèle. */
  modelLevel: ModelLevel;

  // --- Réacteur ---
  /** Volume du réacteur V [L]. */
  volumeL: number;
  /** Débit d'alimentation F [L/s]. */
  feedFlowLps: number;
  /** Concentration d'entrée C_A,in [mol/L]. */
  caInMolL: number;
  /** Température d'entrée T_in [K]. */
  tInK: number;

  // --- Cinétique (ordre 1, A → B) ---
  /** Facteur pré-exponentiel k₀ [s⁻¹]. */
  k0PerS: number;
  /** Énergie d'activation divisée par R, E_a/R [K]. */
  eaOverRK: number;
  /** Enthalpie de réaction ΔH_r [J/mol] (< 0 : exothermique). */
  deltaHrJMol: number;

  // --- Propriétés du milieu réactionnel ---
  /** Masse volumique ρ [g/L]. */
  rhoGL: number;
  /** Capacité thermique massique C_p [J/(g·K)]. */
  cpJGK: number;
  /** Viscosité dynamique μ [Pa·s] (affichage de Re uniquement). */
  viscosityPaS: number;
  /**
   * Capacité thermique de la paroi de cuve (acier, agitateur) [J/K], en équilibre thermique avec
   * le milieu. S'ajoute à V·ρ·C_p : ralentit la dynamique thermique sans changer les états
   * stationnaires.
   */
  vesselHeatCapacityJK: number;

  // --- Échange thermique ---
  /** Produit U·A de référence à N_ref, paroi propre [J/(s·K)] = [W/K]. */
  uaRefWK: number;
  /** Plancher U·A en convection naturelle (agitation nulle) [W/K] (PLAN §4.3). */
  uaMinWK: number;
  /** Exposant de la corrélation U ∝ N^n (2/3 : Nu ∝ Re^{2/3} Pr^{1/3}) [—]. */
  uExponent: number;

  // --- Agitation ---
  /** Vitesse d'agitation courante N [tr/min]. */
  rpm: number;
  /** Vitesse d'agitation de référence N_ref [tr/min]. */
  rpmRef: number;
  /** Diamètre de la turbine D [m] (affichage de Re). */
  turbineDiameterM: number;

  // --- Niveau 1 : eau de refroidissement imposée ---
  /** Température de l'eau de refroidissement imposée T_c [K] (niveau 1). */
  tcK: number;

  // --- Niveau 2 : double enveloppe + vanne ---
  /** Volume de l'enveloppe V_j [L]. */
  jacketVolumeL: number;
  /** Masse volumique de l'eau d'enveloppe ρ_j [g/L]. */
  jacketRhoGL: number;
  /** Capacité thermique de l'eau d'enveloppe C_p,j [J/(g·K)]. */
  jacketCpJGK: number;
  /** Température d'entrée de l'eau froide T_c,in [K]. */
  tcInK: number;
  /** Débit maximal d'eau froide, vanne ouverte à 100 % [L/s]. */
  fcMaxLps: number;
  /** Constante de temps de la vanne τ_v [s]. */
  valveTauS: number;
  /** Vitesse de variation maximale de la vanne r_max [s⁻¹]. */
  valveRateMaxPerS: number;

  // --- Pression et soupape (PLAN §4.4) ---
  /** Pression partielle de gaz inerte P_inerte [Pa]. */
  inertPressurePa: number;
  /** Pression atmosphérique (aval de la soupape) [Pa]. */
  atmPressurePa: number;
  /** Pression de tarage de la soupape [Pa]. */
  reliefSetPressurePa: number;
  /** Fraction du tarage sous laquelle la soupape se referme [—] (hystérésis). */
  reliefResetFraction: number;
  /** Coefficient de décharge C_d [—]. */
  reliefCd: number;
  /** Section de passage de la soupape A_s [m²]. */
  reliefAreaM2: number;
  /** Chaleur latente de vaporisation L_v [J/kg]. */
  latentHeatJKg: number;
  /** Interrupteur du modèle de soupape (désactivé pour les tests de référence). */
  reliefEnabled: boolean;

  // --- Seuils d'alarme et de rupture (PLAN §4.6, S2-C03) ---
  /** Alarme basse-basse LL [K]. */
  tLLK: number;
  /** Alarme haute H [K]. */
  tHK: number;
  /** Alarme haute-haute HH [K]. */
  tHHK: number;
  /** Seuil de rupture (perte de confinement) [K]. */
  tRuptureK: number;
  /** Bande morte des alarmes [K]. */
  alarmDeadbandK: number;
}

/** État du réacteur : x = [C_A, T, T_j, v] (PLAN §4.2). */
export interface ReactorState {
  /** Concentration de A [mol/L]. */
  CA: number;
  /** Température du réacteur [K]. */
  T: number;
  /** Température de l'enveloppe [K]. */
  Tj: number;
  /** Ouverture réelle de la vanne d'eau froide [0..1]. */
  v: number;
}

/** Gains et consigne du PID (action inverse : e = T − T_sp). */
export interface PidGains {
  /** Gain proportionnel K_p [1/K] (sortie = fraction d'ouverture). */
  kp: number;
  /** Gain intégral K_i [1/(K·s)]. */
  ki: number;
  /** Gain dérivé K_d [s/K]. */
  kd: number;
  /** Constante de temps du filtre dérivé τ_f [s]. */
  tauFilterS: number;
  /** Sortie de base u_bias [0..1]. */
  bias: number;
}

/** Réglages dynamiques du régulateur. */
export interface PidSettings extends PidGains {
  /** Consigne de température T_sp [K]. */
  setpointK: number;
}

/**
 * Entrées « de scénario/opérateur » modifiées en cours de simulation.
 * Objet mutable réutilisé (zéro allocation dans les boucles chaudes).
 */
export interface Inputs {
  /** Ouverture de vanne commandée v_cmd [0..1]. */
  valveCmd: number;
  /** Rendement de la pompe d'eau froide η_pompe [0..1]. */
  pumpEfficiency: number;
  /** Facteur d'encrassement f ∈ ]0..1] (1 = paroi propre). */
  fouling: number;
  /** Multiplicateur de k₀ (inhibiteur) ∈ ]0..1], 1 = aucun. */
  inhibitorFactor: number;
  /** 1 si la soupape est ouverte, 0 sinon. */
  reliefOpen: 0 | 1;
  /** Ouverture de la vanne d'alimentation ∈ [0, 1] (1 = débit F nominal, 0 = alimentation coupée). */
  feedFactor: number;
}

export type ControlMode = 'manual' | 'auto';

/** Statut du moteur (machine d'états PLAN §5.5, côté moteur). */
export type EngineStatus = 'ready' | 'running' | 'paused' | 'ruptured' | 'error';

export type ScenarioId = 'cold-start' | 'pump-failure' | 'fouling' | 'emergency-quench';

export type AlarmLevel = 'LL' | 'H' | 'HH' | 'RUPTURE';

export interface AlarmEvent {
  /** Niveau d'alarme. */
  level: AlarmLevel;
  /** `true` à l'apparition, `false` au retour à la normale. */
  active: boolean;
  /** Temps simulé de l'événement [s]. */
  simTimeS: number;
  /** Température au moment de l'événement [K]. */
  tempK: number;
}

/** Paramètres du quench (PLAN §4.8). */
export interface QuenchParams {
  /** Ferme la vanne d'alimentation au déclenchement (arrêt d'urgence). */
  cutFeed: boolean;
  /** Volume de diluant injecté V_q [L]. */
  volumeL: number;
  /** Température du diluant T_q [K]. */
  tempK: number;
  /** Durée d'injection [s simulées]. */
  durationS: number;
  /** Facteur appliqué à k₀ par l'inhibiteur (1 = aucun inhibiteur). */
  inhibitorFactor: number;
  /** Durée de l'effet de l'inhibiteur [s simulées]. */
  inhibitorDurationS: number;
}
