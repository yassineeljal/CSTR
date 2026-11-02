'use client';

import { effectiveQuality, QUALITY_SETTINGS, type QualitySettings } from '@/lib/quality';
import { useReactorStore, type QualityTier } from '@/store/useReactorStore';

/** Niveau de qualité effectif et réglages de rendu associés (réagit aux changements, rarement). */
export function useQuality(): { tier: QualityTier; settings: QualitySettings } {
  const preference = useReactorStore((s) => s.ui.quality);
  const measured = useReactorStore((s) => s.qualityTier);
  const tier = effectiveQuality(preference, measured);
  return { tier, settings: QUALITY_SETTINGS[tier] };
}
