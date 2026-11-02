import type { QualityPreference, QualityTier } from '@/store/useReactorStore';

/**
 * Niveau de qualité effectif : la préférence explicite l'emporte ; en « auto », la mesure de
 * performance à l'exécution décide (S7-L02).
 */
export function effectiveQuality(
  preference: QualityPreference,
  measured: QualityTier,
): QualityTier {
  return preference === 'auto' ? measured : preference;
}

/** Paramètres de rendu dérivés du niveau de qualité. */
export interface QualitySettings {
  /** Rapport de pixels maximal du canvas. */
  maxDpr: number;
  bloom: boolean;
  /** Fraction des instances de bulles et des particules de vapeur conservée. */
  particleScale: number;
}

export const QUALITY_SETTINGS: Readonly<Record<QualityTier, QualitySettings>> = {
  high: { maxDpr: 2, bloom: true, particleScale: 1 },
  low: { maxDpr: 1, bloom: false, particleScale: 0.25 },
};

/** Nombre de particules conservées, borné à ≥ 1 si `count` > 0. */
export function scaledCount(count: number, tier: QualityTier): number {
  if (count <= 0) return 0;
  return Math.max(1, Math.round(count * QUALITY_SETTINGS[tier].particleScale));
}

/** Rapport de pixels effectif : borné par le niveau de qualité et par l'écran. */
export function effectiveDpr(devicePixelRatio: number, tier: QualityTier): number {
  return Math.min(Math.max(devicePixelRatio, 1), QUALITY_SETTINGS[tier].maxDpr);
}

/** Décision de pause automatique quand l'onglet change de visibilité (S7-L04). */
export type VisibilityAction = 'pause' | 'resume' | 'none';

export function visibilityAction(input: {
  hidden: boolean;
  enabled: boolean;
  status: 'ready' | 'running' | 'paused' | 'ruptured' | 'error';
  pausedByUs: boolean;
}): VisibilityAction {
  if (!input.enabled) return input.pausedByUs && !input.hidden ? 'resume' : 'none';
  if (input.hidden) return input.status === 'running' ? 'pause' : 'none';
  return input.pausedByUs && input.status === 'paused' ? 'resume' : 'none';
}
