import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TARGET = process.argv[2] || 'https://ajansondkar-atharva.github.io/pharmacology-explorer/';
const OUT = path.resolve(process.cwd(), '.shots') + path.sep;
fs.mkdirSync(OUT, { recursive: true });
const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'mobile', width: 390, height: 844 },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu'],
});

const page = await browser.newPage();
const consoleErrors = [];
const pageErrors = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') consoleErrors.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', e => pageErrors.push(String(e)));
page.on('requestfailed', r => consoleErrors.push(`[reqfail] ${r.url().slice(0,120)} ${r.failure()?.errorText || ''}`));

await page.goto(TARGET, { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise(r => setTimeout(r, 1500));

// ---- viewport screenshots + per-viewport checks
for (const vp of VIEWPORTS) {
  await page.setViewport({ width: vp.width, height: vp.height });
  await new Promise(r => setTimeout(r, 800));
  await page.screenshot({ path: `${OUT}audit-${vp.name}.png` });

  const metrics = await page.evaluate(() => {
    const q = s => document.querySelector(s);
    const app = document.getElementById('app');
    const shell = q('.app-shell');
    const sidebar = q('.sidebar');
    const topbar = q('.topbar');
    const tiles = [...document.querySelectorAll('.tile')];
    const cards = [...document.querySelectorAll('.card')];
    const activeView = q('.view.active');
    const out = {
      title: document.title,
      bodyScrollW: document.body.scrollWidth,
      innerW: window.innerWidth,
      hOverflow: document.documentElement.scrollWidth > window.innerWidth,
      app: app ? { w: app.offsetWidth, h: app.offsetHeight } : null,
      shell: shell ? { w: shell.offsetWidth, display: getComputedStyle(shell).display } : null,
      sidebar: sidebar ? { w: sidebar.offsetWidth, visible: sidebar.offsetWidth > 0 } : null,
      topbar: topbar ? { h: topbar.offsetHeight } : null,
      activeView: activeView ? activeView.id : null,
      tiles: tiles.length,
      tileSizes: tiles.map(t => ({ w: t.offsetWidth, h: t.offsetHeight })),
      cards: cards.length,
      bodyChildren: document.body.children.length,
      emptyTiles: tiles.filter(t => t.innerText.trim().length < 10).length,
      fonts: [...new Set([...document.querySelectorAll('*')].filter(el => getComputedStyle(el).fontFamily.includes('Space') || getComputedStyle(el).fontFamily.includes('IBM')).slice(0,5).map(el => getComputedStyle(el).fontFamily))],
      system: { bg: getComputedStyle(document.body).backgroundColor, color: getComputedStyle(document.body).color },
    };
    return out;
  });
  console.log(`\n===== ${vp.name} ${vp.width}x${vp.height} =====`);
  console.log(JSON.stringify(metrics, null, 1));
}

// ---- structural dump of home view
const home = await page.evaluate(() => {
  const main = document.getElementById('app');
  const view = document.querySelector('.view.active');
  const txt = (view?.innerText || '').slice(0, 1200);
  const links = [...document.querySelectorAll('.nav-link')].map(a => a.textContent.trim());
  return { viewId: view?.id, text: txt, navLinks: links, html: (main?.innerHTML || '').slice(0, 300) };
});
console.log('\n===== HOME VIEW CONTENT =====');
console.log(home.text);
console.log('\nNAV:', home.navLinks.join(' | '));

console.log('\n===== CONSOLE / PAGE ERRORS =====');
console.log('console+req:', consoleErrors.length ? consoleErrors.slice(0, 15).join('\n') : '(none)');
console.log('pageerrors:', pageErrors.length ? pageErrors.slice(0, 5).join('\n') : '(none)');

await browser.close();
