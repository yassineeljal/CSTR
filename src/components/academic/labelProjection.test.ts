import { describe, expect, it } from 'vitest';
import { ndcToScreen } from './labelProjection';

describe('ndcToScreen', () => {
  const out = new Float32Array(6);
  it('centre NDC → centre de l’écran, Y inversé', () => {
    expect(ndcToScreen(0, 0, 0.5, 800, 600, out, 0)).toBe(true);
    expect([out[0], out[1], out[2]]).toEqual([400, 300, 1]);
    ndcToScreen(1, 1, 0.5, 800, 600, out, 1); // coin haut-droit
    expect([out[3], out[4]]).toEqual([800, 0]);
  });
  it('masque un point derrière la caméra ou au-delà du plan lointain', () => {
    expect(ndcToScreen(0, 0, 1.2, 800, 600, out, 0)).toBe(false);
    expect(ndcToScreen(0, 0, -1.5, 800, 600, out, 0)).toBe(false);
    expect(out[2]).toBe(0);
  });
  it('masque un point nettement hors cadre, tolère une marge de 40 px', () => {
    expect(ndcToScreen(1.2, 0, 0.5, 800, 600, out, 0)).toBe(false);
    expect(ndcToScreen(1.02, 0, 0.5, 800, 600, out, 0)).toBe(true);
  });
});
