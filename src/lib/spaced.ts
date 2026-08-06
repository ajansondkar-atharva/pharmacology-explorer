/* Spaced repetition — SM-2-lite scheduler. Pure functions, testable.
   Ratings: 0 = again, 1 = hard, 2 = good, 3 = easy. */

export interface RepetitionCard {
  drugId: string;
  ease: number;        // 1.3 – 2.8
  intervalDays: number;
  due: number;         // epoch ms
  reps: number;
  lapses: number;
}

export const DAY = 86_400_000;

export function newCard(drugId: string, now = Date.now()): RepetitionCard {
  return { drugId, ease: 2.5, intervalDays: 0, due: now, reps: 0, lapses: 0 };
}

export function schedule(card: RepetitionCard, rating: 0 | 1 | 2 | 3, now = Date.now()): RepetitionCard {
  const c = { ...card };
  if (rating === 0) {
    c.lapses += 1;
    c.reps = 0;
    c.intervalDays = 0;
    c.ease = Math.max(1.3, c.ease - 0.2);
  } else if (rating === 1) {
    c.intervalDays = Math.max(1, Math.round(c.intervalDays * 1.2));
    c.ease = Math.max(1.3, c.ease - 0.15);
    c.reps += 1;
  } else if (rating === 2) {
    c.intervalDays = c.reps === 0 ? 1 : c.reps === 1 ? 6 : Math.round(c.intervalDays * c.ease);
    c.ease = Math.min(2.8, c.ease + 0.05);
    c.reps += 1;
  } else {
    c.intervalDays = c.reps === 0 ? 1 : Math.round((c.reps === 1 ? 6 : c.intervalDays * c.ease) * 1.3);
    c.ease = Math.min(2.8, c.ease + 0.15);
    c.reps += 1;
  }
  c.due = now + Math.max(1, c.intervalDays) * DAY;
  return c;
}

export function dueSoon(cards: RepetitionCard[], now = Date.now(), horizonDays = 1): RepetitionCard[] {
  return cards.filter((c) => c.due <= now + horizonDays * DAY);
}
