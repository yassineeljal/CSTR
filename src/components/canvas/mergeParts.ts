import type { BufferGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Fusionne plusieurs géométries partageant le même matériau en une seule (1 draw call au lieu de
 * N, et autant en moins dans la passe d'ombres). Les géométries sources sont libérées.
 * @throws si les attributs sont incompatibles (position/normal/uv/index)
 */
export function mergeParts(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('mergeParts: attributs de géométrie incompatibles');
  parts.forEach((p) => p.dispose());
  return merged;
}
