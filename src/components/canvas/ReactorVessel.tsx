'use client';

import { useLayoutEffect, useMemo } from 'react';
import { DoubleSide, LatheGeometry, MeshStandardMaterial } from 'three';
import type { ReactorGeometry } from '@/simulation/geometry';
import { useCutaway } from './CutawayContext';
import { CutCaps } from './CutCaps';
import {
  lidInnerProfile,
  lidOuterProfile,
  lidWallSection,
  vesselInnerProfile,
  vesselOuterProfile,
  vesselWallSection,
} from './profiles';
import { mergeParts } from './mergeParts';
import { useBrushedMetalTexture } from './useBrushedMetal';
import { applyWedgeClip } from './wedge';

const RADIAL_SEGMENTS = 96;

export function ReactorVessel({ geometry: g }: { geometry: ReactorGeometry }) {
  const { uniforms } = useCutaway();
  const brushed = useBrushedMetalTexture();

  const materials = useMemo(() => {
    const shell = new MeshStandardMaterial({
      color: '#b9c1c8',
      metalness: 1,
      roughness: 0.42,
      roughnessMap: brushed,
      bumpMap: brushed,
      bumpScale: 0.35,
      side: DoubleSide,
      envMapIntensity: 1.1,
    });
    applyWedgeClip(shell, uniforms);
    const inner = new MeshStandardMaterial({
      color: '#8e979e',
      metalness: 1,
      roughness: 0.5,
      roughnessMap: brushed,
      side: DoubleSide,
    });
    applyWedgeClip(inner, uniforms);
    const cap = new MeshStandardMaterial({
      color: '#e4e9ee',
      metalness: 0.15,
      roughness: 0.55,
      emissive: '#222a31',
      side: DoubleSide,
    });
    return { shell, inner, cap };
  }, [brushed, uniforms]);

  const geoms = useMemo(
    () => ({
      // une seule géométrie pour toute la face extérieure (cuve + couvercle), une pour l'intérieure
      outer: mergeParts([
        new LatheGeometry(vesselOuterProfile(g), RADIAL_SEGMENTS),
        new LatheGeometry(lidOuterProfile(g), RADIAL_SEGMENTS),
      ]),
      inner: mergeParts([
        new LatheGeometry(vesselInnerProfile(g), RADIAL_SEGMENTS),
        new LatheGeometry(lidInnerProfile(g), RADIAL_SEGMENTS),
      ]),
    }),
    [g],
  );
  const sections = useMemo(() => [vesselWallSection(g), lidWallSection(g)], [g]);

  useLayoutEffect(
    () => () => {
      Object.values(geoms).forEach((x) => x.dispose());
      Object.values(materials).forEach((x) => x.dispose());
    },
    [geoms, materials],
  );

  return (
    <group name="Vessel">
      <mesh geometry={geoms.outer} material={materials.shell} castShadow receiveShadow />
      <mesh geometry={geoms.inner} material={materials.inner} receiveShadow />
      <CutCaps shapes={sections} material={materials.cap} />
    </group>
  );
}
