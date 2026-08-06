/* Monograph view — the full drug page. Tabs: Overview, Clinical, PK,
   Safety, Interactions, References. Records visits; favorite/compare
   actions wired to the persistent store. */

import { el, svgIcon, ICONS } from '../lib/dom';
import { registerView } from '../lib/router';
import { MONO_BY_ID } from '../lib/catalog';
import type { Monograph, SystemKey } from '../lib/types';
import { citationUrl } from '../lib/citations';
import {
  badgeFor, systemBadges, kvGrid, pillList, pearlBox,
  pcbaBlock, disclaimerBox, emptyState, citeList, provenanceBlock, tabRow,
} from './components';
import {
  addVisit, getBasket, setBasket, getFavorites, toggleFavorite, getNote, setNote,
} from '../lib/store';
import { toast } from '../lib/toast';
import { drawLineChart, nextSeriesColor } from '../lib/charts';
import { seriesOral, halfLifeToKe, tPeak, cPeak } from '../lib/pk';

const SEV_CLASS: Record<string, string> = {
  contraindicated: 'sev-contraindicated',
  major: 'sev-major',
  moderate: 'sev-moderate',
  minor: 'sev-minor',
};

export function register(): void {
  registerView('monograph', 'Monograph', (root, param) => {
    const id = param ?? '';
    const m = MONO_BY_ID.get(id);
    if (!m) {
      root.appendChild(emptyState(ICONS.search, `No monograph found for “${id}”.`));
      return;
    }
    void addVisit(id);
    root.appendChild(renderMonograph(m));
  });
}

