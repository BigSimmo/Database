# Native Smart Catalogue Search Design

**Date:** 2026-09-01

**Status:** Proposed for implementation

## Objective

Extend the existing provider-free Smart natural-language catalogue search to five additional modes:

- Medication (mode id `prescribing`)
- Tools (`tools`)
- Calculators (`calculators`)
- Factsheets (`factsheets`)
- Dictionary (`dictionary`)

The feature interprets ordinary language only to add bounded, mode-specific catalogue vocabulary to each mode's existing deterministic matcher. It does not generate answers, select treatment, infer diagnoses, or call a model.

## Approved boundaries

The following remain out of scope:

- Documents, Answer, and Favourites
- Clinical Ask or any answer-generation flow
- new providers, API keys, hosted calls, Supabase work, migrations, or production configuration
- new endpoints, feature flags, settings, telemetry, storage, or URL parameters
- microphone, dictation, composer, navigation, responsive-chrome, or visual redesign work
- refactoring the seven already-supported Smart modes
- broad catalogue cleanup, synonym expansion beyond the five named modes, or unrelated search ranking changes

The raw query remains the composer and URL value. Enter continues to open the selected mode's ordinary results surface. Compact codes and exact names remain literal and higher-priority than expansions.

## Considered approaches

### 1. Extend the shared interpreter and current mode matchers — selected

Add the five mode ids and small rule sets to `src/lib/smart-search-intent.ts`. Pass the resulting low-weight terms into the matcher already owned by each mode. This reuses the landed Smart contract, preserves current routes and data ownership, and keeps mode vocabulary auditable.

### 2. Add a generic semantic token engine — rejected

A generic ontology, stemming layer, or cross-mode semantic engine would make rules less predictable and create a new subsystem for a small local catalogue. It would also increase the chance of accidental cross-mode matches and scope creep.

### 3. Build five bespoke parsers or Smart result surfaces — rejected

Per-mode parsers and UI would duplicate intent, cue, accessibility, URL, and ranking behaviour. The existing shared interpreter and composer already own those contracts.

## Architecture

```text
selected mode + raw query
        |
        v
interpretSmartSearch(mode, query)
  - supported-mode check
  - compact-code guard
  - natural-language classification
  - <= 16 deduplicated mode terms
        |
        +---- raw query stays in composer and URL
        |
        v
existing mode route / owner
        |
        v
existing deterministic matcher
  exact title/name/code/alias lane first
  low-weight Smart terms second
        |
        v
ordinary catalogue results
```

No client imports server environment configuration. No network or persistence boundary is added. While one of the five added modes is in Smart natural-language state, the command dropdown and result-page also-matches panel do not call `/api/search/universal`, and the dropdown omits Documents, Answer, and Favourites cross-mode actions; the selected mode's local catalogue is the complete Smart execution path. Literal queries retain their existing universal-search and cross-mode behaviour, and the seven previously supported Smart modes remain unchanged.

## Mode behaviour

### Medication

The `/api/medications` route derives `smartSearchExpansions("prescribing", q)` and supplies them as ranking-only expansions to `searchMedicationCatalog`. Existing typo correction and brand/generic interpretation remain independently reported; Smart terms must not appear as corrections.

Examples of bounded mappings include:

- "medicine that needs regular blood tests" -> `monitoring`, `blood tests`
- "medicine for alcohol dependence" -> `alcohol dependence`, `relapse prevention`
- "information about antidepressant sexual side effects" -> `antidepressant`, `sexual adverse effects`

These are retrieval aliases only. A natural-language rule must not inject a specific medication name that the reader did not type. The results must not be labelled as recommendations, dosing advice, contraindication decisions, or a clinical fit. Exact generic, brand, formulation, and compact medication searches keep their current rank.

### Tools

The launcher uses `rankToolRecords` for a non-empty query instead of maintaining a second substring-only predicate. It supplies `smartSearchExpansions("tools", query)` and the current session visibility, so Saved/Favourites stays inaccessible to guests.

Mappings stay navigational, for example:

- "check medication interactions" -> `medication`, `prescribing`, `interactions`, `safety`
- "find a mental health form" -> `forms`, `paperwork`
- "work out a screening score" -> `calculators`, `assessment`, `score`

### Calculators

