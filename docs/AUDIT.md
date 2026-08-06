# Audit — Drug & Pharmacology Explorer (original single-file app)

Source audited: `reference/original.html` (3,767 lines, 253.7 KB, one HTML file).
Audit date: 2026-08-06. Auditor: Hermes Agent (autonomous architecture pass).

---

## 1. Current Architecture

Single-file static SPA, no build step, no dependencies, no persistence.

```
pharmacology-explorer-revamped.html
├── <style>            # full design system (~400 lines): CSS variables,
│                      #   dark/light themes, components, responsive
├── <body>             # app shell: sidebar nav + topbar (search, theme) + <main id="app">
└── <script>           # everything else (~3,300 lines), structured as comment-delimited
    │                     modules sharing one global namespace:
    ├── core      — DATA{}, $/$$ helpers, el() DOM builder, SYS taxonomy, router,
    │              basket + pinned (in-memory Set), theme, search index
    ├── home      — renderers.home (bento dashboard, quick actions)
    ├── ppi       — DATA.ppi (7 drugs) + renderer (tabs: encyclopedia/comparison/evolution)
    ├── nsaid     — DATA.nsaid + renderer
    ├── antibiotics — DATA.antibiotics (9 classes w/ drugs) + renderer
    ├── acne      — DATA.acne + renderer (flagship)
    ├── derm      — DATA.derm topics + renderer
    ├── interactions — INTERACTION_ENTITIES + DATA.interactions + checker UI
    ├── pk        — canvas chart engine (one-compartment, multi-dose) + lab UI
    ├── mechanisms — DATA.mechanisms + renderer (flagship)
    ├── algorithms — ALGO_ACID / ALGO_ACNE decision trees + renderer
    ├── classes    — unified directory across datasets (filter + grid)
    ├── wiki       — DATA.wiki (38 monographs) + atlas renderer
    ├── notes      — session notes textarea + saved/compare workspace
    └── init       — buildSearchIndex() + router()
```

**Data shapes (current):**
- `DATA.ppi/nsaid/acne/wiki`: `{id, name, cls, summary, fields: [[label, value]…], good, bad, pearl}`
- `DATA.antibiotics`: `[{name, useCase, drugs: [{id, name, summary, fields, good, bad, pearl}]}]`
- `DATA.derm`: `{id, name, summary, subtitle, desc, …}` topics
- `DATA.mechanisms`: `{id, name, subtitle, summary, use, …}`
- `DATA.interactions`: `{a, b, severity, summary, mechanism, mgmt}` + `INTERACTION_ENTITIES`

**Content inventory:** 7 PPI/PCAB + ~8 NSAIDs + ~14 antibiotics + ~9 acne agents + ~6 derm topics + 38 wiki monographs + 10 mechanisms + 2 algorithm trees + ~10 interaction pairs. ~65 unique drug entries total, spanning GI, antimicrobial, derm, cardio, endocrine, psych, resp.

**Routing:** hash-based (`#view/id`), `renderers{}` registry, full re-render per navigation.

---

## 2. Strengths (preserve these)

| Area | What is good |
|---|---|
| Design system | Excellent. CSS-variable token set, dark-first with a real light theme, signature dose-response curve motif used consistently (mark, dividers, tiles), premium typography pairing (Space Grotesk + IBM Plex). |
| Theming | Theme switch is instant, tokens flow everywhere, `prefers-reduced-motion` respected, `:focus-visible` styling present. |
| Aesthetic restraint | Animations subtle (fade/translate, curve stroke-draw), consistent radii/shadows/spacing. Feels curated. |
| Educational framing | "Best for / Avoid when" blocks, clinical pearls, disclaimers, mechanism-first explanations. Strong voice. |
| Architecture seeds | Hash router, renderer registry, shared DOM builder (`el()`), reusable components (tabs, accordions, timeline, compare table, badges, chips). |
| PK visualizer | Genuinely functional hand-rolled canvas engine: one-compartment oral model, multi-dose accumulation, DPR-aware, theme-aware colors. |
| Responsive | Sidebar drawer + scrim < 1024px, grid collapses, sticky first column in tables. |
| Search wiring | Single index over all datasets with per-module metadata; instant results dropdown. |
| Accessibility basics | aria-labels on icon buttons, semantic-ish landmarks, focus visible, keyboard-navigable accordions/tabs (native buttons). |

