'use client';

import { Component, useLayoutEffect, type ErrorInfo, type ReactNode } from 'react';
import { useGLTF } from '@react-three/drei';
import { Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three';
import type { ReactorGeometry } from '@/simulation/geometry';
import { nozzleLayout } from '@/simulation/geometry';
import { sceneAnchors } from './sceneAnchors';

export const DETAILS_URL = '/models/reactor-details.glb';
const DRACO_PATH = '/draco/gltf/';

/** Pièces détaillées modélisées sous Blender (moteur, brides, buses, tuyauterie, soupape, jambes). */
function GltfDetails() {
  const { scene } = useGLTF(DETAILS_URL, DRACO_PATH);
  useLayoutEffect(() => {
    sceneAnchors.clear();
    scene.updateMatrixWorld(true);
    scene.traverse((o: Object3D) => {
      if (o instanceof Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        const m = o.material as MeshStandardMaterial;
        if (m && 'envMapIntensity' in m) m.envMapIntensity = 1.0;
      }
      if (o.name.startsWith('Anchor_')) {
        sceneAnchors.set(o.name, o.getWorldPosition(new Vector3()));
      }
    });
  }, [scene]);
  return <primitive object={scene} name="ReactorDetails" />;
}

/** Repli procédural minimal si le .glb est indisponible (ADR-003). */
function ProceduralDetails({ geometry: g }: { geometry: ReactorGeometry }) {
  const top = g.shellHeight + g.headDepth;
  const relief = nozzleLayout(g).find((n) => n.id === 'reliefValve');
  useLayoutEffect(() => {
    if (relief) {
      sceneAnchors.set(
        'Anchor_ReliefOutlet',
        new Vector3(relief.position[0], relief.position[1] + relief.length * 3, relief.position[2]),
      );
    }
  }, [relief]);
  return (
    <group name="ReactorDetailsFallback">
      <mesh position={[0, top + g.motorHeight / 2, 0]} castShadow>
        <cylinderGeometry args={[g.motorRadius * 0.75, g.motorRadius * 0.75, g.motorHeight, 32]} />
        <meshStandardMaterial color="#0b2a85" metalness={0.2} roughness={0.4} />
      </mesh>
      {relief && (
        <mesh
          position={[
            relief.position[0],
            relief.position[1] + relief.length * 1.5,
            relief.position[2],
          ]}
          castShadow
        >
          <cylinderGeometry args={[relief.radius, relief.radius, relief.length * 3, 24]} />
          <meshStandardMaterial color="#b50b0b" metalness={0.2} roughness={0.45} />
        </mesh>
      )}
      {[0, 1, 2, 3].map((i) => {
        const a = Math.PI / 4 + (i * Math.PI) / 2;
        const r = g.jacketOuterRadius + g.tankDiameter * 0.03;
        const h = -g.floorY - 0.02;
        return (
          <mesh key={i} position={[r * Math.sin(a), g.floorY + h / 2, r * Math.cos(a)]} castShadow>
            <boxGeometry args={[0.04, h, 0.04]} />
            <meshStandardMaterial color="#3a3f45" metalness={0.6} roughness={0.55} />
          </mesh>
        );
      })}
    </group>
  );
}

class DetailsBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }
  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.warn(
      '[ReactorDetails] chargement du .glb impossible, repli procédural :',
      error.message,
      info.componentStack,
    );
  }
  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function ReactorDetails({ geometry }: { geometry: ReactorGeometry }) {
  return (
    <DetailsBoundary fallback={<ProceduralDetails geometry={geometry} />}>
      <GltfDetails />
    </DetailsBoundary>
  );
}

useGLTF.preload(DETAILS_URL, DRACO_PATH);
