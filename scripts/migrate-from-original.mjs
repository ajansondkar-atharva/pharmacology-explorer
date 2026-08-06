#!/usr/bin/env node
/* ============================================================
   MIGRATION — v1 single-file app → structured JSON monographs
   Extracts DATA.ppi / nsaid / antibiotics / acne / derm / wiki /
   interactions / mechanisms from reference/original.html,
   maps fields into the provenance-first schema, and writes
   src/data/monographs/<id>.json + src/data/*.json.
   Nothing is lost: every original field survives in
   `originalFields`.
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'reference', 'original.html'), 'utf8');
const OUT_MONO = join(ROOT, 'src', 'data', 'monographs');
const OUT_DATA = join(ROOT, 'src', 'data');
const FILE_DATE = existsSync(join(ROOT, 'reference', 'original.html'))
  ? statSync(join(ROOT, 'reference', 'original.html')).mtime.toISOString().slice(0, 10)
  : '2026-08-06';

mkdirSync(OUT_MONO, { recursive: true });
mkdirSync(join(OUT_DATA, 'topics'), { recursive: true });

/* ---------- balanced extractor (string/escape aware, [ ] or { }) ---------- */
function extractBalanced(src, startIdx) {
  let i = startIdx;
  while (i < src.length && /\s/.test(src[i])) i++;
  const open = src[i];
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) throw new Error('not an object/array literal at ' + startIdx);
  let depth = 0;
  let inStr = null;
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (c === '\\') j++;
      else if (c === inStr) inStr = null;
    } else if (c === '"' || c === "'") {
      inStr = c;
    } else if (c === open) {
      depth++;
    } else if (c === close) {
      if (--depth === 0) return src.slice(i, j + 1);
    }
  }
  throw new Error('unbalanced ' + open + ' from ' + startIdx);
}

function extractAssignment(src, pattern) {
  const m = src.match(pattern);
  if (!m) throw new Error('no match for ' + pattern);
  return extractBalanced(src, src.indexOf('=', m.index) + 1);
}

const evalLit = (code) => Function('"use strict";return (' + code + ');')();

const ENT = { '&gt;': '>', '&lt;': '<', '&amp;': '&', '&quot;': '"', '&#39;': "'", '&apos;': "'", '&nbsp;': ' ' };
function unescape(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/&(gt|lt|amp|quot|#39|apos|nbsp);/g, (m) => ENT[m] ?? m).replace(/\\u2019/g, '\u2019');
}
function walk(o) {
  if (Array.isArray(o)) return o.map(walk);
  if (o && typeof o === 'object') return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, walk(v)]));
  return unescape(o);
}

/* ---------- extraction ---------- */
const datasets = {
  ppi: extractAssignment(SRC, /DATA\.ppi\s*=\s*/),
  nsaid: extractAssignment(SRC, /DATA\.nsaid\s*=\s*/),
  antibiotics: extractAssignment(SRC, /DATA\.antibiotics\s*=\s*/),
  acne: extractAssignment(SRC, /DATA\.acne\s*=\s*/),
  derm: extractAssignment(SRC, /DATA\.derm\s*=\s*/),
  mechanisms: extractAssignment(SRC, /DATA\.mechanisms\s*=\s*/),
  interactions: extractAssignment(SRC, /DATA\.interactions\s*=\s*/),
  entities: extractAssignment(SRC, /const INTERACTION_ENTITIES\s*=\s*/),
  wiki: extractAssignment(SRC, /DATA\.wiki\s*=\s*/),
};

const DATA = Object.fromEntries(Object.entries(datasets).map(([k, code]) => [k, walk(evalLit(code))]));

/* ---------- label → schema field mapping ---------- */
const LABEL_MAP = [
  [/mechanism/i, 'mechanism'],
  [/potency|pharmacodynam/i, 'pharmacodynamics'],
  [/onset/i, 'pk.onset'],
  [/duration/i, 'pk.duration'],
  [/metabolism|cys|cyp/i, 'pk.metabolism'],
  [/indications/i, 'indications'],
  [/typical uses|clinical use/i, 'indications'],
  [/key cautions|warnings/i, 'safety.warnings'],
  [/interactions/i, 'interactionNotes'],
  [/pearl/i, 'pearl'],
  [/meal timing/i, 'mealTiming'],
  [/pharmacokinetic/i, 'pk.note'],
];

function setPath(obj, path, value) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] ??= {};
    cur = cur[parts[i]];
  }
  cur[parts[parts.length - 1]] = value;
}

function mapFields(fields) {
  const out = {};
  const notes = [];
  for (const [label, value] of fields || []) {
    let mapped = false;
    for (const [re, path] of LABEL_MAP) {
      if (re.test(label)) {
        if (path === 'interactionNotes') notes.push(value);
        else if (path === 'indications') {
          const list = out.indications ?? [];
          list.push(value);
          out.indications = list;
        } else if (path === 'pearl') {
          out.clinicalPearls = [...(out.clinicalPearls ?? []), value];
        } else if (path === 'safety.warnings') {
          out.safety ??= {};
          out.safety.warnings = [...(out.safety.warnings ?? []), value];
        } else {
          setPath(out, path, value);
        }
        mapped = true;
        break;
      }
    }
    if (!mapped) {
      out.extraNotes = [...(out.extraNotes ?? []), `${label}: ${value}`];
    }
  }
  if (notes.length) out.interactionNotes = notes;
  return out;
}

