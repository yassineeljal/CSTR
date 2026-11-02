import { describe, expect, it } from 'vitest';
import { createWedgeUniforms, isInsideWedge } from './wedge';

describe('découpe en coin', () => {
  const quarter = (w: number): [number, number] => [Math.PI / 2 - w, Math.PI / 2];

  it('ne retire rien quand l’angle de coupe est nul', () => {
    const u = createWedgeUniforms();
    for (let a = 0; a < 2 * Math.PI; a += 0.1) {
      expect(isInsideWedge(Math.sin(a), Math.cos(a), u.uWedgeStart.value, u.uWedgeEnd.value)).toBe(
        false,
      );
    }
  });

  it('retire le quartier θ ∈ ]0, π/2[ (x > 0, z > 0) quand w = π/2', () => {
    const [s, e] = quarter(Math.PI / 2);
    expect(isInsideWedge(1, 1, s, e)).toBe(true); // θ = 45°
    expect(isInsideWedge(1, 0.01, s, e)).toBe(true);
    expect(isInsideWedge(-1, 1, s, e)).toBe(false); // θ = 315°
    expect(isInsideWedge(1, -1, s, e)).toBe(false); // θ = 135°
    expect(isInsideWedge(-1, -1, s, e)).toBe(false); // θ = 225°
  });

  it('la zone retirée croît avec l’angle de coupe, bord fixe en θ = π/2', () => {
    const half = quarter(Math.PI / 4); // θ ∈ ]π/4, π/2[
    expect(isInsideWedge(Math.sin(0.3 * Math.PI), 0, ...half)).toBe(false);
    expect(isInsideWedge(Math.sin(0.4 * Math.PI), Math.cos(0.4 * Math.PI), ...half)).toBe(true);
    expect(isInsideWedge(Math.sin(0.1 * Math.PI), Math.cos(0.1 * Math.PI), ...half)).toBe(false);
  });

  it('les angles des organes (ANGLES) restent hors du quartier retiré', async () => {
    const { ANGLES } = await import('@/simulation/geometry');
    const [s, e] = quarter(Math.PI / 2);
    for (const [name, a] of Object.entries(ANGLES)) {
      if (name === 'cutEdge') continue;
      expect(isInsideWedge(Math.sin(a), Math.cos(a), s, e), name).toBe(false);
    }
  });
});
