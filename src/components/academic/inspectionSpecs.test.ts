import katex from 'katex';
import { describe, expect, it } from 'vitest';
import { computeGeometry } from '@/simulation/geometry';
import { SNAPSHOT_LAYOUT, SNAPSHOT_SIZE } from '@/simulation/protocol';
import { inspectionLabels } from './inspectionSpecs';
import { SHEETS } from './sheets';

const g = computeGeometry(100);
const labels = inspectionLabels(g);

describe('étiquettes d’inspection', () => {
  it('couvrent cuve, enveloppe, turbine, soupape et entrée (S6-L01)', () => {
    expect(labels.map((l) => l.id).sort()).toEqual([
      'energy',
      'feed',
      'jacket',
      'matter',
      'relief',
      'turbine',
    ]);
  });

  it('chaque formule se compile avec KaTeX (strict)', () => {
    for (const l of labels) {
      expect(
        () => katex.renderToString(l.tex, { throwOnError: true, strict: 'error' }),
        l.id,
      ).not.toThrow();
    }
  });

  it('chaque étiquette renvoie vers une fiche existante', () => {
    const ids = new Set(SHEETS.map((s) => s.id));
    for (const l of labels) expect(ids.has(l.sheet), l.id).toBe(true);
  });

  it('les positions sont finies et dans une boîte raisonnable autour du réacteur', () => {
    for (const l of labels) {
      for (const c of l.position) expect(Number.isFinite(c)).toBe(true);
      expect(Math.hypot(l.position[0], l.position[2])).toBeLessThan(g.tankDiameter * 1.5);
      expect(l.position[1]).toBeGreaterThan(g.floorY);
      expect(l.position[1]).toBeLessThan(g.shellHeight + g.headDepth + g.motorHeight * 4); // l’étiquette de soupape flotte au-dessus du refoulement
    }
  });

  it('les valeurs sont formatées depuis le snapshot et jamais NaN', () => {
    const s = new Float64Array(SNAPSHOT_SIZE);
    s[SNAPSHOT_LAYOUT.CA] = 0.5;
    s[SNAPSHOT_LAYOUT.T] = 350;
    s[SNAPSHOT_LAYOUT.Tj] = 300;
    s[SNAPSHOT_LAYOUT.Qgen] = 41_667;
    s[SNAPSHOT_LAYOUT.U] = 833;
    s[SNAPSHOT_LAYOUT.pressure] = 1.43e5;
    s[SNAPSHOT_LAYOUT.Da] = 1;
    const byId = Object.fromEntries(labels.map((l) => [l.id, l.value(s)]));
    expect(byId.matter).toBe('0.500');
    expect(byId.energy).toBe('41.7');
    expect(byId.jacket).toBe('26.9');
    expect(byId.turbine).toBe('833');
    expect(byId.relief).toBe('1.43');
    expect(byId.feed).toBe('1.00');
    for (const l of labels) expect(l.value(s)).not.toMatch(/NaN/);
  });

  it('suivent un changement d’échelle du réacteur', () => {
    const big = inspectionLabels(computeGeometry(1000));
    const k = computeGeometry(1000).tankDiameter / g.tankDiameter;
    expect(big[0]!.position[1] / labels[0]!.position[1]).toBeCloseTo(k, 9);
  });
});
