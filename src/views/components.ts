/* Shared view-building components. */

import { el, esc, svgIcon, ICONS } from '../lib/dom';
import { SYSTEMS, type SystemKey, type Citation } from '../lib/types';
import { citationUrl } from '../lib/citations';

export function sectionHead(eyebrow: string, title: string, lede?: string): HTMLElement {
  const head = el('div', { class: 'section-head' });
  const wrap = el('div', {});
  wrap.appendChild(el('div', { class: 'eyebrow' }, eyebrow));
  wrap.appendChild(el('h1', { class: 'h1' }, title));
  if (lede) wrap.appendChild(el('p', { class: 'lede', style: 'margin-top:8px' }, lede));
  head.appendChild(wrap);
  return head;
}

export function badgeFor(sys: SystemKey, text?: string): HTMLElement {
  const s = SYSTEMS[sys] ?? SYSTEMS.signal;
  return el('span', { class: `badge ${s.badge}` }, text ?? s.label);
}

export function systemBadges(systems: SystemKey[]): HTMLElement {
  const wrap = el('span', { class: 'pill-list' });
  systems.forEach((s) => wrap.appendChild(badgeFor(s)));
  return wrap;
}

export function kvGrid(pairs: Array<[string, string | undefined]>): HTMLElement | null {
  const visible = pairs.filter(([, v]) => v && v.trim().length);
  if (!visible.length) return null;
  const dl = el('dl', { class: 'kv' });
  for (const [label, value] of visible) {
    dl.appendChild(el('dt', {}, label));
    dl.appendChild(el('dd', { html: esc(value!) })); // values are trusted-ish but escaped anyway
  }
  return dl;
}

export function pillList(items: string[] | undefined): HTMLElement | null {
  if (!items?.length) return null;
  const wrap = el('div', { class: 'pill-list' });
  items.forEach((i) => wrap.appendChild(el('span', { class: 'pill' }, i)));
  return wrap;
}

export function pearlBox(text: string): HTMLElement {
  return el('div', { class: 'pearl-box' },
    el('div', { class: 'pearl-label' }, '💡 Clinical pearl'),
    el('div', {}, text));
}

export function pcbaBlock(good?: string, bad?: string): HTMLElement | null {
  if (!good && !bad) return null;
  return el('div', { class: 'pcba-grid' },
    good ? el('div', { class: 'pcba-box pcba-good' }, el('div', { class: 'pcba-label' }, 'Best for'), el('div', {}, good)) : null,
    bad ? el('div', { class: 'pcba-box pcba-bad' }, el('div', { class: 'pcba-label' }, 'Avoid / caution when'), el('div', {}, bad)) : null);
}

export function disclaimerBox(text: string): HTMLElement {
  return el('div', { class: 'disclaimer' },
    el('div', { html: svgIcon(ICONS.alert, 17).outerHTML }),
    el('div', { html: esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>') }));
}

export function emptyState(icon: string, text: string): HTMLElement {
  return el('div', { class: 'empty-state' },
    svgIcon(icon, 34),
    el('div', {}, text));
}

export function citeList(refs: Citation[] | undefined): HTMLElement | null {
  if (!refs?.length) return null;
  const wrap = el('div', { class: 'ref-list' });
  refs.forEach((c, i) => {
    const url = citationUrl(c);
    const body = url
      ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, `${c.label}${c.id ? ` — ${c.id}` : ''}`)
      : el('span', {}, `${c.label}${c.id ? ` — ${c.id}` : ''}`);
    wrap.appendChild(el('div', { class: 'ref-item' },
      el('span', { class: 'ref-n' }, String(i + 1).padStart(2, '0')),
      body,
      url ? svgIcon(ICONS.external, 12) : null));
  });
  return wrap;
}

export function provenanceBlock(p: { source: string; confidence: string; lastUpdated: string; revision: number; notes?: string }): HTMLElement {
  const confColor = p.confidence === 'high' ? 'var(--good)' : p.confidence === 'medium' ? 'var(--sys-signal)' : 'var(--text-faint)';
  return el('div', { style: 'font-size:11.5px;color:var(--text-faint);line-height:1.6;' },
    el('div', {}, `Source: <b style="color:var(--text-muted)">${esc(p.source)}</b> · ` +
      `Confidence: <b style="color:${confColor}">${esc(p.confidence)}</b> · ` +
      `Revision: <b style="color:var(--text-muted)">${p.revision}</b> · Updated: <b style="color:var(--text-muted)">${esc(p.lastUpdated)}</b>`),
    p.notes ? el('div', { style: 'margin-top:4px' }, esc(p.notes)) : null);
}

export function tabRow(defs: Array<{ label: string; render: () => HTMLElement }>): HTMLElement {
  const root = el('div', {});
  const tabs = el('div', { class: 'tabs', role: 'tablist' });
  const panels = el('div', {});
  const rendered = defs.map(() => false);

  const activate = (i: number) => {
    $$('.tab-btn', tabs).forEach((b, j) => {
      const on = j === i;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
    panels.childNodes.forEach((p, j) => {
      (p as HTMLElement).classList.toggle('active', j === i);
    });
    if (!rendered[i]) {
      rendered[i] = true;
      panels.children[i].appendChild(defs[i].render());
    }
  };

  defs.forEach((d, i) => {
    const btn = el('button', {
      class: 'tab-btn', role: 'tab', 'aria-selected': String(i === 0),
      'aria-controls': 'panel-' + i, id: 'tab-' + i,
    }, d.label);
    btn.addEventListener('click', () => activate(i));
    tabs.appendChild(btn);
    panels.appendChild(el('div', {
      class: `tab-panel${i === 0 ? ' active' : ''}`, role: 'tabpanel',
      'aria-labelledby': 'tab-' + i, id: 'panel-' + i,
    }));
  });

  activate(0);
  root.appendChild(tabs);
  root.appendChild(panels);
  return root;
}

function $$(sel: string, root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll(sel)) as HTMLElement[];
}
