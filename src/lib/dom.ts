/* DOM utilities — evolved from the v1 `el()` builder.
   Security rule: the ONLY way to inject raw HTML is the explicit
   `html` attribute; every other child is appended as a text node.
   Use `safeHTML()` for any string that may contain untrusted data. */

export type ElAttrs = Record<string, unknown> & {
  html?: string;
  text?: string;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: ElAttrs = {},
  ...children: Array<Node | string | number | null | undefined | false>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'html') {
      node.innerHTML = v as string;
    } else if (k === 'text') {
      node.textContent = v as string;
    } else if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (v !== false && v !== null && v !== undefined) {
      node.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return node;
}

export const $ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T | null =>
  root.querySelector(sel) as T | null;

export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] =>
  Array.from(root.querySelectorAll(sel)) as T[];

/** Escape untrusted text for safe interpolation into innerHTML templates. */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Build an SVG element from a path string (keep icons dependency-free). */
export function svgIcon(paths: string, size = 15, strokeWidth = 1.8): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', String(strokeWidth));
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.innerHTML = paths;
  return svg;
}

export const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V4a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 0 4 5.5v14Z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
  star: '<path d="M12 3l2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8L12 3Z"/>',
  compare: '<path d="M8 6v12M16 6v12M4 9h4M4 15h4M16 9h4M16 15h4"/>',
  flask: '<path d="M9 3h6M10 3v6L5.2 17.6A2 2 0 0 0 7 20.5h10a2 2 0 0 0 1.8-2.9L14 9V3"/><path d="M7.5 14h9"/>',
  heart: '<path d="M12 20.5C7 16.5 3 13.2 3 9.3 3 6.4 5.2 4.5 7.8 4.5c1.7 0 3.2.9 4.2 2.3 1-1.4 2.5-2.3 4.2-2.3C18.8 4.5 21 6.4 21 9.3c0 3.9-4 7.2-9 11.2Z"/>',
  pulse: '<path d="M3 12h4l2.5-6 4 12L16 12h5"/>',
  pill: '<path d="M10.5 20.5a6 6 0 0 1-8.5-8.5l8-8a6 6 0 0 1 8.5 8.5l-8 8Z"/><path d="M3.5 14.5l11-11"/>',
  shield: '<path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6l7-3Z"/>',
  alert: '<path d="M12 9v4M12 17h.01M10.3 3.9 2.5 17.5A1.8 1.8 0 0 0 4 20h16a1.8 1.8 0 0 0 1.5-2.5L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z"/>',
  sync: '<path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/>',
  brain: '<circle cx="12" cy="12" r="2.5"/><circle cx="5" cy="5" r="1.6"/><circle cx="19" cy="5" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="19" r="1.6"/><path d="M9.7 10.3 6.2 6.2M14.3 10.3l3.5-4.1M9.7 13.7l-3.5 4.1M14.3 13.7l3.5 4.1"/>',
  tree: '<circle cx="12" cy="4" r="2"/><path d="M12 6v4M12 10 6 15M12 10l6 5"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  grid: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  list: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  notes: '<path d="M9 4h9a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8z"/><path d="M9 4v4H5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  layers: '<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="M3 13l9 5 9-5"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  filter: '<path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4V3Z"/>',
  flashcard: '<rect x="4" y="4" width="16" height="14" rx="2"/><path d="M8 9h8M8 13h5"/>',
  quiz: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.1 1-1.1 2.2M12 17h.01"/>',
  doc: '<path d="M9 4h9a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8z"/><path d="M9 4v4H5"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/>',
  keyboard: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
} as const;

export type IconName = keyof typeof ICONS;
