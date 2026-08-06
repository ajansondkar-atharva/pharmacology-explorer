/* Search engine — custom, dependency-free, deterministic.
   Pipeline: normalize → field-scoped matching (name/brand/synonym/ATC/
   class/blob) → bounded Damerau–Levenshtein fuzzy for short queries →
   rank by score → highlight. Supports `atc:`, `class:`, `sys:` prefixes.
   Built once at startup; cheap enough to run per keystroke up to ~10k docs. */

import { MONOGRAPHS, MECHANISMS, TOPICS } from './catalog';
import type { ViewKey } from './router';

export interface SearchDoc {
  id: string;
  name: string;
  type: 'drug' | 'mechanism' | 'topic';
  view: ViewKey;
  param: string;
  meta: string;
  sys?: string;
  synonyms: string[];
}

interface IndexedDoc extends SearchDoc {
  tokens: Set<string>;
  nameCompact: string;
  blob: string;
  boost: number;
}

let INDEX: IndexedDoc[] = [];

function normTokens(s: string): Set<string> {
  return new Set(
    s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length > 0)
  );
}

function compact(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Damerau–Levenshtein distance with early exit (bounded). */
function damerau(a: string, b: string, max: number): number {
  const n = a.length, m = b.length;
  if (Math.abs(n - m) > max) return max + 1;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i][0] = i;
  for (let j = 0; j <= m; j++) d[0][j] = j;
  let best = max + 1;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
    if (i === n) best = Math.min(best, d[n].reduce((x, y) => Math.min(x, y)));
  }
  return best;
}

export function buildSearchIndex(): void {
  const docs: IndexedDoc[] = [];
  const boost = { drug: 1.0, mechanism: 0.85, topic: 0.8 };

  for (const m of MONOGRAPHS) {
    const names = [m.name, ...(m.brandNames ?? []), ...(m.synonyms ?? [])];
    const blobParts: string[] = [
      m.name,
      ...names,
      m.class ?? '',
      m.classId ?? '',
      m.summary ?? '',
      m.mechanism ?? '',
      ...(m.indications ?? []),
      ...(m.identifiers?.atc ?? []),
      ...(m.identifiers?.rxnorm ?? []),
      m.identifiers?.drugbank ?? '',
      m.identifiers?.cas ?? '',
      m.identifiers?.unii ?? '',
      m.identifiers?.pubchem ? String(m.identifiers.pubchem) : '',
      ...(m.targets ?? []),
    ];
    const tokens = new Set<string>();
    for (const n of names) for (const t of normTokens(n)) tokens.add(t);
    docs.push({
      id: m.id,
      name: m.name,
      type: 'drug',
      view: 'monograph',
      param: m.id,
      meta: m.class ?? 'Drug',
      sys: m.systems[0],
      synonyms: [...(m.brandNames ?? []), ...(m.synonyms ?? [])],
      tokens,
      nameCompact: compact(m.name),
      blob: blobParts.join(' ').toLowerCase(),
      boost: boost.drug,
    });
  }

  for (const mech of MECHANISMS) {
    docs.push({
      id: mech.id,
      name: mech.name,
      type: 'mechanism',
      view: 'mechanisms',
      param: mech.id,
      meta: 'Mechanism',
      sys: 'signal',
      synonyms: [],
      tokens: normTokens(`${mech.name} ${mech.subtitle ?? ''}`),
      nameCompact: compact(mech.name),
      blob: `${mech.name} ${mech.subtitle ?? ''} ${mech.summary ?? ''} ${mech.use ?? ''}`.toLowerCase(),
      boost: boost.mechanism,
    });
  }

  for (const t of TOPICS) {
    docs.push({
      id: t.id,
      name: t.name,
      type: 'topic',
      view: 'diseases',
      param: t.id,
      meta: t.type === 'derm-topic' ? 'Dermatology topic' : 'Topic',
      sys: 'derm',
      synonyms: [],
      tokens: normTokens(`${t.name} ${t.subtitle ?? ''}`),
      nameCompact: compact(t.name),
      blob: `${t.name} ${t.subtitle ?? ''} ${t.summary ?? ''} ${t.desc ?? ''}`.toLowerCase(),
      boost: boost.topic,
    });
  }

  INDEX = docs;
}

export function searchIndexSize(): number {
  return INDEX.length;
}

