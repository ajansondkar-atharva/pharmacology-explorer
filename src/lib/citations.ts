/* Citation rendering — every scientific statement can carry a reference.
   Each citation type maps to a verifiable link target. */

import type { Citation } from './types';

export function citationUrl(c: Citation): string | null {
  switch (c.type) {
    case 'pubmed':
      return c.id ? `https://pubmed.ncbi.nlm.nih.gov/${c.id}/` : null;
    case 'doi':
      return c.id ? `https://doi.org/${c.id}` : null;
    case 'fda':
      return c.id
        ? `https://www.accessdata.fda.gov/scripts/cder/daf/index.cfm?event=overview.process&ApplNo=${c.id}`
        : 'https://www.fda.gov/drugs';
    case 'dailymed':
      return c.id ? `https://dailymed.nlm.nih.gov/dailymed/drug-info.cfm?setid=${c.id}` : 'https://dailymed.nlm.nih.gov';
    case 'ema':
      return c.id ? `https://www.ema.europa.eu/en/medicines/human/EPAR/${c.id}` : 'https://www.ema.europa.eu';
    case 'drugbank':
      return c.id ? `https://go.drugbank.com/drugs/${c.id}` : 'https://go.drugbank.com';
    case 'guideline':
      return c.id ?? null;
    case 'url':
      return c.id ?? null;
    case 'who':
      return c.id ?? 'https://www.who.int/publications/i/item/WHO-MHP-HPS-EML-2023.02';
    case 'textbook':
      return null;
  }
}

export function citationShort(c: Citation): string {
  return c.id ? `${c.label} (${c.id})` : c.label;
}
