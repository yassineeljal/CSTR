import { WEDGE_DISCARD_GLSL, WEDGE_UNIFORMS_GLSL } from './wedge.glsl';

/**
 * Bulles d'ébullition (S4-L06) — InstancedMesh ≤ 2000, positions calculées sur GPU :
 * aucune mise à jour CPU par frame. aSeed = (phase, rayon relatif, vitesse relative, seuil de densité).
 * L'instance est visible si aSeed.w < uDensity (densité ∝ (T − T_ébullition)⁺).
 */
export const BUBBLES_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uDensity;
uniform float uBottom;
uniform float uTop;
uniform float uRadius;
uniform float uRpm;
uniform float uSize;
varying vec3 vWedgePos;
varying float vAlpha;
void main() {
  float visible = step(aSeed.w, uDensity);
  float t = fract(uTime * 0.22 * (0.6 + aSeed.z) + aSeed.x * 13.7);
  float y = mix(uBottom, uTop, t);
  // trajectoire hélicoïdale autour de l'arbre ; vitesse angulaire ∝ rpm
  float ang = aSeed.x * 6.28318 + t * (2.0 + uRpm * 0.03) * (0.5 + aSeed.z);
  float rad = (0.12 + 0.78 * aSeed.y) * uRadius;
  vec3 center = vec3(rad * sin(ang), y, rad * cos(ang));
  float grow = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.96, 1.0, t));
  float s = uSize * (0.5 + aSeed.z) * grow * visible;
  vWedgePos = center;
  vAlpha = 0.55 * visible;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(center + position * s, 1.0);
}
`;

export const BUBBLES_FRAG = /* glsl */ `
${WEDGE_UNIFORMS_GLSL}
varying vec3 vWedgePos;
varying float vAlpha;
void main() {
  ${WEDGE_DISCARD_GLSL}
  if (vAlpha <= 0.001) discard;
  gl_FragColor = vec4(vec3(0.92, 0.97, 1.0), vAlpha);
}
`;
