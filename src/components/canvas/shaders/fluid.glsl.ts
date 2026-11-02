import { glslThermalRamp } from '@/lib/colorScale';
import { SIMPLEX_NOISE_GLSL } from './noise.glsl';
import { WEDGE_DISCARD_GLSL, WEDGE_UNIFORMS_GLSL } from './wedge.glsl';

/**
 * Fluide réactionnel (S4-L02/L03). Uniforms : uTemperature [K], uTime [s], uRpm, uBoiling [0..1],
 * uLiquidTop (hauteur de surface libre), uRadius (rayon de cuve), uVortexDepth [m], uWaveAmp [m].
 * Les sommets de la surface libre (y = uLiquidTop) sont déformés : vortex h(r) = −depth·(1 − (r/R)²)
 * + ondulation simplex dont l'amplitude croît avec l'ébullition.
 */
export const FLUID_VERT = /* glsl */ `
${SIMPLEX_NOISE_GLSL}
uniform float uTime;
uniform float uBoiling;
uniform float uLiquidTop;
uniform float uRadius;
uniform float uVortexDepth;
uniform float uWaveAmp;
varying vec3 vWedgePos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vSurface;
varying float vRadial;

float surfaceHeight(vec2 xz) {
  float r = length(xz) / uRadius;
  float vortex = -uVortexDepth * (1.0 - r * r);
  float speed = 0.6 + uBoiling * 3.2;
  float n = snoise(vec3(xz * 11.0, uTime * speed)) + 0.5 * snoise(vec3(xz * 27.0, uTime * speed * 1.7));
  float edgeFade = 1.0 - smoothstep(0.82, 1.0, r); // la vague s'éteint à la paroi
  return vortex + n * uWaveAmp * (0.12 + uBoiling) * edgeFade;
}

void main() {
  vec3 p = position;
  vSurface = step(uLiquidTop - 1e-4, p.y);
  vec3 n = normal;
  if (vSurface > 0.5) {
    const float e = 0.004;
    float h = surfaceHeight(p.xz);
    float hx = surfaceHeight(p.xz + vec2(e, 0.0));
    float hz = surfaceHeight(p.xz + vec2(0.0, e));
    p.y += h;
    n = normalize(vec3(-(hx - h) / e, 1.0, -(hz - h) / e));
  }
  vRadial = length(p.xz) / uRadius;
  vWedgePos = position;
  vec4 world = modelMatrix * vec4(p, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const FLUID_FRAG = /* glsl */ `
${glslThermalRamp()}
${WEDGE_UNIFORMS_GLSL}
uniform float uTemperature;
uniform float uTime;
uniform float uRpm;
uniform float uBoiling;
varying vec3 vWedgePos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying float vSurface;
varying float vRadial;

void main() {
  ${WEDGE_DISCARD_GLSL}
  vec3 base = thermalRamp(uTemperature);
  // léger gradient radial : le cœur (zone d'agitation) est un peu plus lumineux
  base *= mix(1.12, 0.9, vRadial);
  // surface : bandes en rotation (écoulement tangentiel ∝ rpm)
  float ang = atan(vWedgePos.x, vWedgePos.z);
  float swirl = 0.5 + 0.5 * sin(ang * 4.0 + vRadial * 14.0 - uTime * uRpm * 0.012);
  base += vSurface * swirl * 0.06 * base;

  vec3 n = normalize(vWorldNormal);
  vec3 v = normalize(cameraPosition - vWorldPos);
  float facing = abs(dot(n, v));
  float fresnel = pow(1.0 - facing, 3.0);
  // reflet spéculaire d'une source fixe (donne du volume à la surface libre)
  vec3 l = normalize(vec3(0.4, 1.0, 0.5));
  float spec = pow(max(dot(reflect(-l, n), v), 0.0), 40.0) * vSurface;

  float emission = thermalEmission(uTemperature);   // > 1 au-delà de ~400 K : déclenche le Bloom
  vec3 col = base * (0.85 + 0.35 * facing) + fresnel * vec3(0.18, 0.26, 0.34) + spec * 0.6;
  col += base * emission * 0.55;
  // écume d'ébullition : éclaircit la surface
  col = mix(col, vec3(1.0, 0.95, 0.9), vSurface * uBoiling * 0.18 * swirl);

  float alpha = clamp(mix(0.72, 0.93, fresnel) + vSurface * 0.08, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
}
`;

/**
 * Face de coupe du fluide : dégradé vertical + stries de convection lentes, même rampe thermique.
 * Distincte du corps (pas de déformation de surface libre).
 */
export const FLUID_CAP_VERT = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const FLUID_CAP_FRAG = /* glsl */ `
${SIMPLEX_NOISE_GLSL}
${glslThermalRamp()}
uniform float uTemperature;
uniform float uTime;
uniform float uLiquidTop;
uniform float uBoiling;
varying vec3 vPos;
void main() {
  vec3 base = thermalRamp(uTemperature);
  float h = clamp(vPos.y / uLiquidTop, 0.0, 1.0);
  base *= mix(0.86, 1.08, h);
  float speed = 0.25 + uBoiling * 0.9;
  float n = snoise(vec3(vPos.x * 8.0, vPos.y * 6.0, uTime * speed))
          + 0.5 * snoise(vec3(vPos.x * 19.0, vPos.y * 15.0, uTime * speed * 1.6));
  base *= 1.0 + 0.09 * n;
  base += base * thermalEmission(uTemperature) * 0.4;
  gl_FragColor = vec4(base, 0.95);
}
`;
