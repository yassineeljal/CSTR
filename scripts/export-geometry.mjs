// Exporte la géométrie absolue (source : src/simulation/geometry.ts) vers tools/blender/geometry.json
// pour que les scripts Blender partagent exactement les mêmes dimensions que la scène Three.js.
// Usage : pnpm geometry:export   (Node ≥ 22.18 : exécution native de TypeScript)
import { writeFileSync } from 'node:fs';
import {
  ANGLES,
  GEOMETRY_RATIOS,
  computeGeometry,
  nozzleLayout,
} from '../src/simulation/geometry.ts';

const VOLUME_L = 100;
const geometry = computeGeometry(VOLUME_L);
const out = {
  _comment: 'Généré par scripts/export-geometry.mjs — ne pas éditer à la main.',
  volumeL: VOLUME_L,
  ratios: GEOMETRY_RATIOS,
  angles: ANGLES,
  geometry,
  nozzles: nozzleLayout(geometry),
};
writeFileSync(
  new URL('../tools/blender/geometry.json', import.meta.url),
  JSON.stringify(out, null, 2) + '\n',
);
console.log('tools/blender/geometry.json écrit');
