import { describe, it, expect } from 'vitest';
import {
  concOral, concIV, seriesOral, seriesMultiDose, halfLifeToKe,
  tPeak, cPeak, cAvgSS, accumulationRatio, hillEffect, receptorOccupancy,
} from '../src/lib/pk';

describe('pk math', () => {
  const p = { ka: 1.0, ke: 0.3, dose: 100, F: 0.8, Vd: 30 };

  it('concentration is zero at t=0', () => {
    expect(concOral(0, p)).toBeCloseTo(0, 5);
  });

  it('concentration peaks then decays', () => {
    const tp = tPeak(p);
    const before = concOral(tp - 0.5, p);
    const at = concOral(tp, p);
    const after = concOral(tp + 0.5, p);
    expect(at).toBeGreaterThan(before);
    expect(at).toBeGreaterThan(after);
  });

  it('cPeak is positive and finite', () => {
    const c = cPeak(p);
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(10);
  });

  it('IV bolus decays exponentially', () => {
    const ke = 0.3;
    expect(concIV(0, 300, 30, ke)).toBeCloseTo(10, 5);
    expect(concIV(1, 300, 30, ke)).toBeCloseTo(10 * Math.exp(-ke), 4);
  });

  it('half-life conversion is exact', () => {
    expect(halfLifeToKe(1)).toBeCloseTo(Math.LN2, 10);
  });

  it('multi-dose accumulates toward steady state', () => {
    const interval = 24;
    const step = 0.25;
    const s = seriesMultiDose(p, interval, 5, 120, step);
    const ptsPerInterval = interval / step;
    const firstPeak = Math.max(...s.slice(0, ptsPerInterval).map((x) => x.c));
    const lastPeak = Math.max(...s.slice(-ptsPerInterval).map((x) => x.c));
    expect(lastPeak).toBeGreaterThan(firstPeak); // accumulation across doses
  });

  it('steady-state average concentration', () => {
    const css = cAvgSS(p, 24);
    expect(css).toBeCloseTo((p.dose * p.F) / (p.Vd * p.ke * 24), 6);
  });

  it('accumulation ratio > 1 for short dosing intervals', () => {
    expect(accumulationRatio(p, 12)).toBeGreaterThan(1);
  });

  it('Hill equation: EC50 gives 0.5 effect', () => {
    expect(hillEffect(30, 30, 1)).toBeCloseTo(0.5, 6);
  });

  it('receptor occupancy: Kd gives 50%', () => {
    expect(receptorOccupancy(5, 5)).toBeCloseTo(0.5, 6);
    expect(receptorOccupancy(0, 5)).toBe(0);
  });

  it('seriesOral is monotonic shape with finite length', () => {
    const s = seriesOral(p, 24);
    expect(s.length).toBeGreaterThan(50);
    expect(s.every((pt) => pt.c >= 0)).toBe(true);
  });
});
