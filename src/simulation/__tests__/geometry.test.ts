import { describe, expect, it } from 'vitest';
import {
  GEOMETRY_RATIOS as R,
  computeGeometry,
  ellipticalHeadProfile,
  shaftAngularSpeedRadPerS,
  tankDiameterFromVolume,
} from '../geometry';

describe('géométrie de cuve standard', () => {
  const g = computeGeometry(100);

  it('H/D = 1 et V = π/4·D²·H redonne le volume demandé', () => {
    expect(g.shellHeight / g.tankDiameter).toBeCloseTo(1, 12);
    const volumeL = (Math.PI / 4) * g.tankDiameter ** 2 * g.shellHeight * 1000;
    expect(volumeL).toBeCloseTo(100, 9);
  });

  it('D ≈ 0,503 m pour 100 L', () => {
    expect(tankDiameterFromVolume(100)).toBeCloseTo(0.5031, 3);
  });

  it('turbine : D_t = D/3, garde au fond = D/3 (S3-C01)', () => {
    expect(g.turbineDiameter / g.tankDiameter).toBeCloseTo(1 / 3, 12);
    expect(g.turbineHeight / g.tankDiameter).toBeCloseTo(1 / 3, 12);
  });

  it('4 chicanes de largeur comprise entre D/12 et D/10', () => {
    expect(g.baffleCount).toBe(4);
    expect(g.baffleWidth).toBeGreaterThanOrEqual(g.tankDiameter / 12 - 1e-12);
    expect(g.baffleWidth).toBeLessThanOrEqual(g.tankDiameter / 10);
  });

  it('turbine Rushton : 6 pales, disque plus petit que la turbine', () => {
    expect(g.bladeCount).toBe(6);
    expect(g.turbineDiskRadius).toBeLessThan(g.turbineRadius);
  });

  it('les pales et la turbine tiennent dans la cuve, hors des chicanes', () => {
    const baffleInnerRadius = g.tankRadius - g.baffleWallGap - g.baffleWidth;
    expect(g.turbineRadius).toBeLessThan(baffleInnerRadius);
  });

  it('l’enveloppe entoure la cuve avec un espace annulaire positif', () => {
    expect(g.jacketInnerRadius).toBeGreaterThan(g.tankRadius);
    expect(g.jacketOuterRadius).toBeGreaterThan(g.jacketInnerRadius);
    expect(g.jacketTop).toBeGreaterThan(g.jacketBottom);
    expect(g.jacketTop).toBeLessThanOrEqual(g.shellHeight);
  });

  it('le niveau de liquide est sous le couvercle et au-dessus de la turbine', () => {
    expect(g.liquidHeight).toBeLessThan(g.shellHeight);
    expect(g.liquidHeight).toBeGreaterThan(g.turbineHeight + g.bladeHeight);
  });

  it('toutes les dimensions sont proportionnelles à D (changement d’échelle)', () => {
    const big = computeGeometry(1000);
    const k = big.tankDiameter / g.tankDiameter;
    expect(big.turbineDiameter / g.turbineDiameter).toBeCloseTo(k, 12);
    expect(big.baffleWidth / g.baffleWidth).toBeCloseTo(k, 12);
    expect(big.motorHeight / g.motorHeight).toBeCloseTo(k, 12);
  });

  it('les rapports exportés sont cohérents', () => {
    expect(R.baffleWidth).toBeCloseTo(1 / 12, 12);
    expect(R.bladeCount).toBe(6);
  });
});

describe('ellipticalHeadProfile', () => {
  const pts = ellipticalHeadProfile(0.25, 0.125, 24);
  it('va du pôle (r = 0, y = −h) au bord (r = R, y = 0)', () => {
    expect(pts[0]?.[0]).toBeCloseTo(0, 12);
    expect(pts[0]?.[1]).toBeCloseTo(-0.125, 12);
    expect(pts.at(-1)?.[0]).toBeCloseTo(0.25, 12);
    expect(pts.at(-1)?.[1]).toBeCloseTo(0, 12);
  });
  it('appartient à l’ellipse (r/R)² + (y/h)² = 1', () => {
    for (const [r, y] of pts) expect((r / 0.25) ** 2 + (y / 0.125) ** 2).toBeCloseTo(1, 12);
  });
});

describe('shaftAngularSpeedRadPerS', () => {
  it('120 tr/min = 4π rad/s', () => {
    expect(shaftAngularSpeedRadPerS(120)).toBeCloseTo(4 * Math.PI, 12);
  });
  it('applique le facteur visuel', () => {
    expect(shaftAngularSpeedRadPerS(60, 0.5)).toBeCloseTo(Math.PI, 12);
  });
});

describe('synchronisation avec les assets Blender', () => {
  it('tools/blender/geometry.json est à jour (relancer `pnpm geometry:export` sinon)', async () => {
    const { readFileSync } = await import('node:fs');
    const path = await import('node:path');
    const { nozzleLayout, ANGLES } = await import('../geometry');
    const file = path.resolve(import.meta.dirname, '../../../tools/blender/geometry.json');
    const exported = JSON.parse(readFileSync(file, 'utf8')) as {
      volumeL: number;
      geometry: Record<string, number>;
      nozzles: unknown;
      angles: Record<string, number>;
    };
    const g = computeGeometry(exported.volumeL);
    for (const [key, value] of Object.entries(g)) {
      expect(exported.geometry[key], key).toBeCloseTo(value as number, 12);
    }
    expect(exported.nozzles).toEqual(JSON.parse(JSON.stringify(nozzleLayout(g))));
    expect(exported.angles).toEqual(JSON.parse(JSON.stringify(ANGLES)));
  });
});
