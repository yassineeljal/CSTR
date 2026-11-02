'use client';

import { useLayoutEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferAttribute, BufferGeometry, PerspectiveCamera, ShaderMaterial, Vector3 } from 'three';
import { simRef } from '@/client/simRef';
import { normalizedReliefFlow } from '@/lib/visuals';
import { nozzleLayout, type ReactorGeometry } from '@/simulation/geometry';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';
import { getAnchor } from './sceneAnchors';
import { STEAM_FRAG, STEAM_VERT } from './shaders/steam.glsl';
import { setUniform, setUniformVec3 } from './uniforms';

export const MAX_STEAM = 800;
/** Débit de vapeur [kg/s] correspondant à un panache plein. */
export const FULL_PLUME_KG_S = 0.01;

/**
 * Panache de vapeur de la soupape : `Points` + sprite doux, intégralement animé sur GPU.
 * L'émission suit le débit de soupape du snapshot ; l'origine est l'ancrage `Anchor_ReliefOutlet`
 * de l'asset Blender (repli : position calculée depuis la géométrie).
 */
export function SteamParticles({
  geometry: g,
  count = MAX_STEAM,
}: {
  geometry: ReactorGeometry;
  count?: number;
}) {
  const fallback = useMemo(() => {
    const n = nozzleLayout(g).find((x) => x.id === 'reliefValve');
    return n
      ? new Vector3(n.position[0], n.position[1] + n.length * 4, n.position[2])
      : new Vector3(0, 1, 0);
  }, [g]);

  const geom = useMemo(() => {
    const geo = new BufferGeometry();
    const seeds = new Float32Array(MAX_STEAM * 4);
    let s = 0x5ea;
    const rnd = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = 0; i < MAX_STEAM; i++) {
      seeds[i * 4] = rnd();
      seeds[i * 4 + 1] = (i + 0.5) / MAX_STEAM; // seuil d'émission
      seeds[i * 4 + 2] = rnd();
      seeds[i * 4 + 3] = rnd();
    }
    geo.setAttribute('position', new BufferAttribute(new Float32Array(MAX_STEAM * 3), 3));
    geo.setAttribute('aSeed', new BufferAttribute(seeds, 4));
    geo.setDrawRange(0, count);
    return geo;
  }, [count]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: STEAM_VERT,
        fragmentShader: STEAM_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uFlow: { value: 0 },
          uOrigin: { value: new Vector3() },
          uHeight: { value: g.tankDiameter * 1.1 },
          uSpread: { value: g.tankDiameter * 0.16 },
          uPixelScale: { value: 800 },
        },
      }),
    [g.tankDiameter],
  );
  useLayoutEffect(
    () => () => {
      geom.dispose();
      material.dispose();
    },
    [geom, material],
  );

  useFrame(({ clock, camera, size }) => {
    const flow = normalizedReliefFlow(
      simRef.current[SNAPSHOT_LAYOUT.reliefFlow] as number,
      FULL_PLUME_KG_S,
    );
    setUniform(material, 'uTime', clock.elapsedTime);
    setUniform(material, 'uFlow', flow);
    setUniformVec3(material, 'uOrigin', getAnchor('Anchor_ReliefOutlet', fallback));
    if (camera instanceof PerspectiveCamera) {
      // taille en pixels d'un sprite de 1 m à 1 m de distance
      setUniform(
        material,
        'uPixelScale',
        size.height / (2 * Math.tan((camera.fov * Math.PI) / 360)),
      );
    }
  });

  return (
    <points
      geometry={geom}
      material={material}
      frustumCulled={false}
      renderOrder={4}
      name="Steam"
    />
  );
}
