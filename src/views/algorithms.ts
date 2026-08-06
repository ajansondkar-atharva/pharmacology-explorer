/* Treatment Algorithms — interactive decision trees (acid disorders,
   acne severity) migrated from v1. Educational study tool. */

import { el } from '../lib/dom';
import { registerView, navigate } from '../lib/router';
import { sectionHead, disclaimerBox, tabRow } from './components';

interface AlgoNode {
  q?: string;
  options?: Array<{ label: string; next: string }>;
  leaf?: boolean;
  tone?: 'caution' | 'ok';
  title?: string;
  rec?: string;
  why?: string;
  caution?: string;
  links?: Array<[string, string | null, string]>;
}

interface AlgoTree {
  start: string;
  nodes: Record<string, AlgoNode>;
}

const modules = import.meta.glob('../data/algorithms.json', {
  eager: true,
  import: 'default',
}) as Record<string, { acid?: AlgoTree; acne?: AlgoTree }>;

const TREES = modules['../data/algorithms.json'] ?? {};

export function register(): void {
  registerView('algorithms', 'Treatment Algorithms', (root) => {
    root.appendChild(sectionHead(
      'Guided decision logic',
      'Treatment Algorithms',
      'Click through the questions to see the reasoning a treatment decision typically follows. A study tool for understanding decision logic — not a diagnostic or prescribing instrument.'
    ));
    root.appendChild(disclaimerBox('<b>Educational only.</b> These flowcharts illustrate common decision logic for study purposes. They do not account for a real patient\u2019s full history, and are not a substitute for clinical judgment or a licensed prescriber.'));

    const tabs: Array<{ label: string; render: () => HTMLElement }> = [];
    if (TREES.acid) tabs.push({ label: 'Acid-related disorders', render: () => renderAlgorithm(TREES.acid!) });
    if (TREES.acne) tabs.push({ label: 'Acne severity', render: () => renderAlgorithm(TREES.acne!) });
    if (tabs.length) root.appendChild(tabRow(tabs));
  });
}

function renderAlgorithm(tree: AlgoTree): HTMLElement {
  const wrap = el('div', {});
  const body = el('div', {});
  wrap.appendChild(body);
  let path: string[] = [tree.start];

  function draw(): void {
    body.innerHTML = '';
    const nodeId = path[path.length - 1];
    const node = tree.nodes[nodeId];
    if (!node) return;
    if (path.length > 1) {
      const back = el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-bottom:14px' }, '← Back');
      back.addEventListener('click', () => { path.pop(); draw(); });
      body.appendChild(back);
    }
    if (!node.leaf) {
      body.appendChild(el('div', { class: 'h3', style: 'margin-bottom:14px' }, node.q ?? ''));
      const opts = el('div', { style: 'display:flex;flex-direction:column;gap:8px' });
      (node.options ?? []).forEach((o) => {
        const b = el('button', { class: 'card card-interactive', style: 'text-align:left;width:100%;font-size:13.5px;padding:14px 16px;border:none' }, o.label);
        b.addEventListener('click', () => { path.push(o.next); draw(); });
        opts.appendChild(b);
      });
      body.appendChild(opts);
    } else {
      const toneColor = node.tone === 'caution' ? 'var(--sys-derm)' : 'var(--good)';
      const card = el('div', { class: 'card', style: `border-color:${toneColor}55;` },
        el('span', { class: 'badge', style: `background:${toneColor}1f;color:${toneColor};` }, node.tone === 'caution' ? 'Needs care' : 'Suggested approach'),
        el('div', { class: 'h3', style: 'margin-top:10px;margin-bottom:10px' }, node.title ?? ''),
        node.rec ? el('div', { style: 'margin-bottom:10px' },
          el('span', { class: 'field-label' }, 'Approach'),
          el('div', { class: 'field-value' }, node.rec)) : null,
        node.why ? el('div', {},
          el('span', { class: 'field-label' }, 'Why'),
          el('div', { class: 'field-value' }, node.why)) : null);
      if (node.caution) {
        card.appendChild(el('div', { class: 'text-faint', style: 'font-size:12px;margin-top:10px' }, '⚠ ' + node.caution));
      }
      if (node.links?.length) {
        const linkRow = el('div', { class: 'pill-list', style: 'margin-top:14px' });
        node.links.forEach(([view, id, label]) => {
          const p = el('span', { class: 'pill', style: 'cursor:pointer' }, label);
          p.addEventListener('click', () => {
            if (view === 'ppi') navigate('monograph', id ?? '');
            else if (view === 'nsaid' || view === 'acne' || view === 'derm' || view === 'interactions') {
              if (id) navigate('monograph', id);
              else if (view === 'interactions') navigate('interactions');
              else navigate('directory', id ? `class:${id}` : undefined);
            }
          });
          linkRow.appendChild(p);
        });
        card.appendChild(linkRow);
      }
      body.appendChild(card);
      const restart = el('button', { class: 'btn btn-ghost btn-sm', style: 'margin-top:14px' }, 'Start over');
      restart.addEventListener('click', () => { path = [tree.start]; draw(); });
      body.appendChild(restart);
    }
  }
  draw();
  return wrap;
}
