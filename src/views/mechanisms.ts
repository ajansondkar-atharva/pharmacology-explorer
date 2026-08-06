/* Mechanism Explorer — from molecular target to clinical consequence. */

import { el, ICONS } from '../lib/dom';
import { registerView, navigate } from '../lib/router';
import { MECHANISMS } from '../lib/catalog';
import { sectionHead, pearlBox, emptyState } from './components';

export function register(): void {
  registerView('mechanisms', 'Mechanism Explorer', (root, focusId) => {
    root.appendChild(sectionHead(
      'Mechanism of action',
      'Mechanism Explorer',
      'How drugs work — from molecular target to clinical consequence. Each mechanism card links to the drugs in this reference that use it.'
    ));

    if (!MECHANISMS.length) {
      root.appendChild(emptyState(ICONS.brain, 'No mechanism data yet.'));
      return;
    }

    MECHANISMS.forEach((m) => {
      const card = el('div', { class: 'card', style: 'margin-bottom:12px;padding:20px 22px;' },
        el('div', { style: 'display:flex;align-items:center;gap:10px;flex-wrap:wrap' },
          el('div', { class: 'h3' }, m.name),
          m.subtitle ? el('span', { class: 'badge badge-signal' }, m.subtitle) : null),
        m.summary ? el('p', { class: 'text-muted', style: 'font-size:13.5px;line-height:1.6;margin-top:8px;max-width:72ch' }, m.summary) : null,
        m.use ? el('div', { style: 'margin-top:10px' },
          el('span', { class: 'field-label' }, 'Clinical use'),
          el('div', { class: 'field-value', style: 'font-size:13px;max-width:72ch' }, m.use)) : null);

      const fields = (m.fields as Array<[string, string]> | undefined) ?? [];
      if (fields.length) {
        const list = el('div', { style: 'margin-top:12px;display:flex;flex-direction:column;gap:8px' });
        fields.forEach(([k, v]) => {
          list.appendChild(el('div', { style: 'font-size:12.8px;line-height:1.55' },
            el('span', { class: 'field-label', style: 'display:inline;margin-right:8px' }, k),
            el('span', { class: 'text-muted' }, v)));
        });
        card.appendChild(list);
      }

      const links = (m.links as Array<[string, string, string]> | undefined) ?? [];
      if (links.length) {
        const pills = el('div', { class: 'pill-list', style: 'margin-top:12px' });
        links.forEach(([view, id, label]) => {
          const p = el('span', { class: 'pill', style: 'cursor:pointer' }, label);
          p.addEventListener('click', () => navigate(view as never, id));
          pills.appendChild(p);
        });
        card.appendChild(pills);
      }
      if (m.pearl) {
        card.appendChild(el('div', { style: 'margin-top:12px' }, pearlBox(String(m.pearl))));
      }

      root.appendChild(card);
    });

    void focusId;
  });
}
