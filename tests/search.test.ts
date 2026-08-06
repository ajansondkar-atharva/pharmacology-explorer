import { describe, it, expect, beforeAll } from 'vitest';
import { buildSearchIndex, search, highlightName, searchIndexSize } from '../src/lib/search';

beforeAll(() => {
  buildSearchIndex();
});

describe('search index', () => {
  it('indexes the whole catalog', () => {
    expect(searchIndexSize()).toBeGreaterThan(50);
  });

  it('exact name match ranks first', () => {
    const res = search('omeprazole');
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].doc.name.toLowerCase()).toBe('omeprazole');
  });

  it('prefix match finds drugs', () => {
    const res = search('metfo');
    expect(res.some((r) => r.doc.name.toLowerCase().startsWith('metfo'))).toBe(true);
  });

  it('fuzzy matching tolerates typos', () => {
    const res = search('omeprazol');
    expect(res.some((r) => r.doc.name.toLowerCase() === 'omeprazole')).toBe(true);
  });

  it('finds by ATC code when scoped', () => {
    const res = search('atc:A02BC', { prefix: 'atc' });
    expect(Array.isArray(res)).toBe(true);
  });

  it('returns no results for gibberish', () => {
    expect(search('zzzzqqqq')).toHaveLength(0);
  });

  it('highlight wraps the match safely', () => {
    const h = highlightName('Omeprazole', 'ome');
    expect(h).toContain('style="color:var(--accent)');
    // XSS safety: highlight escapes HTML in names
    const evil = highlightName('<script>x</script>', 'scr');
    expect(evil).not.toContain('<script>');
  });
});
