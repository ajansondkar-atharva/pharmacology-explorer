// paren balance checker with type tracking
const src = require('fs').readFileSync(process.argv[2], 'utf8');
const stack = [];
let inStr = null, line = 1, col = 0;
const PAIRS = { '(': ')', '[': ']', '{': '}' };
for (let i = 0; i < src.length; i++) {
  const c = src[i];
  col++;
  if (c === '\n') { line++; col = 0; }
  if (inStr) {
    if (c === '\\') i++;
    else if (c === inStr) inStr = null;
    continue;
  }
  if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
  if (PAIRS[c]) {
    stack.push({ c, line, col });
  } else if (Object.values(PAIRS).includes(c)) {
    const top = stack.pop();
    if (!top || PAIRS[top.c] !== c) {
      console.log(`MISMATCH: expected ${top ? PAIRS[top.c] : 'nothing'} got ${c} at ${line}:${col}`);
      process.exit(1);
    }
  }
}
if (stack.length) {
  console.log(`UNCLOSED ${stack.length}:`);
  stack.slice(-10).forEach((s) => console.log(`  ${s.c} opened at ${s.line}:${s.col}`));
  process.exit(1);
}
console.log('balanced OK');
