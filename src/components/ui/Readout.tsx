'use client';

import { useThrottledReadout } from '@/hooks/useThrottledReadout';

interface ReadoutProps {
  /** Extrait et formate la valeur depuis le snapshot courant. */
  format: (snapshot: Float64Array) => string;
  /** Niveau d'alarme optionnel : 0 normal, 1 avertissement (ambre), 2 alarme (rouge). */
  level?: (snapshot: Float64Array) => 0 | 1 | 2;
  className?: string;
}

/**
 * Valeur numérique rafraîchie à 10 Hz directement dans le DOM, sans re-rendu React
 * (PLAN §5.4 règle 4).
 */
export function Readout({ format, level, className }: ReadoutProps) {
  const ref = useThrottledReadout<HTMLSpanElement>(format, level);
  return <span ref={ref} className={className} aria-live="off" />;
}
