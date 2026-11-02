/** Découpe en coin pour les ShaderMaterial : mêmes uniforms que `applyWedgeClip`. */
export const WEDGE_UNIFORMS_GLSL = /* glsl */ `
uniform float uWedgeStart;
uniform float uWedgeEnd;
`;

/** À insérer au début de main() du fragment shader (`vWedgePos` = position objet). */
export const WEDGE_DISCARD_GLSL = /* glsl */ `
  float wedgeAngle = atan(vWedgePos.x, vWedgePos.z);
  if (wedgeAngle < 0.0) wedgeAngle += 6.28318530718;
  if (wedgeAngle > uWedgeStart && wedgeAngle < uWedgeEnd) discard;
`;
