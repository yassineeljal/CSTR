import { glslThermalRamp } from '@/lib/colorScale';
import { WEDGE_DISCARD_GLSL, WEDGE_UNIFORMS_GLSL } from './wedge.glsl';

/**
 * Film de fluide caloporteur dans l'enveloppe (S4-L04). Couleur selon T_j ; bandes verticales
 * défilant à une vitesse ∝ F_c (uFlow), figées quand la pompe est en panne (uFlow = 0).
 */
export const JACKET_VERT = /* glsl */ `
varying vec3 vWedgePos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;
void main() {
  vUv = uv;
  vWedgePos = position;
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorldPos = world.xyz;
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const JACKET_FRAG = /* glsl */ `
${glslThermalRamp()}
${WEDGE_UNIFORMS_GLSL}
uniform float uTemperature;
uniform float uFlowPhase;   // phase des bandes, intégrée côté JS (∝ F_c) : se fige quand F_c = 0
uniform float uFlow;        // débit normalisé [0..1]
varying vec3 vWedgePos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
varying vec2 vUv;

void main() {
  ${WEDGE_DISCARD_GLSL}
  vec3 base = thermalRamp(uTemperature);
  // bandes hélicoïdales : la composante verticale (v) défile avec la phase
  float band = 0.5 + 0.5 * sin(vUv.y * 55.0 + vUv.x * 12.0 - uFlowPhase);
  float stripes = mix(0.06, 0.3, uFlow) * band;      // contraste réduit quand l'eau stagne
  vec3 n = normalize(vWorldNormal);
  vec3 v = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - abs(dot(n, v)), 2.5);
  vec3 col = base * (0.7 + stripes) + fresnel * vec3(0.12, 0.2, 0.3);
  gl_FragColor = vec4(col, 0.62);
}
`;
