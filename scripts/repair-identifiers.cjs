// General JSON structural repair for the neurology-task template bug:
//   - "key": {,  →  "key": {        (conditional-fill left an empty brace + comma)
//   - missing commas between properties (one property per line)
//   - trailing commas before } / ]
const fs = require('fs');
const dir = 'src/data/monographs';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'));
let repaired = 0;

function repair(src) {
  // 1. empty-block bug
  src = src.replace(/(:\s*)\{,\s*(\n|$)/g, '$1{$2');
  // 2. missing inter-property commas
  const lines = src.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!/,\s*$/.test(line) && /[\]}"0-9]$/.test(line.trimEnd())) {
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      const next = (lines[j] ?? '').trim();
      if (next.startsWith('"')) line = line + ',';
    }
    out.push(line);
  }
  // 3. trailing commas before closing braces/brackets
  return out.join('\n').replace(/,\s*([}\]])/g, '$1');
}

for (const f of files) {
  const p = dir + '/' + f;
  const s = fs.readFileSync(p, 'utf8');
  let ok = true;
  try {
    JSON.parse(s);
  } catch {
    ok = false;
  }
  if (ok) continue;
  fs.writeFileSync(p, repair(s));
  repaired++;
}

// re-validate all
let bad = 0;
for (const f of files) {
  try {
    JSON.parse(fs.readFileSync(dir + '/' + f, 'utf8'));
  } catch (e) {
    bad++;
    console.log('STILL BROKEN:', f, '-', e.message.slice(0, 70));
  }
}
console.log('repaired:', repaired, '| remaining broken:', bad);
