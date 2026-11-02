'use client';

import { useLayoutEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, LatheGeometry, ShaderMaterial } from 'three';
import { simRef } from '@/client/simRef';
import { boilingFactor, vortexDepthM } from '@/lib/visuals';
import type { ReactorGeometry } from '@/simulation/geometry';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import { useCutaway } from './CutawayContext';
import { CutCaps } from './CutCaps';
import { fluidProfile, fluidSection } from './profiles';
import { FLUID_CAP_FRAG, FLUID_CAP_VERT, FLUID_FRAG, FLUID_VERT } from './shaders/fluid.glsl';
import { setUniform } from './uniforms';

const S = SNAPSHOT_LAYOUT;
/** Vortex de référence à N_ref [m] et borne [fraction de la hauteur de liquide]. */
const VORTEX_REF_DEPTH_RATIO = 0.05; // × hauteur de liquide, à 120 tr/min
const VORTEX_MAX_DEPTH_RATIO = 0.14;
const REF_RPM = 120;
/** Amplitude des vagues [fraction du rayon de cuve]. */
const WAVE_AMPLITUDE_RATIO = 0.05;

/**
 * Fluide réactionnel (S4-L02/L03) : couleur thermique, vortex ∝ rpm², ondulations d'ébullition,
 * émission au-delà de ~400 K (Bloom). Tous les uniforms sont mis à jour dans useFrame depuis le
 * snapshot (aucun re-rendu React).
 */
export function Fluid({ geometry: g }: { geometry: ReactorGeometry }) {
  const { uniforms: wedge } = useCutaway();

  const body = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: FLUID_VERT,
        fragmentShader: FLUID_FRAG,
        transparent: true,
        side: DoubleSide,
        depthWrite: false,
        uniforms: {
          uWedgeStart: wedge.uWedgeStart,
          uWedgeEnd: wedge.uWedgeEnd,
          uTemperature: { value: 300 },
          uTime: { value: 0 },
          uRpm: { value: REF_RPM },
          uBoiling: { value: 0 },
          uLiquidTop: { value: g.liquidHeight },
          uRadius: { value: g.tankRadius },
          uVortexDepth: { value: 0 },
          uWaveAmp: { value: WAVE_AMPLITUDE_RATIO * g.tankRadius },
        },
      }),
    [wedge, g.liquidHeight, g.tankRadius],
  );
  const cap = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: FLUID_CAP_VERT,
        fragmentShader: FLUID_CAP_FRAG,
        transparent: true,
        side: DoubleSide,
        uniforms: {
          uTemperature: { value: 300 },
          uTime: { value: 0 },
          uLiquidTop: { value: g.liquidHeight },
          uBoiling: { value: 0 },
        },
      }),
    [g.liquidHeight],
  );
  const geom = useMemo(() => new LatheGeometry(fluidProfile(g), 96), [g]);
  const section = useMemo(() => [fluidSection(g)], [g]);

  useLayoutEffect(
    () => () => {
      geom.dispose();
      body.dispose();
      cap.dispose();
    },
    [geom, body, cap],
  );

  useFrame(({ clock }) => {
    const s = simRef.current;
    const t = s[S.T] as number;
    const rpm = s[S.rpm] as number;
    setUniform(body, 'uTemperature', t);
    setUniform(body, 'uTime', clock.elapsedTime);
    setUniform(body, 'uRpm', rpm);
    setUniform(body, 'uBoiling', boilingFactor(t));
    setUniform(
      body,
      'uVortexDepth',
      vortexDepthM(
        rpm,
        REF_RPM,
        VORTEX_REF_DEPTH_RATIO * g.liquidHeight,
        VORTEX_MAX_DEPTH_RATIO * g.liquidHeight,
      ),
    );
    setUniform(cap, 'uTemperature', t);
    setUniform(cap, 'uTime', clock.elapsedTime);
    setUniform(cap, 'uBoiling', boilingFactor(t));
  });

  return (
    <group name="Fluid">
      <mesh geometry={geom} material={body} renderOrder={1} />
      <CutCaps shapes={section} material={cap} />
    </group>
  );
}