## 3. Weaknesses

1. **No persistence anywhere.** Basket, pins, notes, recents, theme — all in-memory. Reload wipes everything.
2. **Hardcoded arrays, no identifiers.** No ATC, RxNorm, CAS, DrugBank, PubChem, UNII. Impossible to link out, dedupe, or sync with authorities.
3. **Flat `fields[][]` shape.** `[label, value]` pairs can't be queried ("which drugs have half-life > 12h?") — no structured PK/safety/interaction fields.
4. **No provenance / citations.** Every fact is unverifiable as authored. No source, date, revision, confidence.
5. **Search is `String.includes`** over a concatenated blob: no fuzzy, no ranking, no tokenization, no synonyms (brand names missing), no filters, no debounce, no recents, no keyboard nav in results.
6. **Interaction checker is a static pair table** (~10 pairs) — not an engine. No mechanism-of-interaction library, no severity rationale, no management, no references.
7. **Compare = hand-written static tables** per module. No dynamic drug-vs-drug comparison engine.
8. **Monograph depth is thin.** 5 generic fields per wiki drug ("Mechanism / Typical uses / Key cautions / Interactions / Pearl"). No dosing, PK values, pregnancy/lactation, renal/hepatic, contraindications, adverse-effect frequency, overdose, monitoring.
9. **Single 253 KB file.** Any change risks the whole app; no modules, no reuse, no tests, no type safety. `/* @MODULES */` marker exists but unused (stale build-merge comment).
10. **`alert()`** used for basket limit — jarring UX.
11. **No dirty-XSS hardening**: `innerHTML` used with data strings (safe today because data is static/trusted; becomes a real risk the moment sync imports external content).
12. **Session notes are a bare textarea**, silently cleared on reload.
13. **Theme choice not persisted**, no system-preference default.

## 4. Missing Features (vs. brief)

- Structured database / per-drug files; versioning; revision history
- Fuzzy, ranked, synonym-aware search with filters + recents
- Real interaction engine (severity, mechanism, evidence, management, refs)
- Dynamic comparison engine
- PK visualizations beyond one model: dose-response, receptor occupancy, CYP pathways, drug timelines
- Disease encyclopedia pages (GERD/PUD exist as topics only; no HTN, T2DM, asthma, COPD, acne-as-disease, rosacea, psoriasis…)
- Clinical guidelines with evidence grades
- Command palette, keyboard shortcuts
- Bookmarks/favorites, notes persistence, flashcards, quiz, spaced repetition, study/focus/presentation modes
- Offline-first: IndexedDB, service worker, PWA installability
- Sync engine with hash-based update detection + trusted-source import (OpenFDA/DailyMed/RxNorm…)
- Citations (PubMed/DOI/FDA label links)
- Images/structures (2D structure SVG generation from SMILES at minimum)
- 10k-scale: virtualized lists, incremental load, worker-based indexing

## 5. Performance Issues

| Issue | Severity |
|---|---|
| Search scans a concatenated lowercase blob per keystroke, no index | Medium (fine at 60 drugs, dies at 10k) |
| Whole-view re-render on every navigation; no caching of rendered views | Medium |
| All 38 wiki monographs rendered as one DOM dump in atlas view; directory renders every card | Medium |
| Google Fonts remote dependency — blocks paint offline, violates offline-first | High |
| No lazy loading / code splitting / web workers | Medium |
| `el()` re-parses SVG strings on every call | Low |
| Accordion max-height fixed at 4000px — long monographs clip or waste layout | Low |

## 6. Accessibility Issues

