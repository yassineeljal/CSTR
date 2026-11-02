import type { ShaderMaterial, Vector3 } from 'three';

/**
 * Écriture d'un uniform scalaire. Fonction hors composant : évite que le React Compiler ne
 * considère la mutation d'un objet Three.js mémoïsé comme une violation d'immutabilité
 * (les uniforms sont mutables par conception, mis à jour dans useFrame — ADR-005).
 */
export function setUniform(material: ShaderMaterial, name: string, value: number): void {
  const u = material.uniforms[name];
  if (u) u.value = value;
}

export function setUniformVec3(material: ShaderMaterial, name: string, value: Vector3): void {
  const u = material.uniforms[name];
  if (u) (u.value as Vector3).copy(value);
}
