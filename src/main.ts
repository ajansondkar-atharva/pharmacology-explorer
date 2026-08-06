/* Bootstrap — wires nav, theme (persisted), search combobox, command
   palette, keyboard shortcuts, sync badge; then boots the router. */

import './styles/design-system.css';
import './styles/fonts.css';
import { el, $, $$, svgIcon, ICONS, type IconName } from './lib/dom';
import { navigate, initRouter, getViewLabel, type ViewKey } from './lib/router';
import { initStore, getPrefs, setPref, addRecentSearch, getRecentSearches } from './lib/store';
import { buildSearchIndex, search, highlightName, searchIndexSize, type SearchDoc } from './lib/search';
import { catalogStats, applySyncedOverlays } from './lib/catalog';
import { toast } from './lib/toast';
import { registerViews } from './views';
import { storageMode } from './lib/store';

/* ---------- nav ---------- */

interface NavDef {
  view: ViewKey;
  label: string;
  icon: IconName;
  group: string;
}

const NAV: NavDef[] = [
  { view: 'home', label: 'Dashboard', icon: 'grid', group: 'Browse' },
  { view: 'directory', label: 'Drug Directory', icon: 'search', group: 'Browse' },
  { view: 'diseases', label: 'Diseases', icon: 'heart', group: 'Browse' },
  { view: 'guidelines', label: 'Guidelines', icon: 'shield', group: 'Browse' },
  { view: 'interactions', label: 'Interaction Checker', icon: 'compare', group: 'Tools' },
  { view: 'pk', label: 'PK Visualizer', icon: 'pulse', group: 'Tools' },
  { view: 'mechanisms', label: 'Mechanism Explorer', icon: 'brain', group: 'Tools' },
  { view: 'algorithms', label: 'Treatment Algorithms', icon: 'tree', group: 'Tools' },
  { view: 'study', label: 'Study Mode', icon: 'quiz', group: 'Study' },
  { view: 'saved', label: 'Saved & Notes', icon: 'bookmark', group: 'Study' },
];

function buildNav(): void {
  const nav = $('#nav')!;
  const groups = new Map<string, NavDef[]>();
  for (const n of NAV) {
    if (!groups.has(n.group)) groups.set(n.group, []);
    groups.get(n.group)!.push(n);
  }
  for (const [group, items] of groups) {
    const g = el('div', { class: 'nav-group' });
    g.appendChild(el('div', { class: 'nav-group-label' }, group));
    for (const item of items) {
      const link = el('button', {
        class: 'nav-link',
        'data-view': item.view,
        'aria-current': 'false',
      }, svgIcon(ICONS[item.icon], 15), el('span', {}, item.label), el('span', { class: 'nav-dot', style: 'margin-left:auto' }));
      link.addEventListener('click', () => navigate(item.view));
      g.appendChild(link);
    }
    nav.appendChild(g);
  }
  appStateNav();
}

function appStateNav(): void {
  // keep nav active state in sync with route (called by router hook below)
}

/* ---------- theme (persisted) ---------- */

function applyTheme(theme: string): void {
  document.documentElement.setAttribute('data-theme', theme);
  const icon = $('#themeIcon')!;
  icon.innerHTML = theme === 'dark' ? ICONS.sun : ICONS.moon;
}

async function initTheme(): Promise<void> {
  const prefs = await getPrefs();
  const theme = prefs.theme ?? 'dark';
  applyTheme(theme);
  $('#themeBtn')!.addEventListener('click', async () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    await setPref('theme', next);
  });
}

/* ---------- search combobox (ARIA) ---------- */

let searchActive = -1;
let searchResults: SearchDoc[] = [];

async function runSearch(): Promise<void> {
  const input = $('#searchInput') as HTMLInputElement;
  const box = $('#searchResults')!;
  const q = input.value.trim();
  if (!q) {
    const recents = await getRecentSearches();
    box.innerHTML = '';
    if (recents.length) {
      box.appendChild(el('div', { class: 'search-section' }, 'Recent searches'));
      for (const r of recents) {
        const row = el('div', { class: 'search-row', role: 'option', tabindex: '-1' },
          el('span', { class: 'sw-name' }, r),
          el('span', { class: 'sw-meta' }, 'recent'));
        row.addEventListener('click', () => {
          input.value = r;
          input.dispatchEvent(new Event('input'));
        });
        box.appendChild(row);
      }
    } else {
      box.appendChild(el('div', { class: 'search-hint' }, 'Type to search drugs, mechanisms, classes, ATC codes…'));
    }
    box.classList.add('open');
    input.setAttribute('aria-expanded', 'true');
    searchActive = -1;
    return;
  }
  const hits = search(q, { limit: 9 });
  searchResults = hits.map((h) => h.doc);
  box.innerHTML = '';
  if (!hits.length) {
    box.appendChild(el('div', { class: 'search-row', style: 'color:var(--text-faint)' }, 'No matches'));
  } else {
    hits.forEach((hit, i) => {
      const row = el('div', {
        class: 'search-row', role: 'option', tabindex: '-1',
        'aria-selected': 'false', id: 'sr-' + i,
      },
        el('span', { class: 'sw-name', html: highlightName(hit.doc.name, q) }),
        hit.doc.synonyms.length ? el('span', { class: 'sw-syn' }, hit.doc.synonyms[0]) : null,
        el('span', { class: 'sw-meta' }, hit.doc.meta));
      row.addEventListener('mousedown', (e) => {
        e.preventDefault();
        openSearchResult(hit.doc);
      });
      box.appendChild(row);
    });
  }
  box.classList.add('open');
  input.setAttribute('aria-expanded', 'true');
  searchActive = -1;
}

