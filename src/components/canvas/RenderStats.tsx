'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { simRef } from '@/client/simRef';
import { SNAPSHOT_LAYOUT } from '@/simulation/protocol';

/**
 * Publie 1×/s les statistiques de rendu dans `document.documentElement.dataset` (audit de
 * performance S7-L01 et budget de draw calls en e2e). Coût négligeable.
 */
export function RenderStats() {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const id = setInterval(() => {
      const { render, memory } = gl.info;
      const d = document.documentElement.dataset;
      d.drawCalls = String(render.calls);
      d.triangles = String(render.triangles);
      d.geometries = String(memory.geometries);
      d.textures = String(memory.textures);
      // état de simulation (tests e2e et audit) : lecture seule du snapshot
      d.simTemp = (simRef.current[SNAPSHOT_LAYOUT.T] as number).toFixed(1);
      d.simTime = (simRef.current[SNAPSHOT_LAYOUT.simTime] as number).toFixed(1);
    }, 1000);
    return () => clearInterval(id);
  }, [gl]);
  return null;
}
