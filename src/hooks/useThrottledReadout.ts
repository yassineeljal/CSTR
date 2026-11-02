'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { simRef } from '@/client/simRef';
import { subscribeReadout } from '@/lib/readoutTicker';

/**
 * Affiche une valeur dérivée du snapshot dans un élément DOM à 10 Hz, sans re-rendu React.
 * @param format reçoit le snapshot courant (lecture seule) et renvoie le texte
 */
export function useThrottledReadout<T extends HTMLElement>(
  format: (snapshot: Float64Array) => string,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  });
  useEffect(
    () =>
      subscribeReadout(() => {
        const el = ref.current;
        if (el) el.textContent = formatRef.current(simRef.current);
      }),
    [],
  );
  return ref;
}