function openSearchResult(doc: SearchDoc): void {
  const input = $('#searchInput') as HTMLInputElement;
  const box = $('#searchResults')!;
  box.classList.remove('open');
  input.setAttribute('aria-expanded', 'false');
  void addRecentSearch(input.value);
  input.value = '';
  navigate(doc.view, doc.param);
}

function moveSearch(dir: 1 | -1): void {
  const box = $('#searchResults')!;
  const rows = $$('[role="option"]', box);
  if (!rows.length) return;
  searchActive = (searchActive + dir + rows.length) % rows.length;
  rows.forEach((r, i) => {
    r.setAttribute('aria-selected', String(i === searchActive));
    if (i === searchActive) r.scrollIntoView({ block: 'nearest' });
  });
}

function initSearch(): void {
  const input = $('#searchInput') as HTMLInputElement;
  const box = $('#searchResults')!;
  let timer: number | undefined;
  input.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void runSearch(), 60);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveSearch(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveSearch(-1); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const rows = $$('[role="option"]', box);
      const hit = searchActive >= 0 && searchActive < rows.length
        ? searchResults[searchActive]
        : searchResults[0];
      if (hit) openSearchResult(hit);
    } else if (e.key === 'Escape') {
      box.classList.remove('open');
      input.setAttribute('aria-expanded', 'false');
      input.blur();
    }
  });
  document.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).closest('.search-wrap')) {
      box.classList.remove('open');
      input.setAttribute('aria-expanded', 'false');
    }
  });
}

/* ---------- command palette ---------- */

interface PaletteItem {
  label: string;
  hint?: string;
  kbd?: string;
  icon?: IconName;
  action: () => void;
}

function paletteItems(): PaletteItem[] {
  const items: PaletteItem[] = [
    { label: 'Go to Dashboard', icon: 'grid', action: () => navigate('home') },
    { label: 'Go to Drug Directory', icon: 'search', action: () => navigate('directory') },
    { label: 'Go to Diseases', icon: 'heart', action: () => navigate('diseases') },
    { label: 'Go to Guidelines', icon: 'shield', action: () => navigate('guidelines') },
    { label: 'Check interactions', icon: 'compare', action: () => navigate('interactions') },
    { label: 'Open PK Visualizer', icon: 'pulse', action: () => navigate('pk') },
    { label: 'Mechanism Explorer', icon: 'brain', action: () => navigate('mechanisms') },
    { label: 'Treatment Algorithms', icon: 'tree', action: () => navigate('algorithms') },
    { label: 'Study Mode', icon: 'quiz', action: () => navigate('study') },
    { label: 'Saved & Notes', icon: 'bookmark', action: () => navigate('saved') },
    { label: 'Synchronization engine', icon: 'sync', action: () => navigate('sync') },
    { label: 'Toggle light / dark theme', icon: 'moon', kbd: 'T', action: () => $('#themeBtn')!.click() },
    { label: 'Focus search', icon: 'search', kbd: '/', action: () => $('#searchInput')!.focus() },
  ];
  const stats = catalogStats();
  items.unshift({
    label: `${stats.drugs} monographs · ${stats.classes} classes · ${stats.mechanisms} mechanisms`,
    hint: 'catalog',
    icon: 'layers',
    action: () => navigate('directory'),
  });
  return items;
}

let paletteActive = -1;
function openPalette(): void {
  const backdrop = $('#paletteBackdrop')!;
  const input = $('#paletteInput') as HTMLInputElement;
  backdrop.classList.add('open');
  input.value = '';
  renderPalette(paletteItems());
  input.focus();
}
function closePalette(): void {
  $('#paletteBackdrop')!.classList.remove('open');
}
function renderPalette(items: PaletteItem[]): void {
  const list = $('#paletteList')!;
  list.innerHTML = '';
  if (!items.length) {
    list.appendChild(el('div', { class: 'palette-empty' }, 'No commands match'));
    return;
  }
  items.forEach((item, i) => {
    const row = el('div', {
      class: 'palette-item', role: 'option', tabindex: '-1',
      'aria-selected': 'false', id: 'pi-' + i,
    },
      item.icon ? svgIcon(ICONS[item.icon], 15) : el('span', { style: 'width:15px' }),
      el('span', { class: 'pi-name' }, item.label),
      item.hint ? el('span', { class: 'sw-syn' }, item.hint) : null,
      item.kbd ? el('span', { class: 'pi-kbd' }, el('kbd', {}, item.kbd)) : null);
    row.addEventListener('mousedown', (e) => {
      e.preventDefault();
      item.action();
      closePalette();
    });
    list.appendChild(row);
  });
  paletteActive = -1;
}
function movePalette(dir: 1 | -1): void {
  const rows = $$('#paletteList .palette-item');
  if (!rows.length) return;
  paletteActive = (paletteActive + dir + rows.length) % rows.length;
  rows.forEach((r, i) => r.setAttribute('aria-selected', String(i === paletteActive)));
}
function runPaletteAction(): void {
  const rows = $$('#paletteList .palette-item');
  const idx = paletteActive >= 0 ? paletteActive : 0;
  const row = rows[idx];
  if (!row) return;
  const items = paletteItems();
  // find matching item via element order
  const all = [...$('#paletteList')!.children];
  const target = all.indexOf(row);
  if (target >= 0 && items[target]) {
    items[target].action();
    closePalette();
  }
}

