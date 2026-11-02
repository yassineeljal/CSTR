'use client';

import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { simRef } from '@/client/simRef';
import { vibrationAmplitude } from '@/lib/visuals';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import { useReactorStore } from '@/store/useReactorStore';

/** Amplitude maximale du tremblement [m] (à l'approche de la rupture). */
const MAX_SHAKE_M = 0.012;
/** Inclinaison maximale [rad]. */
const MAX_TILT_RAD = 0.006;

/**
 * Tremblement de la cuve ∝ (T − T_HH)⁺ et ∝ pression (S4-L08). Discret à l'approche de HH,
 * fort près de la rupture. Désactivé par la préférence « réduire les animations ».
 */
export function VibrationRig({ children }: { children: ReactNode }) {
  const group = useRef<Group>(null);
  useFrame(({ clock }) => {
    const g = group.current;
    if (!g) return;
    const { params, ui } = useReactorStore.getState();
    const s = simRef.current;
    const amp = ui.reducedMotion
      ? 0
      : vibrationAmplitude(
          s[SNAPSHOT_LAYOUT.T] as number,
          params.tHHK,
          params.tRuptureK,
          (s[SNAPSHOT_LAYOUT.pressure] as number) / params.reliefSetPressurePa,
        );
    if (amp === 0) {
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
      return;
    }
    const t = clock.elapsedTime;
    // somme de sinusoïdes incommensurables : pseudo-aléatoire sans état ni allocation
    g.position.set(
      amp * MAX_SHAKE_M * (Math.sin(t * 53.1) + 0.6 * Math.sin(t * 91.7)),
      amp * MAX_SHAKE_M * 0.5 * Math.sin(t * 67.3),
      amp * MAX_SHAKE_M * (Math.sin(t * 59.9 + 1.3) + 0.6 * Math.sin(t * 83.1)),
    );
    g.rotation.set(
      amp * MAX_TILT_RAD * Math.sin(t * 47.3),
      0,
      amp * MAX_TILT_RAD * Math.sin(t * 71.9 + 0.7),
    );
  });
  return <group ref={group}>{children}</group>;
}
