/* DOM smoke test — renders every registered view into jsdom and asserts
   no exceptions and non-trivial output. Canvas is stubbed (jsdom has no
   2D context). This catches selector typos and render-time crashes that
   unit tests on pure logic cannot. */

// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest';

// stub canvas 2D context for the chart engine
class FakeCtx {
  canvas: HTMLCanvasElement;
  constructor(canvas: HTMLCanvasElement) { this.canvas = canvas; }
  setTransform() { return this as unknown as void; }
  clearRect() { return this as unknown as void; }
  beginPath() { return this as unknown as void; }
  moveTo() { return this as unknown as void; }
  lineTo() { return this as unknown as void; }
  quadraticCurveTo() { return this as unknown as void; }
  stroke() { return this as unknown as void; }
  fill() { return this as unknown as void; }
  closePath() { return this as unknown as void; }
  fillText() { return this as unknown as void; }
  save() { return this as unknown as void; }
  restore() { return this as unknown as void; }
  rotate() { return this as unknown as void; }
  translate() { return this as unknown as void; }
  setLineDash() { return this as unknown as void; }
  roundRect() { return this as unknown as void; }
  measureText(text: string) { return { width: text.length * 6 }; }
  get font() { return ''; }
  set font(_v: string) { /* noop */ }
  get fillStyle() { return ''; }
  set fillStyle(_v: string) { /* noop */ }
  get strokeStyle() { return ''; }
  set strokeStyle(_v: string) { /* noop */ }
  get lineWidth() { return 1; }
  set lineWidth(_v: number) { /* noop */ }
  get textAlign() { return 'left'; }
  set textAlign(_v: string) { /* noop */ }
  get textBaseline() { return 'alphabetic'; }
  set textBaseline(_v: string) { /* noop */ }
  get globalAlpha() { return 1; }
  set globalAlpha(_v: number) { /* noop */ }
}

beforeAll(() => {
  // jsdom has no 2D canvas context — patch the prototype so every canvas
  // created by jsdom (including view code) gets the fake context.
  const canvasProto = Object.getPrototypeOf(document.createElement('canvas'));
  (canvasProto as unknown as { getContext: unknown }).getContext = function (this: HTMLCanvasElement) {
    return new FakeCtx(this);
  };
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true });

  // minimal app shell for the router/views
  document.body.innerHTML = `
    <div id="app"></div>
    <div id="nav"></div>
    <div id="crumb"></div>
    <div id="searchInput"></div>
    <div id="searchResults"></div>
    <div id="paletteBackdrop"></div>
    <div id="paletteList"></div>
    <div id="paletteInput"></div>
    <div id="themeBtn"></div>
    <div id="toastWrap"></div>
    <div id="basketCount">0</div>
    <div id="syncBadge"><span id="syncLabel"></span></div>
  `;
});

describe('view render smoke test', () => {
  it('registers all views and renders each without throwing', async () => {
    const { registerViews } = await import('../src/views');
    const { registerView, navigate, parseHash } = await import('../src/lib/router');
    const { initStore } = await import('../src/lib/store');
    const { buildSearchIndex } = await import('../src/lib/search');
    const { applySyncedOverlays } = await import('../src/lib/catalog');
    void registerView; void parseHash;

    registerViews();
    await initStore();
    await applySyncedOverlays();
    buildSearchIndex();

    // capture registered views from the router's internals is private;
    // instead navigate to each known view and assert DOM output
    const views = [
      'home', 'directory', 'diseases', 'guidelines', 'interactions',
      'pk', 'mechanisms', 'algorithms', 'study', 'saved', 'compare', 'sync',
    ];

    const app = document.getElementById('app')!;
    for (const v of views) {
      navigate(v as never);
      const html = app.innerHTML;
      expect(html.length, `${v} rendered empty`).toBeGreaterThan(100);
    }

    // monograph detail with real id + PK curve
    navigate('monograph', 'omeprazole');
    expect(app.innerHTML).toContain('Omeprazole');

    // disease detail
    navigate('diseases', 'gerd');
    expect(app.innerHTML).toContain('GERD');

    // directory with class filter
    navigate('directory', 'class:ppi');
    expect(app.innerHTML).toContain('Omeprazole');

    // interactions pair check path (render only — engine covered in unit tests)
    navigate('interactions');
    expect(app.innerHTML).toContain('Interaction Checker');
  });

  it('search finds omeprazole through the built index', async () => {
    const { search } = await import('../src/lib/search');
    const res = search('omeprazole');
    expect(res[0]?.doc.name).toBe('Omeprazole');
  });
});
