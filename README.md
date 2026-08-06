# Pharmacology Explorer v2

An offline-first pharmacology encyclopedia — structured drug monographs, a real
interaction engine, pharmacokinetic visualizations, evidence-graded guidelines,
disease pages, and study tools. Evolved from the single-file
`pharmacology-explorer-revamped.html` (preserved in `reference/`).

## Quick start

```bash
npm install
npm run dev        # dev server
npm run build      # PWA production build → dist/ (offline via service worker)
npm run build:portable  # single-file index.html (double-click friendly)
npm run preview    # serve the production build
npm test           # vitest unit suite
npm run validate   # data schema gate (monographs/diseases/guidelines/…)
```

## Architecture

```
src/
├── main.ts                # bootstrap: store → overlays → search index → router
├── lib/
│   ├── types.ts           # provenance-first Monograph schema (omit, never invent)
│   ├── catalog.ts         # JSON glob imports, lookups, synced-overlay merge
│   ├── search.ts          # ranked fuzzy search (prefix/token/substring/DL-bounded,
│   │                      #   synonym + ATC aware, atc:/class:/sys: scopes)
│   ├── interactions.ts    # 3-source engine: curated pairs + monograph records + class rules
│   ├── pk.ts / charts.ts  # PK math (oral 1-comp, multi-dose, Hill, occupancy) + canvas engine
│   ├── store.ts           # Dexie/IndexedDB + localStorage + memory fallbacks
│   ├── sync.ts            # hash-based update detection; OpenFDA + RxNorm sources
│   ├── spaced.ts          # SM-2-lite scheduler
│   ├── router.ts / state.ts / toast.ts / dom.ts / citations.ts
├── views/                 # home, directory, monograph, compare, interactions,
│   │                      #   pk-lab, mechanisms, algorithms, diseases, guidelines,
│   │                      #   study, saved, sync
├── data/                  # the database — one JSON file per monograph + datasets
│   ├── monographs/*.json  # 160+ structured drug monographs (bundled)
│   ├── diseases.json      # 10 disease encyclopedia pages
│   ├── guidelines.json    # 30 evidence-graded statements
│   ├── interactions.json  # entities + normalized pairs
│   ├── mechanisms.json / algorithms.json / topics/
scripts/                   # migrate-from-original.mjs, validate-data.mjs,
│                          #   fetch-fonts.mjs, make-icons.py, balance-check.cjs
tests/                     # vitest (search, pk, interactions, spaced)
```

## Data model (provenance-first)

Every monograph carries `provenance: { source, confidence, lastUpdated,
revision, notes }`. **Unknown values are omitted — never invented.** Values are
ranges where they vary. Synced records (OpenFDA/RxNorm) land in an overlay
table and are merged additively at load: user data and validated base data are
never overwritten.

Contributing a drug: copy `src/data/monographs/omeprazole.json`, fill only
confident fields, set `provenance`, run `npm run validate`.

## Sync

`Sync` (sidebar badge / palette): hash-based change detection against public
APIs. OpenFDA drug/NDC enriches brand names, routes, NDC, RxCUI, UNII, pharm
class. RxNorm resolves RxCUI identifiers. Attribution: FDA openFDA; NLM RxNorm.

## Design language

Dark-first, dose–response curve motif (mark, dividers, tiles), Space Grotesk +
IBM Plex (fonts bundled offline, OFL). `prefers-reduced-motion` respected;
full ARIA on search combobox, palette, tabs, accordions.

## Roadmap

- 10k-scale: virtualized directory, worker-based indexing, chunked data loading
- DailyMed SPL sync source; WHO EML import; OpenFDA full-catalog paging
- 2D structure rendering from SMILES; MOA diagrams; drug timelines
- Notes sync/export (JSON/Markdown), CSV export of comparisons
- Spaced-repetition review scheduling options (deck filters, per-system decks)
