/* Toast notifications — replaces the v1 `alert()` for in-app messaging. */

import { el } from './dom';

let wrap: HTMLElement | null = null;

function getWrap(): HTMLElement {
  if (!wrap) {
    wrap = document.getElementById('toastWrap') as HTMLElement | null;
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      document.body.appendChild(wrap);
    }
  }
  return wrap;
}

export type ToastKind = 'ok' | 'warn' | 'error' | 'info';

export function toast(message: string, kind: ToastKind = 'info', duration = 2600): void {
  const t = el('div', { class: `toast ${kind === 'info' ? '' : kind}` }, message);
  getWrap().appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity .3s ease';
    setTimeout(() => t.remove(), 320);
  }, duration);
}
