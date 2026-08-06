/* Pharmacokinetic math — evolved from the v1 canvas engine.
   Models: single oral dose (1-compartment, first-order absorption),
   IV bolus, multi-dose accumulation, steady-state, dose–response
   (Hill equation), receptor occupancy. Pure functions — no DOM. */

export interface PKParams {
  ka: number;   // absorption rate (/h)
  ke: number;   // elimination rate (/h) = ln(2)/t½
  dose: number; // mg
  F: number;    // bioavailability 0–1
  Vd: number;   // L
  tLag?: number; // h
}

export function halfLifeToKe(tHalf: number): number {
  return Math.LN2 / tHalf;
}

/** Concentration at time t after a single oral dose (mg/L). */
export function concOral(t: number, p: PKParams): number {
  const tt = Math.max(0, t - (p.tLag ?? 0));
  if (p.ka === p.ke) {
    // flip-flop degenerate case
    return (p.dose * p.F * p.ka * tt * Math.exp(-p.ke * tt)) / p.Vd;
  }
  return (
    (p.dose * p.F * p.ka) / (p.Vd * (p.ka - p.ke)) * (Math.exp(-p.ke * tt) - Math.exp(-p.ka * tt))
  );
}

/** Concentration after IV bolus (mg/L). */
export function concIV(t: number, dose: number, Vd: number, ke: number): number {
  return (dose / Vd) * Math.exp(-ke * t);
}

export interface SeriesPoint {
  t: number;
  c: number;
}

export function seriesOral(p: PKParams, tMax: number, step = 0.25): SeriesPoint[] {
  const pts: SeriesPoint[] = [];
  for (let t = 0; t <= tMax + 1e-9; t += step) pts.push({ t: round(t), c: round(concOral(t, p)) });
  return pts;
}

export function seriesIV(dose: number, Vd: number, ke: number, tMax: number, step = 0.25): SeriesPoint[] {
  const pts: SeriesPoint[] = [];
  for (let t = 0; t <= tMax + 1e-9; t += step) pts.push({ t: round(t), c: round(concIV(t, dose, Vd, ke)) });
  return pts;
}

/** Multi-dose accumulation to steady state. */
export function seriesMultiDose(
  p: PKParams,
  interval: number,
  numDoses: number,
  tMax: number,
  step = 0.25
): SeriesPoint[] {
  const pts: SeriesPoint[] = [];
  const doses = Math.floor(tMax / interval);
  for (let t = 0; t <= tMax + 1e-9; t += step) {
    let c = 0;
    const dosesTaken = Math.min(numDoses, Math.floor(t / interval) + 1);
    for (let d = 0; d < dosesTaken; d++) {
      c += concOral(t - d * interval, p);
    }
    pts.push({ t: round(t), c: round(c) });
  }
  void doses;
  return pts;
}

export function tPeak(p: PKParams): number {
  if (p.ka === p.ke) return 1 / p.ka;
  return Math.log(p.ka / p.ke) / (p.ka - p.ke);
}

export function cPeak(p: PKParams): number {
  return concOral(tPeak(p), p);
}

export function cAvgSS(p: PKParams, interval: number): number {
  // average concentration at steady state = AUC_tau / tau
  return (p.dose * p.F) / (p.Vd * p.ke * interval);
}

export function accumulationRatio(p: PKParams, interval: number): number {
  return 1 / (1 - Math.exp(-p.ke * interval));
}

/* ---------- pharmacodynamics ---------- */

/** Hill equation: effect fraction 0–1. */
export function hillEffect(conc: number, ec50: number, hill: number): number {
  return Math.pow(conc, hill) / (Math.pow(ec50, hill) + Math.pow(conc, hill));
}

export function receptorOccupancy(conc: number, kd: number): number {
  return conc / (kd + conc);
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}
