'use client';

import { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3 } from 'three';
import { computeGeometry } from '@/simulation/geometry';
import { useReactorStore } from '@/store/useReactorStore';
import { inspectionLabels } from './inspectionSpecs';
import { MAX_LABELS, labelScreen, ndcToScreen } from './labelProjection';

const tmp = new Vector3();

/**
 * Projette les ancrages des étiquettes d'inspection sur l'écran à chaque frame (côté Canvas).
 * Ne rend rien : la couche DOM `InspectionOverlay` lit `labelScreen`. Inactif hors mode Inspection.
 */
export function LabelProjector() {
  const volumeL = useReactorStore((s) => s.params.volumeL);
  const specs = useMemo(
    () => inspectionLabels(computeGeometry(volumeL)).slice(0, MAX_LABELS),
    [volumeL],
  );
  useFrame(({ camera, size }) => {
    if (!useReactorStore.getState().ui.inspectionMode) return;
    for (let i = 0; i < specs.length; i++) {
      const p = (specs[i] as (typeof specs)[number]).position;
      tmp.set(p[0], p[1], p[2]).project(camera);
      ndcToScreen(tmp.x, tmp.y, tmp.z, size.width, size.height, labelScreen, i);
    }
  });
  return null;
}
