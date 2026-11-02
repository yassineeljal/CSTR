'use client';

import { useLayoutEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DoubleSide,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  ShaderMaterial,
} from 'three';
import { simRef } from '@/client/simRef';
import { bubbleDensity } from '@/lib/visuals';
import type { ReactorGeometry } from '@/simulation/geometry';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import { useCutaway } from './CutawayContext';
import { BUBBLES_FRAG, BUBBLES_VERT } from './shaders/bubbles.glsl';
import { setUniform } from './uniforms';

/** Nombre maximal d'instances (PLAN S4-L06 : ≤ 2000). */
export const MAX_BUBBLES = 2000;

/** PRNG déterministe (mulberry32) : mêmes bulles à chaque session. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Bulles d'ébullition : un seul InstancedMesh, trajectoires hélicoïdales calculées dans le vertex
 * shader (aucune écriture CPU par frame). Densité ∝ (T − T_ébullition)⁺, vitesse angulaire ∝ rpm.
 */
export function BubbleParticles({
  geometry: g,
  count = MAX_BUBBLES,
}: {
  geometry: ReactorGeometry;
  count?: number;
}) {
  const { uniforms: wedge } = useCutaway();

  const geom = useMemo(() => {
    const ico = new IcosahedronGeometry(1, 0);
    const rnd = seeded(0xb0b);
    const seeds = new Float32Array(MAX_BUBBLES * 4);
    for (let i = 0; i < MAX_BUBBLES; i++) {
      seeds[i * 4] = rnd();
      seeds[i * 4 + 1] = rnd();
      seeds[i * 4 + 2] = rnd();
      seeds[i * 4 + 3] = (i + 0.5) / MAX_BUBBLES; // seuil de densité : activation progressive et uniforme
    }
    ico.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 4));
    return ico;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: BUBBLES_VERT,
        fragmentShader: BUBBLES_FRAG,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uWedgeStart: wedge.uWedgeStart,
          uWedgeEnd: wedge.uWedgeEnd,
          uTime: { value: 0 },
          uDensity: { value: 0 },
          uBottom: { value: 0.04 * g.shellHeight },
          uTop: { value: g.liquidHeight },
          uRadius: { value: g.tankRadius - g.baffleWallGap - g.baffleWidth },
          uRpm: { value: 120 },
          uSize: { value: g.tankDiameter * 0.007 },
        },
      }),
    [wedge, g],
  );
  useLayoutEffect(
    () => () => {
      geom.dispose();
      material.dispose();
    },
    [geom, material],
  );

  useFrame(({ clock }) => {
    const s = simRef.current;
    setUniform(material, 'uTime', clock.elapsedTime);
    setUniform(material, 'uDensity', bubbleDensity(s[SNAPSHOT_LAYOUT.T] as number));
    setUniform(material, 'uRpm', s[SNAPSHOT_LAYOUT.rpm] as number);
  });

  return (
    <instancedMesh
      args={[geom, material, MAX_BUBBLES]}
      count={count}
      frustumCulled={false}
      renderOrder={3}
      name="Bubbles"
      ref={(mesh: InstancedMesh | null) => {
        if (mesh) mesh.count = Math.min(count, MAX_BUBBLES);
      }}
    />
  );
}
