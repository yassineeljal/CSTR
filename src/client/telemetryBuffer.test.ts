import { describe, expect, it } from 'vitest';
import { TelemetryBuffer } from './telemetryBuffer';

describe('TelemetryBuffer', () => {
  it('rejette une capacité < 2', () => {
    expect(() => new TelemetryBuffer(2, 1)).toThrow(RangeError);
  });

  it('stocke temps + séries et expose des vues contiguës', () => {
    const b = new TelemetryBuffer(3, 8);
    expect(b.size).toBe(0);
    expect(b.lastTime).toBe(Number.NEGATIVE_INFINITY);
    b.push(0, [10, 20]);
    b.push(1, [11, 21]);
    expect(Array.from(b.channel(0))).toEqual([0, 1]);
    expect(Array.from(b.channel(1))).toEqual([10, 11]);
    expect(Array.from(b.channel(2))).toEqual([20, 21]);
    expect(b.lastTime).toBe(1);
  });

  it('élimine la moitié la plus ancienne à saturation, en conservant l’ordre', () => {
    const b = new TelemetryBuffer(2, 8);
    for (let i = 0; i < 8; i++) b.push(i, [i * 10]);
    expect(b.size).toBe(8);
    b.push(8, [80]);
    expect(b.size).toBe(5);
    expect(Array.from(b.channel(0))).toEqual([4, 5, 6, 7, 8]);
    expect(Array.from(b.channel(1))).toEqual([40, 50, 60, 70, 80]);
  });

  it('ne dépasse jamais la capacité sur de longues séries', () => {
    const b = new TelemetryBuffer(2, 100);
    for (let i = 0; i < 10_000; i++) {
      b.push(i, [i]);
      expect(b.size).toBeLessThanOrEqual(100);
    }
    expect(b.lastTime).toBe(9999);
    // monotonie préservée
    const t = b.channel(0);
    for (let i = 1; i < t.length; i++) expect(t[i]!).toBeGreaterThan(t[i - 1]!);
  });

  it('window() renvoie les N dernières secondes (recherche dichotomique)', () => {
    const b = new TelemetryBuffer(2, 1000);
    for (let i = 0; i <= 200; i++) b.push(i * 0.5, [i]); // 0 … 100 s
    const w = b.window(1, 10);
    expect(w.length).toBe(21); // t ∈ [90, 100] à 0,5 s
    expect(w[0]).toBe(180);
    expect(w.at(-1)).toBe(200);
    expect(b.lowerBound(1000)).toBe(b.size);
    expect(b.lowerBound(-5)).toBe(0);
  });

  it('window() sur un tampon vide est vide', () => {
    expect(new TelemetryBuffer(2, 4).window(1, 10).length).toBe(0);
  });

  it('clear() vide le tampon', () => {
    const b = new TelemetryBuffer(2, 4);
    b.push(0, [1]);
    b.clear();
    expect(b.size).toBe(0);
  });

  it('les vues partagent la mémoire (aucune copie)', () => {
    const b = new TelemetryBuffer(2, 16);
    b.push(0, [1]);
    const v1 = b.channel(1);
    const v2 = b.channel(1);
    expect(v1.buffer).toBe(v2.buffer);
  });
});