/* ---------- system guesser for migrated wiki drugs ---------- */
const SYSTEM_HINTS = [
  [/pp|acid|proton|gi|gastric|ulcer|anti-emetic|antiemetic|nausea/i, 'gi'],
  [/antibiotic|antifungal|antiviral|antimicrobial|bacterial|azole|cyclovir|cillin|cycline|nitro/i, 'anti'],
  [/acne|topical|dermat|retin|depigment|melasma|hydroquinone|peroxide|clindamycin/i, 'derm'],
  [/statin|anticoag|antiplatelet|hypertens|angina|arrhythm|beta.?block|calcium.?channel|ace |arb |diuretic|cardio|lipid/i, 'cardio'],
  [/antidepress|ssri|antipsych|psych|anxiolytic|sedative/i, 'psych'],
  [/diabet|insulin|metformin|gliflozin|glutide|endocrine|thyroid|steroid/i, 'endo'],
  [/asthma|copd|bronchodil|inhal|respiratory|leukotriene|antihistamine|montelukast|salbutamol/i, 'resp'],
  [/anticonvuls|analgesic|antipyretic|opioid|neurolog|migraine|parkinson/i, 'neuro'],
  [/nsaid|musculoskeletal|anti-inflammatory|gout/i, 'musc'],
  [/anticoag|heparin|warfarin|antiplatelet/i, 'heme'],
];

