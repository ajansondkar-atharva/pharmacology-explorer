#!/usr/bin/env node
/* Data validation — schema invariants over every bundled dataset.
   Run: npm run validate (or node scripts/validate-data.mjs).
   This is the gate for adding new monographs: no hallucinated shapes,
   no duplicate ids, valid system keys, valid severities, valid refs. */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MONO_DIR = join(ROOT, 'src', 'data', 'monographs');
const DATA_DIR = join(ROOT, 'src', 'data');

const VALID_SYSTEMS = ['gi', 'anti', 'derm', 'signal', 'cardio', 'psych', 'endo', 'resp', 'neuro', 'renal', 'heme', 'onc', 'musc', 'immune'];
const VALID_SEVERITIES = ['contraindicated', 'major', 'moderate', 'minor'];
const VALID_CONFIDENCE = ['high', 'medium', 'low'];
const VALID_SOURCES = ['curated', 'migrated', 'openfda', 'dailymed', 'rxnorm', 'user', 'community'];
const VALID_REF_TYPES = ['pubmed', 'doi', 'fda', 'dailymed', 'guideline', 'textbook', 'drugbank', 'url', 'ema', 'who'];

const errors = [];
let warnings = 0;

function check(cond, msg) {
  if (!cond) errors.push(msg);
}
function warn(msg) {
  warnings++;
  console.warn('  ⚠ ' + msg);
}

/* ---------- monographs ---------- */
const files = readdirSync(MONO_DIR).filter((f) => f.endsWith('.json'));
const ids = new Set();

for (const f of files) {
  const raw = JSON.parse(readFileSync(join(MONO_DIR, f), 'utf8'));
  const base = f.replace(/\.json$/, '');
  const m = raw;

  check(m.schemaVersion === 1, `${base}: schemaVersion must be 1 (got ${m.schemaVersion})`);
  check(typeof m.id === 'string' && /^[a-z0-9-]+$/.test(m.id), `${base}: invalid id "${m.id}"`);
  check(m.id === base, `${base}: id "${m.id}" must match filename "${base}"`);
  check(!ids.has(m.id), `${base}: duplicate id`);
  ids.add(m.id);
  check(typeof m.name === 'string' && m.name.length > 1, `${base}: missing name`);
  check(Array.isArray(m.systems) && m.systems.length > 0, `${base}: systems must be a non-empty array`);
  for (const s of m.systems) check(VALID_SYSTEMS.includes(s), `${base}: invalid system "${s}"`);
  check(m.provenance && VALID_SOURCES.includes(m.provenance.source), `${base}: invalid provenance.source`);
  check(m.provenance && VALID_CONFIDENCE.includes(m.provenance.confidence), `${base}: invalid provenance.confidence`);
  check(m.provenance && typeof m.provenance.lastUpdated === 'string', `${base}: provenance.lastUpdated required`);
  check(m.provenance && typeof m.provenance.revision === 'number', `${base}: provenance.revision required`);

  if (m.identifiers) {
    if (m.identifiers.atc) check(Array.isArray(m.identifiers.atc), `${base}: atc must be an array`);
    if (m.identifiers.rxnorm) check(Array.isArray(m.identifiers.rxnorm), `${base}: rxnorm must be an array`);
  }
  if (m.interactions) {
    for (const ix of m.interactions) {
      check(VALID_SEVERITIES.includes(ix.severity), `${base}: invalid interaction severity "${ix.severity}"`);
      check(typeof ix.summary === 'string' && ix.summary.length > 10, `${base}: interaction summary too short`);
    }
  }
  if (m.refs) {
    for (const r of m.refs) {
      check(VALID_REF_TYPES.includes(r.type), `${base}: invalid ref type "${r.type}"`);
      check(typeof r.label === 'string' && r.label.length > 2, `${base}: ref label too short`);
    }
  }
  if (m.originalFields) check(Array.isArray(m.originalFields), `${base}: originalFields must be an array`);
}

/* ---------- diseases ---------- */
const diseasesPath = join(DATA_DIR, 'diseases.json');
if (existsSync(diseasesPath)) {
  const diseases = JSON.parse(readFileSync(diseasesPath, 'utf8'));
  const dIds = new Set();
  for (const d of diseases) {
    check(d.id && !dIds.has(d.id), `disease: duplicate/missing id ${d.id}`);
    dIds.add(d.id);
    check(VALID_SYSTEMS.includes(d.system), `disease ${d.id}: invalid system "${d.system}"`);
    check(typeof d.summary === 'string', `disease ${d.id}: missing summary`);
    if (d.guidelines) for (const g of d.guidelines) check(typeof g.rec === 'string', `disease ${d.id}: guideline rec missing`);
    for (const id of d.keyDrugIds ?? []) check(ids.has(id), `disease ${d.id}: links to unknown drug "${id}"`);
  }
}

/* ---------- guidelines ---------- */
const glPath = join(DATA_DIR, 'guidelines.json');
if (existsSync(glPath)) {
  const rows = JSON.parse(readFileSync(glPath, 'utf8'));
  for (const r of rows) {
    check(r.body && r.condition && r.grade && r.rec && r.source, `guideline row missing fields: ${JSON.stringify(r).slice(0, 80)}`);
    check(['A', 'B', 'C', 'D'].includes(r.grade), `guideline row invalid grade "${r.grade}"`);
  }
}

/* ---------- interactions ---------- */
const ixPath = join(DATA_DIR, 'interactions.json');
if (existsSync(ixPath)) {
  const ix = JSON.parse(readFileSync(ixPath, 'utf8'));
  for (const p of ix.pairs ?? []) {
    check(VALID_SEVERITIES.includes(p.severity), `interaction pair ${p.a}+${p.b}: invalid severity`);
    check(typeof p.summary === 'string' && p.summary.length > 10, `interaction pair ${p.a}+${p.b}: summary too short`);
  }
}

/* ---------- algorithms ---------- */
const algoPath = join(DATA_DIR, 'algorithms.json');
if (existsSync(algoPath)) {
  const trees = JSON.parse(readFileSync(algoPath, 'utf8'));
  for (const [name, tree] of Object.entries(trees)) {
    check(tree && tree.start && tree.nodes, `algorithm ${name}: malformed`);
    for (const [nid, node] of Object.entries(tree.nodes)) {
      if (!node.leaf) {
        check(Array.isArray(node.options), `algorithm ${name}/${nid}: options missing`);
        for (const o of node.options) check(tree.nodes[o.next], `algorithm ${name}/${nid}: dangling next "${o.next}"`);
      } else {
        check(node.title && node.rec, `algorithm ${name}/${nid}: leaf missing title/rec`);
      }
    }
  }
}

/* ---------- mechanisms ---------- */
const mechPath = join(DATA_DIR, 'mechanisms.json');
if (existsSync(mechPath)) {
  const mechs = JSON.parse(readFileSync(mechPath, 'utf8'));
  for (const m of mechs) check(m.id && m.name, `mechanism missing id/name`);
}

/* ---------- summary ---------- */
if (errors.length) {
  console.error(`\n✗ VALIDATION FAILED — ${errors.length} error(s):`);
  errors.slice(0, 40).forEach((e) => console.error('  ✗ ' + e));
  process.exit(1);
}
console.log(`✓ Data valid — ${ids.size} monographs, ${existsSync(diseasesPath) ? JSON.parse(readFileSync(diseasesPath, 'utf8')).length : 0} diseases, ${existsSync(glPath) ? JSON.parse(readFileSync(glPath, 'utf8')).length : 0} guideline rows${warnings ? `, ${warnings} warning(s)` : ''}`);
