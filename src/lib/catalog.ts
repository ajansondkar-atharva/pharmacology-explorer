/* Catalog — loads all bundled datasets (monographs, mechanisms,
   interactions, topics) via Vite glob imports and exposes lookup
   helpers + derived statistics. */

import type { Monograph, SystemKey } from './types';

const monoModules = import.meta.glob('../data/monographs/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Monograph>;

const mechModule = import.meta.glob('../data/mechanisms.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const ixModule = import.meta.glob('../data/interactions.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

const dermModule = import.meta.glob('../data/topics/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

export const MONOGRAPHS: Monograph[] = Object.values(monoModules)
  .filter((m): m is Monograph => Boolean(m && m.id))
  .sort((a, b) => a.name.localeCompare(b.name));

export const MONO_BY_ID = new Map<string, Monograph>(MONOGRAPHS.map((m) => [m.id, m]));

export interface InteractionEntity {
  id: string;
  label: string;
  sys?: SystemKey;
}

export interface InteractionPair {
  a: string;
  b: string;
  severity: 'contraindicated' | 'major' | 'moderate' | 'minor';
  summary: string;
  mechanism?: string;
  mgmt?: string;
  evidence?: string;
}

export const INTERACTION_ENTITIES: InteractionEntity[] = (
  (ixModule['../data/interactions.json'] as { entities?: InteractionEntity[] })?.entities ?? []
);

export const INTERACTION_PAIRS: InteractionPair[] = (
  (ixModule['../data/interactions.json'] as { pairs?: InteractionPair[] })?.pairs ?? []
);

export interface MechanismDef {
  id: string;
  name: string;
  subtitle?: string;
  summary?: string;
  use?: string;
  [k: string]: unknown;
}

export const MECHANISMS: MechanismDef[] = (mechModule['../data/mechanisms.json'] as MechanismDef[]) ?? [];

export interface Topic {
  id: string;
  name: string;
  type: string;
  summary?: string;
  subtitle?: string;
  desc?: string;
  [k: string]: unknown;
}

export const TOPICS: Topic[] = Object.values(dermModule).flat() as Topic[];

/* ---------- derived stats ---------- */

export interface CatalogStats {
  drugs: number;
  classes: number;
  mechanisms: number;
  interactions: number;
  systems: number;
  bySystem: Record<SystemKey, number>;
  withPk: number;
  withSafety: number;
  withIds: number;
}

export function catalogStats(): CatalogStats {
  const bySystem = {} as Record<SystemKey, number>;
  let withPk = 0, withSafety = 0, withIds = 0;
  for (const m of MONOGRAPHS) {
    for (const s of m.systems) bySystem[s] = (bySystem[s] ?? 0) + 1;
    if (m.pharmacokinetics && Object.keys(m.pharmacokinetics).length) withPk++;
    if (m.safety) withSafety++;
    if (m.identifiers && Object.keys(m.identifiers).length) withIds++;
  }
  return {
    drugs: MONOGRAPHS.length,
    classes: new Set(MONOGRAPHS.map((m) => m.classId).filter(Boolean)).size,
    mechanisms: MECHANISMS.length,
    interactions: INTERACTION_PAIRS.length + MONOGRAPHS.flatMap((m) => m.interactions ?? []).length,
    systems: Object.keys(bySystem).length,
    bySystem,
    withPk,
    withSafety,
    withIds,
  };
}

export function uniqueClasses(): Array<{ classId: string; label: string; count: number }> {
  const map = new Map<string, { classId: string; label: string; count: number }>();
  for (const m of MONOGRAPHS) {
    if (!m.classId) continue;
    const cur = map.get(m.classId);
    if (cur) cur.count++;
    else map.set(m.classId, { classId: m.classId, label: m.class ?? m.classId, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}
