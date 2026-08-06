/* Study Mode — quiz, flashcards, spaced-repetition review.
   Questions are generated from monograph data; the app never
   fabricates an answer — distractors come from other monographs. */

import { el } from '../lib/dom';
import { registerView } from '../lib/router';
import { MONOGRAPHS, MONO_BY_ID } from '../lib/catalog';
import { sectionHead, disclaimerBox, tabRow, emptyState } from './components';
import { getQuizCards, setQuizCard } from '../lib/store';
import { newCard, schedule } from '../lib/spaced';
import type { Monograph } from '../lib/types';
import { toast } from '../lib/toast';

type QType = 'mechanism' | 'class' | 'halfLife' | 'indication';

interface Question {
  type: QType;
  drug: Monograph;
  prompt: string;
  options: string[];
  correct: number;
  explain: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function halfLifeNum(m: Monograph): number | null {
  const v = parseFloat(m.pharmacokinetics?.halfLife ?? '');
  return v > 0 ? v : null;
}

function generateQuestion(drug: Monograph, type: QType, pool: Monograph[]): Question | null {
  const others = pool.filter((m) => m.id !== drug.id);
  if (type === 'mechanism') {
    const correct = drug.mechanism;
    if (!correct) return null;
    const distractors = shuffle(others.filter((m) => m.mechanism && m.mechanism !== correct)).slice(0, 3)
      .map((m) => m.mechanism!);
    if (distractors.length < 3) return null;
    const options = shuffle([correct, ...distractors]);
    return {
      type, drug,
      prompt: `What is the primary mechanism of action of ${drug.name}?`,
      options,
      correct: options.indexOf(correct),
      explain: `${drug.name}: ${correct}`,
    };
  }
  if (type === 'class') {
    const correct = drug.class;
    if (!correct) return null;
    const distractors = shuffle(others.map((m) => m.class).filter((c): c is string => Boolean(c) && c !== correct)).slice(0, 3);
    if (distractors.length < 3) return null;
    const options = shuffle([correct, ...distractors]);
    return {
      type, drug,
      prompt: `Which class does ${drug.name} belong to?`,
      options,
      correct: options.indexOf(correct),
      explain: `${drug.name}: ${correct}`,
    };
  }
  if (type === 'halfLife') {
    const correct = halfLifeNum(drug);
    if (!correct) return null;
    const distractorVals = new Set<number>();
    for (const m of shuffle(others)) {
      const v = halfLifeNum(m);
      if (v && Math.abs(v - correct) > correct * 0.4) distractorVals.add(v);
      if (distractorVals.size === 3) break;
    }
    if (distractorVals.size < 3) return null;
    const opts = shuffle([correct, ...distractorVals]);
    return {
      type, drug,
      prompt: `What is the approximate plasma half-life of ${drug.name}?`,
      options: opts.map((v) => `~${v} h`),
      correct: opts.indexOf(correct),
      explain: `${drug.name}: half-life ~${correct} h.`,
    };
  }
  // indication
  const correct = drug.indications?.[0];
  if (!correct) return null;
  const distractors = shuffle(others.flatMap((m) => m.indications ?? [])).filter((i) => i !== correct).slice(0, 3);
  if (distractors.length < 3) return null;
  const options = shuffle([correct, ...distractors]);
  return {
    type, drug,
    prompt: `Which of these is a typical indication for ${drug.name}?`,
    options,
    correct: options.indexOf(correct),
    explain: `${drug.name}: ${correct}`,
  };
}

export function register(): void {
  registerView('study', 'Study Mode', (root) => {
    root.appendChild(sectionHead(
      'Active recall',
      'Study Mode',
      'Quiz, flashcards, and spaced-repetition review — every question is generated from the monograph data itself, so answers are grounded in the reference, never invented.'
    ));

    root.appendChild(tabRow([
      { label: 'Quiz', render: () => quizTab() },
      { label: 'Flashcards', render: () => flashcardTab() },
      { label: 'Review (spaced repetition)', render: () => reviewTab() },
    ]));

    root.appendChild(disclaimerBox('Study mode is a learning tool. Getting a question right or wrong has no clinical meaning — verify high-stakes facts against the product label and current guidelines.'));
  });
}

function buildPool(): Monograph[] {
  return MONOGRAPHS.filter((m) => m.mechanism || m.class || m.indications?.length);
}

function quizTab(): HTMLElement {
  const wrap = el('div', {});
  const countSel = el('select', { class: 'filter-select', 'aria-label': 'Quiz length' },
    el('option', { value: '5' }, '5 questions'),
    el('option', { value: '10', selected: true }, '10 questions'),
    el('option', { value: '15' }, '15 questions')) as HTMLSelectElement;
  const startBtn = el('button', { class: 'btn btn-primary' }, 'Start quiz');
  wrap.appendChild(el('div', { class: 'filters' }, countSel, startBtn));
  const stage = el('div', { style: 'margin-top:16px' });
  wrap.appendChild(stage);

  const pool = buildPool();
  const types: QType[] = ['mechanism', 'class', 'halfLife', 'indication'];

  startBtn.addEventListener('click', () => {
    const n = parseInt(countSel.value, 10);
    const questions: Question[] = [];
    for (const drug of shuffle(pool)) {
      const type = types[Math.floor(Math.random() * types.length)];
      const q = generateQuestion(drug, type, pool);
      if (q) questions.push(q);
      if (questions.length >= n) break;
    }
    runQuiz(stage, questions);
  });

  return wrap;
}

function runQuiz(stage: HTMLElement, questions: Question[]): void {
  let idx = 0;
  let score = 0;
  const missed = new Set<string>();

  const draw = () => {
    stage.innerHTML = '';
    if (idx >= questions.length) {
      const pct = Math.round((score / questions.length) * 100);
      stage.appendChild(el('div', { class: 'quiz-card card', style: 'text-align:center;padding:40px' },
        el('div', { class: 'h2' }, `${pct}% — ${score}/${questions.length}`),
        el('div', { class: 'text-muted', style: 'margin:10px 0 18px' },
          missed.size ? `Review these: ${[...missed].map((id) => MONO_BY_ID.get(id)?.name ?? id).join(', ')}` : 'Perfect — consider shorter intervals.'),
        el('div', { class: 'sr-btn-row' },
          el('button', { class: 'btn btn-primary', onclick: () => { void (async () => {
            for (const id of missed) {
              const card = await getQuizCards().then((cs) => cs.find((c) => c.drugId === id)) ?? newCard(id);
              await setQuizCard(schedule(card, 0));
            }
            toast(`${missed.size} missed drugs queued for spaced repetition`, 'info');
          })(); } }, missed.size ? 'Queue missed for review' : 'Restart'),
          el('button', { class: 'btn btn-ghost', onclick: () => { idx = 0; score = 0; missed.clear(); draw(); } }, 'Restart'))));
      return;
    }
    const q = questions[idx];
    const card = el('div', { class: 'quiz-card card' },
      el('div', { class: 'mono', style: 'font-size:11px;color:var(--text-faint);margin-bottom:8px' },
        `Question ${idx + 1}/${questions.length} · ${q.drug.name}`),
      el('div', { class: 'quiz-q' }, q.prompt));
    q.options.forEach((opt, i) => {
      const btn = el('button', { class: 'quiz-opt' }, opt);
      btn.addEventListener('click', () => {
        const answered = i === q.correct;
        if (answered) score++;
        else missed.add(q.drug.id);
        $$('.quiz-opt', card).forEach((b, j) => {
          b.disabled = true;
          if (j === q.correct) b.classList.add('correct');
          else if (j === i && !answered) b.classList.add('wrong');
        });
        const explain = el('div', { class: 'prose', style: 'margin-top:12px;padding:12px 14px;background:var(--surface-2);border-radius:10px;border:1px solid var(--border);font-size:13px' },
          answered ? '✓ Correct. ' : '✗ Not quite. ', q.explain);
        card.appendChild(explain);
        const next = el('button', { class: 'btn btn-primary', style: 'margin-top:14px' }, idx + 1 < questions.length ? 'Next question' : 'See results');
        next.addEventListener('click', () => { idx++; draw(); });
        card.appendChild(next);
      });
      card.appendChild(btn);
    });
    stage.appendChild(card);
  };
  draw();
}

function flashcardTab(): HTMLElement {
  const wrap = el('div', {});
  const sysSel = el('select', { class: 'filter-select', 'aria-label': 'Deck filter' },
    el('option', { value: '' }, 'All drugs'),
    el('option', { value: 'gi' }, 'Acid / GI'),
    el('option', { value: 'anti' }, 'Antimicrobial'),
    el('option', { value: 'derm' }, 'Dermatology'),
    el('option', { value: 'cardio' }, 'Cardiology'),
    el('option', { value: 'psych' }, 'Psychiatry'),
    el('option', { value: 'endo' }, 'Endocrinology'),
    el('option', { value: 'resp' }, 'Respiratory')) as HTMLSelectElement;
  const flipMode = el('select', { class: 'filter-select', 'aria-label': 'Card direction' },
    el('option', { value: 'drug-first' }, 'Drug → mechanism'),
    el('option', { value: 'mech-first' }, 'Mechanism → drug')) as HTMLSelectElement;
  wrap.appendChild(el('div', { class: 'filters' }, sysSel, flipMode));
  const stage = el('div', { style: 'margin-top:16px' });
  wrap.appendChild(stage);

  let deck: Monograph[] = [];
  let idx = 0;
  let shown = false;

  const draw = () => {
    stage.innerHTML = '';
    if (!deck.length) {
      stage.appendChild(emptyState('', 'No flashcards — every drug here needs a mechanism statement.'));
      return;
    }
    if (idx >= deck.length) {
      stage.appendChild(el('div', { style: 'text-align:center;padding:30px' },
        el('div', { class: 'h3', style: 'margin-bottom:14px' }, 'Deck complete'),
        el('button', { class: 'btn btn-primary', onclick: () => { idx = 0; shown = false; draw(); } }, 'Shuffle again')));
      return;
    }
    const drug = deck[idx];
    const mechFirst = flipMode.value === 'mech-first';
    const front = mechFirst ? (drug.mechanism ?? drug.class ?? drug.name) : drug.name;
    const back = mechFirst ? drug.name : (drug.mechanism ?? drug.class ?? '—');
    const fc = el('div', { class: 'flashcard', role: 'button', tabindex: '0' },
      el('div', {}, el('span', { class: 'fc-label' }, mechFirst ? 'Mechanism' : 'Drug'),
        el('div', {}, front),
        shown ? el('div', { style: 'margin-top:18px;color:var(--accent);font-size:14px' }, back) : el('div', { style: 'margin-top:18px;color:var(--text-faint);font-size:12px' }, 'Click to reveal')));
    fc.addEventListener('click', () => { shown = !shown; draw(); });
    fc.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); shown = !shown; draw(); }
    });
    stage.appendChild(fc);
    if (shown) {
      const row = el('div', { class: 'sr-btn-row' });
      [['Again', 0], ['Hard', 1], ['Good', 2], ['Easy', 3]].forEach(([label, rating]) => {
        const b = el('button', { class: `sr-btn sr-${rating}` }, label as string);
        b.addEventListener('click', () => {
          void (async () => {
            const existing = (await getQuizCards()).find((c) => c.drugId === drug.id);
            await setQuizCard(schedule(existing ?? newCard(drug.id), rating as 0 | 1 | 2 | 3));
          })();
          shown = false;
          idx++;
          draw();
        });
        row.appendChild(b);
      });
      stage.appendChild(row);
    }
  };

  const rebuild = () => {
    deck = shuffle(buildPool().filter((m) => !sysSel.value || m.systems.includes(sysSel.value as never)));
    idx = 0;
    shown = false;
    draw();
  };
  sysSel.addEventListener('change', rebuild);
  flipMode.addEventListener('change', rebuild);
  rebuild();
  return wrap;
}