function guessSystems(cls, name) {
  const hay = `${cls ?? ''} ${name ?? ''}`;
  const found = new Set();
  for (const [re, sys] of SYSTEM_HINTS) if (re.test(hay)) found.add(sys);
  if (!found.size) found.add('signal');
  return [...found];
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

/* ---------- build monographs ---------- */
const written = [];
let count = 0;

function writeMonograph(m) {
  const path = join(OUT_MONO, `${m.id}.json`);
  const existing = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : null;
  if (existing) {
    // Collision (drug appears in two v1 datasets, e.g. acne + wiki):
    // first write is the class-specific one — it wins for scalars;
    // originalFields are unioned so no content is lost.
    const seen = new Set((existing.originalFields || []).map(([l]) => l));
    const merged = { ...existing };
    merged.originalFields = [...(existing.originalFields || [])];
    for (const [label, value] of m.originalFields || []) {
      if (!seen.has(label)) {
        merged.originalFields.push([label, value]);
        seen.add(label);
      }
    }
    merged.provenance = {
      ...existing.provenance,
      notes: [existing.provenance?.notes, `Merged with ${m.provenance.source} entry (id ${m.id}).`].filter(Boolean).join(' '),
    };
    writeFileSync(path, JSON.stringify(merged, null, 2) + '\n');
    written.push(path);
    return;
  }
  writeFileSync(path, JSON.stringify(m, null, 2) + '\n');
  written.push(path);
  count++;
}

function baseMono(id, name, cls, systems, extra = {}) {
  return {
    schemaVersion: 1,
    id,
    name,
    class: cls || undefined,
    systems,
    ...extra,
    provenance: {
      source: 'migrated',
      confidence: 'medium',
      lastUpdated: FILE_DATE,
      revision: 1,
      notes: 'Migrated verbatim from the v1 single-file app (reference/original.html). Content is author-curated study material, not a regulatory source.',
    },
  };
}

/* PPIs & PCABs */
for (const d of DATA.ppi) {
  const mapped = mapFields(d.fields);
  const m = baseMono(d.id, d.name, d.cls, ['gi'], {
    summary: d.summary,
    good: d.good,
    bad: d.bad,
    clinicalPearls: mapped.clinicalPearls?.length ? mapped.clinicalPearls : (d.pearl ? [d.pearl] : undefined),
    mechanism: mapped.mechanism,
    pharmacodynamics: mapped.pharmacodynamics,
    pharmacokinetics: {
      onset: mapped.pk?.onset,
      duration: mapped.pk?.duration,
      metabolism: mapped.pk?.metabolism,
    },
    indications: mapped.indications,
    interactionNotes: mapped.interactionNotes,
    originalFields: d.fields,
    classId: 'ppi',
  });
  writeMonograph(m);
}

/* NSAIDs */
for (const d of DATA.nsaid) {
  const mapped = mapFields(d.fields);
  const m = baseMono(d.id, d.name, d.cls, guessSystems(d.cls, d.name), {
    summary: d.summary,
    good: d.good,
    bad: d.bad,
    clinicalPearls: mapped.clinicalPearls?.length ? mapped.clinicalPearls : (d.pearl ? [d.pearl] : undefined),
    mechanism: mapped.mechanism,
    pharmacodynamics: mapped.pharmacodynamics,
    pharmacokinetics: { onset: mapped.pk?.onset, duration: mapped.pk?.duration, metabolism: mapped.pk?.metabolism },
    indications: mapped.indications,
    interactionNotes: mapped.interactionNotes,
    originalFields: d.fields,
    classId: 'nsaid',
  });
  writeMonograph(m);
}

/* Antibiotics (classes with drugs) */
for (const cls of DATA.antibiotics) {
  const classId = 'abx-' + slug(cls.name);
  for (const d of cls.drugs || []) {
    const mapped = mapFields(d.fields);
    const m = baseMono(d.id, d.name, d.cls || cls.name, ['anti'], {
      summary: d.summary,
      good: d.good,
      bad: d.bad,
      clinicalPearls: mapped.clinicalPearls?.length ? mapped.clinicalPearls : (d.pearl ? [d.pearl] : undefined),
      mechanism: mapped.mechanism,
      pharmacodynamics: mapped.pharmacodynamics,
      pharmacokinetics: { onset: mapped.pk?.onset, duration: mapped.pk?.duration, metabolism: mapped.pk?.metabolism },
      indications: mapped.indications,
      interactionNotes: mapped.interactionNotes,
      originalFields: d.fields,
      classId,
    });
    writeMonograph(m);
  }
}

/* Acne */
for (const d of DATA.acne) {
  const mapped = mapFields(d.fields);
  const m = baseMono(d.id, d.name, d.cls, ['derm'], {
    summary: d.summary,
    good: d.good,
    bad: d.bad,
    clinicalPearls: mapped.clinicalPearls?.length ? mapped.clinicalPearls : (d.pearl ? [d.pearl] : undefined),
    mechanism: mapped.mechanism,
    pharmacodynamics: mapped.pharmacodynamics,
    pharmacokinetics: { onset: mapped.pk?.onset, duration: mapped.pk?.duration, metabolism: mapped.pk?.metabolism },
    indications: mapped.indications,
    interactionNotes: mapped.interactionNotes,
    originalFields: d.fields,
    classId: 'acne',
  });
  writeMonograph(m);
}

/* Wiki atlas */
for (const d of DATA.wiki) {
  const mapped = mapFields(d.fields);
  const m = baseMono(d.id, d.name, d.cls, guessSystems(d.cls, d.name), {
    summary: d.summary,
    good: d.good,
    bad: d.bad,
    clinicalPearls: mapped.clinicalPearls?.length ? mapped.clinicalPearls : (d.pearl ? [d.pearl] : undefined),
    mechanism: mapped.mechanism,
    pharmacodynamics: mapped.pharmacodynamics,
    indications: mapped.indications,
    interactionNotes: mapped.interactionNotes,
    safety: mapped.safety?.warnings ? { warnings: mapped.safety.warnings } : undefined,
    originalFields: d.fields,
  });
  writeMonograph(m);
}

/* Derm topics (non-drug encyclopedia topics) */
const topics = (DATA.derm || []).map((t) => ({
  id: t.id,
  name: t.name,
  type: 'derm-topic',
  summary: t.summary,
  subtitle: t.subtitle,
  desc: t.desc,
  details: t.details || null,
  provenance: { source: 'migrated', confidence: 'medium', lastUpdated: FILE_DATE, revision: 1 },
}));
writeFileSync(join(OUT_DATA, 'topics', 'derm.json'), JSON.stringify(topics, null, 2) + '\n');

/* Mechanisms */
writeFileSync(join(OUT_DATA, 'mechanisms.json'), JSON.stringify(DATA.mechanisms, null, 2) + '\n');

/* Algorithms (decision trees) */
const algoAcid = extractAssignment(SRC, /const ALGO_ACID\s*=\s*/);
const algoAcne = extractAssignment(SRC, /const ALGO_ACNE\s*=\s*/);
writeFileSync(
  join(OUT_DATA, 'algorithms.json'),
  JSON.stringify({ acid: walk(evalLit(algoAcid)), acne: walk(evalLit(algoAcne)) }, null, 2) + '\n'
);

/* Interactions (entities + pairs) */
writeFileSync(
  join(OUT_DATA, 'interactions.json'),
  JSON.stringify({ entities: DATA.entities, pairs: DATA.interactions }, null, 2) + '\n'
);

/* ---------- summary ---------- */
console.log(`Migrated ${count} monographs → ${OUT_MONO}`);
console.log(`Topics: ${topics.length} (derm) · Mechanisms: ${DATA.mechanisms.length} · Interaction pairs: ${DATA.interactions.length} · Entities: ${DATA.entities.length}`);
const bySrc = {};
for (const p of written) {
  const m = JSON.parse(readFileSync(p, 'utf8'));
  const src = m.provenance.source;
  bySrc[src] = (bySrc[src] ?? 0) + 1;
}
console.log('Provenance:', JSON.stringify(bySrc));
