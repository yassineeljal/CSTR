'use client';

import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from 'three';
import { Leva, useControls } from 'leva';

/**
 * Réglages live (caméra, exposition) — développement uniquement (S3-L09). Ce module n'est
 * importé que par `import()` derrière `process.env.NODE_ENV === 'development'` : il est exclu du
 * bundle de production (vérifié par `tests/e2e/scene.spec.ts`).
 */
export default function DevControls() {
  const { exposure, fov } = useControls('Scène', {
    exposure: { value: 1, min: 0.2, max: 3, step: 0.05 },
    fov: { value: 38, min: 20, max: 80, step: 1 },
  });
  // Appliqué dans la boucle de rendu : les objets Three.js sont mutables par nature.
  useFrame(({ gl, camera }) => {
    gl.toneMappingExposure = exposure;
    if (camera instanceof PerspectiveCamera && camera.fov !== fov) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

export function DevPanel() {
  return <Leva collapsed titleBar={{ title: 'Dev' }} />;
}
