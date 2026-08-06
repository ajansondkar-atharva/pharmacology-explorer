/* Router — hash-based, view registry, deep-linking (same model as v1,
   now typed and with registered labels). */

export type ViewKey =
  | 'home' | 'directory' | 'monograph' | 'compare' | 'interactions'
  | 'pk' | 'mechanisms' | 'algorithms' | 'diseases' | 'guidelines'
  | 'study' | 'saved';

export interface Route {
  view: ViewKey;
  param?: string;
}

type Renderer = (root: HTMLElement, param?: string) => void;

interface ViewDef {
  label: string;
  render: Renderer;
}

const VIEWS = new Map<ViewKey, ViewDef>();
let currentView: ViewKey = 'home';
let currentParam: string | undefined;

export function registerView(view: ViewKey, label: string, render: Renderer): void {
  VIEWS.set(view, { label, render });
}

export function getViewLabel(view: ViewKey): string {
  return VIEWS.get(view)?.label ?? view;
}

export function parseHash(): Route {
  const hash = location.hash.replace(/^#\/?/, '');
  const [view, ...rest] = hash.split('/');
  const key = (VIEWS.has(view as ViewKey) ? view : 'home') as ViewKey;
  return { view: key, param: rest.length ? rest.join('/') : undefined };
}

export function navigate(view: ViewKey, param?: string): void {
  const target: Route = { view, param };
  const hash = param ? `${view}/${param}` : view;
  if (location.hash.replace(/^#\/?/, '') !== hash) {
    location.hash = hash;
  }
  applyRoute(target);
}

export function current(): Route {
  return { view: currentView, param: currentParam };
}

export function applyRoute(route: Route): void {
  const def = VIEWS.get(route.view);
  if (!def) return;
  currentView = route.view;
  currentParam = route.param;
  const app = document.getElementById('app')!;
  app.innerHTML = '';
  const viewEl = document.createElement('div');
  viewEl.className = 'view active';
  app.appendChild(viewEl);
  def.render(viewEl, route.param);
  window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
}

export function initRouter(): void {
  window.addEventListener('hashchange', () => applyRoute(parseHash()));
  applyRoute(parseHash());
}