function renderMonograph(m: Monograph): HTMLElement {
  const wrap = el('div', {});

  /* ---------- header ---------- */
  const head = el('div', { class: 'mono-head' });
  const topRow = el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap' },
    el('div', { class: 'eyebrow', style: 'flex:1;min-width:200px' }, m.class ?? 'Drug monograph'),
    ...m.systems.map((s) => badgeFor(s as SystemKey)));

  const titleRow = el('div', { style: 'display:flex;align-items:baseline;gap:14px;margin-top:8px;flex-wrap:wrap' },
    el('h1', { class: 'h1', style: 'font-size:clamp(26px,3.4vw,38px)' }, m.name),
    m.brandNames?.length ? el('div', { class: 'mono' , style: 'color:var(--text-faint);font-size:13px' }, `Brands: ${m.brandNames.join(', ')}`) : null);
  head.appendChild(topRow);
  head.appendChild(titleRow);
  if (m.synonyms?.length) head.appendChild(el('div', { class: 'mono', style: 'color:var(--text-faint);font-size:12px;margin-top:6px' }, m.synonyms.join(' · ')));
  if (m.summary) head.appendChild(el('p', { class: 'mono-summary' }, m.summary));

  /* identifiers */
  const identChips: HTMLElement[] = [];
  const ids = m.identifiers;
  if (ids) {
    if (ids.atc?.length) identChips.push(...ids.atc.map((a) => identChip(`ATC ${a}`, 'https://www.whocc.no/atc_ddd_index/?code=' + a)));
    if (ids.rxnorm?.length) identChips.push(...ids.rxnorm.map((r) => identChip(`RxNorm ${r}`, 'https://rxnav.nlm.nih.gov/id/rxnorm/' + r)));
    if (ids.drugbank) identChips.push(identChip(ids.drugbank, citationUrl({ type: 'drugbank', label: 'DrugBank', id: ids.drugbank })!));
    if (ids.pubchem) identChips.push(identChip(`PubChem ${ids.pubchem}`, `https://pubchem.ncbi.nlm.nih.gov/compound/${ids.pubchem}`));
    if (ids.cas) identChips.push(identChip(`CAS ${ids.cas}`, `https://commonchemistry.cas.org/detail?cas_rn=${ids.cas}`));
    if (ids.unii) identChips.push(identChip(`UNII ${ids.unii}`, `https://fdasis.nlm.nih.gov/srs/unii/${ids.unii}`));
  }
  if (identChips.length) head.appendChild(el('div', { class: 'ident-grid', style: 'margin-top:14px' }, ...identChips));

  /* actions */
  const actions = el('div', { class: 'mono-actions' });
  const favBtn = el('button', { class: 'btn btn-ghost btn-sm', 'aria-pressed': 'false' }, svgIcon(ICONS.star, 14), 'Favorite');
  const cmpBtn = el('button', { class: 'btn btn-ghost btn-sm' }, svgIcon(ICONS.compare, 14), 'Compare');
  actions.appendChild(favBtn);
  actions.appendChild(cmpBtn);
  actions.appendChild(el('button', {
    class: 'btn btn-ghost btn-sm',
  }, svgIcon(ICONS.external, 14), 'DrugBank'));
  (actions.lastChild as HTMLElement).addEventListener('click', () => {
    const url = m.identifiers?.drugbank
      ? citationUrl({ type: 'drugbank', label: 'DrugBank', id: m.identifiers.drugbank })
      : 'https://go.drugbank.com/unearth/q?utf8=%E2%9C%93&query=' + encodeURIComponent(m.name);
    window.open(url!, '_blank', 'noopener');
  });
  head.appendChild(actions);

  /* load persisted state into action buttons */
  void (async () => {
    const favs = new Set(await getFavorites());
    if (favs.has(m.id)) favBtn.classList.add('saved');
    const basket = await getBasket();
    if (basket.includes(m.id)) {
      cmpBtn.style.borderColor = 'var(--accent)';
      cmpBtn.style.color = 'var(--accent)';
    }
  })();
  favBtn.addEventListener('click', async () => {
    const on = await toggleFavorite(m.id);
    favBtn.classList.toggle('saved', on);
    favBtn.setAttribute('aria-pressed', String(on));
    toast(on ? `Added ${m.name} to favorites` : `Removed ${m.name} from favorites`, on ? 'ok' : 'info', 1800);
  });
  cmpBtn.addEventListener('click', async () => {
    const basket = await getBasket();
    if (!basket.includes(m.id) && basket.length >= 4) {
      toast('Compare up to 4 items at a time — remove one first.', 'warn');
      return;
    }
    const next = basket.includes(m.id) ? basket.filter((x) => x !== m.id) : [...basket, m.id];
    await setBasket(next);
    const on = next.includes(m.id);
    cmpBtn.style.borderColor = on ? 'var(--accent)' : '';
    cmpBtn.style.color = on ? 'var(--accent)' : '';
    toast(on ? `Added to compare basket (${next.length}/4)` : 'Removed from basket', 'info', 1800);
  });

  wrap.appendChild(head);

  /* ---------- body ---------- */
  const layout = el('div', { class: 'mono-layout', style: 'margin-top:20px' });
  const main = el('div', {});

  main.appendChild(tabRow([
    { label: 'Overview', render: () => overviewTab(m) },
    { label: 'Clinical', render: () => clinicalTab(m) },
    { label: 'Pharmacokinetics', render: () => pkTab(m) },
    { label: 'Safety', render: () => safetyTab(m) },
    { label: 'Interactions', render: () => interactionsTab(m) },
    { label: 'References', render: () => refsTab(m) },
  ]));

  layout.appendChild(main);

  /* rail */
  const rail = el('div', { class: 'mono-rail' });
  rail.appendChild(el('div', { class: 'card', style: 'padding:16px' },
    el('div', { class: 'field-label' }, 'Systems'),
    systemBadges(m.systems as SystemKey[]),
    m.classId ? el('div', { class: 'field-label', style: 'margin-top:12px' }, 'Class key') : null,
    m.classId ? el('div', { class: 'mono', style: 'font-size:12px;color:var(--text-muted)' }, m.classId) : null,
    m.provenance ? el('div', { style: 'margin-top:14px' }, provenanceBlock(m.provenance)) : null));
  if (m.refs?.length) {
    rail.appendChild(el('div', { class: 'card', style: 'padding:16px' },
      el('div', { class: 'field-label' }, 'Key references'),
      citeList(m.refs)));
  }
  layout.appendChild(rail);
  wrap.appendChild(layout);

  /* notes */
  const noteCard = el('div', { class: 'card', style: 'margin-top:18px' },
    el('div', { class: 'field-label' }, `Your notes on ${m.name} (stored locally)`),
    el('textarea', {
      style: 'width:100%;min-height:110px;background:var(--surface-2);border:1px solid var(--border);border-radius:10px;padding:12px;color:var(--text);font-family:var(--font-body);font-size:13.5px;resize:vertical;margin-top:8px;',
      placeholder: 'Write your own notes, mnemonics, or study observations…',
    }));
  const ta = $('textarea', noteCard);
  void getNote(m.id).then((t) => { if (t) ta.value = t; });
  let noteTimer: number | undefined;
  ta.addEventListener('input', () => {
    window.clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => {
      void setNote(m.id, ta.value);
    }, 400);
  });
  wrap.appendChild(noteCard);

  wrap.appendChild(disclaimerBox('Study reference — not a dosing guide. Dosing, pregnancy, and safety statements must be verified against the current product label and clinical guidelines before clinical use.'));

  /* legacy content preserved from v1 */
  if (m.originalFields?.length) {
    const item = el('div', { class: 'accordion-item' });
    const header = el('button', { class: 'accordion-header', 'aria-expanded': 'false' },
      el('span', {}, 'Legacy v1 content (preserved verbatim)'),
      svgIcon(ICONS.chevron, 14));
    const body = el('div', { class: 'accordion-body' });
    const inner = el('div', { class: 'accordion-body-inner' });
    inner.appendChild(kvGrid(m.originalFields.map(([l, v]) => [l, v]))!);
    body.appendChild(inner);
    item.appendChild(header);
    item.appendChild(body);
    header.addEventListener('click', () => {
      const open = item.classList.toggle('open');
      header.setAttribute('aria-expanded', String(open));
    });
    wrap.appendChild(el('div', { style: 'margin-top:18px' }, item));
  }

  return wrap;
}