`calculatorMatchesQuery` and every candidate-count helper accept the same optional expansion list. A direct abbreviation/name/indication match wins; otherwise a record may match a Smart term. The page computes the terms once for the current query and uses them for the result list and all filter counts.

Mappings are limited to present catalogue measures, for example:

- "screen depression severity" -> `PHQ-9`, `depression`
- "measure anxiety symptoms" -> `GAD-7`, `anxiety`
- "screen hazardous drinking" -> `AUDIT-C`, `CAGE`, `alcohol`
- "rate obsessive compulsive symptoms" -> `Y-BOCS`, `obsessive compulsive`

### Factsheets

`filterFactsheets` accepts optional Smart terms and returns direct query matches before expansion-only matches, while retaining catalogue order within each group. Category filtering applies to both groups through the same predicate.

Mappings use only concepts already represented by the local factsheets, for example:

- "information for someone who worries all the time" -> `generalised anxiety disorder`, `worry`, `anxiety`
- "plain information about talking therapy" -> `cognitive behavioural therapy`, `CBT`
- "information about antidepressant side effects" -> `antidepressants`, `SSRI`, `side effects`

Smart search does not change a factsheet's source, review, audience, or demo-governance state.

### Dictionary

`DictionaryFilters` gains an optional `expansions` field. `searchDictionary` retains its exact term, abbreviation, alias, prefix, and context scores; expansion-only entry, abbreviation, and topic hits receive a lower score and a truthful `Related search term` reason. `dictionaryCatalogue` passes Dictionary-mode terms, while universal search, compare, and other callers remain unchanged. This avoids broadening unrelated modes through the federated also-matches lane.

Mappings remain definitional, for example:

- "term for hearing a voice that is not there" -> `hallucination`, `auditory hallucination`
- "what does mental state exam mean" -> `mental state examination`, `MSE`
- "term for repeated unwanted thoughts" -> `obsession`, `intrusive thought`

## Shared safety and quality rules

- Keep `smartNaturalSearchModeIds` as the only capability allowlist.
- Keep a second typed `smartLocalOnlyModeIds` set containing exactly the five modes in this design. It suppresses universal-search requests only while those modes have `naturalLanguage: true`.
- Preserve the existing 16-term cap, normalisation, and deduplication.
- Keep compact codes literal after terminal punctuation is stripped: examples include `PHQ-9?`, `GAD-7?`, `K10?`, and medication identifiers containing letters and digits.
- Derive expansions only from the selected mode's rule set. The seven previously supported modes retain their existing federated also-matches behaviour; the five modes in this design suppress that path while Smart is active. No second mode's rules run.
- Do not expose Documents or Answer actions, or start a universal-search request, from the five new modes while their Smart natural-language state is active.
- Never rewrite the raw query or place derived terms in the URL, recents, storage, telemetry, or UI.
- Exact catalogue identifiers, titles, medication names, brands, dictionary terms, and abbreviations must outrank expansion-only matches.
- Empty queries keep current browse behaviour.
- A rule that finds no current record is harmless and produces the current empty state; it must not fall back to another mode or provider.

## Error handling

There is no new asynchronous dependency. Invalid, empty, unsupported, or unmatched input follows current behaviour with no Smart expansions. Matcher failures retain existing route error boundaries. No raw-question fallback is introduced.

## Verification strategy

Use fast feedback during implementation:

1. Focused unit tests for the shared intent matrix and each changed matcher.
2. Existing focused DOM tests only where the route owner must prove list/count consistency or session visibility.
3. One provider-free Chromium test that submits one natural-language query in each of the five modes, verifies the ordinary route and visible result, and asserts zero Clinical Ask requests.
4. Formatting and diff checks.

Do not run provider, Supabase, RAG, migration, production-readiness, physical-device, full Playwright, or duplicated broad gates for this change. Run the repository's final local PR gate once only at publication handoff if required; GitHub supplies authoritative broad exact-head coverage.

## Completion criteria

- All five modes advertise Smart only when the shared interpreter classifies the current query as natural language.
- Natural-language examples return relevant local catalogue records through existing routes.
- Literal identifiers and exact matches keep priority.
- Documents, Answer, and Favourites remain unsupported and unadvertised.
- No five-mode Smart request reaches Clinical Ask, universal search, Documents, Answer, or any external provider.
- The focused test set passes and the final diff contains only the planned source, test, and documentation changes.
