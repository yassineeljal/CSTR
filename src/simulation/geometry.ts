/**
 * Proportions géométriques du réacteur agité (S3-C01) — module pur, source unique de vérité pour
 * la scène Three.js ET les scripts Blender (`tools/blender/`, via `pnpm geometry:export`).
 *
 * Toutes les valeurs « normalisées » sont des multiples du diamètre de cuve D. Références :
 * Paul, Atiemo-Obeng & Kresta, « Handbook of Industrial Mixing » (2004), §6 — cuve standard à
 * chicanes : H/D = 1, D_turbine/D = 1/3, C/D = 1/3, 4 chicanes de largeur D/10 à D/12.
 */

/** Proportions normalisées par le diamètre intérieur de cuve D. */
export const GEOMETRY_RATIOS = {
  /** Hauteur de la virole cylindrique H/D. */
  shellHeight: 1.0,
  /** Profondeur d'un fond elliptique 2:1 (h = D/4). */
  headDepth: 0.25,
  /** Épaisseur de paroi t/D (≈ 6 mm pour D = 0,5 m). */
  wallThickness: 0.012,
  /** Taux de remplissage de la virole par le liquide (hauteur de liquide / H). */
  fillFraction: 0.8,

  /** Diamètre de turbine / D. */
  turbineDiameter: 1 / 3,
  /** Garde au fond : hauteur de la turbine au-dessus du bas de la virole / D. */
  turbineClearance: 1 / 3,
  /** Diamètre du disque de turbine / diamètre de turbine. */
  turbineDiskRatio: 0.75,
  /** Largeur (rayon) de pale / diamètre de turbine. */
  bladeLength: 0.25,
  /** Hauteur de pale / diamètre de turbine. */
  bladeHeight: 0.2,
  /** Nombre de pales de la turbine Rushton. */
  bladeCount: 6,
  /** Diamètre d'arbre / D. */
  shaftDiameter: 0.03,

  /** Nombre de chicanes. */
  baffleCount: 4,
  /** Largeur de chicane / D (D/12). */
  baffleWidth: 1 / 12,
  /** Épaisseur de chicane / D. */
  baffleThickness: 0.012,
  /** Jeu paroi–chicane / D (évite les zones mortes). */
  baffleWallGap: 0.014,

  /** Espace annulaire de l'enveloppe / D. */
  jacketGap: 0.06,
  /** Début de l'enveloppe (en fraction de H, depuis le bas de la virole). */
  jacketStart: 0.05,
  /** Fin de l'enveloppe (en fraction de H). */
  jacketEnd: 0.88,

  /** Diamètre extérieur du moteur d'agitation / D. */
  motorDiameter: 0.22,
  /** Hauteur du moteur / D. */
  motorHeight: 0.28,
  /** Diamètre des buses / D. */
  nozzleDiameter: 0.07,
  /** Diamètre de la soupape de sécurité (corps) / D. */
  reliefValveDiameter: 0.09,
  /** Hauteur des jambes (bas de la tête de cuve → sol) / D. */
  legHeight: 0.42,
  /** Rayon extérieur des brides de couvercle / D (demi-diamètre + débord). */
  lidFlangeOverhang: 0.045,
  /** Longueur d'une buse verticale sur le couvercle / D. */
  nozzleLength: 0.12,
} as const;

/**
 * Angles (rad) des organes autour de l'axe, avec dir(θ) = (sin θ, 0, cos θ) — même convention que
 * `LatheGeometry`. Le quart de coupe retire θ ∈ [0, π/2] : tous les organes visibles de la coupe
 * sont placés dans ]π/2, 2π[.
 */
export const ANGLES = {
  feed: (150 * Math.PI) / 180,
  reliefValve: (225 * Math.PI) / 180,
  thermowell: (315 * Math.PI) / 180,
  sightGlass: (105 * Math.PI) / 180,
  jacketIn: (120 * Math.PI) / 180,
  jacketOut: (300 * Math.PI) / 180,
  /** Début de la coupe : la zone retirée est ]CUT_START − w, CUT_START[ avec w ≤ π/2. */
  cutEdge: Math.PI / 2,
} as const;

