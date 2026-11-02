'use client';

import { useLayoutEffect, useMemo } from 'react';
import { BoxGeometry, MeshStandardMaterial } from 'three';
import type { ReactorGeometry } from '@/simulation/geometry';
import { useCutaway } from './CutawayContext';
import { mergeParts } from './mergeParts';
import { applyWedgeClip } from './wedge';

/** Chicanes verticales (4 × D/12) à 45° + k·90° — celle du quartier retiré disparaît avec la coupe. */
export function Baffles({ geometry: g }: { geometry: ReactorGeometry }) {
  const { uniforms } = useCutaway();
  const mat = useMemo(() => {
    const m = new MeshStandardMaterial({ color: '#9aa4ac', metalness: 1, roughness: 0.4 });
    applyWedgeClip(m, uniforms);
    return m;
  }, [uniforms]);
  useLayoutEffect(() => () => mat.dispose(), [mat]);

  const geometry = useMemo(() => {
    const y0 = 0.03 * g.shellHeight;
    const y1 = g.shellHeight - 0.03 * g.shellHeight;
    const radius = g.tankRadius - g.baffleWallGap - g.baffleWidth / 2;
    const parts = Array.from({ length: g.baffleCount }, (_, i) => {
      const a = Math.PI / 4 + (i * 2 * Math.PI) / g.baffleCount;
      const box = new BoxGeometry(g.baffleThickness, y1 - y0, g.baffleWidth);
      box.rotateY(a);
      box.translate(radius * Math.sin(a), (y0 + y1) / 2, radius * Math.cos(a));
      return box;
    });
    return mergeParts(parts);
  }, [g]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <group name="Baffles">
      <mesh geometry={geometry} material={mat} castShadow receiveShadow />
    </group>
  );
}