- Search dropdown has no `role=listbox`/`aria-activedescendant`; keyboard users can't navigate results
- Drug cards: entire card head is clickable but not a button; no ARIA-expanded state on accordions
- Interactive chips/checkboxes are `div`s with no role/tabindex/keyboard handling
- Color is used for system taxonomy; badges carry text so OK, but `.cb` checkbox has no accessible name beyond `title`
- No skip-to-content link; landmark structure could be improved
- Comparison table first-column sticky header contrast is borderline
- No `lang`-level typography issues, but emphasis (bold) vs. heading structure is loose in places

## 7. Scalability Issues

- DATA namespace + renderers registry is fine for ~10 views, but every view is a function touching globals; no data layer separation
- Data embedded in HTML → cannot be extended by sync, imports, or user additions without editing source
- No stable IDs (ids are slugs, mostly stable, but no canonical identifier linkage for dedupe)
- Search index rebuilt once at init from in-memory arrays; no incremental index
- No paging/virtualization for 10k records
- Single JS parse of 250 KB+ blocks first render

## 8. Security Issues

- `el()` accepts `html` attr → innerHTML; several call sites interpolate data into `html:` strings. XSS risk if any data source becomes untrusted (sync engine, user import). Must sanitize at the render boundary.
- No CSP. If we add external images/fonts, a CSP baseline is warranted.
- Interaction/pregnancy content has no disclaimer enforcement (only static disclaimer boxes).
- No input validation on hash params (view ids interpolated into selectors via `$('#card-'+focusId)` — id injection risk if ids ever become user-controlled).

## 9. Scientific Content Gaps

- **Dosing absent** for every drug (adult/pediatric/geriatric/renal/hepatic)
- **PK numeric values absent** (half-life, bioavailability, protein binding, Vd, clearance, metabolism %)
- **Pregnancy/lactation categories** absent
- **Contraindications, black-box warnings, monitoring** absent
- **Adverse effects with frequency** absent
- **Overdose & management** absent
- **Interactions**: only 10 curated pairs; no class-level interaction library
- **Approvals/regulatory**: no FDA/EMA/WHO status, no dates
- **Chemistry**: no formula, SMILES, InChI, structure
- **No references/citations** on any statement
- **No disease pages** (only acid/acne algorithm trees)
- **No guideline integration** (NICE/AHA/ESC/GINA/GOLD evidence grades)
- **No ATC classification** anywhere

## 10. UI/UX Improvements

- Persist theme, basket, pins, notes, recents (IndexedDB/localStorage)
- Command palette (Ctrl+K) + keyboard shortcuts (?)
- Instant search with keyboard navigation, recents, filters, brand/synonym awareness
- Monograph layout: tabbed sections instead of one long accordion; sticky metadata rail
- Replace `alert()` with in-app toast
- Virtualized directory with facet filters (class, route, system, safety)
- Compare: dynamic table generation from structured fields
- Empty states, loading skeletons for async DB loads
- Study modes (quiz/flashcards) with progress
- Local-first: everything works offline; fonts bundled or system fallback

## 11. Code Quality Issues

- 3,300-line script with `/* MODULE */` comments pretending to be modularity; global namespace shared implicitly
- No TypeScript; no tests; no lint/format config
- Mixed quoting/styles (single/double), inconsistent ternaries
- `pill()`/`pillList()` return HTML strings while most builders return nodes — two parallel render styles
- `DATA` is a grab-bag; no schema, no validation, no version field
- Dead `/* @MODULES */` merge marker; `curveSVGabs()` duplicates `curveSVG()`
- No error handling anywhere (search, router, canvas)
- `renderers.notes` re-renders on every basket toggle (fine now, wasteful later)
- No separation: UI/Db/Search/Sync/Parser/Renderer/Charts/State/Utils all in one scope

---

## 12. Target Architecture (decided)

Modern SPA, Vite + TypeScript, no UI framework (preserve bespoke design language):

