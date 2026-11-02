import { describe, expect, it } from 'vitest';
import { PidController } from '../pid';
import type { PidSettings } from '../types';

const BASE: PidSettings = { kp: 0.25, ki: 0.01, kd: 3, tauFilterS: 2, bias: 0.3, setpointK: 350 };
const DT = 0.1;

describe('PidController', () => {
  it('action inverse : T au-dessus de la consigne ⇒ la vanne s’ouvre davantage', () => {
    const pid = new PidController(BASE, DT);
    pid.engage(0.3, 350);
    expect(pid.update(352)).toBeGreaterThan(0.3);
    const cold = new PidController(BASE, DT);
    cold.engage(0.3, 350);
    expect(cold.update(348)).toBeLessThan(0.3);
  });

  it('(a) échelon de consigne sans coup de dérivée : la sortie ne saute que de K_p·Δ', () => {
    const pid = new PidController({ ...BASE, ki: 0 }, DT);
    pid.engage(0.3, 350);
    for (let i = 0; i < 20; i++) pid.update(350);
    const before = pid.output;
    pid.configure({ setpointK: 349 }); // Δsp = −1 K ⇒ e passe de 0 à +1
    const after = pid.update(350);
    expect(after - before).toBeCloseTo(BASE.kp * 1, 9); // pas de terme dérivé : T n'a pas bougé
  });

  it('(b) vanne saturée 30 s : l’intégrale ne croît pas (anti-windup par clamping)', () => {
    const pid = new PidController(BASE, DT);
    pid.engage(0.3, 350);
    // T très haute ⇒ sortie saturée à 1 pendant 30 s simulées
    for (let i = 0; i < 300; i++) pid.update(380);
    expect(pid.output).toBe(1);
    const integralSaturated = pid.integralState;
    for (let i = 0; i < 300; i++) pid.update(380);
    expect(pid.integralState).toBe(integralSaturated);
    // Sans clamping, l'intégrale aurait atteint e·t = 30·60 = 1800 K·s
    expect(integralSaturated).toBeLessThan(100);
  });

  it('anti-windup : reprend l’intégration quand l’erreur change de sens', () => {
    const pid = new PidController({ ...BASE, kd: 0 }, DT);
    pid.engage(0.3, 350);
    for (let i = 0; i < 100; i++) pid.update(380);
    const frozen = pid.integralState;
    pid.update(349.5); // e < 0 : sortie désaturée ⇒ l'intégrale repart (vers le bas)
    expect(pid.integralState).toBeLessThan(frozen);
  });

  it('anti-windup bas : sortie saturée à 0 ne fait pas dériver l’intégrale', () => {
    const pid = new PidController(BASE, DT);
    pid.engage(0.3, 350);
    for (let i = 0; i < 400; i++) pid.update(320);
    expect(pid.output).toBe(0);
    const i0 = pid.integralState;
    for (let i = 0; i < 400; i++) pid.update(320);
    expect(pid.integralState).toBe(i0);
  });

  it('(c) bascule Manuel→Auto sans saut : première sortie = sortie courante', () => {
    for (const u of [0, 0.3, 0.77, 1]) {
      const pid = new PidController(BASE, DT);
      pid.engage(u, 351.2);
      // même mesure ⇒ e, D identiques ⇒ la sortie reste u (à la dérivation de l'intégrale d'un pas près)
      const first = pid.update(351.2);
      expect(Math.abs(first - u)).toBeLessThan(BASE.ki * 1.2 * DT + 1e-9);
    }
  });

  it('bumpless sans intégrale (K_i = 0) : ne produit pas de NaN', () => {
    const pid = new PidController({ ...BASE, ki: 0 }, DT);
    pid.engage(0.5, 350);
    expect(Number.isFinite(pid.update(351))).toBe(true);
  });

  it('un changement de gain ne fait pas sauter la sortie (recalage de l’intégrale)', () => {
    const pid = new PidController(BASE, DT);
    pid.engage(0.3, 350);
    for (let i = 0; i < 50; i++) pid.update(351);
    const before = pid.output;
    pid.configure({ kp: 0.5, ki: 0.02 });
    const after = pid.update(351);
    expect(Math.abs(after - before)).toBeLessThan(0.02);
  });

  it('la dérivée est calculée sur la mesure et filtrée', () => {
    const pid = new PidController({ ...BASE, kp: 0, ki: 0, kd: 3, tauFilterS: 2 }, DT);
    pid.engage(0.3, 350);
    // rampe de 1 K/s : D filtrée tend vers 1 K/s ⇒ sortie → bias + 3·1
    let u = 0;
    for (let i = 1; i <= 2000; i++) u = pid.update(350 + i * DT);
    expect(u).toBe(1); // saturée : 0,3 + 3 ≥ 1
    const slow = new PidController({ ...BASE, kp: 0, ki: 0, kd: 0.1, tauFilterS: 2 }, DT);
    slow.engage(0.3, 350);
    for (let i = 1; i <= 2000; i++) u = slow.update(350 + i * DT);
    expect(u).toBeCloseTo(0.3 + 0.1 * 1, 3);
  });

  it('reset() remet l’état à zéro', () => {
    const pid = new PidController(BASE, DT);
    pid.engage(0.3, 350);
    for (let i = 0; i < 50; i++) pid.update(355);
    pid.reset();
    expect(pid.integralState).toBe(0);
    expect(pid.output).toBe(0);
  });
});
