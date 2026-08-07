import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://localhost:4174/';
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`[${m.type()}] ${m.text()}`); });
await p.goto(BASE, { waitUntil: 'networkidle0', timeout: 45000 });
const direct = await p.evaluate(async () => {
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    const u = reg.active ? 'active' : reg.installing ? 'installing' : reg.waiting ? 'waiting' : 'pending';
    return `direct register OK: ${u} @ ${reg.scope}`;
  } catch (e) {
    return 'direct register FAILED: ' + e.message;
  }
});
console.log('DIRECT:', direct);
// now check if the app's own virtual-module registration ever fired — look for the chunk load
const chunkLoaded = await p.evaluate(async () => {
  try {
    const m = await import('/assets/virtual_pwa-register-ChYTMNb8.js');
    return 'virtual module import OK, exports: ' + Object.keys(m).join(',');
  } catch (e) {
    return 'virtual import FAILED: ' + e.message;
  }
});
console.log('VIRTUAL:', chunkLoaded);
console.log('ERRORS:', errs.length ? errs.join('\n') : '(none)');
await b.close();
