import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://localhost:4174/';
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text()); });

await p.goto(BASE, { waitUntil: 'networkidle0', timeout: 45000 });
await new Promise(r => setTimeout(r, 1200));
const r1 = await p.evaluate(() => ({
  swRegistered: 'serviceWorker' in navigator ? !!navigator.serviceWorker.controller : 'unsupported',
  swScope: 'serviceWorker' in navigator && navigator.serviceWorker.controller ? navigator.serviceWorker.controller.scriptURL : null,
  tiles: document.querySelectorAll('.tile').length,
  activeNav: document.querySelector('.nav-link.active')?.textContent?.trim(),
  navWidths: [...document.querySelectorAll('.nav-link')].slice(0, 4).map(n => Math.round(n.getBoundingClientRect().width)),
  placeholderColor: getComputedStyle(document.querySelector('#searchInput')).getPropertyValue('--text-muted') || getComputedStyle(document.querySelector('#searchInput')).color,
  themeIconFilled: (document.getElementById('themeIcon')?.innerHTML || '').length > 50,
}));

// wait for SW to activate on second load (autoUpdate flow)
await p.reload({ waitUntil: 'networkidle0', timeout: 45000 });
await new Promise(r => setTimeout(r, 2000));
const r2 = await p.evaluate(() => ({
  swControlled: 'serviceWorker' in navigator ? !!navigator.serviceWorker.controller : 'unsupported',
  tiles: document.querySelectorAll('.tile').length,
  updateToast: !!document.querySelector('.toast'),
}));

console.log('FIRST LOAD:', JSON.stringify(r1, null, 1));
console.log('AFTER RELOAD:', JSON.stringify(r2, null, 1));
console.log('ERRORS:', errs.length ? errs : '(none)');
await b.close();
