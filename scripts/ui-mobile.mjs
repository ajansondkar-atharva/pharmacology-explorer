import puppeteer from 'puppeteer-core';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const p = await b.newPage();
await p.setViewport({ width: 390, height: 844, isMobile: true });
const errs = [];
p.on('pageerror', e => errs.push(String(e)));
for (const r of ['', '#/directory', '#/interactions', '#/monograph/amlodipine']) {
  await p.goto('http://localhost:4173/' + r, { waitUntil: 'networkidle0', timeout: 45000 });
  await new Promise(x => setTimeout(x, 600));
  const m = await p.evaluate(() => ({
    hOverflow: document.documentElement.scrollWidth > window.innerWidth,
    hamburgerVisible: getComputedStyle(document.getElementById('hamburger')).display !== 'none',
    sidebarOffscreen: document.getElementById('sidebar').getBoundingClientRect().left < -200,
    view: !!document.querySelector('.view.active'),
    tiles: document.querySelectorAll('.tile').length,
    searchW: Math.round(document.querySelector('.search-wrap')?.getBoundingClientRect().width || 0),
  }));
  console.log(r || '(home)', JSON.stringify(m));
}
console.log('pageerrors:', errs.length ? errs : '(none)');
await b.close();
