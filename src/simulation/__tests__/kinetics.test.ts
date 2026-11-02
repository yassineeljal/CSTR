import { describe, expect, it } from 'vitest';
import { WATER_CRITICAL_TEMP_K } from '../constants';
import { antoineWaterPa, arrhenius, damkohler, heatTransferUA, reynoldsStirred } from '../kinetics';
import { SEBORG_PARAMS as P } from '../presets/seborgBenchmark';

describe('arrhenius', () => {
  it('donne k(350 K) ≈ 1/60 s⁻¹ (±1 %) pour le benchmark', () => {
    expect(arrhenius(350, P.k0PerS, P.eaOverRK)).toBeCloseTo(1 / 60, 3);
    expect(Math.abs(arrhenius(350, P.k0PerS, P.eaOverRK) * 60 - 1)).toBeLessThan(0.01);
  });
  it('est strictement croissante en T', () => {
    expect(arrhenius(360, P.k0PerS, P.eaOverRK)).toBeGreaterThan(
      arrhenius(350, P.k0PerS, P.eaOverRK),
    );
  });
  it('retourne 0 pour T ≤ 0 (pas de division par zéro)', () => {
    expect(arrhenius(0, P.k0PerS, P.eaOverRK)).toBe(0);
    expect(arrhenius(-5, P.k0PerS, P.eaOverRK)).toBe(0);
  });
  it('vérifie la loi : k(T2)/k(T1) = exp(Ea/R·(1/T1 − 1/T2))', () => {
    const ratio = arrhenius(380, 1, P.eaOverRK) / arrhenius(350, 1, P.eaOverRK);
    expect(ratio).toBeCloseTo(Math.exp(P.eaOverRK * (1 / 350 - 1 / 380)), 10);
  });
});

describe('heatTransferUA', () => {
  it('vaut UA_ref à N = N_ref, paroi propre', () => {
    expect(heatTransferUA(P.rpmRef, 1, P)).toBeCloseTo(P.uaRefWK, 10);
  });
  it('suit N^(2/3)', () => {
    expect(heatTransferUA(P.rpmRef / 2, 1, P) / P.uaRefWK).toBeCloseTo(Math.pow(0.5, 2 / 3), 10);
  });
  it('ne tombe jamais sous UA_min, même à N = 0 ou N < 0', () => {
    expect(heatTransferUA(0, 1, P)).toBeCloseTo(P.uaMinWK, 10);
    expect(heatTransferUA(-10, 1, P)).toBeCloseTo(P.uaMinWK, 10);
    expect(heatTransferUA(0, 1, P)).toBeGreaterThan(0);
  });
  it("est proportionnel au facteur d'encrassement", () => {
    expect(heatTransferUA(P.rpmRef, 0.4, P)).toBeCloseTo(0.4 * P.uaRefWK, 10);
  });
});

describe('antoineWaterPa', () => {
  it('vaut ≈ 101,3 kPa à 100 °C', () => {
    expect(antoineWaterPa(373.15)).toBeGreaterThan(101325 * 0.995);
    expect(antoineWaterPa(373.15)).toBeLessThan(101325 * 1.01);
  });
  it('vaut ≈ 3,17 kPa à 25 °C (table)', () => {
    expect(antoineWaterPa(298.15)).toBeCloseTo(3170, -2);
  });
  it('vaut ≈ 4,76 bar à 150 °C (table vapeur : 4,758 bar)', () => {
    expect(antoineWaterPa(423.15) / 1e5).toBeGreaterThan(4.7);
    expect(antoineWaterPa(423.15) / 1e5).toBeLessThan(4.85);
  });
  it('est quasi continue à la bascule des plages (< 1 %)', () => {
    const below = antoineWaterPa(373.15 - 1e-9);
    const above = antoineWaterPa(373.15 + 1e-9);
    expect(Math.abs(above - below) / below).toBeLessThan(0.01);
  });
  it('est croissante et bornée à la température critique', () => {
    expect(antoineWaterPa(450)).toBeGreaterThan(antoineWaterPa(400));
    expect(antoineWaterPa(1000)).toBe(antoineWaterPa(WATER_CRITICAL_TEMP_K));
  });
});

describe('nombres adimensionnels', () => {
  it('Damköhler vaut ≈ 1 au point nominal (k·τ = 1/60 · 60)', () => {
    expect(damkohler(350, P)).toBeCloseTo(1, 1);
  });
  it("tient compte de l'inhibiteur", () => {
    expect(damkohler(350, P, 0.05)).toBeCloseTo(0.05 * damkohler(350, P), 10);
  });
  it('Reynolds : Re = ρ N D² / μ', () => {
    // 1000 kg/m³, 2 tr/s, D = 0,1 m, 1e-3 Pa·s ⇒ 1000·2·0,01/1e-3 = 20 000
    expect(reynoldsStirred(1000, 120, 0.1, 1e-3)).toBeCloseTo(20000, 6);
    expect(reynoldsStirred(1000, -5, 0.1, 1e-3)).toBe(0);
  });
});
