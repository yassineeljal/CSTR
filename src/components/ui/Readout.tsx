'use client';

import { useThrottledReadout } from '@/hooks/useThrottledReadout';

interface ReadoutProps {
  /** Extrait et formate la valeur depuis le snapshot courant. */
  format: (snapshot: Float64Array) => string;
  className?: string;
}

/**
 * Valeur numérique rafraîchie à 10 Hz directement dans le DOM, sans re-rendu React
 * (PLAN §5.4 règle 4).
 */
export function Readout({ format, className }: ReadoutProps) {
  const ref = useThrottledReadout<HTMLSpanElement>(format);
  return <span ref={ref} className={className} aria-live="off" />;
}
