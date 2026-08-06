/* Sync engine — hash-based update detection + trusted-source import.
   Sources implement the SyncSource interface. Data lands in the
   `synced` overlay table and is merged into the catalog at load:
   synced fields enrich bundled monographs; user data is never touched.

   Bundled sources:
   - openfda  : OpenFDA drug/NDC API — brand names, routes, NDCs,
                pharmacological classes (public API, rate-limited)
   - rxnorm   : RxNorm REST API — RxCUI identifiers (public UMLS subset)

   OpenFDA requires attribution ("Data provided by the FDA U.S. Food
   and Drug Administration (openFDA)") — shown in the sync panel. */

import { MONOGRAPHS } from './catalog';
import { getSynced, putSynced, clearSynced, getPrefs, setPref } from './store';
import type { Monograph } from './types';

export interface SyncSourceDef {
  id: string;
  label: string;
  description: string;
  attribution?: string;
}

export interface SyncStats {
  checked: number;
  changed: number;
  failed: number;
  totalStored: number;
}

export interface SyncReport {
  source: string;
  startedAt: number;
  finishedAt: number;
  stats: SyncStats;
  error?: string;
}

export type SyncProgress = (source: string, done: number, total: number, label: string) => void;

interface SyncSource {
  def: SyncSourceDef;
  run(onProgress: SyncProgress): Promise<SyncStats>;
}

/* ---------- hashing (FNV-1a, stable) ---------- */

