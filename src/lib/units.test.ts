import { describe, expect, it } from 'vitest';
import {
  barToPa,
  celsiusToKelvin,
  formatSimTime,
  fractionToPercent,
  lpmToLps,
  lpsToLpm,
  kelvinToCelsius,
  minutesToSeconds,
  molPerLToMolPerM3,
  molPerM3ToMolPerL,
  paToBar,
  rpmToRadPerS,
  secondsToMinutes,
  wattsToKilowatts,
} from './units';

describe('units', () => {
  it('K ↔ °C', () => {
    expect(kelvinToCelsius(373.15)).toBeCloseTo(100, 12);
    expect(celsiusToKelvin(kelvinToCelsius(350))).toBeCloseTo(350, 12);
  });
  it('Pa ↔ bar', () => {
    expect(paToBar(3e5)).toBe(3);
    expect(barToPa(paToBar(123456))).toBeCloseTo(123456, 9);
  });
  it('s ↔ min', () => {
    expect(secondsToMinutes(90)).toBe(1.5);
    expect(minutesToSeconds(secondsToMinutes(42))).toBeCloseTo(42, 12);
  });
  it('mol/L ↔ mol/m³', () => {
    expect(molPerLToMolPerM3(0.5)).toBe(500);
    expect(molPerM3ToMolPerL(molPerLToMolPerM3(0.37))).toBeCloseTo(0.37, 12);
  });
  it('tr/min → rad/s', () => {
    expect(rpmToRadPerS(60)).toBeCloseTo(2 * Math.PI, 12);
  });
  it('fraction → %, W → kW', () => {
    expect(fractionToPercent(0.3)).toBeCloseTo(30, 12);
    expect(wattsToKilowatts(41667)).toBeCloseTo(41.667, 9);
  });
  it('L/s ↔ L/min', () => {
    expect(lpsToLpm(100 / 60)).toBeCloseTo(100, 12);
    expect(lpmToLps(lpsToLpm(0.37))).toBeCloseTo(0.37, 12);
  });
  it('formatSimTime', () => {
    expect(formatSimTime(0)).toBe('00:00');
    expect(formatSimTime(75.9)).toBe('01:15');
    expect(formatSimTime(3600)).toBe('60:00');
    expect(formatSimTime(-5)).toBe('00:00');
  });
});
