import { describe, expect, it } from 'vitest';
import {
  QUALITY_SETTINGS,
  effectiveDpr,
  effectiveQuality,
  scaledCount,
  visibilityAction,
} from './quality';

describe('qualité adaptative', () => {
  it('la préférence explicite l’emporte, « auto » suit la mesure', () => {
    expect(effectiveQuality('auto', 'low')).toBe('low');
    expect(effectiveQuality('auto', 'high')).toBe('high');
    expect(effectiveQuality('high', 'low')).toBe('high');
    expect(effectiveQuality('low', 'high')).toBe('low');
  });
  it('le niveau bas réduit dpr, désactive le Bloom et divise les particules par 4', () => {
    expect(QUALITY_SETTINGS.low.bloom).toBe(false);
    expect(QUALITY_SETTINGS.high.bloom).toBe(true);
    expect(effectiveDpr(2, 'low')).toBe(1);
    expect(effectiveDpr(3, 'high')).toBe(2);
    expect(effectiveDpr(0.5, 'high')).toBe(1);
    expect(scaledCount(2000, 'high')).toBe(2000);
    expect(scaledCount(2000, 'low')).toBe(500);
    expect(scaledCount(1, 'low')).toBe(1);
    expect(scaledCount(0, 'low')).toBe(0);
  });
});

describe('visibilityAction (S7-L04)', () => {
  const base = { enabled: true, pausedByUs: false } as const;
  it('met en pause une simulation en cours quand l’onglet est masqué', () => {
    expect(visibilityAction({ ...base, hidden: true, status: 'running' })).toBe('pause');
  });
  it('ne touche pas une simulation déjà en pause ou terminée', () => {
    for (const status of ['ready', 'paused', 'ruptured', 'error'] as const) {
      expect(visibilityAction({ ...base, hidden: true, status })).toBe('none');
    }
  });
  it('ne relance que ce qu’elle a elle-même mis en pause, et seulement si toujours en pause', () => {
    expect(visibilityAction({ ...base, hidden: false, status: 'paused', pausedByUs: true })).toBe(
      'resume',
    );
    expect(visibilityAction({ ...base, hidden: false, status: 'paused', pausedByUs: false })).toBe(
      'none',
    );
    expect(visibilityAction({ ...base, hidden: false, status: 'running', pausedByUs: true })).toBe(
      'none',
    );
    expect(visibilityAction({ ...base, hidden: false, status: 'ruptured', pausedByUs: true })).toBe(
      'none',
    );
  });
  it('désactivée : aucune pause ; relance éventuelle d’une pause déjà posée', () => {
    expect(
      visibilityAction({ hidden: true, enabled: false, status: 'running', pausedByUs: false }),
    ).toBe('none');
    expect(
      visibilityAction({ hidden: false, enabled: false, status: 'paused', pausedByUs: true }),
    ).toBe('resume');
  });
});
