import puppeteer from 'puppeteer-core';
import path from 'node:path';
import fs from 'node:fs';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = process.argv[2] || 'http://localhost:4173/';
const OUT = path.resolve(process.cwd(), '.shots') + path.sep;
fs.mkdirSync(OUT, { recursive: true });

const ROUTES = ['home', 'directory', 'interactions', 'pk', 'mechanisms', 'algorithms', 'diseases', 'guidelines', 'study', 'saved'];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--disable-gpu'] });
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));

function contrast(fg, bg) {
  const p = c => { const m = c.match(/\d+/g); return m ? m.map(Number) : [0,0,0]; };
  const [r1,g1,b1] = p(fg), [r2,g2,b2] = p(bg);
  const lum = (r,g,b) => { const f = v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
  const l1 = lum(r1,g1,b1), l2 = lum(r2,g2,b2);
  return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
}

for (const route of ROUTES) {
  await page.goto(`${BASE}#/${route}`, { waitUntil: 'networkidle0', timeout: 45000 });
  await new Promise(r => setTimeout(r, 900));
  await page.screenshot({ path: `${OUT}view-${route}.png` });

  const r = await page.evaluate(() => {
    const contrast = (fg, bg) => {
      const p = c => { const m = c.match(/\d+/g); return m ? m.map(Number) : [0,0,0]; };
      const [r1,g1,b1] = p(fg), [r2,g2,b2] = p(bg);
      const lum = (r,g,b) => { const f = v => { v/=255; return v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }; return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b); };
      const l1 = lum(r1,g1,b1), l2 = lum(r2,g2,b2);
      return (Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05);
    };
    const q = s => document.querySelector(s);
    const view = q('.view.active');
    const text = (view?.innerText || '').trim();
    const stats = {
      route: location.hash,
      textLen: text.length,
      textHead: text.slice(0, 400),
      fontSize: view ? getComputedStyle(view).fontSize : null,
      headings: [...(view?.querySelectorAll('h1,h2,h3') || [])].map(h => ({ tag: h.tagName, txt: (h.textContent || '').trim().slice(0, 60), fs: getComputedStyle(h).fontSize })),
      buttons: (view?.querySelectorAll('button') || []).length,
      inputs: (view?.querySelectorAll('input,select,textarea') || []).length,
      links: (view?.querySelectorAll('a') || []).length,
      imgs: (view?.querySelectorAll('img') || []).length,
      emptyEls: [...(view?.querySelectorAll('div,section,article') || [])].filter(e => e.offsetHeight > 20 && (e.innerText || '').trim() === '').length,
      overflowX: view ? view.scrollWidth > view.clientWidth : false,
      tinyText: [...(view?.querySelectorAll('*') || [])].filter(e => { const s = getComputedStyle(e); return s.fontSize && parseFloat(s.fontSize) < 11 && (e.innerText || '').trim(); }).length,
      lowContrast: (() => { let n = 0; for (const e of (view?.querySelectorAll('*') || [])) { const s = getComputedStyle(e); if (!s.color || !(e.innerText || '').trim()) continue; const bg = s.backgroundColor === 'rgba(0, 0, 0, 0)' ? 'rgb(10, 14, 19)' : s.backgroundColor; if (contrast(s.color, bg) < 3.5 && parseFloat(s.fontSize) > 0) n++; } return n; })(),
     };
     return stats;
  });
  console.log(`\n===== ${route} =====\n${JSON.stringify(r, null, 1)}`);
}

console.log('\n===== PAGE ERRORS =====', errors.length ? errors.join('\n') : '(none)');
await browser.close();