function identChip(label: string, href: string): HTMLElement {
  return el('a', { class: 'ident-chip', href, target: '_blank', rel: 'noopener noreferrer' }, label);
}

/* ---------- tabs ---------- */

function overviewTab(m: Monograph): HTMLElement {
  const sec = el('div', {});
  if (m.mechanism) sec.appendChild(monoSection('Mechanism of action', ICONS.brain, el('div', { class: 'prose' }, m.mechanism)));
  if (m.targets?.length) sec.appendChild(monoSection('Molecular targets', ICONS.flask, pillList(m.targets)!));
  if (m.receptorAffinity) sec.appendChild(monoSection('Receptor affinity', ICONS.flask, el('div', { class: 'prose' }, m.receptorAffinity)));
  if (m.pharmacodynamics) sec.appendChild(monoSection('Pharmacodynamics', ICONS.pulse, el('div', { class: 'prose' }, m.pharmacodynamics)));
  if (m.indications?.length) sec.appendChild(monoSection('Indications', ICONS.doc, pillList(m.indications)!));
  if (m.good || m.bad) sec.appendChild(monoSection('Positioning', ICONS.compare, pcbaBlock(m.good, m.bad)!));
  if (m.clinicalPearls?.length) {
    const pearls = el('div', {});
    m.clinicalPearls.forEach((p) => pearls.appendChild(pearlBox(p)));
    sec.appendChild(monoSection('Clinical pearls', ICONS.star, pearls));
  }
  return sec;
}

