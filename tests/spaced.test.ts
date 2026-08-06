import { describe, it, expect } from 'vitest';
import { newCard, schedule, dueSoon, DAY } from '../src/lib/spaced';

describe('spaced repetition (SM-2 lite)', () => {
  const now = 1_000_000_000_000;

  it('new card is due immediately', () => {
    const c = newCard('omeprazole', now);
    expect(c.due).toBe(now);
    expect(c.ease).toBe(2.5);
  });

  it('rating 0 (again) resets interval and lapses', () => {
    const c = newCard('x', now);
    const next = schedule(c, 0, now);
    expect(next.lapses).toBe(1);
    expect(next.intervalDays).toBe(0);
    expect(next.ease).toBeLessThan(c.ease);
  });

  it('rating 2 (good) grows intervals and ease', () => {
    const c = newCard('x', now);
    const r1 = schedule(c, 2, now);
    expect(r1.intervalDays).toBe(1);
    const r2 = schedule(r1, 2, now);
    expect(r2.intervalDays).toBe(6);
    const r3 = schedule(r2, 2, now);
    expect(r3.intervalDays).toBeGreaterThan(6);
    expect(r3.ease).toBeGreaterThan(r1.ease);
  });

  it('dueSoon filters by horizon', () => {
    const now2 = now;
    const due = newCard('a', now2);
    const later = { ...newCard('b', now2), due: now2 + 30 * DAY };
    const out = dueSoon([due, later], now2, 1);
    expect(out.map((c) => c.drugId)).toEqual(['a']);
  });

  it('interval never schedules in the past', () => {
    const c = newCard('x', now);
    const next = schedule(c, 0, now);
    expect(next.due).toBeGreaterThan(now);
  });
});
