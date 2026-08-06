/* Interaction engine — resolves a drug pair to structured findings.
   Sources, in priority order:
   1. Pair-level entries from data/interactions.json (v1 curated pairs)
   2. Monograph-level `interactions[]` entries on either drug
   3. Mechanism-level rules (class × class) — extensible rule table
   Every finding explains WHY (severity rationale + mechanism) and
   carries management + evidence; nothing is a bare red/yellow/green. */

import { INTERACTION_PAIRS, MONO_BY_ID } from './catalog';
import type { DrugInteraction, InteractionSeverity, Monograph } from './types';

export interface InteractionFinding {
  a: string;
  b: string;
  severity: InteractionSeverity;
  summary: string;
  mechanism?: string;
  management?: string;
  evidence?: string;
  source: 'pair' | 'monograph' | 'rule';
  ruleId?: string;
}

export interface PairCheckResult {
  pair: [string, string];
  findings: InteractionFinding[];
  worst: InteractionSeverity | null;
}

/** Class-level mechanistic rules (extensible). When both drugs belong
    to the given classes, the rule fires. */
interface ClassRule {
  id: string;
  classA: string[];   // classIds on drug A
  classB: string[];   // classIds on drug B
  severity: InteractionSeverity;
  summary: string;
  mechanism?: string;
  management?: string;
  evidence?: string;
}

const CLASS_RULES: ClassRule[] = [
  {
    id: 'rule-antiplatelet-nsaid',
    classA: ['antiplatelet'],
    classB: ['nsaid'],
    severity: 'major',
    summary: 'Additive bleeding risk — NSAIDs inhibit platelet COX-1 and can displace/compete with antiplatelet agents; GI mucosal injury adds a second bleeding pathway.',
    mechanism: 'Both agents impair primary hemostasis through distinct routes (platelet COX-1 inhibition vs. irreversible platelet blockade), and NSAID gastropathy adds a mucosal bleeding source.',
    management: 'Prefer GI-sparing strategies (PPI co-therapy), lowest effective NSAID dose/duration, or an alternative analgesic. Monitor for GI bleeding.',
    evidence: 'Meta-analyses of observational data; cardiology guidance recommends caution combining NSAIDs with antiplatelets.',
  },
  {
    id: 'rule-nsaid-ace',
    classA: ['nsaid'],
    classB: ['acei', 'arb'],
    severity: 'moderate',
    summary: 'NSAIDs blunt the antihypertensive effect of ACE inhibitors/ARBs and worsen renal function in at-risk patients (the "triple whammy" with diuretics).',
    mechanism: 'NSAIDs suppress renal prostaglandin synthesis, reducing afferent arteriolar vasodilation and promoting sodium retention, opposing the renin–angiotensin blockade.',
    management: 'Monitor BP and renal function; avoid in significant CKD or volume depletion. Consider acetaminophen or short NSAID courses.',
    evidence: 'Multiple observational studies; risk amplified with concurrent diuretics (triple whammy).',
  },
  {
    id: 'rule-ssri-nsaid',
    classA: ['ssri'],
    classB: ['nsaid'],
    severity: 'moderate',
    summary: 'SSRIs plus NSAIDs raise the risk of upper GI bleeding beyond either alone.',
    mechanism: 'SSRIs deplete platelet serotonin (impairing aggregation) while NSAIDs inhibit COX-1 — additive hemostatic impairment plus GI injury.',
    management: 'Consider PPI co-therapy, or an alternative antidepressant/analgesic in high-risk patients.',
    evidence: 'Case-control and cohort studies show ~2–6× increased GI bleed risk vs. either agent alone.',
  },
  {
    id: 'rule-pcabi-cz',
    classA: ['ppi', 'pcab'],
    classB: ['azole'],
    severity: 'minor',
    summary: 'Acid suppression reduces absorption of pH-dependent azole antifungals.',
    mechanism: 'Ketoconazole/itraconazole require gastric acidity for dissolution; raised intragastric pH lowers bioavailability.',
    management: 'Separate dosing, prefer fluconazole (less pH-dependent), or monitor antifungal response.',
    evidence: 'Pharmacokinetic studies; clinically significant mainly for ketoconazole/itraconazole.',
  },
];