/** Fraction de rayon (r/R) des buses de couvercle. */
export const LID_NOZZLE_RADIAL = {
  feed: 0.55,
  reliefValve: 0.6,
  thermowell: 0.45,
  sightGlass: 0.6,
} as const;

export type GeometryRatios = typeof GEOMETRY_RATIOS;

/** Géométrie absolue [m] pour un volume de cuve donné. */
export interface ReactorGeometry {
  /** Diamètre intérieur de cuve D [m]. */
  tankDiameter: number;
  tankRadius: number;
  shellHeight: number;
  headDepth: number;
  wallThickness: number;
  /** Hauteur du liquide au-dessus du bas de la virole [m]. */
  liquidHeight: number;
  turbineDiameter: number;
  turbineRadius: number;
  /** Hauteur de la turbine au-dessus du bas de la virole [m]. */
  turbineHeight: number;
  turbineDiskRadius: number;
  bladeLength: number;
  bladeHeight: number;
  bladeCount: number;
  shaftRadius: number;
  baffleCount: number;
  baffleWidth: number;
  baffleThickness: number;
  baffleWallGap: number;
  jacketInnerRadius: number;
  jacketOuterRadius: number;
  jacketBottom: number;
  jacketTop: number;
  motorRadius: number;
  motorHeight: number;
  nozzleRadius: number;
  reliefValveRadius: number;
  legHeight: number;
  lidFlangeRadius: number;
  nozzleLength: number;
  /** Ordonnée du sol (y < 0) : bas de la tête de cuve moins la hauteur des jambes [m]. */
  floorY: number;
}

/** Une buse : position de sa base sur l'équipement, direction de sortie, rayon. */
export interface NozzleSpec {
  id: 'feed' | 'reliefValve' | 'thermowell' | 'sightGlass' | 'outlet' | 'jacketIn' | 'jacketOut';
  /** Position de la base [m] (repère du réacteur : origine au bas de la virole, axe Y). */
  position: [number, number, number];
  /** Direction unitaire de sortie. */
  direction: [number, number, number];
  radius: number;
  length: number;
}

/** Hauteur y de la surface extérieure du couvercle (dôme 2:1) à la fraction radiale ρ = r/R. */
export function lidSurfaceY(g: ReactorGeometry, rho: number): number {
  return g.shellHeight + g.headDepth * Math.sqrt(Math.max(0, 1 - rho * rho));
}

/** Disposition des buses (S3-C01 : position soupape, buses d'entrée/sortie, enveloppe). */
export function nozzleLayout(g: ReactorGeometry): NozzleSpec[] {
  const lid = (id: NozzleSpec['id'], angle: number, rho: number): NozzleSpec => {
    const r = rho * g.tankRadius;
    return {
      id,
      position: [r * Math.sin(angle), lidSurfaceY(g, rho), r * Math.cos(angle)],
      direction: [0, 1, 0],
      radius: id === 'reliefValve' ? g.reliefValveRadius : g.nozzleRadius,
      length: g.nozzleLength,
    };
  };
  const side = (id: NozzleSpec['id'], angle: number, y: number): NozzleSpec => ({
    id,
    position: [g.jacketOuterRadius * Math.sin(angle), y, g.jacketOuterRadius * Math.cos(angle)],
    direction: [Math.sin(angle), 0, Math.cos(angle)],
    radius: g.nozzleRadius,
    length: g.nozzleLength,
  });
  return [
    lid('feed', ANGLES.feed, LID_NOZZLE_RADIAL.feed),
    lid('reliefValve', ANGLES.reliefValve, LID_NOZZLE_RADIAL.reliefValve),
    lid('thermowell', ANGLES.thermowell, LID_NOZZLE_RADIAL.thermowell),
    lid('sightGlass', ANGLES.sightGlass, LID_NOZZLE_RADIAL.sightGlass),
    {
      id: 'outlet',
      position: [0, -g.headDepth, 0],
      direction: [0, -1, 0],
      radius: g.nozzleRadius,
      length: g.nozzleLength,
    },
    side('jacketIn', ANGLES.jacketIn, g.jacketBottom + 0.04 * g.shellHeight),
    side('jacketOut', ANGLES.jacketOut, g.jacketTop - 0.04 * g.shellHeight),
  ];
}

