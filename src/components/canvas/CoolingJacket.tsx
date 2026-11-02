'use client';

import { useLayoutEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, LatheGeometry, MeshStandardMaterial, Vector2 } from 'three';
import { simRef } from '@/client/simRef';
import { temperatureToRgb } from '@/lib/colorScale';
import type { ReactorGeometry } from '@/simulation/geometry';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import { useCutaway } from './CutawayContext';
import { CutCaps } from './CutCaps';
import { jacketCoolantSection, jacketRadii, jacketWallSections } from './profiles';
import { mergeParts } from './mergeParts';
import { useBrushedMetalTexture } from './useBrushedMetal';
import { applyWedgeClip } from './wedge';

const tmp: [number, number, number] = [0, 0, 0];

/** Double enveloppe : paroi extérieure, plaques, film de fluide caloporteur coloré par T_j. */
export function CoolingJacket({ geometry: g }: { geometry: ReactorGeometry }) {
  const { uniforms } = useCutaway();
  const brushed = useBrushedMetalTexture();
  const r = jacketRadii(g);

  const mats = useMemo(() => {
    const wall = new MeshStandardMaterial({
      // acier peint (non poli) : un métal pur à incidence rasante reflète l'horizon sombre
      color: '#b4c0cc',
      metalness: 0.55,
      roughness: 0.5,
      roughnessMap: brushed,
      bumpMap: brushed,
      bumpScale: 0.12,
      side: DoubleSide,
    });
    applyWedgeClip(wall, uniforms);
    const coolant = new MeshStandardMaterial({
      color: '#2a7fd0',
      metalness: 0,
      roughness: 0.25,
      transparent: true,
      opacity: 0.55,
      side: DoubleSide,
      depthWrite: false,
    });
    applyWedgeClip(coolant, uniforms);
    const cap = new MeshStandardMaterial({
      color: '#e4e9ee',
      metalness: 0.15,
      roughness: 0.55,
      emissive: '#222a31',
      side: DoubleSide,
    });
    const coolantCap = new MeshStandardMaterial({
      color: '#2a7fd0',
      roughness: 0.3,
      transparent: true,
      opacity: 0.8,
      side: DoubleSide,
    });
    return { wall, coolant, cap, coolantCap };
  }, [brushed, uniforms]);

  const geoms = useMemo(() => {
    const t = g.wallThickness;
    const line = (rad: number, y0: number, y1: number) => [
      new Vector2(rad, y0),
      new Vector2(rad, y1),
    ];
    const ring = (rIn: number, rOut: number, y: number) => [
      new Vector2(rIn, y),
      new Vector2(rOut, y),
    ];
    return {
      // paroi extérieure + plaques haute/basse : même matériau, un seul draw call
      wall: mergeParts([
        new LatheGeometry(line(r.outer, g.jacketBottom - t, g.jacketTop + t), 96),
        new LatheGeometry(ring(r.inner, r.outer, g.jacketBottom - t), 96),
        new LatheGeometry(ring(r.inner, r.outer, g.jacketTop + t), 96),
      ]),
      // films caloporteurs : légèrement à l'intérieur des parois pour éviter le z-fighting
      film: mergeParts([
        new LatheGeometry(line(r.coolantOuter - 0.0006, g.jacketBottom, g.jacketTop), 96),
        new LatheGeometry(line(r.inner + 0.0006, g.jacketBottom, g.jacketTop), 96),
      ]),
    };
  }, [g, r.inner, r.outer, r.coolantOuter]);
  const wallSections = useMemo(() => jacketWallSections(g), [g]);
  const coolantSection = useMemo(() => [jacketCoolantSection(g)], [g]);

  useLayoutEffect(
    () => () => {
      Object.values(geoms).forEach((x) => x.dispose());
      Object.values(mats).forEach((x) => x.dispose());
    },
    [geoms, mats],
  );

  useFrame(() => {
    // Placeholder (S3) : couleur de l'eau selon T_j ; le motif d'écoulement arrive au Sprint 4.
    const tj = simRef.current[SNAPSHOT_LAYOUT.Tj] as number;
    temperatureToRgb(tj, tmp);
    mats.coolant.color.setRGB(tmp[0], tmp[1], tmp[2]);
    mats.coolantCap.color.setRGB(tmp[0], tmp[1], tmp[2]);
  });

  return (
    <group name="Jacket">
      <mesh geometry={geoms.wall} material={mats.wall} castShadow receiveShadow />
      <mesh geometry={geoms.film} material={mats.coolant} renderOrder={2} />
      <CutCaps shapes={wallSections} material={mats.cap} />
      <CutCaps shapes={coolantSection} material={mats.coolantCap} />
    </group>
  );
}
