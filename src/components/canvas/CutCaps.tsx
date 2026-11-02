'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { DoubleSide, ShapeGeometry, type Group, type Material, type Shape } from 'three';
import { mergeParts } from './mergeParts';
import { useCutaway } from './CutawayContext';

interface CutCapsProps {
  shapes: Shape[];
  material: Material;
}

/**
 * Faces de coupe (sections de paroi/fluide) aux deux bords du quartier retiré. La face A reste en
 * θ = π/2 ; la face B suit le bord mobile θ = π/2 − w. Visibles seulement quand la coupe est ouverte.
 */
export function CutCaps({ shapes, material }: CutCapsProps) {
  const { angle } = useCutaway();
  const a = useRef<Group>(null);
  const b = useRef<Group>(null);
  const geometry = useMemo(() => mergeParts(shapes.map((s) => new ShapeGeometry(s, 12))), [shapes]);
  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(() => {
    const open = angle.current > 0.01;
    if (a.current) a.current.visible = open;
    if (b.current) {
      b.current.visible = open;
      b.current.rotation.y = -angle.current;
    }
  });

  return (
    <>
      <group ref={a}>
        <mesh geometry={geometry} material={material} />
      </group>
      <group ref={b}>
        <mesh geometry={geometry} material={material} />
      </group>
    </>
  );
}

export { DoubleSide };
