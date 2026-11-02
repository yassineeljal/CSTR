import { Vector3 } from 'three';

/**
 * Points d'ancrage nommés (sortie de soupape, buses, moteur…) exportés par les assets Blender
 * (`Anchor_*`). Utilisés par les particules de vapeur (S4-L07) et les étiquettes d'inspection (S6-L01).
 */
export const sceneAnchors = new Map<string, Vector3>();

/** Valeur de repli si l'asset n'est pas chargé (position calculée depuis la géométrie). */
export function getAnchor(name: string, fallback: Vector3): Vector3 {
  return sceneAnchors.get(name) ?? fallback;
}
