'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BoxGeometry, CylinderGeometry, MeshStandardMaterial, type Group } from 'three';
import { simRef } from '@/client/simRef';
import { shaftAngularSpeedRadPerS, type ReactorGeometry } from '@/simulation/geometry';
import { SNAPSHOT_LAYOUT, STATUS_CODE } from '@/simulation/protocol';
import { mergeParts } from './mergeParts';

/**
 * Facteur de ralentissement visuel de l'arbre : à 120 tr/min la rotation réelle (2 tr/s) donne du
 * stroboscope avec 6 pales à 60 fps ; on affiche 0,5× la vitesse réelle, proportionnelle au rpm.
 */
export const AGITATOR_VISUAL_FACTOR = 0.5;

/** Arbre + turbine Rushton à 6 pales. La rotation est pilotée dans useFrame, sans re-rendu. */
export function Agitator({ geometry: g }: { geometry: ReactorGeometry }) {
  const rotor = useRef<Group>(null);
  const mat = useMemo(
    () => new MeshStandardMaterial({ color: '#c8d0d6', metalness: 1, roughness: 0.28 }),
    [],
  );

  const geometry = useMemo(() => {
    const top = g.shellHeight + g.headDepth + g.motorHeight * 0.55; // jusqu'au réducteur
    const yTurbine = g.turbineHeight;
    const hubHeight = g.bladeHeight * 0.9;
    const diskThickness = g.tankDiameter * 0.012;
    const bladeThickness = g.tankDiameter * 0.01;
    const bladeCenterRadius = g.turbineRadius - g.bladeLength / 2;
    const shaftBottom = yTurbine - hubHeight / 2;

    const shaft = new CylinderGeometry(g.shaftRadius, g.shaftRadius, top - shaftBottom, 24);
    shaft.translate(0, (top + shaftBottom) / 2, 0);
    const hub = new CylinderGeometry(g.shaftRadius * 2.4, g.shaftRadius * 2.4, hubHeight, 24);
    hub.translate(0, yTurbine, 0);
    const disk = new CylinderGeometry(g.turbineDiskRadius, g.turbineDiskRadius, diskThickness, 48);
    disk.translate(0, yTurbine, 0);
    const blades = Array.from({ length: g.bladeCount }, (_, i) => {
      const a = (i / g.bladeCount) * Math.PI * 2;
      const blade = new BoxGeometry(bladeThickness, g.bladeHeight, g.bladeLength);
      blade.rotateY(a);
      blade.translate(bladeCenterRadius * Math.sin(a), yTurbine, bladeCenterRadius * Math.cos(a));
      return blade;
    });
    // arbre + moyeu + disque + 6 pales : un seul maillage, un seul draw call
    return mergeParts([shaft, hub, disk, ...blades]);
  }, [g]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    const s = simRef.current;
    if (!rotor.current) return;
    if (s[SNAPSHOT_LAYOUT.status] === STATUS_CODE.running) {
      rotor.current.rotation.y +=
        shaftAngularSpeedRadPerS(s[SNAPSHOT_LAYOUT.rpm] as number, AGITATOR_VISUAL_FACTOR) *
        Math.min(delta, 0.1);
    }
  });

  return (
    <group name="Agitator" ref={rotor}>
      <mesh geometry={geometry} material={mat} castShadow />
    </group>
  );
}
