'use client';

import { useEffect, useRef, type RefObject } from 'react';
import { simRef } from '@/client/simRef';
import { subscribeReadout } from '@/lib/readoutTicker';

/**
 * Affiche une valeur dérivée du snapshot dans un élément DOM à 10 Hz, sans re-rendu React.
 * @param format reçoit le snapshot courant (lecture seule) et renvoie le texte
 * @param level niveau d'alarme optionnel (0 normal, 1 avertissement, 2 alarme) posé en `data-level`
 */
export function useThrottledReadout<T extends HTMLElement>(
  format: (snapshot: Float64Array) => string,
  level?: (snapshot: Float64Array) => 0 | 1 | 2,
): RefObject<T | null> {
  const ref = useRef<T | null>(null);
  const formatRef = useRef(format);
  const levelRef = useRef(level);
  useEffect(() => {
    formatRef.current = format;
    levelRef.current = level;
  });
  useEffect(
    () =>
      subscribeReadout(() => {
        const el = ref.current;
        if (!el) return;
        const snap = simRef.current;
        el.textContent = formatRef.current(snap);
        const lv = levelRef.current?.(snap) ?? 0;
        const next = lv === 0 ? '' : String(lv);
        if (el.dataset.level !== next) {
          if (next) el.dataset.level = next;
          else delete el.dataset.level;
        }
      }),
    [],
  );
  return ref;
}