export interface SearchResult {
  doc: SearchDoc;
  score: number;
  matchedField: string;
}

export interface SearchOptions {
  limit?: number;
  prefix?: string; // 'atc:' | 'class:' | 'sys:'
}

export function search(query: string, opts: SearchOptions = {}): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q || !INDEX.length) return [];

  // scoped queries: atc:A02BC  class:ppi  sys:cardio
  const scopeMatch = q.match(/^(atc|class|sys):(.+)$/);
  const scope = scopeMatch?.[1] ?? opts.prefix ?? '';
  const qBody = scopeMatch ? scopeMatch[2] : q;

  const qTokens = qBody.replace(/[^a-z0-9]+/g, ' ').split(' ').filter((t) => t.length > 0);
  if (!qTokens.length) return [];
  const qCompact = compact(qBody);

  const results: SearchResult[] = [];
  const fuzzy = qBody.length >= 4;

  for (const doc of INDEX) {
    if (scope === 'atc' && !doc.blob.includes('atc:') && !hasAtc(doc, qBody)) continue;
    if (scope === 'class') {
      const clsMatch = doc.blob.includes(qBody) && (doc.meta.toLowerCase().includes(qBody) || (doc as { classId?: string }).classId?.includes(qBody));
      if (!clsMatch) continue;
    }
    if (scope === 'sys' && doc.sys !== qBody) continue;

    let total = 0;
    let matchedField = 'blob';
    let coverage = 0;

    for (const qt of qTokens) {
      let best = 0;
      let field = 'blob';

      if (doc.name.toLowerCase() === qBody) { best = Math.max(best, 130); field = 'name'; }
      if (doc.name.toLowerCase().startsWith(qBody)) { best = Math.max(best, 110); field = 'name'; }
      if (doc.nameCompact.startsWith(qCompact) && qCompact.length >= 2) { best = Math.max(best, 100); field = 'name'; }

      if (doc.tokens.has(qt)) {
        const nameHit = doc.name.toLowerCase().split(/[^a-z0-9]+/).includes(qt);
        best = Math.max(best, nameHit ? 95 : 60);
        field = nameHit ? 'name' : 'token';
      }
      for (const s of doc.synonyms) {
        if (s.toLowerCase().startsWith(qBody)) { best = Math.max(best, 95); field = 'synonym'; }
        if (s.toLowerCase().split(/[^a-z0-9]+/).includes(qt)) { best = Math.max(best, 80); field = 'synonym'; }
      }
      if (qBody.length >= 3 && doc.name.toLowerCase().includes(qBody)) { best = Math.max(best, 75); field = 'name'; }
      if (doc.blob.includes(qBody)) { best = Math.max(best, 45); }

      if (fuzzy) {
        for (const nameToken of doc.tokens) {
          const limit = nameToken.length <= 6 ? 1 : 2;
          if (Math.abs(nameToken.length - qt.length) > limit) continue;
          const d = damerau(nameToken, qt, limit);
          if (d <= limit) {
            best = Math.max(best, 50 - d * 8);
            field = 'fuzzy';
            break;
          }
        }
      }

      if (best > 0) {
        total += best;
        coverage++;
        matchedField = field;
      } else {
        total = 0;
        break; // AND semantics across tokens
      }
    }
    if (total === 0) continue;
    const score = total * (coverage / qTokens.length) * doc.boost;
    results.push({ doc, score, matchedField });
  }

  results.sort((a, b) => b.score - a.score || a.doc.name.length - b.doc.name.length);
  return results.slice(0, opts.limit ?? 10);
}

function hasAtc(doc: IndexedDoc, q: string): boolean {
  const atcRe = /(atc[:\s]*[a-z0-9]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = atcRe.exec(doc.blob))) {
    if (m[1].toLowerCase().replace(/atc[: ]/, '') === q.toLowerCase()) return true;
  }
  return false;
}

/** Highlight the query's first occurrence inside a name (safe — escaped first). */
export function highlightName(name: string, query: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safe = esc(name);
  const q = query.trim().toLowerCase();
  if (!q) return safe;
  const idx = safe.toLowerCase().indexOf(q);
  if (idx < 0) return safe;
  return (
    safe.slice(0, idx) +
    '<span style="color:var(--accent);font-weight:600;">' +
    safe.slice(idx, idx + q.length) +
    '</span>' +
    safe.slice(idx + q.length)
  );
}