function initPalette(): void {
  const backdrop = $('#paletteBackdrop')!;
  const input = $('#paletteInput') as HTMLInputElement;
  $('#paletteBtn')!.addEventListener('click', () => openPalette());
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closePalette();
  });
  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    let items = paletteItems();
    if (q) {
      items = items.filter((i) => i.label.toLowerCase().includes(q));
      if (!items.length) {
        const hits = search(q, { limit: 6 });
        items = hits.map((h) => ({
          label: h.doc.name,
          hint: h.doc.meta,
          action: () => navigate(h.doc.view, h.doc.param),
        }));
      }
    }
    renderPalette(items);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); movePalette(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); movePalette(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); runPaletteAction(); }
    else if (e.key === 'Escape') { e.preventDefault(); closePalette(); }
  });
}

/* ---------- shortcuts ---------- */

function initShortcuts(): void {
  document.addEventListener('keydown', (e) => {
    const target = e.target as HTMLElement;
    const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
    const mod = e.ctrlKey || e.metaKey;

    if (mod && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openPalette();
      return;
    }
    if (typing) return;

    switch (e.key.toLowerCase()) {
      case '/':
        e.preventDefault();
        ($('#searchInput') as HTMLInputElement).focus();
        break;
      case 't':
        $('#themeBtn')!.click();
        break;
      case '?':
        e.preventDefault();
        toast('Shortcuts — Ctrl+K palette · / search · T theme · Esc close', 'info', 4000);
        break;
      case 'h':
        navigate('home');
        break;
      case 'd':
        navigate('directory');
        break;
      case 'i':
        navigate('interactions');
        break;
      case 's':
        navigate('study');
        break;
      case 'escape':
        closePalette();
        break;
    }
  });
}

/* ---------- shell misc ---------- */

function initShell(): void {
  $('#hamburger')!.addEventListener('click', () => {
    $('#sidebar')!.classList.add('open');
    $('#scrim')!.classList.add('open');
  });
  $('#scrim')!.addEventListener('click', closeSidebar);
  $('#studyBtn')!.addEventListener('click', () => navigate('study'));
  $$('.nav-link').forEach((n) => n.addEventListener('click', () => closeSidebar()));
  const basket = $('.basket-pill')!;
  basket.addEventListener('click', () => navigate('saved'));
  import('./lib/store').then(({ getBasket }) => getBasket().then((ids) => {
    $('#basketCount')!.textContent = String(ids.length);
  }));
}

function closeSidebar(): void {
  $('#sidebar')!.classList.remove('open');
  $('#scrim')!.classList.remove('open');
}

/* ---------- crumb sync ---------- */

let lastCrumb = '';
function updateCrumb(): void {
  const hash = location.hash.replace(/^#\/?/, '');
  const view = (hash.split('/')[0] || 'home') as ViewKey;
  const label = getViewLabel(view);
  if (label === lastCrumb) return;
  lastCrumb = label;
  $('#crumb')!.innerHTML = `Pharm.Explorer <span style="color:var(--text-faint)">/</span> <b>${label}</b>`;
}

/* ---------- boot ---------- */

async function boot(): Promise<void> {
  registerViews();
  buildNav();
  initShell();
  await initTheme();
  initSearch();
  initPalette();
  initShortcuts();
  await initStore();
  await applySyncedOverlays();
  buildSearchIndex();
  updateCrumb();
  window.addEventListener('hashchange', updateCrumb);

  // sync badge: click → sync panel
  const badge = $('#syncBadge')!;
  const label = $('#syncLabel')!;
  badge.classList.add('offline');
  label.textContent = 'local';
  badge.style.cursor = 'pointer';
  badge.setAttribute('role', 'button');
  badge.setAttribute('tabindex', '0');
  badge.title = `Local-first — ${catalogStats().drugs} monographs offline. Click to open the sync engine.`;
  const openSync = () => navigate('sync');
  badge.addEventListener('click', openSync);
  badge.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openSync(); }
  });

  initRouter();

  // boot log
  console.info(`[pharm-explorer] booted: ${searchIndexSize()} indexed entries, storage=${storageMode}`);
}

void boot();

/* re-export for views that need it */
export { el, $, $$, svgIcon, ICONS };
