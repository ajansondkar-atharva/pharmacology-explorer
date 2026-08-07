import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://localhost:4174/';
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const p = await b.newPage();
const failed = [];
p.on('requestfailed', r => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));
await p.goto(BASE, { waitUntil: 'networkidle0', timeout: 45000 });
await new Promise(r => setTimeout(r, 2500));
const regs = await p.evaluate(async () => {
  const regs = await navigator.serviceWorker.getRegistrations();
  return regs.map(r => r.active ? `active:${r.active.scriptURL}` : r.installing ? `installing:${r.installing.scriptURL}` : r.waiting ? `waiting:${r.waiting.scriptURL}` : 'no-active-sw');
});
console.log('REGISTRATIONS:', JSON.stringify(regs));
console.log('FAILED REQUESTS:', failed.length ? failed.join('\n') : '(none)');
// fetch /assets/sw.js directly to see if it exists
const probe = await p.evaluate(async () => {
  const r = await fetch('./assets/sw.js').then(x => x.status).catch(e => 'fetch-err:' + e.message);
  const r2 = await fetch('./sw.js').then(x => x.status).catch(e => 'fetch-err:' + e.message);
  return { assetsSw: r, rootSw: r2 };
});
console.log('SW PATH PROBE:', JSON.stringify(probe));
await b.close();
