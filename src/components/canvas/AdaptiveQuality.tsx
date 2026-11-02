'use client';

import { useEffect, useState } from 'react';
import { useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { effectiveDpr, effectiveQuality } from '@/lib/quality';
import { useReactorStore } from '@/store/useReactorStore';

/** Délai avant de juger la cadence [ms] : compilation des shaders et décodage du .glb faussent les premières secondes. */
export const WARMUP_MS = 6000;
/** Cadence en deçà de laquelle on dégrade la qualité [images/s]. */
export const DECLINE_BELOW_FPS = 45;
/** Cadence au-delà de laquelle on rétablit la qualité [images/s]. */
export const INCLINE_ABOVE_FPS = 54;

/**
 * Qualité adaptative (S7-L02) : `PerformanceMonitor` de drei mesure la cadence réelle ; sous
 * `DECLINE_BELOW_FPS` le niveau passe à « bas » (dpr 1, Bloom coupé, 4× moins de particules), puis
 * remonte au-delà de `INCLINE_ABOVE_FPS`.
 *
 * Bornes : en rendu à la demande la cadence est plafonnée à celle des snapshots (≈ 60 Hz, avec de
 * la gigue). Un seuil de 50 FPS serait trop proche de ce plafond — la mesure oscille autour et la
 * remontée serait impossible (observé sur un audit de 10 min : bascule définitive sur « bas »
 * avec un GPU pourtant peu chargé). D'où 45 / 54. Une préférence explicite (Haute/Basse) neutralise la mesure.
 * En rendu à la demande, la mesure n'a lieu que pendant les images produites (simulation en cours).
 */
export function AdaptiveQuality() {
  const setDpr = useThree((s) => s.setDpr);
  const setTier = useReactorStore((s) => s.setQualityTier);
  const preference = useReactorStore((s) => s.ui.quality);
  const measured = useReactorStore((s) => s.qualityTier);
  const tier = effectiveQuality(preference, measured);
  const [warmedUp, setWarmedUp] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setWarmedUp(true), WARMUP_MS);
    return () => clearTimeout(id);
  }, []);

  useEffect(() => {
    setDpr(effectiveDpr(window.devicePixelRatio, tier));
  }, [setDpr, tier]);

  if (preference !== 'auto' || !warmedUp) return null;
  return (
    <PerformanceMonitor
      ms={250}
      iterations={8}
      flipflops={Infinity}
      bounds={() => [DECLINE_BELOW_FPS, INCLINE_ABOVE_FPS]}
      onDecline={() => setTier('low')}
      onIncline={() => setTier('high')}
    />
  );
}