function reviewTab(): HTMLElement {
  const wrap = el('div', {});
  const stage = el('div', { style: 'margin-top:16px' });
  wrap.appendChild(stage);

  const draw = async () => {
    stage.innerHTML = '';
    const cards = (await getQuizCards()).filter((c) => c.due <= Date.now());
    if (!cards.length) {
      stage.appendChild(el('div', { class: 'card', style: 'text-align:center;padding:30px' },
        el('div', { class: 'h3', style: 'margin-bottom:8px' }, 'Nothing due'),
        el('div', { class: 'text-muted', style: 'font-size:13px' }, 'Quiz or flashcard a drug to schedule it. Due cards appear here with SM-2 intervals.')));
      return;
    }
    const card = cards[0];
    const drug = MONO_BY_ID.get(card.drugId);
    if (!drug) return;
    const qType: QType[] = ['mechanism', 'class', 'halfLife', 'indication'];
    const q = generateQuestion(drug, qType[Math.floor(Math.random() * qType.length)], buildPool())
      ?? generateQuestion(drug, 'class', buildPool())
      ?? generateQuestion(drug, 'mechanism', buildPool());
    if (!q) return;
    const box = el('div', { class: 'quiz-card card' },
      el('div', { class: 'mono', style: 'font-size:11px;color:var(--text-faint);margin-bottom:8px' },
        `Review · ${drug.name} · due interval ${card.intervalDays}d · ease ${card.ease.toFixed(2)}`),
      el('div', { class: 'quiz-q' }, q.prompt));
    q.options.forEach((opt, i) => {
      const btn = el('button', { class: 'quiz-opt' }, opt);
      btn.addEventListener('click', () => {
        $$('.quiz-opt', box).forEach((b, j) => {
          b.disabled = true;
          if (j === q.correct) b.classList.add('correct');
          else if (j === i && i !== q.correct) b.classList.add('wrong');
        });
        box.appendChild(el('div', { class: 'prose', style: 'margin-top:12px;padding:12px 14px;background:var(--surface-2);border-radius:10px;border:1px solid var(--border);font-size:13px' }, q.explain));
        const row = el('div', { class: 'sr-btn-row' });
        [['Again', 0], ['Hard', 1], ['Good', 2], ['Easy', 3]].forEach(([label, rating]) => {
          const b = el('button', { class: `sr-btn sr-${rating}` }, label as string);
          b.addEventListener('click', () => {
            void setQuizCard(schedule(card, rating as 0 | 1 | 2 | 3));
            void draw();
          });
          row.appendChild(b);
        });
        box.appendChild(row);
      });
      box.appendChild(btn);
    });
    stage.appendChild(box);
  };
  void draw();
  return wrap;
}

function $$(sel: string, root: ParentNode): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll(sel)) as HTMLButtonElement[];
}
