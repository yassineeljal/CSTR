/**
 * Pont entre la scène 3D et la couche DOM des étiquettes d'inspection : la scène écrit ici la
 * position écran de chaque ancrage (dans `useFrame`), la couche DOM la lit dans son propre rAF.
 * Tampon préalloué : aucun objet créé par frame.
 */
export const MAX_LABELS = 16;
/** Triplets (x px, y px, visible 0/1) par étiquette. */
export const labelScreen = new Float32Array(MAX_LABELS * 3);

/**
 * Convertit des coordonnées normalisées (NDC) en pixels écran.
 * @returns `true` si le point est devant la caméra et dans le cadre
 */
export function ndcToScreen(
  ndcX: number,
  ndcY: number,
  ndcZ: number,
  width: number,
  height: number,
  out: Float32Array,
  index: number,
): boolean {
  const x = (ndcX * 0.5 + 0.5) * width;
  const y = (-ndcY * 0.5 + 0.5) * height;
  const visible =
    ndcZ > -1 && ndcZ < 1 && x >= -40 && x <= width + 40 && y >= -40 && y <= height + 40;
  out[index * 3] = x;
  out[index * 3 + 1] = y;
  out[index * 3 + 2] = visible ? 1 : 0;
  return visible;
}
