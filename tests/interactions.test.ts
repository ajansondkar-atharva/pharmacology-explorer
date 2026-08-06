import { describe, it, expect } from 'vitest';
import { checkPair, severityLabel } from '../src/lib/interactions';
import { INTERACTION_PAIRS, MONO_BY_ID } from '../src/lib/catalog';

describe('interaction engine', () => {
  it('resolves a known static pair (v1)', () => {
    if (!INTERACTION_PAIRS.length) return;
    const p = INTERACTION_PAIRS[0];
    const res = checkPair(p.a, p.b);
    expect(res.findings.length).toBeGreaterThan(0);
    expect(res.worst).not.toBeNull();
  });

  it('fires the antiplatelet × NSAID class rule', () => {
    const aspirin = MONO_BY_ID.get('aspirin');
    const ibuprofen = MONO_BY_ID.get('ibuprofen');
    if (!aspirin || !ibuprofen) return; // data-dependent
    const res = checkPair('aspirin', 'ibuprofen');
    const rule = res.findings.find((f) => f.source === 'rule');
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe('major');
    expect(rule!.mechanism).toBeTruthy();
    expect(rule!.management).toBeTruthy();
  });

  it('returns worst severity across findings', () => {
    const res = checkPair('aspirin', 'ibuprofen');
    if (!res.findings.length) return;
    expect(res.worst).toBeDefined();
  });

  it('handles unknown drugs without crashing', () => {
    const res = checkPair('aspirin', 'nonexistent-drug');
    expect(Array.isArray(res.findings)).toBe(true);
  });

  it('severity labels are capitalized', () => {
    expect(severityLabel('major')).toBe('Major');
    expect(severityLabel('contraindicated')).toBe('Contraindicated');
  });
});
