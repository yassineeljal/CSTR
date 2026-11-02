'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import type { WebGLRenderer } from 'three';
import { effectiveQuality } from '@/lib/quality';
import { useReactorStore } from '@/store/useReactorStore';

/** Active/désactive la remise à zéro automatique de `renderer.info` (objet Three.js mutable par conception). */
function setInfoAutoReset(gl: WebGLRenderer, autoReset: boolean): void {
  gl.info.autoReset = autoReset;
  gl.info.reset();
}

/** Période de publication des statistiques [ms]. */
const PUBLISH_MS = 500;

/**
 * Publie les statistiques de rendu dans `document.documentElement.dataset` (audit S7-L01, budgets
 * en e2e). Méthode de mesure :
 *  - `renderer.info.autoReset` est désactivé : avec le post-traitement, chaque passe (scène, bloom,
 *    tone mapping…) appellerait sinon `reset()` et on ne verrait que la dernière passe ;
 *  - le compteur d'images est celui de la boucle R3F (une image affichée = un `useFrame`), pas
 *    `info.render.frame` qui compte les passes ;
 *  - draw calls et triangles sont des moyennes *par image affichée* sur la période.
 */
export function RenderStats() {
  const gl = useThree((s) => s.gl);
  const frames = useRef(0);
  const lastFrames = useRef(0);

  useFrame(() => {
    frames.current++;
  });

  useEffect(() => {
    setInfoAutoReset(gl, false);
    const id = setInterval(() => {
      const { render, memory } = gl.info;
      const shown = frames.current - lastFrames.current;
      lastFrames.current = frames.current;
      const perFrame = (v: number) => (shown > 0 ? Math.round(v / shown) : 0);
      const d = document.documentElement.dataset;
      if (shown > 0) {
        d.drawCalls = String(perFrame(render.calls));
        d.triangles = String(perFrame(render.triangles));
      }
      gl.info.reset();
      d.frames = String(frames.current);
      d.geometries = String(memory.geometries);
      d.textures = String(memory.textures);
      const { ui, qualityTier } = useReactorStore.getState();
      d.quality = effectiveQuality(ui.quality, qualityTier);
    }, PUBLISH_MS);
    return () => {
      clearInterval(id);
      setInfoAutoReset(gl, true);
    };
  }, [gl]);
  return null;
}
