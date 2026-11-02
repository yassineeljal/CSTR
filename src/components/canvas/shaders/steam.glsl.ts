/**
 * Panache de vapeur de la soupape (S4-L07) — `Points` + sprite doux, positions sur GPU.
 * aSeed = (phase, seuil d'émission, dispersion x, dispersion z). Émission ∝ uFlow (débit de
 * soupape normalisé) : une particule vit si aSeed.y < uFlow.
 */
export const STEAM_VERT = /* glsl */ `
attribute vec4 aSeed;
uniform float uTime;
uniform float uFlow;
uniform vec3 uOrigin;
uniform float uHeight;
uniform float uSpread;
uniform float uPixelScale;
varying float vAlpha;
void main() {
  float alive = step(aSeed.y, uFlow);
  float age = fract(uTime * 0.55 * (0.7 + 0.6 * aSeed.y) + aSeed.x);
  vec3 drift = vec3((aSeed.z - 0.5) * 2.0 * uSpread * age, 0.0, (aSeed.w - 0.5) * 2.0 * uSpread * age);
  vec3 p = uOrigin + drift + vec3(0.08 * age * age, uHeight * age, 0.03 * age * age);
  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float size = mix(0.05, 0.3, age) * alive;
  gl_PointSize = size * uPixelScale / max(-mv.z, 0.05);
  vAlpha = alive * (1.0 - age) * smoothstep(0.0, 0.08, age) * 0.2;
}
`;

export const STEAM_FRAG = /* glsl */ `
varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;               // 0 au centre, 1 au bord
  float soft = exp(-d * 3.2);
  float a = soft * vAlpha;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(0.82, 0.86, 0.9), a);
}
`;
