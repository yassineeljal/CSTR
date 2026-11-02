import { describe, expect, it } from 'vitest';
import { computeGeometry } from '@/simulation/geometry';
import {
  fluidProfile,
  fluidSection,
  jacketCoolantSection,
  jacketRadii,
  jacketWallSections,
  lidInnerProfile,
  lidOuterProfile,
  polygonArea,
  revolvedVolume,
  vesselInnerProfile,
  vesselOuterProfile,
  vesselWallSection,
} from './profiles';

const g = computeGeometry(100);

describe('profils de révolution', () => {
  it('le profil intérieur de cuve part de l’axe (r = 0) et finit en haut de virole', () => {
    const p = vesselInnerProfile(g);
    expect(p[0]?.x).toBeCloseTo(0, 12);
    expect(p[0]?.y).toBeCloseTo(-g.headDepth, 12);
    expect(p.at(-1)?.x).toBeCloseTo(g.tankRadius, 12);
    expect(p.at(-1)?.y).toBeCloseTo(g.shellHeight, 12);
  });

  it('le profil extérieur englobe l’intérieur (épaisseur de paroi)', () => {
    const o = vesselOuterProfile(g);
    const i = vesselInnerProfile(g);
    expect(o.at(-1)!.x - i.at(-1)!.x).toBeCloseTo(g.wallThickness, 12);
    expect(o[0]!.y).toBeLessThan(i[0]!.y);
  });

  it('le couvercle va du bord (y = H) au pôle (r = 0, y = H + profondeur)', () => {
    const i = lidInnerProfile(g);
    expect(i[0]?.x).toBeCloseTo(g.tankRadius, 12);
    expect(i[0]?.y).toBeCloseTo(g.shellHeight, 12);
    expect(i.at(-1)?.x).toBeCloseTo(0, 12);
    expect(i.at(-1)?.y).toBeCloseTo(g.shellHeight + g.headDepth, 12);
    expect(lidOuterProfile(g).at(-1)!.y).toBeGreaterThan(i.at(-1)!.y);
  });

  it('le profil du fluide se termine sur l’axe à la hauteur de liquide', () => {
    const p = fluidProfile(g);
    expect(p.at(-1)?.x).toBeCloseTo(0, 12);
    expect(p.at(-1)?.y).toBeCloseTo(g.liquidHeight, 12);
  });

  it('le volume de fluide correspond au remplissage attendu (Pappus)', () => {
    // fond elliptique : (2/3)·π·R²·h ; virole remplie : π·R²·hl
    const expected =
      (2 / 3) * Math.PI * g.tankRadius ** 2 * g.headDepth +
      Math.PI * g.tankRadius ** 2 * g.liquidHeight;
    expect(revolvedVolume(fluidSection(g))).toBeCloseTo(expected, 4);
    // ≈ 80 L de virole + 21 L de fond pour D = 0,503 m
    expect(revolvedVolume(fluidSection(g)) * 1000).toBeGreaterThan(90);
    expect(revolvedVolume(fluidSection(g)) * 1000).toBeLessThan(130);
  });

  it('l’enveloppe a un espace annulaire positif et ses plaques ferment l’espace', () => {
    const r = jacketRadii(g);
    expect(r.coolantOuter).toBeGreaterThan(r.inner);
    expect(r.outer).toBeGreaterThan(r.coolantOuter);
    expect(jacketWallSections(g)).toHaveLength(3);
    const area = polygonArea(jacketCoolantSection(g).getPoints(1));
    expect(area).toBeCloseTo((r.coolantOuter - r.inner) * (g.jacketTop - g.jacketBottom), 10);
  });

  it('la section de paroi a une aire > 0 de l’ordre de t × longueur développée', () => {
    const area = polygonArea(vesselWallSection(g).getPoints(1));
    expect(area).toBeGreaterThan(g.wallThickness * g.shellHeight * 0.9);
    expect(area).toBeLessThan(g.wallThickness * (g.shellHeight + 2 * g.tankRadius) * 1.6);
  });
});
