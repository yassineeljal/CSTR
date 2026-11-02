import type { Material, WebGLProgramParametersWithUniforms } from 'three';

/**
 * Découpe en coin (quartier retiré) par `discard` dans le fragment shader, pilotée par deux
 * uniforms partagés. Permet d'animer l'angle de coupe sans reconstruire de géométrie.
 *
 * Convention d'angle : θ = atan(x, z) ∈ [0, 2π[, identique à `LatheGeometry` et à `ANGLES`.
 * Le coin retiré est ]uWedgeStart, uWedgeEnd[ ; si Start = End, rien n'est retiré.
 * Le matériau doit appartenir à un mesh dont l'axe local Y est l'axe du réacteur.
 */
export interface WedgeUniforms {
  uWedgeStart: { value: number };
  uWedgeEnd: { value: number };
}

export function createWedgeUniforms(): WedgeUniforms {
  return { uWedgeStart: { value: Math.PI / 2 }, uWedgeEnd: { value: Math.PI / 2 } };
}

/** Met à jour les uniforms pour un angle de coupe w ∈ [0, π/2] (bord fixe en θ = π/2). */
export function setWedgeAngle(uniforms: WedgeUniforms, angle: number): void {
  uniforms.uWedgeStart.value = Math.PI / 2 - angle;
  uniforms.uWedgeEnd.value = Math.PI / 2;
}

/** Injecte le test de coin dans un matériau standard Three.js. */
export function applyWedgeClip(material: Material, uniforms: WedgeUniforms): void {
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    shader.uniforms.uWedgeStart = uniforms.uWedgeStart;
    shader.uniforms.uWedgeEnd = uniforms.uWedgeEnd;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWedgePos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWedgePos = position;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWedgePos;\nuniform float uWedgeStart;\nuniform float uWedgeEnd;',
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float wedgeAngle = atan(vWedgePos.x, vWedgePos.z);
        if (wedgeAngle < 0.0) wedgeAngle += 6.28318530718;
        if (wedgeAngle > uWedgeStart && wedgeAngle < uWedgeEnd) discard;`,
      );
  };
  material.customProgramCacheKey = () => 'wedge-clip-v1';
  material.needsUpdate = true;
}

/**
 * Test CPU équivalent du shader (pour les tests unitaires) : `true` si le point est retiré.
 */
export function isInsideWedge(x: number, z: number, start: number, end: number): boolean {
  let a = Math.atan2(x, z);
  if (a < 0) a += 2 * Math.PI;
  return a > start && a < end;
}
