/* Disease pages — encyclopedia entries with overview, pathophysiology,
   guidelines, and treatment tiers linking into the drug catalog. */

import { el } from '../lib/dom';
import { registerView, navigate } from '../lib/router';
import { MONO_BY_ID } from '../lib/catalog';
import { sectionHead, badgeFor, citeList, disclaimerBox, tabRow } from './components';
import type { SystemKey } from '../lib/types';

interface DiseaseGuideline {
  body: string;
  grade: string;
  rec: string;
}

interface DiseaseTier {
  tier: string;
  label: string;
  evidence: string;
  drugIds: string[];
}

interface Disease {
  id: string;
  name: string;
  system: string;
  summary: string;
  pathophysiology: string;
  diagnosis?: string;
  guidelines?: DiseaseGuideline[];
  treatmentTiers?: DiseaseTier[];
  keyDrugIds?: string[];
  refs?: Array<{ label: string; type: string; id: string }>;
  provenance?: { source: string; confidence: string; lastUpdated: string; revision: number; notes?: string };
}

const modules = import.meta.glob('../data/diseases.json', { eager: true, import: 'default' }) as Record<string, Disease[]>;
const DISEASES: Disease[] = modules['../data/diseases.json'] ?? [];

function ev(grade: string): string {
  return `ev-${grade.toUpperCase()}`;
}

export function register(): void {
  registerView('diseases', 'Diseases', (root, param) => {
    if (param) {
      const d = DISEASES.find((x) => x.id === param);
      if (d) {
        renderDetail(root, d);
        return;
      }
    }
    renderIndex(root);
  });
}

function renderIndex(root: HTMLElement): void {
  root.appendChild(sectionHead(
    'Encyclopedia',
    'Disease Pages',
    'Structured overviews of major conditions — pathophysiology, evidence-graded guideline statements, and treatment tiers linked to the drug catalog. Study material, not diagnostic guidance.'
  ));
  const grid = el('div', { class: 'directory-grid' });
  DISEASES.forEach((d) => {
    const row = el('div', { class: 'dir-row', tabindex: '0', role: 'button' },
      el('div', { style: 'display:flex;align-items:center;gap:8px;justify-content:space-between' },
        el('div', { class: 'dr-name' }, d.name),
        badgeFor(d.system as SystemKey)),
      el('div', { class: 'dr-class' }, `${d.guidelines?.length ?? 0} guideline statements · ${d.keyDrugIds?.length ?? 0} linked drugs`),
      d.summary ? el('div', { style: 'font-size:12px;color:var(--text-muted);line-height:1.45;margin-top:4px' }, d.summary) : null);
    const open = () => navigate('diseases', d.id);
    row.addEventListener('click', open);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    grid.appendChild(row);
  });
  root.appendChild(grid);
  root.appendChild(disclaimerBox('Disease pages synthesize guideline-level statements for study. They are not diagnostic criteria, treatment protocols, or a substitute for a licensed prescriber.'));
}

function renderDetail(root: HTMLElement, d: Disease): void {
  const back = el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-bottom:14px' }, '← All diseases');
  back.addEventListener('click', () => navigate('diseases'));
  root.appendChild(back);

  root.appendChild(sectionHead(
    'Disease encyclopedia',
    d.name,
    d.summary
  ));

  root.appendChild(tabRow([
    { label: 'Overview', render: () => {
      const sec = el('div', {});
      if (d.pathophysiology) {
        sec.appendChild(el('div', { class: 'mono-section' },
          el('h3', {}, 'Pathophysiology'),
          el('div', { class: 'prose' }, d.pathophysiology)));
      }
      if (d.diagnosis) {
        sec.appendChild(el('div', { class: 'mono-section' },
          el('h3', {}, 'Diagnosis'),
          el('div', { class: 'prose' }, d.diagnosis)));
      }
      if (d.keyDrugIds?.length) {
        const pills = el('div', { class: 'pill-list' });
        d.keyDrugIds.forEach((id) => {
          const m = MONO_BY_ID.get(id);
          if (!m) return;
          const p = el('span', { class: 'pill', style: 'cursor:pointer' }, m.name);
          p.addEventListener('click', () => navigate('monograph', id));
          pills.appendChild(p);
        });
        sec.appendChild(el('div', { class: 'mono-section' },
          el('h3', {}, 'Key drugs in this reference'),
          pills));
      }
      if (d.refs?.length) {
        sec.appendChild(el('div', { class: 'mono-section' }, el('h3', {}, 'References'), citeList(d.refs as never) ?? el('div', {})));
      }
      return sec;
    } },
    { label: 'Guidelines', render: () => {
      const sec = el('div', {});
      if (!d.guidelines?.length) {
        sec.appendChild(el('div', { class: 'text-faint' }, 'No guideline statements yet.'));
        return sec;
      }
      d.guidelines.forEach((g) => {
        sec.appendChild(el('div', { class: 'guideline-row' },
          el('span', { class: `ev ${ev(g.grade)}` }, g.grade),
          el('div', {}, el('span', { class: 'gl-rec' }, g.rec),
            el('div', { class: 'gl-src', style: 'margin-top:4px' }, g.body)),
          el('span', { class: 'gl-src' }, g.body)));
      });
      return sec;
    } },
    { label: 'Treatment', render: () => {
      const sec = el('div', {});
      if (!d.treatmentTiers?.length) {
        sec.appendChild(el('div', { class: 'text-faint' }, 'No treatment tiers yet.'));
        return sec;
      }
      d.treatmentTiers.forEach((t) => {
        const drugLinks = t.drugIds.map((id) => {
          const m = MONO_BY_ID.get(id);
          return m ? drugPill(m.name, id) : null;
        }).filter(Boolean);
        sec.appendChild(el('div', { class: 'guideline-row' },
          el('span', { class: `ev ${ev(t.evidence)}` }, t.evidence),
          el('div', {},
            el('div', { style: 'font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--text-faint);font-family:var(--font-mono);margin-bottom:4px' }, t.tier),
            el('div', { class: 'gl-rec' }, t.label),
            drugLinks.length ? el('div', { class: 'pill-list', style: 'margin-top:8px' }, ...drugLinks) : null),
          el('span', { class: 'gl-src' }, t.evidence)));
      });
      return sec;
    } },
  ]));

  root.appendChild(disclaimerBox('Treatment tiers are study-level summaries of guideline recommendations. Dosing, duration, and patient-specific adjustments must come from the current guideline text and the product label.'));
}

function drugPill(name: string, id: string): HTMLElement {
  const p = el('span', { class: 'pill', style: 'cursor:pointer' }, name);
  p.addEventListener('click', () => navigate('monograph', id));
  return p;
}