export function hashOf(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/* ---------- OpenFDA source ---------- */

interface OpenFDAResult {
  brand_name?: string;
  generic_name?: string;
  product_ndc?: string;
  route?: string[];
  pharm_class_epc?: string[];
  pharm_class_moa?: string[];
  active_ingredients?: Array<{ name: string; strength: string }>;
  openfda?: {
    rxcui?: string[];
    unii?: string[];
    nui?: string[];
  };
}

const OPENFDA_BASE = 'https://api.fda.gov/drug/ndc.json';

async function openfdaSearch(name: string, limit = 6): Promise<OpenFDAResult[]> {
  const url = `${OPENFDA_BASE}?search=generic_name:"${encodeURIComponent(name)}"+brand_name:"${encodeURIComponent(name)}"&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) {
    if (res.status === 404) return []; // no results
    throw new Error(`OpenFDA ${res.status}`);
  }
  const data = (await res.json()) as { results?: OpenFDAResult[] };
  return data.results ?? [];
}

async function openfdaSource(onProgress: SyncProgress): Promise<SyncStats> {
  const stats: SyncStats = { checked: 0, changed: 0, failed: 0, totalStored: 0 };
  const existing = await getSynced();
  const existingHashes = new Map(existing.filter((r) => r.source === 'openfda').map((r) => [r.drugId, r.hash]));

  for (let i = 0; i < MONOGRAPHS.length; i++) {
    const m = MONOGRAPHS[i];
    onProgress('openfda', i + 1, MONOGRAPHS.length, m.name);
    stats.checked++;
    try {
      const results = await openfdaSearch(m.name);
      if (!results.length) continue;

      const brands = [...new Set(results.map((r) => r.brand_name).filter(Boolean) as string[])];
      const routes = [...new Set(results.flatMap((r) => r.route ?? []))];
      const ndcs = [...new Set(results.map((r) => r.product_ndc).filter(Boolean) as string[])];
      const rxcuis = [...new Set(results.flatMap((r) => r.openfda?.rxcui ?? []))];
      const unii = [...new Set(results.flatMap((r) => r.openfda?.unii ?? []))];
      const pharmClasses = [...new Set([...results.flatMap((r) => r.pharm_class_epc ?? []), ...results.flatMap((r) => r.pharm_class_moa ?? [])])];

      const overlay: Partial<Monograph> = {
        id: m.id,
        name: m.name,
        brandNames: brands.length ? [...new Set([...(m.brandNames ?? []), ...brands])] : m.brandNames,
        systems: m.systems,
        class: pharmClasses.length && !m.class ? pharmClasses.join('; ') : m.class,
        identifiers: {
          ...(m.identifiers ?? {}),
          ...(rxcuis.length ? { rxnorm: [...new Set([...(m.identifiers?.rxnorm ?? []), ...rxcuis])] } : {}),
          ...(unii.length ? { unii: unii[0] } : {}),
          ...(ndcs.length ? { ndc: ndcs.slice(0, 20) } : {}),
        },
        pharmacokinetics: {
          ...(m.pharmacokinetics ?? {}),
          ...(routes.length ? { routes: [...new Set([...(m.pharmacokinetics?.routes ?? []), ...routes])] } : {}),
        },
        provenance: {
          source: 'openfda',
          confidence: 'high',
          lastUpdated: new Date().toISOString().slice(0, 10),
          revision: (m.provenance?.revision ?? 0) + 1,
          notes: 'Enriched from OpenFDA drug/NDC (brand names, routes, NDC, RxCUI, UNII, pharm class). Data provided by the FDA (openFDA).',
        },
      };
      const json = JSON.stringify(overlay);
      const h = hashOf(json);
      if (existingHashes.get(m.id) === h) continue;
      await putSynced({ drugId: m.id, source: 'openfda', hash: h, json, updatedAt: Date.now() });
      stats.changed++;
    } catch {
      stats.failed++;
    }
    await sleep(120); // respect OpenFDA rate limits
  }

  stats.totalStored = (await getSynced()).filter((r) => r.source === 'openfda').length;
  return stats;
}

/* ---------- RxNorm source ---------- */

const RXNAV = 'https://rxnav.nlm.nih.gov/REST';

async function rxnormSource(onProgress: SyncProgress): Promise<SyncStats> {
  const stats: SyncStats = { checked: 0, changed: 0, failed: 0, totalStored: 0 };
  const existing = await getSynced();
  const existingHashes = new Map(existing.filter((r) => r.source === 'rxnorm').map((r) => [r.drugId, r.hash]));

  for (let i = 0; i < MONOGRAPHS.length; i++) {
    const m = MONOGRAPHS[i];
    onProgress('rxnorm', i + 1, MONOGRAPHS.length, m.name);
    stats.checked++;
    try {
      const res = await fetch(`${RXNAV}/rxcui.json?name=${encodeURIComponent(m.name)}&search=2`);
      if (!res.ok) {
        if (res.status === 404) continue;
        throw new Error(`RxNorm ${res.status}`);
      }
      const data = (await res.json()) as { idGroup?: { rxnormId?: string[] } };
      const rxcuis = data.idGroup?.rxnormId ?? [];
      if (!rxcuis.length) continue;

      const overlay: Partial<Monograph> = {
        id: m.id,
        name: m.name,
        systems: m.systems,
        identifiers: {
          ...(m.identifiers ?? {}),
          rxnorm: [...new Set([...(m.identifiers?.rxnorm ?? []), ...rxcuis])],
        },
        provenance: {
          source: 'rxnorm',
          confidence: 'high',
          lastUpdated: new Date().toISOString().slice(0, 10),
          revision: (m.provenance?.revision ?? 0) + 1,
          notes: 'RxCUI identifiers resolved via RxNorm REST API (public UMLS subset).',
        },
      };
      const json = JSON.stringify(overlay);
      const h = hashOf(json);
      if (existingHashes.get(m.id) === h) continue;
      await putSynced({ drugId: m.id, source: 'rxnorm', hash: h, json, updatedAt: Date.now() });
      stats.changed++;
    } catch {
      stats.failed++;
    }
    await sleep(80);
  }

  stats.totalStored = (await getSynced()).filter((r) => r.source === 'rxnorm').length;
  return stats;
}

/* ---------- manager ---------- */

const SOURCES: Array<{ def: SyncSourceDef; run: SyncSource['run'] }> = [
  {
    def: {
      id: 'openfda',
      label: 'OpenFDA (FDA drug/NDC)',
      description: 'Enriches monographs with brand names, routes, NDC numbers, RxCUI/UNII identifiers, and pharmacological class.',
      attribution: 'Data provided by the U.S. Food and Drug Administration (openFDA).',
    },
    run: openfdaSource,
  },
  {
    def: {
      id: 'rxnorm',
      label: 'RxNorm (NLM)',
      description: 'Resolves RxCUI identifiers for each monograph via the public RxNorm REST API.',
    },
    run: rxnormSource,
  },
];

export const SYNC_SOURCES = SOURCES.map((s) => s.def);

export interface SyncState {
  lastRun: number | null;
  reports: SyncReport[];
}

export async function loadSyncState(): Promise<SyncState> {
  const prefs = await getPrefs();
  try {
    return JSON.parse(prefs['sync:state'] ?? '{"lastRun":null,"reports":[]}') as SyncState;
  } catch {
    return { lastRun: null, reports: [] };
  }
}

export async function saveSyncState(state: SyncState): Promise<void> {
  await setPref('sync:state', JSON.stringify(state));
}

export async function runSync(
  sourceIds: string[],
  onProgress: SyncProgress,
  onDone?: (reports: SyncReport[]) => void
): Promise<SyncReport[]> {
  const reports: SyncReport[] = [];
  const state = await loadSyncState();
  for (const src of SOURCES) {
    if (!sourceIds.includes(src.def.id)) continue;
    const startedAt = Date.now();
    let stats: SyncStats = { checked: 0, changed: 0, failed: 0, totalStored: 0 };
    let error: string | undefined;
    try {
      stats = await src.run(onProgress);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
    reports.push({ source: src.def.id, startedAt, finishedAt: Date.now(), stats, error });
  }
  state.lastRun = Date.now();
  state.reports = [...reports, ...state.reports.filter((r) => !sourceIds.includes(r.source))].slice(0, 20);
  await saveSyncState(state);
  onDone?.(reports);
  return reports;
}

export async function resetSource(sourceId: string): Promise<void> {
  await clearSynced(sourceId);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
