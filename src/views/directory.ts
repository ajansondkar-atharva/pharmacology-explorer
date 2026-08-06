/* Drug Directory — filterable, searchable index of every monograph.
   Filters: system, class, route, text. Hash param `class:<id>` deep-links. */

import { el, $$, ICONS } from '../lib/dom';
import { registerView, navigate } from '../lib/router';
import { MONOGRAPHS, uniqueClasses } from '../lib/catalog';
import { SYSTEMS, ROUTE_LABELS, type SystemKey } from '../lib/types';
import { sectionHead, badgeFor, emptyState } from './components';

interface Filters {
  sys: string;
  classId: string;
  route: string;
  text: string;
}

const PAGE = 120;

export function register(): void {
  registerView('directory', 'Drug Directory', (root, param) => {
    root.appendChild(sectionHead(
      'Encyclopedia index',
      'Drug Directory',
      `${MONOGRAPHS.length} structured monographs — filter by therapeutic system, drug class, or route. Click a row to open the full monograph.`
    ));

    const filters: Filters = { sys: '', classId: '', route: '', text: '' };
    if (param?.startsWith('class:')) filters.classId = param.slice(6);

    const chipRow = el('div', { class: 'chip-row', style: 'margin-bottom:14px' });
    chipRow.appendChild(el('button', { class: 'chip active', 'data-sys': '' }, 'All systems'));
    (Object.keys(SYSTEMS) as SystemKey[]).forEach((key) => {
      const chip = el('button', { class: 'chip', 'data-sys': key }, SYSTEMS[key].label);
      chip.addEventListener('click', () => {
        filters.sys = key;
        refreshChips();
        renderGrid();
      });
      chipRow.appendChild(chip);
    });

    const classes = uniqueClasses();
    const classSel = el('select', { class: 'filter-select', 'aria-label': 'Filter by drug class' },
      el('option', { value: '' }, 'All classes'),
      ...classes.map((c) => el('option', { value: c.classId }, `${c.label} (${c.count})`))) as HTMLSelectElement;
    const routeSel = el('select', { class: 'filter-select', 'aria-label': 'Filter by route' },
      el('option', { value: '' }, 'All routes'),
      ...Object.entries(ROUTE_LABELS).map(([k, v]) => el('option', { value: k }, v))) as HTMLSelectElement;
    const textInput = el('input', {
      class: 'search-input', style: 'max-width:280px', placeholder: 'Filter by name…',
      'aria-label': 'Filter directory by name',
    }) as HTMLInputElement;

    const filterBar = el('div', { class: 'filters' }, classSel, routeSel, textInput);
    root.appendChild(chipRow);
    root.appendChild(filterBar);

    const gridWrap = el('div', {});
    root.appendChild(gridWrap);

    const refreshChips = () => {
      $$('.chip', chipRow).forEach((c) => c.classList.toggle('active', (c.dataset.sys ?? '') === filters.sys));
    };
    if (filters.classId) {
      classSel.value = filters.classId;
      refreshChips();
    }

    let shown = PAGE;
    const renderGrid = () => {
      const q = filters.text.toLowerCase().trim();
      let list = MONOGRAPHS;
      if (filters.sys) list = list.filter((m) => m.systems.includes(filters.sys as SystemKey));
      if (filters.classId) list = list.filter((m) => m.classId === filters.classId);
      if (filters.route) list = list.filter((m) => m.pharmacokinetics?.routes?.includes(filters.route));
      if (q) {
        list = list.filter((m) =>
          m.name.toLowerCase().includes(q) ||
          (m.class ?? '').toLowerCase().includes(q) ||
          (m.brandNames ?? []).some((b) => b.toLowerCase().includes(q)) ||
          (m.identifiers?.atc ?? []).some((a) => a.toLowerCase().includes(q)));
      }
      gridWrap.innerHTML = '';
      if (!list.length) {
        gridWrap.appendChild(emptyState(ICONS.search, 'No monographs match these filters'));
        return;
      }
      const slice = list.slice(0, shown);
      const grid = el('div', { class: 'directory-grid' });
      slice.forEach((m) => {
        const row = el('div', {
          class: 'dir-row',
          tabindex: '0',
          role: 'button',
          'aria-label': `Open monograph for ${m.name}`,
        },
          el('div', { style: 'display:flex;align-items:center;gap:8px;justify-content:space-between' },
            el('div', { class: 'dr-name' }, m.name),
            badgeFor(m.systems[0])),
          el('div', { class: 'dr-class' }, m.class ?? ''),
          m.summary ? el('div', { style: 'font-size:12px;color:var(--text-muted);line-height:1.45;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden' }, m.summary) : null);
        const open = () => navigate('monograph', m.id);
        row.addEventListener('click', open);
        row.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
        grid.appendChild(row);
      });
      gridWrap.appendChild(grid);
      if (list.length > shown) {
        const more = el('button', { class: 'btn btn-ghost', style: 'margin:16px auto 0;display:flex' },
          `Show ${Math.min(PAGE, list.length - shown)} more (${list.length - shown} remaining)`);
        more.addEventListener('click', () => {
          shown += PAGE;
          renderGrid();
        });
        gridWrap.appendChild(more);
      }
      gridWrap.appendChild(el('div', { style: 'margin-top:14px;font-size:12px;color:var(--text-faint);font-family:var(--font-mono)' },
        `${list.length} results`));
    };

    classSel.addEventListener('change', () => { filters.classId = classSel.value; renderGrid(); });
    routeSel.addEventListener('change', () => { filters.route = routeSel.value; renderGrid(); });
    textInput.addEventListener('input', () => { filters.text = textInput.value; shown = PAGE; renderGrid(); });

    renderGrid();
  });
}