```
pharmacology-explorer/
├── index.html                  # app shell (kept thin)
├── vite.config.ts              # PWA plugin, build config
├── public/
│   ├── manifest.webmanifest
│   └── icons/…
├── src/
│   ├── main.ts                 # bootstrap: db init → index build → router
│   ├── styles/                 # design-system.css (tokens, components — evolved from original)
│   ├── lib/
│   │   ├── db.ts               # Dexie wrapper (drugs, favorites, notes, recents, quiz, meta)
│   │   ├── catalog.ts          # JSON monograph import + canonical ID registry
│   │   ├── search.ts           # token/prefix/fuzzy ranked search + synonym expansion
│   │   ├── interactions.ts     # interaction engine (pair + mechanism rules)
│   │   ├── compare.ts          # dynamic comparison field extraction
│   │   ├── pk.ts               # pharmacokinetic math (oral 1-comp, i.v., steady state)
│   │   ├── charts.ts           # canvas chart engine (evolved from original)
│   │   ├── sync.ts             # hash-based update detection + import pipelines
│   │   ├── citations.ts        # citation renderer (PubMed/DOI/FDA/DailyMed)
│   │   └── dom.ts              # el(), sanitize, event helpers
│   ├── views/                  # home, directory, monograph, compare, interactions,
│   │                           # pk-lab, mechanisms, algorithms, diseases, guidelines,
│   │                           # study, saved
│   ├── data/                   # structured JSON monographs (one file per drug)
│   │   └── monographs/*.json
│   ├── workers/search.worker.ts
│   └── components/…
├── scripts/                    # migrate-from-original.mjs, validate-data.mjs, serve.mjs
└── tests/                      # vitest unit tests (search, interactions, compare, pk, schema)
```

**Key decisions:**
1. **Vite + TS, no framework** — honors "don't redesign from scratch"; the DOM/design language is bespoke and framework-free already.
2. **Per-drug JSON monographs** under `src/data/monographs/` (bundled) + IndexedDB for user state (favorites/notes/recents/quiz) + synced-record store. Exactly the brief's `database/drugs/` shape, with a build-time index.
3. **Custom search, not Fuse.js** — prefix trie + token scoring + bounded fuzzy + synonym table gives deterministic, fast, filterable results with no dependency; Fuse's scoring is opaque for a 10k science corpus.
4. **Hand-rolled canvas/SVG charts** (evolved original engine) — Chart.js would fight the aesthetic and add 200 KB; brief's "Chart.js/D3" is a suggestion, not a mandate.
5. **Dexie only external runtime dep** (IndexedDB ergonomics); everything else stdlib. PWA via `vite-plugin-pwa`.
6. **Provenance-first data schema**: every monograph carries `sources[]`, `lastUpdated`, `revision`, `confidence`, and per-fact citations where they exist. Unknown values are omitted — never invented.
7. **Sync engine**: content-addressed hash registry (`meta.sync_state`), remote catalog JSON fetch → diff → import into IndexedDB overlay, never overwriting user edits; OpenFDA/DailyMed pipeline implemented as an import module (API-key-free endpoints), respecting rate limits and license (DailyMed/RxNorm public domain; OpenFDA requires attribution).
8. **A11y**: full ARIA on search combobox, accordions, chips; keyboard-first everywhere; focus trap in palette.
9. **Single-file artifact** preserved: `npm run build:portable` (vite-plugin-singlefile) so the double-click workflow from the original survives; PWA build for installable offline.

## 13. Iteration Plan (this build)

1. Scaffold (Vite+TS, design system, skeleton, git) — commit
2. Migrate existing content to structured JSON (nothing lost) — commit
3. Core engine: DB, catalog, router, palette, shortcuts, theme persistence — commit
4. Search engine — commit
5. Views: home, directory, monograph, compare — commit
6. Interactions + PK lab extensions — commit
7. Diseases + guidelines — commit
8. Study tools — commit
9. PWA + sync scaffold — commit
10. Dataset expansion (delegated parallel authoring) — commit
11. Tests, portable build, verification — commit