function clinicalTab(m: Monograph): HTMLElement {
  const sec = el('div', {});
  const d = m.dosing;
  if (d) {
    sec.appendChild(monoSection('Dosing', ICONS.pill,
      kvGrid([
        ['Adult', d.adult],
        ['Pediatric', d.pediatric],
        ['Geriatric', d.geriatric],
        ['Renal adjustment', d.renalAdjustment],
        ['Hepatic adjustment', d.hepaticAdjustment],
        ['Maximum dose', d.maxDose],
      ]) ?? el('div', {}, '')));
  }
  const s = m.safety;
  const clinicalRows: Array<[string, string | undefined]> = [];
  if (s?.contraindications?.length) clinicalRows.push(['Contraindications', s.contraindications.join(' · ')]);
  if (s?.warnings?.length) clinicalRows.push(['Warnings & cautions', s.warnings.join(' · ')]);
  if (clinicalRows.length) sec.appendChild(monoSection('Contraindications & warnings', ICONS.alert, kvGrid(clinicalRows)!));
  if (s?.blackBox?.length) {
    sec.appendChild(monoSection('Black box warnings', ICONS.alert,
      el('div', { style: 'border:1px solid rgba(240,135,107,.4);background:rgba(240,135,107,.07);border-radius:10px;padding:14px;' },
        ...s.blackBox.map((b) => el('div', { style: 'font-size:13px;line-height:1.55;margin-bottom:6px' }, '⚠ ' + b)))));
  }
  if (m.guidelines?.length) sec.appendChild(monoSection('Guideline context', ICONS.shield, pillList(m.guidelines)!));
  if (m.pharmacokinetics?.routes?.length) sec.appendChild(monoSection('Routes of administration', ICONS.flask, pillList(m.pharmacokinetics.routes)!));
  return sec;
}

function pkTab(m: Monograph): HTMLElement {
  const sec = el('div', {});
  const pk = m.pharmacokinetics;
  const rows: Array<[string, string | undefined]> = [
    ['Bioavailability', pk?.bioavailability],
    ['Half-life', pk?.halfLife],
    ['Protein binding', pk?.proteinBinding],
    ['Volume of distribution', pk?.volumeOfDistribution],
    ['Clearance', pk?.clearance],
    ['Onset', pk?.onset],
    ['Duration', pk?.duration],
    ['Metabolism', pk?.metabolism],
    ['Active metabolites', pk?.activeMetabolites?.join(', ')],
    ['Elimination', pk?.elimination],
  ];
  const grid = kvGrid(rows);
  if (grid) sec.appendChild(monoSection('Pharmacokinetic parameters', ICONS.clock, grid));

  /* illustrative concentration curve from real values where present */
  const halfLife = parseFloat(pk?.halfLife ?? '');
  if (halfLife > 0) {
    const ke = halfLifeToKe(halfLife);
    const F = Math.min(1, Math.max(0.05, parseFloat(pk?.bioavailability ?? '80') / 100 || 0.8));
    const Vd = Math.max(5, parseFloat(pk?.volumeOfDistribution ?? '30') || 30);
    const dose = 40;
    const p = { ka: 1.2, ke, dose, F, Vd };
    const tMax = Math.min(72, Math.max(24, halfLife * 5));
    const canvas = el('canvas', { style: 'width:100%;display:block;' }) as HTMLCanvasElement;
    const tP = tPeak(p);
    const cP = cPeak(p);
    const note = el('div', {
      class: 'text-faint', style: 'font-size:11.5px;margin-top:8px;font-family:var(--font-mono)',
    }, `Illustrative single-dose curve from monograph PK values (dose ${dose} mg, ka 1.2/h). Peak ${cP.toFixed(1)} mg/L at ${tP.toFixed(1)} h.`);
    sec.appendChild(monoSection('Concentration–time curve', ICONS.pulse, (() => {
      const wrap2 = el('div', {});
      wrap2.appendChild(canvas);
      wrap2.appendChild(note);
      requestAnimationFrame(() => {
        drawLineChart(canvas, [{ label: m.name, points: seriesOral(p, tMax), color: nextSeriesColor(), fill: true }], {
          xLabel: 'Time (h)', yLabel: 'Conc (mg/L)', height: 240, xMax: tMax, showLegend: false,
        });
      });
      return wrap2;
    })()));
  } else if (pk) {
    sec.appendChild(el('div', { class: 'text-faint', style: 'font-size:12.5px' },
      'No numeric half-life value available — curve omitted (values must be real, never invented).'));
  }
  return sec;
}

