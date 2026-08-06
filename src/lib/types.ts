/* ============================================================
   DATA MODEL — provenance-first monograph schema
   Rules:
   - Unknown values are OMITTED, never invented.
   - Every monograph carries provenance (source, confidence,
     lastUpdated, revision).
   - `originalFields` preserves legacy v1 content verbatim so
     no migrated knowledge is ever lost.
   ============================================================ */

export const SCHEMA_VERSION = 1;

export type SystemKey =
  | 'gi' | 'anti' | 'derm' | 'signal' | 'cardio' | 'psych'
  | 'endo' | 'resp' | 'neuro' | 'renal' | 'heme' | 'onc'
  | 'musc' | 'immune';

export type Confidence = 'high' | 'medium' | 'low';
export type DataSource = 'curated' | 'migrated' | 'openfda' | 'dailymed' | 'rxnorm' | 'user' | 'community';

export interface Provenance {
  source: DataSource;
  confidence: Confidence;
  lastUpdated: string;   // ISO date
  revision: number;
  notes?: string;
}

export interface Identifiers {
  atc?: string[];
  rxnorm?: string[];
  cas?: string;
  drugbank?: string;
  pubchem?: number;
  unii?: string;
  ndc?: string[];
}

export interface Chemistry {
  formula?: string;
  smiles?: string;
  inchikey?: string;
  molecularWeight?: string; // Da (string to allow ranges)
}

export interface Pharmacokinetics {
  bioavailability?: string;
  halfLife?: string;
  proteinBinding?: string;
  volumeOfDistribution?: string;
  clearance?: string;
  onset?: string;
  duration?: string;
  metabolism?: string;          // e.g. "Hepatic, CYP2C19 major, CYP3A4 minor"
  activeMetabolites?: string[];
  elimination?: string;
  routes?: string[];            // 'oral' | 'iv' | 'topical' | ...
}

export interface Dosing {
  adult?: string;
  pediatric?: string;
  geriatric?: string;
  renalAdjustment?: string;
  hepaticAdjustment?: string;
  maxDose?: string;
}

export interface AdverseEffect {
  effect: string;
  frequency?: string; // e.g. 'common', '1–10%', 'rare'
}

export interface Safety {
  pregnancy?: string;   // category / narrative
  lactation?: string;
  contraindications?: string[];
  warnings?: string[];
  blackBox?: string[];
  monitoring?: string[];
  adverseEffects?: AdverseEffect[];
  overdose?: string;
}

export type InteractionSeverity = 'contraindicated' | 'major' | 'moderate' | 'minor';

export interface DrugInteraction {
  withId?: string;        // canonical drug id when known
  withClass?: string;     // class label when pair is class-level
  severity: InteractionSeverity;
  summary: string;
  mechanism?: string;
  management?: string;
  evidence?: string;      // 'RCT' | 'meta-analysis' | 'case report' | ...
}

export interface Citation {
  label: string;
  type: 'pubmed' | 'doi' | 'fda' | 'dailymed' | 'guideline' | 'textbook' | 'drugbank' | 'url' | 'ema' | 'who';
  id?: string;            // PMID / DOI / URL
  note?: string;
}

export interface Monograph {
  schemaVersion: number;
  id: string;
  name: string;
  brandNames?: string[];
  synonyms?: string[];
  class?: string;
  classId?: string;         // taxonomy key, e.g. 'ppi', 'nsaid'
  systems: SystemKey[];
  summary?: string;

  identifiers?: Identifiers;
  chemistry?: Chemistry;

  mechanism?: string;
  targets?: string[];
  receptorAffinity?: string;
  pharmacodynamics?: string;

  pharmacokinetics?: Pharmacokinetics;
  dosing?: Dosing;

  safety?: Safety;

  interactions?: DrugInteraction[];
  interactionNotes?: string[];  // free-text notes migrated from v1
  indications?: string[];
  guidelines?: string[];    // short guideline recs this drug features in
  clinicalPearls?: string[];
  good?: string;            // "Best for"
  bad?: string;             // "Avoid / caution when"

  refs?: Citation[];

  /** v1 content preserved verbatim (migrated monographs). */
  originalFields?: Array<[string, string]>;

  provenance: Provenance;
}

/* ---------- taxonomy ---------- */

export interface SystemDef {
  key: SystemKey;
  label: string;
  badge: string;   // css class
  colorVar: string;
}

export const SYSTEMS: Record<SystemKey, SystemDef> = {
  gi:     { key: 'gi',     label: 'Acid / GI',      badge: 'badge-gi',     colorVar: '--sys-gi' },
  anti:   { key: 'anti',   label: 'Antimicrobial',  badge: 'badge-anti',   colorVar: '--sys-anti' },
  derm:   { key: 'derm',   label: 'Dermatology',    badge: 'badge-derm',   colorVar: '--sys-derm' },
  signal: { key: 'signal', label: 'PK / Mechanism', badge: 'badge-signal', colorVar: '--sys-signal' },
  cardio: { key: 'cardio', label: 'Cardiology',     badge: 'badge-cardio', colorVar: '--sys-cardio' },
  psych:  { key: 'psych',  label: 'Psychiatry',     badge: 'badge-psych',  colorVar: '--sys-psych' },
  endo:   { key: 'endo',   label: 'Endocrinology',  badge: 'badge-endo',   colorVar: '--sys-endo' },
  resp:   { key: 'resp',   label: 'Respiratory',    badge: 'badge-resp',   colorVar: '--sys-resp' },
  neuro:  { key: 'neuro',  label: 'Neurology',      badge: 'badge-neuro',  colorVar: '--sys-neuro' },
  renal:  { key: 'renal',  label: 'Nephrology',     badge: 'badge-renal',  colorVar: '--sys-renal' },
  heme:   { key: 'heme',   label: 'Hematology',     badge: 'badge-heme',   colorVar: '--sys-heme' },
  onc:    { key: 'onc',    label: 'Oncology',       badge: 'badge-onc',    colorVar: '--sys-onc' },
  musc:   { key: 'musc',   label: 'Musculoskeletal', badge: 'badge-musc',  colorVar: '--sys-musc' },
  immune: { key: 'immune', label: 'Immunology',     badge: 'badge-immune', colorVar: '--sys-immune' },
};

export const ROUTE_LABELS: Record<string, string> = {
  oral: 'Oral', iv: 'IV', im: 'IM', sc: 'Subcutaneous', topical: 'Topical',
  ophthalmic: 'Ophthalmic', otic: 'Otic', inhaled: 'Inhaled', intranasal: 'Intranasal',
  transdermal: 'Transdermal', vaginal: 'Vaginal', rectal: 'Rectal', intrathecal: 'Intrathecal',
};
