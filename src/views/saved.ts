/* Saved & Notes — favorites, persisted notes, recent activity, compare
   basket. Everything lives in the local store (IndexedDB/localStorage). */

import { el } from '../lib/dom';
import { registerView, navigate } from '../lib/router';
import { MONO_BY_ID } from '../lib/catalog';
import { sectionHead, emptyState, disclaimerBox, tabRow, badgeFor } from './components';
import {
  getFavorites, getNotes, getRecentSearches, getVisits,
  getBasket, setBasket, toggleFavorite,
} from '../lib/store';
import type { SystemKey } from '../lib/types';
import { toast } from '../lib/toast';

export function register(): void {
  registerView('saved', 'Saved & Notes', (root) => {
    root.appendChild(sectionHead(
      'Workspace',
      'Saved & Notes',
      'Favorites, your own notes, recent activity, and the compare basket — all persisted locally on this device. Nothing leaves your machine.'
    ));

    root.appendChild(tabRow([
      { label: 'Favorites', render: () => listTab('favorites') },
      { label: 'Notes', render: () => listTab('notes') },
      { label: 'Recent', render: () => listTab('recent') },
      { label: 'Compare basket', render: () => listTab('basket') },
    ]));

    root.appendChild(disclaimerBox('Your saved data is stored in the browser’s local storage (IndexedDB). Clearing browser data for this site will erase favorites, notes, and review state.'));
  });
}

function drugLink(id: string, sub: string): HTMLElement {
  const m = MONO_BY_ID.get(id);
  if (!m) return el('div', {}, `${id} (not in catalog)`);
  const row = el('div', { class: 'dir-row', tabindex: '0', role: 'button' },
    el('div', { class: 'dr-name' }, m.name),
    el('div', { class: 'dr-class' }, sub));
  const open = () => navigate('monograph', id);
  row.addEventListener('click', open);
  row.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
  });
  return row;
}

async function renderInto(body: HTMLElement, kind: 'favorites' | 'notes' | 'recent' | 'basket'): Promise<void> {
  body.innerHTML = '';

  if (kind === 'favorites') {
    const favs = new Set(await getFavorites());
    if (!favs.size) {
      body.appendChild(el('div', { style: 'grid-column:1/-1' }, emptyState('', 'No favorites yet — star any monograph to pin it here.')));
      return;
    }
    for (const id of favs) {
      const row = drugLink(id, 'Favorite');
      row.style.position = 'relative';
      const star = el('button', { class: 'star-btn', style: 'position:absolute;top:10px;right:12px;color:var(--sys-signal)', 'aria-label': 'Remove favorite' }, '★');
      star.addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleFavorite(id);
        void renderInto(body, kind);
      });
      row.appendChild(star);
      body.appendChild(row);
    }
  } else if (kind === 'notes') {
    const notes = (await getNotes()).sort((a, b) => b.updatedAt - a.updatedAt).filter((n) => n.text.trim());
    if (!notes.length) {
      body.appendChild(el('div', { style: 'grid-column:1/-1' }, emptyState('', 'No notes yet — write one from any monograph page.')));
      return;
    }
    notes.forEach((n) => {
      const m = MONO_BY_ID.get(n.drugId);
      const card = el('div', { class: 'card', style: 'grid-column:1/-1;padding:16px 18px' },
        el('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px' },
          el('div', { class: 'dr-name', style: 'cursor:pointer' }, m?.name ?? n.drugId),
          m ? badgeFor(m.systems[0] as SystemKey) : null),
        el('div', { style: 'font-size:13px;color:var(--text-muted);line-height:1.55;white-space:pre-wrap' }, n.text));
      (card.children[0].children[0] as HTMLElement).addEventListener('click', () => navigate('monograph', n.drugId));
      body.appendChild(card);
    });
  } else if (kind === 'recent') {
    const [recents, visits] = await Promise.all([getRecentSearches(), getVisits()]);
    if (!recents.length && !visits.length) {
      body.appendChild(el('div', { style: 'grid-column:1/-1' }, emptyState('', 'No recent activity.')));
      return;
    }
    if (visits.length) {
      body.appendChild(el('div', { class: 'field-label', style: 'grid-column:1/-1;margin-top:4px' }, 'Recently viewed drugs'));
      visits.forEach((id) => body.appendChild(drugLink(id, 'Viewed')));
    }
    if (recents.length) {
      body.appendChild(el('div', { class: 'field-label', style: 'grid-column:1/-1;margin-top:14px' }, 'Recent searches'));
      recents.forEach((r) => {
        const pill = el('span', { class: 'pill', style: 'cursor:pointer;grid-column:1/-1;justify-self:start' }, r);
        pill.addEventListener('click', () => {
          const input = document.getElementById('searchInput') as HTMLInputElement;
          input.value = r;
          input.dispatchEvent(new Event('input'));
        });
        body.appendChild(pill);
      });
    }
  } else {
    const basket = await getBasket();
    if (!basket.length) {
      body.appendChild(el('div', { style: 'grid-column:1/-1' }, emptyState('', 'Basket is empty — use Compare on any monograph to add up to 4 drugs.')));
      return;
    }
    for (const id of basket) {
      const row = drugLink(id, 'In compare basket');
      row.style.position = 'relative';
      const rm = el('button', { class: 'btn btn-ghost btn-sm', style: 'position:absolute;top:10px;right:12px' }, 'Remove');
      rm.addEventListener('click', async (e) => {
        e.stopPropagation();
        await setBasket((await getBasket()).filter((x) => x !== id));
        toast('Removed from basket', 'info', 1500);
        void renderInto(body, kind);
      });
      row.appendChild(rm);
      body.appendChild(row);
    }
    body.appendChild(el('div', { style: 'grid-column:1/-1;margin-top:8px' },
      el('button', { class: 'btn btn-primary' }, 'Compare these drugs',
        )));
    (body.lastElementChild!.firstElementChild as HTMLElement).addEventListener('click', () => navigate('compare'));
  }
}

function listTab(kind: 'favorites' | 'notes' | 'recent' | 'basket'): HTMLElement {
  const wrap = el('div', {});
  const body = el('div', { class: 'directory-grid', style: 'margin-top:6px' });
  wrap.appendChild(body);
  void renderInto(body, kind);
  return wrap;
}
