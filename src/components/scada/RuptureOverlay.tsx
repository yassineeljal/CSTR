'use client';

import { useEffect, useRef } from 'react';
import { formatSimTime } from '@/lib/units';
import { useReactorStore } from '@/store/useReactorStore';

interface RuptureOverlayProps {
  /** Appelé par « Réessayer » : remet la simulation à zéro et la relance. */
  onRetry: () => void;
}

/**
 * Écran de rupture (S4-L09) : flash, voile rouge, message « Perte de confinement — T = … K à t = … »
 * et bouton Réessayer. Le flash est désactivé par « réduire les animations » (préférence ou système).
 */
export function RuptureOverlay({ onRetry }: RuptureOverlayProps) {
  const rupture = useReactorStore((s) => s.rupture);
  const reducedMotion = useReactorStore((s) => s.ui.reducedMotion);
  const retry = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (rupture) retry.current?.focus();
  }, [rupture]);

  if (!rupture) return null;
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="rupture-title"
      aria-describedby="rupture-desc"
      data-testid="rupture-overlay"
      className="absolute inset-0 z-50 flex items-center justify-center bg-red-950/70 backdrop-blur-[2px]"
    >
      {!reducedMotion && (
        <div aria-hidden className="rupture-flash pointer-events-none absolute inset-0 bg-white" />
      )}
      <div className="mx-4 max-w-md rounded border border-red-500 bg-zinc-950/95 p-6 text-center font-mono shadow-2xl">
        <h2 id="rupture-title" className="text-xl font-semibold tracking-wide text-red-400">
          PERTE DE CONFINEMENT
        </h2>
        <p id="rupture-desc" className="mt-3 text-sm text-zinc-200">
          Perte de confinement — T = {rupture.tempK.toFixed(1)} K à t ={' '}
          {formatSimTime(rupture.simTimeS)}
        </p>
        <p className="mt-2 text-xs text-zinc-400">
          La température a dépassé le seuil de rupture. Une intervention plus précoce (quench, arrêt
          de l’alimentation, rétablissement du refroidissement) aurait pu sauver le réacteur.
        </p>
        <button
          ref={retry}
          onClick={onRetry}
          className="mt-5 rounded border border-red-400 bg-red-900 px-4 py-2 text-sm font-medium text-red-50 hover:bg-red-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          Réessayer
        </button>
      </div>
    </div>
  );
}
