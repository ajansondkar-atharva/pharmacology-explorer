/* Compare engine — dynamic drug-vs-drug table from structured fields.
   Accepts a param list (`a+b+c`) or the persisted basket; shows shared
   rows; highlights divergences. */

import { el, $$, ICONS } from '../lib/dom';
import { registerView, navigate } from '../lib/router';
import { MONO_BY_ID } from '../lib/catalog';
import { sectionHead, emptyState, disclaimerBox } from './components';
import { getBasket, setBasket } from '../lib/store';
import type { Monograph } from '../lib/types';
interface CompareRow {
  label: string;
  values: string[];
}

function field(m: Monograph, pick: (m: Monograph) => string | undefined): string {
  return pick(m) ?? '—';
}

function buildRows(drugs: Monograph[]): CompareRow[] {
  const rows: CompareRow[] = [];
  const add = (label: string, pick: (m: Monograph) => string | undefined) => {
    rows.push({ label, values: drugs.map((m) => field(m, pick)) });
  };
  add('Class', (m) => m.class);
  add('Mechanism', (m) => m.mechanism);
  add('Targets', (m) => m.targets?.join(', '));
  add('Indications', (m) => m.indications?.slice(0, 3).join('; '));
  add('Onset', (m) => m.pharmacokinetics?.onset);
  add('Duration', (m) => m.pharmacokinetics?.duration);
  add('Half-life', (m) => m.pharmacokinetics?.halfLife);
  add('Bioavailability', (m) => m.pharmacokinetics?.bioavailability);
  add('Protein binding', (m) => m.pharmacokinetics?.proteinBinding);
  add('Volume of distribution', (m) => m.pharmacokinetics?.volumeOfDistribution);
  add('Metabolism', (m) => m.pharmacokinetics?.metabolism);
  add('Active metabolites', (m) => m.pharmacokinetics?.activeMetabolites?.join(', '));
  add('Elimination', (m) => m.pharmacokinetics?.elimination);
  add('Routes', (m) => m.pharmacokinetics?.routes?.join(', '));
  add('Pregnancy', (m) => m.safety?.pregnancy);
  add('Lactation', (m) => m.safety?.lactation);
  add('Black box warnings', (m) => m.safety?.blackBox?.join('; '));
  add('Structured interactions', (m) => m.interactions?.length ? String(m.interactions.length) : '—');
  add('Good for', (m) => m.good);
  add('Avoid when', (m) => m.bad);
  return rows;
}

export function register(): void {
  registerView('compare', 'Compare', (root, param) => {
    const ids = (param ?? '').split('+').filter(Boolean);
    root.appendChild(sectionHead(
      'Comparative pharmacology',
      'Compare Drugs',
      'Dynamic comparison table — every row drawn from the structured monograph fields. Values are direct transcriptions, not reinterpreted.'
    ));

    const pickerWrap = el('div', {});
    root.appendChild(pickerWrap);
    const tableWrap = el('div', { style: 'margin-top:8px' });
    root.appendChild(tableWrap);

    async function render(): Promise<void> {
      const basket = ids.length ? ids : await getBasket();
      const drugs = basket.map((id) => MONO_BY_ID.get(id)).filter((m): m is Monograph => Boolean(m));
      pickerWrap.innerHTML = '';

      /* basket management */
      const chips = el('div', { class: 'chip-row' });
      for (const d of drugs) {
        const chip = el('span', { class: 'chip active' }, `${d.name} ✕`);
        chip.addEventListener('click', async () => {
          const next = basket.filter((x) => x !== d.id);
          await setBasket(next);
          render();
        });
        chips.appendChild(chip);
      }
      if (drugs.length < 4) {
        const add = el('select', {
          class: 'filter-select', 'aria-label': 'Add drug to comparison',
        }, el('option', { value: '' }, 'Add drug…'),
          ...allDrugs()
            .filter((m) => !basket.includes(m.id))
            .slice(0, 200)
            .map((m) => el('option', { value: m.id }, m.name))) as HTMLSelectElement;
        add.addEventListener('change', async () => {
          if (!add.value) return;
          const next = [...basket, add.value].slice(0, 4);
          await setBasket(next);
          render();
        });
        chips.appendChild(add);
      }
      pickerWrap.appendChild(chips);
      if (!ids.length) {
        pickerWrap.appendChild(el('div', { style: 'margin-top:10px;font-size:12.5px;color:var(--text-faint)' },
          'Basket is persisted locally. Use ★-adjacent Compare buttons on monographs, or add from the list above.'));
      }

      tableWrap.innerHTML = '';
      if (drugs.length < 2) {
        tableWrap.appendChild(emptyState(ICONS.compare, 'Select 2–4 drugs to compare.'));
        return;
      }

      const rows = buildRows(drugs);
      const tbl = el('div', { class: 'table-wrap' });
      const table = el('table', { class: 'compare' });
      const thead = el('thead', {}, el('tr', {},
        el('th', {}, 'Field'),
        ...drugs.map((d) => el('th', {}, d.name))));
      const tbody = el('tbody', {});
      rows.forEach((row) => {
        const distinct = new Set(row.values.filter((v) => v !== '—'));
        const tr = el('tr', {});
        tr.appendChild(el('td', {}, row.label));
        row.values.forEach((v, i) => {
          const same = distinct.size <= 1;
          tr.appendChild(el('td', {
            style: same ? '' : 'color:var(--accent)',
            title: same ? '' : 'Differs across selection',
          }, v));
          void i;
        });
        tbody.appendChild(tr);
      });
      table.appendChild(thead);
      table.appendChild(tbody);
      tbl.appendChild(table);
      tableWrap.appendChild(tbl);

      tableWrap.appendChild(disclaimerBox('Comparison values are transcribed from each monograph’s structured fields. Rows highlighted in teal differ across the selected drugs.'));

      /* open-monograph links */
      const headerCells = $$('th', table).slice(1);
      headerCells.forEach((th, i) => {
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => navigate('monograph', drugs[i].id));
      });
    }

    void render();
  });
}

function allDrugs(): Monograph[] {
  return [...MONO_BY_ID.values()].sort((a, b) => a.name.localeCompare(b.name));
}