function classSet(m: Monograph): Set<string> {
  const s = new Set<string>();
  if (m.classId) s.add(m.classId);
  if (m.class) {
    for (const t of m.class.toLowerCase().split(/[^a-z0-9]+/)) {
      if (t) s.add(t);
    }
  }
  for (const sys of m.systems) s.add(sys);
  return s;
}

/** Find the single most specific class rule for a pair. */
function ruleFor(a: Monograph, b: Monograph): ClassRule | null {
  const sa = classSet(a);
  const sb = classSet(b);
  for (const rule of CLASS_RULES) {
    const inA = (list: string[]) => list.some((c) => sa.has(c));
    const inB = (list: string[]) => list.some((c) => sb.has(c));
    if ((inA(rule.classA) && inB(rule.classB)) || (inA(rule.classB) && inB(rule.classA))) {
      return rule;
    }
  }
  return null;
}

function norm(idOrName: string): string {
  return idOrName.trim().toLowerCase();
}

export function checkPair(a: string, b: string): PairCheckResult {
  const findings: InteractionFinding[] = [];
  const ma = MONO_BY_ID.get(a);
  const mb = MONO_BY_ID.get(b);
  const na = norm(a);
  const nb = norm(b);

  /* 1. static pair table */
  for (const p of INTERACTION_PAIRS) {
    const pa = norm(p.a);
    const pb = norm(p.b);
    if ((pa === na && pb === nb) || (pa === nb && pb === na)) {
      findings.push({
        a, b,
        severity: p.severity,
        summary: p.summary,
        mechanism: p.mechanism,
        management: p.mgmt,
        evidence: p.evidence,
        source: 'pair',
      });
    }
  }

  /* 2. monograph-level interactions (both directions) */
  const ixList = [
    ...(ma?.interactions ?? []).map((i: DrugInteraction) => ({ from: a, to: b, i })),
    ...(mb?.interactions ?? []).map((i: DrugInteraction) => ({ from: b, to: a, i })),
  ];
  for (const { from, to, i } of ixList) {
    if (!i.withId && !i.withClass) continue;
    const matchesId = i.withId ? norm(i.withId) === norm(to) : false;
    const matchesClass = i.withClass
      ? (MONO_BY_ID.get(to)?.classId === norm(i.withClass) ||
         MONO_BY_ID.get(to)?.class?.toLowerCase().includes(norm(i.withClass).toLowerCase()))
      : false;
    if (matchesId || matchesClass) {
      findings.push({
        a: from, b: to,
        severity: i.severity,
        summary: i.summary,
        mechanism: i.mechanism,
        management: i.management,
        evidence: i.evidence,
        source: 'monograph',
      });
    }
  }

  /* 3. class rules */
  if (ma && mb) {
    const rule = ruleFor(ma, mb);
    if (rule) {
      findings.push({
        a: ma.id, b: mb.id,
        severity: rule.severity,
        summary: rule.summary,
        mechanism: rule.mechanism,
        management: rule.management,
        evidence: rule.evidence,
        source: 'rule',
        ruleId: rule.id,
      });
    }
  }

  /* dedupe by (a,b,source) */
  const seen = new Set<string>();
  const unique = findings.filter((f) => {
    const key = `${f.a}|${f.b}|${f.source}|${f.severity}|${f.summary.slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const sevRank: Record<InteractionSeverity, number> = {
    contraindicated: 4, major: 3, moderate: 2, minor: 1,
  };
  const worst = unique.reduce<InteractionSeverity | null>(
    (acc, f) => (acc === null || sevRank[f.severity] > sevRank[acc] ? f.severity : acc),
    null
  );

  return { pair: [a, b], findings: unique, worst };
}

export function severityLabel(s: InteractionSeverity): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
