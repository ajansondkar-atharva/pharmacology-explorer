#!/usr/bin/env node
/* Downloads variable-font woff2 files from Google Fonts (OFL licensed)
   into public/fonts/, so the app never depends on a network font CDN.
   Idempotent — skips existing files. */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'fonts');
mkdirSync(OUT, { recursive: true });

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36';

const FAMILIES = {
  'space-grotesk.woff2': 'family=Space+Grotesk:wght@400;500;600;700',
  'ibm-plex-sans.woff2': 'family=IBM+Plex+Sans:wght@400;500;600;700',
  'ibm-plex-mono.woff2': 'family=IBM+Plex+Mono:wght@400;500;600',
};

async function main() {
  for (const [file, family] of Object.entries(FAMILIES)) {
    const dest = join(OUT, file);
    if (existsSync(dest)) {
      console.log(`skip ${file} (exists)`);
      continue;
    }
    const cssUrl = `https://fonts.googleapis.com/css2?${family}&display=swap`;
    const css = await (await fetch(cssUrl, { headers: { 'User-Agent': UA } })).text();
    // css2 returns one @font-face per weight/format; take the woff2 URL of the
    // first (400) block for each family as a static variable-ish subset.
    const urls = [...css.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/g)];
    if (!urls.length) throw new Error(`no woff2 URLs found for ${file}: ${css.slice(0, 200)}`);
    // dedupe: css2 lists same unicode-range per weight; first is enough for UI text
    const url = urls[0][1];
    const buf = await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer();
    writeFileSync(dest, Buffer.from(buf));
    console.log(`ok ${file} (${(buf.byteLength / 1024).toFixed(0)} KB)`);
  }
  console.log('fonts ready → public/fonts/');
}

main().catch((e) => {
  console.error('fetch-fonts failed:', e.message);
  process.exit(1);
});
