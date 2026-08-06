/* Guidelines — evidence-graded recommendation tables, filterable by
   issuing body and condition. */

import { el, $$ } from '../lib/dom';
import { registerView } from '../lib/router';
import { sectionHead, emptyState, disclaimerBox } from './components';

interface GuidelineRow {
  body: string;
  condition: string;
  grade: string;
  rec: string;
  source: string;
}

const modules = import.meta.glob('../data/guidelines.json', { eager: true, import: 'default' }) as Record<string, GuidelineRow[]>;
const ROWS: GuidelineRow[] = modules['../data/guidelines.json'] ?? [];

function evClass(grade: string): string {
  return `ev-${grade.toUpperCase()}`;
}

export function register(): void {
  registerView('guidelines', 'Guidelines', (root) => {
    root.appendChild(sectionHead(
      'Evidence base',
      'Clinical Guidelines',
      `${ROWS.length} evidence-graded statements from major bodies (ACG, AAD, AHA/ACC, ADA, GINA, GOLD, IDSA/ATS, WHO, ESC, NICE). Grades are transcribed from the published guideline — verify against the source text.`
    ));

    const bodies = [...new Set(ROWS.map((r) => r.body))].sort();
    const conditions = [...new Set(ROWS.map((r) => r.condition))].sort();

    const bodySel = el('select', { class: 'filter-select', 'aria-label': 'Filter by body' },
      el('option', { value: '' }, 'All bodies'),
      ...bodies.map((b) => el('option', { value: b }, b))) as HTMLSelectElement;
    const condSel = el('select', { class: 'filter-select', 'aria-label': 'Filter by condition' },
      el('option', { value: '' }, 'All conditions'),
      ...conditions.map((c) => el('option', { value: c }, c))) as HTMLSelectElement;
    const gradeSel = el('select', { class: 'filter-select', 'aria-label': 'Filter by grade' },
      el('option', { value: '' }, 'All grades'),
      ...['A', 'B', 'C', 'D'].map((g) => el('option', { value: g }, `Grade ${g}`))) as HTMLSelectElement;

    root.appendChild(el('div', { class: 'filters' }, bodySel, condSel, gradeSel));

    const listWrap = el('div', {});
    root.appendChild(listWrap);

    const render = () => {
      listWrap.innerHTML = '';
      let rows = ROWS;
      if (bodySel.value) rows = rows.filter((r) => r.body === bodySel.value);
      if (condSel.value) rows = rows.filter((r) => r.condition === condSel.value);
      if (gradeSel.value) rows = rows.filter((r) => r.grade === gradeSel.value);
      if (!rows.length) {
        listWrap.appendChild(emptyState('', 'No statements match these filters.'));
        return;
      }
      const card = el('div', { class: 'card', style: 'padding:6px 22px' });
      rows.forEach((r) => {
        card.appendChild(el('div', { class: 'guideline-row' },
          el('span', { class: `ev ${evClass(r.grade)}` }, r.grade),
          el('div', {},
            el('div', { style: 'font-size:11px;font-family:var(--font-mono);text-transform:uppercase;letter-spacing:.06em;color:var(--text-faint);margin-bottom:4px' },
              `${r.body} · ${r.condition}`),
            el('div', { class: 'gl-rec' }, r.rec)),
          el('span', { class: 'gl-src' }, r.source)));
      });
      listWrap.appendChild(card);
      listWrap.appendChild(el('div', { style: 'margin-top:12px;font-size:12px;color:var(--text-faint);font-family:var(--font-mono)' },
        `${rows.length} statements`));
    };

    [bodySel, condSel, gradeSel].forEach((s) => s.addEventListener('change', render));
    render();

    root.appendChild(disclaimerBox('Guideline statements are distilled for study. Evidence grades can differ between editions of a guideline; always cite and verify against the current full-text document before any clinical application.'));
  });
}

void $$;