/**
 * Diamètre de cuve D tel que le volume utile de la virole (π/4·D²·H avec H = D) vaille `volumeL`.
 * @param volumeL volume du réacteur [L]
 */
export function tankDiameterFromVolume(volumeL: number): number {
  const volumeM3 = volumeL / 1000;
  return Math.cbrt((4 * volumeM3) / (Math.PI * GEOMETRY_RATIOS.shellHeight));
}

/**
 * Calcule la géométrie absolue. Repère : axe vertical Y, origine au bas de la virole, centre du
 * réacteur sur l'axe Y.
 */
export function computeGeometry(
  volumeL: number,
  r: GeometryRatios = GEOMETRY_RATIOS,
): ReactorGeometry {
  const D = tankDiameterFromVolume(volumeL);
  const shellHeight = r.shellHeight * D;
  const turbineDiameter = r.turbineDiameter * D;
  const tankRadius = D / 2;
  return {
    tankDiameter: D,
    tankRadius,
    shellHeight,
    headDepth: r.headDepth * D,
    wallThickness: r.wallThickness * D,
    liquidHeight: r.fillFraction * shellHeight,
    turbineDiameter,
    turbineRadius: turbineDiameter / 2,
    turbineHeight: r.turbineClearance * D,
    turbineDiskRadius: (r.turbineDiskRatio * turbineDiameter) / 2,
    bladeLength: r.bladeLength * turbineDiameter,
    bladeHeight: r.bladeHeight * turbineDiameter,
    bladeCount: r.bladeCount,
    shaftRadius: (r.shaftDiameter * D) / 2,
    baffleCount: r.baffleCount,
    baffleWidth: r.baffleWidth * D,
    baffleThickness: r.baffleThickness * D,
    baffleWallGap: r.baffleWallGap * D,
    jacketInnerRadius: tankRadius + r.wallThickness * D,
    jacketOuterRadius: tankRadius + r.wallThickness * D + r.jacketGap * D,
    jacketBottom: r.jacketStart * shellHeight,
    jacketTop: r.jacketEnd * shellHeight,
    motorRadius: (r.motorDiameter * D) / 2,
    motorHeight: r.motorHeight * D,
    nozzleRadius: (r.nozzleDiameter * D) / 2,
    reliefValveRadius: (r.reliefValveDiameter * D) / 2,
    legHeight: r.legHeight * D,
    lidFlangeRadius: tankRadius + r.lidFlangeOverhang * D,
    nozzleLength: r.nozzleLength * D,
    floorY: -r.headDepth * D - r.legHeight * D,
  };
}

/**
 * Profil elliptique 2:1 (quart d'ellipse) d'un fond, du pôle (r = 0) au bord (r = R).
 * Retourne des paires [r, y] avec y = 0 au bord (raccord avec la virole) et y = −h au pôle
 * pour un fond bas ; l'appelant retourne le signe pour un couvercle.
 * @param radius rayon de la virole R [m]
 * @param depth profondeur h [m]
 * @param segments nombre de segments (≥ 2)
 */
export function ellipticalHeadProfile(
  radius: number,
  depth: number,
  segments: number,
): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * (Math.PI / 2); // 0 = pôle, π/2 = bord
    pts.push([radius * Math.sin(a), -depth * Math.cos(a)]);
  }
  return pts;
}

/** Vitesse de rotation visuelle de l'arbre [rad/s] pour un rpm donné (facteur visuel borné). */
export function shaftAngularSpeedRadPerS(rpm: number, visualFactor = 1): number {
  return ((rpm * 2 * Math.PI) / 60) * visualFactor;
}
