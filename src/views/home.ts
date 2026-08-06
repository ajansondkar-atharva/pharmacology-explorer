/* Home dashboard — hero, live catalog stats, module tiles, quick actions. */

import { el, svgIcon, ICONS } from '../lib/dom';
import { registerView } from '../lib/router';
import { catalogStats, uniqueClasses } from '../lib/catalog';
import { sectionHead } from './components';
import type { ViewKey } from '../lib/router';

interface Tile {
  view: ViewKey;
  sys: string;
  title: string;
  desc: string;
  icon: string;
  size: 'lg' | 'md' | 'sm';
  flagship?: boolean;
}

const TILES: Tile[] = [
  { view: 'directory', sys: 'gi', title: 'Drug Directory', desc: 'Every monograph in the reference — filter by system, class, and route.', icon: ICONS.search, size: 'lg', flagship: true },
  { view: 'diseases', sys: 'derm', title: 'Disease Pages', desc: 'Encyclopedia pages: overview, pathophysiology, treatment logic, drug comparisons.', icon: ICONS.heart, size: 'md' },
  { view: 'guidelines', sys: 'signal', title: 'Guidelines', desc: 'Evidence-graded recommendations from major bodies — with sources.', icon: ICONS.shield, size: 'md' },
  { view: 'interactions', sys: 'signal', title: 'Interaction Checker', desc: 'Pick two agents — see the mechanism behind the warning, not just a flag.', icon: ICONS.compare, size: 'md' },
  { view: 'pk', sys: 'signal', title: 'PK Visualizer', desc: 'Absorption, steady state, dose–response, receptor occupancy — drawn as curves.', icon: ICONS.pulse, size: 'md' },
  { view: 'mechanisms', sys: 'signal', title: 'Mechanism Explorer', desc: 'From molecular target to clinical consequence.', icon: ICONS.brain, size: 'md' },
  { view: 'algorithms', sys: 'signal', title: 'Treatment Algorithms', desc: 'Guided decision logic — for study, not diagnosis.', icon: ICONS.tree, size: 'md' },
  { view: 'study', sys: 'derm', title: 'Study Mode', desc: 'Quiz, flashcards, and spaced repetition built from the monographs.', icon: ICONS.quiz, size: 'md', flagship: true },
  { view: 'saved', sys: 'gi', title: 'Saved & Compare', desc: 'Favorites, notes, recent searches, and the compare basket — persisted locally.', icon: ICONS.bookmark, size: 'md' },
];

const QUICK: Array<{ label: string; view: ViewKey; icon: string }> = [
  { label: 'Compare drugs', view: 'saved', icon: ICONS.compare },
  { label: 'Check interactions', view: 'interactions', icon: ICONS.alert },
  { label: 'Study by mechanism', view: 'mechanisms', icon: ICONS.brain },
  { label: 'Treatment pathways', view: 'algorithms', icon: ICONS.tree },
  { label: 'Disease pages', view: 'diseases', icon: ICONS.heart },
  { label: 'PK lab', view: 'pk', icon: ICONS.pulse },
];

export function register(): void {
  registerView('home', 'Dashboard', (root) => {
    const stats = catalogStats();
    const classes = uniqueClasses();

    root.appendChild(sectionHead(
      'Pharmacology encyclopedia',
      'Drug & Pharmacology Explorer',
      'An offline-first reference of structured drug monographs, interaction analysis, pharmacokinetic visualizations, and evidence-graded guidelines. Local-first: every entry works without a connection.'
    ));

    /* stat row */
    const statRow = el('div', { class: 'stat-row' },
      statTile(String(stats.drugs), 'monographs'),
      statTile(String(stats.classes), 'drug classes'),
      statTile(String(stats.mechanisms), 'mechanisms'),
      statTile(String(stats.interactions), 'interaction records'),
      statTile(String(stats.systems), 'therapeutic systems'),
      statTile(`${Math.round((stats.withPk / Math.max(1, stats.drugs)) * 100)}%`, 'with PK data'));
    root.appendChild(statRow);

    /* quick actions */
    const quick = el('div', { class: 'quick-row' });
    QUICK.forEach((q) => {
      const btn = el('button', { class: 'quick-btn' }, svgIcon(q.icon, 15), q.label);
      btn.addEventListener('click', () => import('../lib/router').then((r) => r.navigate(q.view)));
      quick.appendChild(btn);
    });
    root.appendChild(quick);

    /* bento */
    const bento = el('div', { class: 'bento', style: 'margin-top:22px' });
    TILES.forEach((t) => {
      const tile = el('div', { class: `tile tile-${t.size}` },
        el('div', { class: 'tile-icon', style: `background:rgba(62,217,197,.1);color:var(--sys-${t.sys})` }, svgIcon(t.icon, 17)),
        el('div', { class: 'tile-title' }, t.title),
        el('div', { class: 'tile-desc' }, t.desc),
        el('svg', { class: 'tile-curve', viewBox: '0 0 90 34', html: '<path d="M2 28 C 18 28, 24 6, 42 6 S 70 28, 88 28" fill="none"/>' }));
      tile.addEventListener('click', () => import('../lib/router').then((r) => r.navigate(t.view)));
      bento.appendChild(tile);
    });
    root.appendChild(bento);

    /* class snapshot */
    const topClasses = classes.slice(0, 10);
    if (topClasses.length) {
      const card = el('div', { class: 'card', style: 'margin-top:22px' },
        el('h3', { class: 'h3', style: 'margin-bottom:14px' }, 'Largest classes in the reference'),
        el('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px' },
          ...topClasses.map((c) => {
            const row = el('div', {
              class: 'dir-row',
            }, el('div', { class: 'dr-name' }, c.label), el('div', { class: 'dr-class' }, `${c.count} monographs`));
            row.addEventListener('click', () => import('../lib/router').then((r) => r.navigate('directory', `class:${c.classId}`)));
            return row;
          })));
      root.appendChild(card);
    }

    root.appendChild(el('div', { style: 'margin-top:20px' },
      disclaimer('Study reference only — not a dosing guide. Verify against current clinical guidelines and product labels.')));
  });
}

function statTile(num: string, label: string): HTMLElement {
  return el('div', { class: 'stat-tile' },
    el('div', { class: 'stat-num' }, num),
    el('div', { class: 'stat-label' }, label));
}

function disclaimer(text: string): HTMLElement {
  return el('div', { class: 'disclaimer' },
    el('div', { html: svgIcon(ICONS.alert, 17).outerHTML }),
    el('div', {}, text));
}
