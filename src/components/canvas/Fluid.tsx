'use client';

import { useLayoutEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, LatheGeometry, MeshPhysicalMaterial, MeshStandardMaterial } from 'three';
import { simRef } from '@/client/simRef';
import { temperatureToRgb } from '@/lib/colorScale';
import type { ReactorGeometry } from '@/simulation/geometry';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import { useCutaway } from './CutawayContext';
import { CutCaps } from './CutCaps';
import { fluidProfile, fluidSection } from './profiles';
import { applyWedgeClip } from './wedge';

const tmp: [number, number, number] = [0, 0, 0];

/**
 * Fluide réactionnel. Version S3 (placeholder) : couleur pilotée par T via la rampe partagée.
 * Les shaders (vortex, ébullition, émission) remplacent ce matériau au Sprint 4.
 */
export function Fluid({ geometry: g }: { geometry: ReactorGeometry }) {
  const { uniforms } = useCutaway();

  const mats = useMemo(() => {
    const body = new MeshPhysicalMaterial({
      color: '#2a7fd0',
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      opacity: 0.78,
      side: DoubleSide,
      depthWrite: false,
    });
    applyWedgeClip(body, uniforms);
    const cap = new MeshStandardMaterial({
      color: '#2a7fd0',
      roughness: 0.35,
      transparent: true,
      opacity: 0.92,
      side: DoubleSide,
    });
    return { body, cap };
  }, [uniforms]);

  const geom = useMemo(() => new LatheGeometry(fluidProfile(g), 96), [g]);
  const section = useMemo(() => [fluidSection(g)], [g]);
  useLayoutEffect(
    () => () => {
      geom.dispose();
      mats.body.dispose();
      mats.cap.dispose();
    },
    [geom, mats],
  );

  useFrame(() => {
    const t = simRef.current[SNAPSHOT_LAYOUT.T] as number;
    temperatureToRgb(t, tmp);
    mats.body.color.setRGB(tmp[0], tmp[1], tmp[2]);
    mats.cap.color.setRGB(tmp[0], tmp[1], tmp[2]);
  });

  return (
    <group name="Fluid">
      <mesh geometry={geom} material={mats.body} renderOrder={1} />
      <CutCaps shapes={section} material={mats.cap} />
    </group>
  );
}
