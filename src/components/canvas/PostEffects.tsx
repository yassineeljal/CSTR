'use client';

import { Bloom, EffectComposer, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useQuality } from '@/hooks/useQuality';
import { useReactorStore } from '@/store/useReactorStore';

/** Seuil de luminance du Bloom (HDR) : seul le fluide émissif (> 1) l'atteint, soit ≳ 400 K. */
export const BLOOM_THRESHOLD = 1.1;

/**
 * Post-traitement (S4-L05) : Bloom (mipmapBlur), vignette, tone mapping ACES en dernier.
 * En mode « Inspection » ou qualité basse, le Bloom est retiré.
 */
export function PostEffects() {
  const inspection = useReactorStore((s) => s.ui.inspectionMode);
  const { settings } = useQuality();
  const bloomOn = !inspection && settings.bloom;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        luminanceThreshold={BLOOM_THRESHOLD}
        luminanceSmoothing={0.15}
        intensity={bloomOn ? 1.25 : 0}
        mipmapBlur
        radius={0.75}
      />
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