function safetyTab(m: Monograph): HTMLElement {
  const sec = el('div', {});
  const s = m.safety;
  if (!s) {
    sec.appendChild(el('div', { class: 'text-faint', style: 'font-size:13px' },
      'Structured safety data not yet available for this monograph. Verify against the product label.'));
    return sec;
  }
  const rows: Array<[string, string | undefined]> = [
    ['Pregnancy', s.pregnancy],
    ['Lactation', s.lactation],
    ['Monitoring', s.monitoring?.join(' · ')],
    ['Overdose', s.overdose],
  ];
  const grid = kvGrid(rows);
  if (grid) sec.appendChild(monoSection('Pregnancy, monitoring & overdose', ICONS.shield, grid));
  if (s.adverseEffects?.length) {
    const list = el('div', {});
    s.adverseEffects.forEach((ae) => {
      list.appendChild(el('div', {
        style: 'display:flex;justify-content:space-between;gap:14px;padding:9px 4px;border-bottom:1px solid var(--border);font-size:13px;',
      },
        el('span', {}, ae.effect),
        el('span', { class: 'mono', style: 'color:var(--text-faint);font-size:11.5px;white-space:nowrap' }, ae.frequency ?? '')));
    });
    sec.appendChild(monoSection('Adverse effects', ICONS.alert, list));
  }
  return sec;
}

function interactionsTab(m: Monograph): HTMLElement {
  const sec = el('div', {});
  const ix = m.interactions ?? [];
  if (ix.length) {
    ix.forEach((i) => {
      const card = el('div', { class: 'interaction-card' },
        el('h4', {},
          el('span', { class: `sev ${SEV_CLASS[i.severity] ?? 'sev-moderate'}` }, i.severity),
          i.withId ? el('span', {}, `${m.name} + ${MONO_BY_ID.get(i.withId)?.name ?? i.withId}`) : el('span', {}, `${m.name} + ${i.withClass ?? 'unknown'}`)),
        el('div', { class: 'interaction-grid' },
          el('div', { class: 'ix-block' }, el('span', { class: 'ix-label' }, 'Why it matters'), el('div', {}, i.summary)),
          i.mechanism ? el('div', { class: 'ix-block' }, el('span', { class: 'ix-label' }, 'Mechanism'), el('div', {}, i.mechanism)) : null,
          i.management ? el('div', { class: 'ix-block' }, el('span', { class: 'ix-label' }, 'Management'), el('div', {}, i.management)) : null,
          i.evidence ? el('div', { class: 'ix-block' }, el('span', { class: 'ix-label' }, 'Evidence'), el('div', {}, i.evidence)) : null));
      sec.appendChild(card);
    });
  } else {
    sec.appendChild(el('div', { class: 'text-faint', style: 'font-size:13px' }, 'No structured interactions recorded for this monograph yet.'));
  }
  if (m.interactionNotes?.length) {
    sec.appendChild(monoSection('Interaction notes (v1)', ICONS.alert,
      el('div', {}, ...m.interactionNotes.map((n) => el('div', { class: 'prose', style: 'margin-bottom:8px' }, n)))));
  }
  return sec;
}

function refsTab(m: Monograph): HTMLElement {
  const sec = el('div', {});
  if (m.refs?.length) {
    sec.appendChild(monoSection('References', ICONS.doc, citeList(m.refs)!));
  } else {
    sec.appendChild(el('div', { class: 'text-faint', style: 'font-size:13px' },
      'No citations attached yet. This monograph is migrated study content — references are added as curated data lands.'));
  }
  sec.appendChild(monoSection('Provenance', ICONS.shield,
    provenanceBlock(m.provenance)));
  if (m.originalFields?.length) {
    sec.appendChild(el('div', { class: 'text-faint', style: 'font-size:12.5px;line-height:1.6' },
      `Legacy v1 fields preserved: ${m.originalFields.length} (see accordion at page bottom).`));
  }
  return sec;
}

function monoSection(title: string, icon: string, content: HTMLElement): HTMLElement {
  return el('div', { class: 'mono-section' },
    el('h3', {}, svgIcon(icon, 15), title),
    content);
}

function $(sel: string, root: ParentNode): HTMLTextAreaElement {
  return root.querySelector(sel) as HTMLTextAreaElement;
}
