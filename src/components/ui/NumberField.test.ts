import { describe, expect, it } from 'vitest';
import { clampTo, parseNumberInput } from './NumberField';

describe('parseNumberInput', () => {
  it('accepte point et virgule décimale, signe, exposant, espaces', () => {
    expect(parseNumberInput('350')).toBe(350);
    expect(parseNumberInput('0,25')).toBe(0.25);
    expect(parseNumberInput(' -12.5 ')).toBe(-12.5);
    expect(parseNumberInput('+3')).toBe(3);
    expect(parseNumberInput('1e-3')).toBe(0.001);
    expect(parseNumberInput('.5')).toBe(0.5);
    expect(parseNumberInput('1 000')).toBe(1000);
  });
  it('rejette le texte, le vide, NaN/Infinity et les formats ambigus', () => {
    for (const bad of [
      '',
      '  ',
      'abc',
      '1,2,3',
      '--1',
      '1..2',
      'NaN',
      'Infinity',
      '12px',
      '1e',
      '0x10',
    ]) {
      expect(parseNumberInput(bad), bad).toBeNull();
    }
  });
});

describe('clampTo', () => {
  it('borne aux deux extrémités', () => {
    expect(clampTo(5, 0, 10)).toBe(5);
    expect(clampTo(-1, 0, 10)).toBe(0);
    expect(clampTo(11, 0, 10)).toBe(10);
  });
});
