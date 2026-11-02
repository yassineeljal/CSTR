import { describe, expect, it } from 'vitest';
import { rangeAround } from './controlRanges';

describe('rangeAround', () => {
  it('conserve la plage quand la valeur est dedans', () => {
    expect(rangeAround(5, 0, 10)).toEqual({ min: 0, max: 10 });
  });
  it('élargit la plage pour contenir une valeur hors plage (presets atypiques)', () => {
    expect(rangeAround(12, 0, 10)).toEqual({ min: 0, max: 12 });
    expect(rangeAround(-3, 0, 10)).toEqual({ min: -3, max: 10 });
  });
});
