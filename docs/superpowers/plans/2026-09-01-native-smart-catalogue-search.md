# Native Smart Catalogue Search Implementation Plan

> **For Codex:** Execute this plan with the named subagent-driven-development workflow. Use one fresh implementation subagent at a time, followed by an independent reviewer. Do not start the next task until the current task is accepted.

**Goal:** Add safe, provider-free natural-language catalogue search to Medication, Tools, Calculators, Factsheets, and Dictionary while preserving exact-match priority and current routes.

**Architecture:** Extend the existing shared Smart allowlist and mode-scoped expansion rules. Thread the bounded expansions into each mode's current deterministic matcher; keep the original query as the only user-visible and URL value. Do not add an engine, endpoint, flag, provider, persistence, or new result surface.

**Tech Stack:** TypeScript, React 19, Next.js App Router, Vitest, React Testing Library, Playwright.

**Global Constraints:** Follow [the approved design](../specs/2026-09-01-native-smart-catalogue-search-design.md). Keep Documents, Answer, Favourites, Clinical Ask, providers, Supabase, migrations, deployment, and UI redesign out of scope. Preserve guest visibility boundaries, exact identifiers, current filter counts, accessibility, and one-composer routing. Use test-first implementation, small commits, and no force operations.

---

## Execution protocol

Use this plan-specific evidence root:

```text
.superpowers/sdd/2026-09-01-native-smart-catalogue-search/
  ledger.md
  task-1/{brief.md,report.md,review-package.md,review.md}
  task-2/{brief.md,report.md,review-package.md,review.md}
  task-3/{brief.md,report.md,review-package.md,review.md}
  task-4/{brief.md,report.md,review-package.md,review.md}
  task-5/{brief.md,report.md,review-package.md,review.md}
  final-review.md
```

The orchestrator owns shared-file sequencing and ledger updates. Implementation agents must not edit files outside their task brief. Review agents are read-only. Use these explicit models:

| Work                           | Model           | Effort |
| ------------------------------ | --------------- | ------ |
| Tasks 1–3 implementer          | `gpt-5.6-terra` | medium |
| Task 4 Medication implementer  | `gpt-5.6-sol`   | high   |
| Task 5 integration implementer | `gpt-5.6-terra` | medium |
| Per-task reviewer              | `gpt-5.6-terra` | high   |
| Final branch reviewer          | `gpt-5.6-sol`   | high   |

Do not parallelise implementation tasks: Tasks 2–5 depend on the shared intent file and overlapping integration tests. Fresh sequential agents reduce context drift without creating merge conflicts. A task is accepted only when its focused tests pass and the reviewer returns both `spec_verdict: pass` and `quality_verdict: pass`. Fix blocking findings with the same implementer, then dispatch a fresh reviewer.

Before Task 1, restore the lockfile-pinned development dependencies once in this isolated worktree:

```powershell
npm ci --prefer-offline --no-audit
```

Do not change `package.json` or `package-lock.json`.

## Task 1: Extend the shared Smart capability and adversarial matrix

**Files:**

- Modify: `src/lib/smart-search-intent.ts`
- Modify: `tests/smart-search-intent.test.ts`

**Subagent brief:** Extend only the shared capability/rule contract. Do not integrate any mode owner yet and do not alter the intent algorithm used by the existing seven modes.

### Step 1: Write the failing capability and rule tests

Add the five ids to the expected supported set and pin representative expansions:

```ts
expect(smartNaturalSearchModeIds).toEqual([
  "services",
  "forms",
  "differentials",
  "formulation",
  "dsm",
  "specifiers",
  "therapy-compass",
  "prescribing",
  "tools",
  "calculators",
  "factsheets",
  "dictionary",
]);

expect(smartLocalOnlyModeIds).toEqual(["prescribing", "tools", "calculators", "factsheets", "dictionary"]);

expect(interpretSmartSearch("prescribing", "medicine that needs regular blood tests").expansions).toEqual(
  expect.arrayContaining(["monitoring", "blood tests"]),
);
expect(interpretSmartSearch("tools", "where can I check medication interactions?").expansions).toEqual(
  expect.arrayContaining(["prescribing", "interactions"]),
);
expect(interpretSmartSearch("calculators", "screen depression severity").expansions).toContain("phq-9");
expect(interpretSmartSearch("factsheets", "information for someone who worries all the time").expansions).toContain(
  "generalised anxiety disorder",
);
expect(interpretSmartSearch("dictionary", "term for hearing a voice that is not there").expansions).toContain(
  "hallucination",
);
```

Add an adversarial table proving:

- `PHQ-9?`, `GAD-7?`, `K10?`, and existing compact codes stay literal.
- exact names such as `sertraline`, `Calculators`, and `MSE` do not acquire unrelated terms.
- Documents, Answer, and Favourites remain unsupported and return no expansions.
- the same phrase cannot leak rules across two modes.

### Step 2: Run the test to prove it fails

```powershell
npm run test -- tests/smart-search-intent.test.ts
```

Expected: failure because the five ids and rules are not present.

### Step 3: Implement the smallest shared change

Append the five `AppModeId` values to `smartNaturalSearchModeIds`, export the exact five-value `smartLocalOnlyModeIds` set and its type guard, and add typed `ExpansionRule[]` entries to `modeExpansionRules`. Use only the mappings in the design, normalise through the existing code, and retain the existing 16-term cap, compact-code guard, and natural-language classifier.

Keep the rules in the existing module. Do not extract a new rule engine or rewrite the existing seven rule sets.

### Step 4: Run the focused test

```powershell
npm run test -- tests/smart-search-intent.test.ts
```

Expected: pass.

### Step 5: Commit

```powershell
git add src/lib/smart-search-intent.ts tests/smart-search-intent.test.ts
git commit -m "feat(search): extend smart catalogue intent"
```

## Task 2: Integrate Tools and Calculators

**Files:**

- Modify: `src/components/applications-launcher-page.tsx`
- Modify: `src/components/calculators/calculator-filters.ts`
- Modify: `src/components/calculators/search-page.tsx`
- Modify: `tests/tools-catalog.test.ts`
- Modify: `tests/calculators-mode.dom.test.tsx`
- Modify: `tests/favourites-auth-gate.dom.test.tsx`

**Subagent brief:** These are two small local catalogues with client-owned matching. Reuse existing rank/filter helpers; do not change layouts, routes, catalogue records, or filters.

### Step 1: Add failing Tools tests

Extend `tests/tools-catalog.test.ts` to prove:

```ts
const expansions = smartSearchExpansions("tools", "where can I check medication interactions?");
expect(rankToolRecords("where can I check medication interactions?", 5, expansions)[0]?.tool.id).toBe(
  "medication-prescribing",
);
```

Also prove an exact `Forms` query ranks Forms first and an unauthenticated Smart query cannot return Favourites.

In `tests/favourites-auth-gate.dom.test.tsx`, render:

```tsx
<ApplicationsLauncherWorkspace query="where can I check medication interactions?" canAccessFavourites={false} />
```

Assert `application-card-medication-prescribing` and its mobile row counterpart are present, are the first result in their respective owner, and no Favourites card/row is mounted. This is the failing owner-level test; the ranker test alone already supports low-weight expansions. Do not add a second browser suite.

### Step 2: Add failing Calculator tests

Pin the intended backwards-compatible interface in `tests/calculators-mode.dom.test.tsx`:

```ts
export function calculatorMatchesQuery(calc: CalculatorFixture, query: string, expansions?: readonly string[]): boolean;
```

Test `screen depression severity` -> PHQ-9, `measure anxiety symptoms` -> GAD-7, and `PHQ-9?` -> the exact PHQ-9 record. Add one assertion that candidate counts use the identical expanded predicate as the visible result list.

### Step 3: Run the focused tests to prove they fail

```powershell
npm run test -- tests/tools-catalog.test.ts tests/calculators-mode.dom.test.tsx tests/favourites-auth-gate.dom.test.tsx
```

### Step 4: Implement Tools through one existing ranked collection

In `ApplicationsLauncherWorkspace`, compute the terms once and make `queryMatchedApps` the only query-matched collection:

```ts
const smartExpansions = useMemo(() => smartSearchExpansions("tools", query), [query]);
const queryMatchedApps = useMemo(
  () =>
    normalizedQuery
      ? rankToolRecords(query, undefined, smartExpansions, {
          authenticated: canAccessFavourites,
          demoMode: false,
        }).map((match) => match.tool)
      : launcherApps,
  [canAccessFavourites, launcherApps, normalizedQuery, query, smartExpansions],
);
```

Build `filterCounts` from `queryMatchedApps`. Build `filteredApps` by applying only `launcherAppMatchesFilter` to `queryMatchedApps`; do not run the old substring predicate a second time. Derive the selected-tool fallback and `submitSearch` target from `filteredApps[0]`. Remove `initialToolId` and the duplicated substring predicate. This ensures counts, desktop cards, mobile rows, selection, and submit all share one ranked owner while keeping filter, detail, and guest-access behaviour unchanged.

### Step 5: Implement Calculator expansion threading

Add the optional `readonly string[]` argument to `calculatorMatchesQuery`, `calculatorMatchesFilters`, `filterCalculatorRecords`, and the three candidate-count helpers. Use `normalizeSearchText` for both the raw query and haystack so harmless terminal punctuation does not break codes such as `PHQ-9?`. Check the normalized raw query first, then match normalized expansion terms against the same haystack. In `search-page.tsx`, compute:

```ts
const smartExpansions = useMemo(() => smartSearchExpansions("calculators", query), [query]);
```

Pass it to the result list and every candidate-count call so visible counts remain truthful.

### Step 6: Run the focused tests

```powershell
npm run test -- tests/tools-catalog.test.ts tests/calculators-mode.dom.test.tsx tests/favourites-auth-gate.dom.test.tsx
```

Expected: pass.

### Step 7: Commit

```powershell
git add src/components/applications-launcher-page.tsx src/components/calculators/calculator-filters.ts src/components/calculators/search-page.tsx tests/tools-catalog.test.ts tests/calculators-mode.dom.test.tsx tests/favourites-auth-gate.dom.test.tsx
git commit -m "feat(search): add smart tools and calculator matching"
```

## Task 3: Integrate Factsheets and Dictionary

**Files:**

- Modify: `src/components/factsheets/factsheets-data.ts`
- Modify: `src/app/(search-app)/factsheets/search/page.tsx`
- Modify: `src/components/factsheets/factsheets-search-page.tsx`
- Modify: `src/lib/dictionary.ts`
- Modify: `src/components/dictionary/dictionary-catalogue-pages.tsx`
- Modify: `tests/factsheets-data.test.ts`
- Modify: `tests/factsheets-search-page.dom.test.tsx`
- Modify: `tests/dictionary-data.test.ts`

**Subagent brief:** Add low-weight local expansion matching while preserving factsheet category consistency and Dictionary's exact scoring. Do not change content, governance metadata, facets, compare behaviour, or result UI.

### Step 1: Add failing Factsheet tests

Extend `tests/factsheets-data.test.ts` to prove:

- natural-language expansion terms find the Generalised anxiety disorder and CBT factsheets;
- a direct `Zoloft` or `Sertraline` match appears before expansion-only records;
- category filtering and unfiltered counts use the same expansion list;
- unknown text still returns an empty list.

Use the explicit interface:

```ts
filterFactsheets(query: string, category?: string, expansions?: readonly string[]): Factsheet[]
```

### Step 2: Add failing Dictionary tests

Extend `DictionaryFilters` with:

```ts
expansions?: readonly string[];
```

Test that `MSE` retains its exact abbreviation score/reason, while a natural-language Dictionary query returns the intended entry with a lower `Related search term` score. Prove `dictionaryCatalogue` uses Dictionary-mode expansions and `dictionaryCompareHref`/compare search stays unchanged when no expansions are supplied.

### Step 3: Run the focused tests to prove they fail

```powershell
npm run test -- tests/factsheets-data.test.ts tests/factsheets-search-page.dom.test.tsx tests/dictionary-data.test.ts
```

Expected: failure on the new expansion contracts.

### Step 4: Implement Factsheet ordering and route consistency

In `filterFactsheets`, use `normalizeSearchText` to build one normalized haystack per sheet and to normalize the raw query and expansion terms. Apply category first, then partition into direct matches and expansion-only matches. Return direct matches followed by expansion-only matches, preserving the original array order within both groups and deduplicating by slug.

The server page computes `smartSearchExpansions("factsheets", query)` and passes the same list to both the initial `filterFactsheets` call and `FactsheetsSearchPage`. The client component uses that supplied list for its unfiltered category counts; do not re-derive different terms.

### Step 5: Implement low-score Dictionary matches

Add optional expansions to `DictionaryFilters`. Keep `entryScore(entry, query)` unchanged for the raw query. Only when it returns `null`, test the normalized expansions against term, aliases, definition, meaning, context, and kind label and return a score below 44 with reason `Related search term`.

Apply the same lower-priority fallback to abbreviation and topic lanes without changing exact scores. In `dictionaryCatalogue`, derive `smartSearchExpansions("dictionary", params.q)` once and pass it to `searchDictionary`. Leave `searchDictionaryDomain` in `src/lib/universal-search.ts` unchanged; all other callers omit the optional field and retain current behaviour.

### Step 6: Run the focused tests

```powershell
npm run test -- tests/factsheets-data.test.ts tests/factsheets-search-page.dom.test.tsx tests/dictionary-data.test.ts
```

Expected: pass.

### Step 7: Commit

```powershell
git add -- 'src/components/factsheets/factsheets-data.ts' 'src/app/(search-app)/factsheets/search/page.tsx' 'src/components/factsheets/factsheets-search-page.tsx' 'src/lib/dictionary.ts' 'src/components/dictionary/dictionary-catalogue-pages.tsx' 'tests/factsheets-data.test.ts' 'tests/factsheets-search-page.dom.test.tsx' 'tests/dictionary-data.test.ts'
git commit -m "feat(search): add smart factsheet and dictionary matching"
```

## Task 4: Integrate Medication without adding clinical inference

**Files:**

- Modify: `src/lib/medication-query.ts`
- Modify: `src/app/api/medications/route.ts`
- Modify: `tests/medications.test.ts`
- Modify: `tests/medications-route.test.ts`

**Subagent brief:** This task changes retrieval aliases only. Do not add recommendations, dose logic, diagnosis inference, warnings, provider calls, data changes, or UI claims. Smart terms must not be exposed as typo/brand corrections.

### Step 1: Add failing rank and route tests

Pin this backwards-compatible interface:

```ts
export function searchMedicationCatalog(
  records: MedicationRecord[],
  query: string,
  limit?: number,
  rankingExpansions?: readonly string[],
): { matches: MedicationSearchMatch[]; analysis: MedicationCatalogQueryAnalysis };
```

Add tests proving:

- `medicine that needs regular blood tests` retrieves monitoring-relevant records when given Prescribing expansions;
- exact `sertraline` and the existing `Zoloft` brand alias keep their current top result;
- Smart terms do not appear in `analysis.corrections` or `analysis.expansions`;
- the medications API derives Prescribing expansions from `q` and returns ordinary catalogue matches without changing response shape.

### Step 2: Run the focused tests to prove they fail

```powershell
npm run test -- tests/medications.test.ts tests/medications-route.test.ts
```

### Step 3: Implement ranking-only expansion merging

Inside `searchMedicationCatalog`, deduplicate `analysis.expansions` and `rankingExpansions` before passing them to `rankMedicationRecords`. Return the original `analysis` object unchanged so the existing `MedicationInterpretationChip` reports only typo and brand/generic analysis.

In `src/app/api/medications/route.ts`, derive and forward the terms inside `rankCatalogMatches`, the shared ranking seam used by both public-fixture and hosted owner-catalogue branches:

```ts
const smartExpansions = smartSearchExpansions("prescribing", q);
const { matches, analysis } = searchMedicationCatalog(records, q, limit, smartExpansions);
```

Do not change `useMedicationCatalog`, query parameters, response types, cache headers, authorization, or owner-catalogue selection.

### Step 4: Run the focused tests

```powershell
npm run test -- tests/medications.test.ts tests/medications-route.test.ts
```

Expected: pass.

### Step 5: Commit

```powershell
git add src/lib/medication-query.ts src/app/api/medications/route.ts tests/medications.test.ts tests/medications-route.test.ts
git commit -m "feat(search): add safe smart medication retrieval"
```

Stage the exact existing route-test path only.

## Task 5: Prove the five-mode boundary and update documentation

**Files:**

- Modify: `src/lib/search-command-surface.ts`
- Modify: `src/components/clinical-dashboard/universal-search-command-surface.tsx`
- Modify: `src/components/clinical-dashboard/universal-search-also-matches-state.ts`
- Modify: `src/components/clinical-dashboard/universal-search-also-matches.tsx`
- Modify: `tests/search-command-surface.test.ts`
- Modify: `tests/universal-search-also-matches-state.test.ts`
- Modify: `tests/ui-clinical-ask.spec.ts`
- Modify: `docs/search-chrome-behaviour.md`
- Modify: `docs/clinical-governance.md`
- Include: `docs/superpowers/specs/2026-09-01-native-smart-catalogue-search-design.md`
- Include: `docs/superpowers/plans/2026-09-01-native-smart-catalogue-search.md`

**Subagent brief:** Integrate and document the exact feature. Do not add visual changes, provider tests, broad browser matrices, or release operations.

### Step 1: Add failing local-only request-boundary tests

Extend `commandSurfaceRemoteSearchEnabled` with an optional Smart-state argument:

```ts
export function commandSurfaceRemoteSearchEnabled(modeId: AppModeId, smartNaturalLanguage = false): boolean;
```

In `tests/search-command-surface.test.ts`, prove that it returns `false` for all five `smartLocalOnlyModeIds` when the second argument is `true`, still returns each mode's configured value for literal searches, and leaves the seven earlier Smart modes unchanged.

Add and test a pure cross-mode filter:

```ts
export function filterCommandSurfaceCrossModesForSmartSearch(
  modeId: AppModeId,
  query: string,
  modeIds: readonly AppModeId[],
): AppModeId[];
```

For natural-language queries in the five `smartLocalOnlyModeIds`, it removes `documents`, `answer`, and `favourites` while retaining other configured targets. For literal queries and every other mode, it returns the session-filtered list unchanged.

Extend `shouldRunUniversalAlsoMatches` to accept the current query:

```ts
export function shouldRunUniversalAlsoMatches(
  modeId: AppModeId,
  locationSearch: string | null,
  query?: string,
): boolean;
```

In `tests/universal-search-also-matches-state.test.ts`, prove natural-language Tools and Medication queries return `false`, literal `medications` and `sertraline` queries retain the current result, and the existing Answer URL-state cases remain unchanged.

Run:

```powershell
npm run test -- tests/search-command-surface.test.ts tests/universal-search-also-matches-state.test.ts
```

Expected: failure because the request suppression has not been implemented.

### Step 2: Suppress universal search only for the five Smart-local states

In `universal-search-command-surface.tsx`, pass `smartNaturalSearch` into `commandSurfaceRemoteSearchEnabled`. In `search-command-surface.ts`, return `false` only when `smartNaturalLanguage` and the mode is in `smartLocalOnlyModeIds`; otherwise retain the configured result. Reorder the component's derived values so `trimmedQuery` and `smartInterpretation` are available before `crossModes`, then pass the already session-filtered configured list through `filterCommandSurfaceCrossModesForSmartSearch`. Do not change `filterCrossModesForSession` or the mode configurations.

In `universal-search-also-matches.tsx`, pass `trimmedQuery` into `shouldRunUniversalAlsoMatches`. In the state helper, return `false` when the mode is in `smartLocalOnlyModeIds` and `interpretSmartSearch(modeId, query).naturalLanguage` is true, before applying the existing Answer URL rule. Do not change `useUniversalSearch`, the universal API, domain mappings, literal-query behaviour, or the earlier seven Smart modes.

Run:

```powershell
npm run test -- tests/search-command-surface.test.ts tests/universal-search-also-matches-state.test.ts
```

Expected: pass.

### Step 3: Add the focused five-mode provider-free browser matrix

Leave the current seven-mode regression unchanged. Add a separate five-mode tuple array:

```ts
["prescribing", "/", "medicine that needs regular blood tests", "Warfarin"],
["tools", "/tools", "where can I check medication interactions?", "Medication Prescribing"],
["calculators", "/calculators/search", "screen depression severity", "PHQ-9"],
["factsheets", "/factsheets/search", "information for someone who worries all the time", "Generalised anxiety disorder"],
["dictionary", "/dictionary/search", "term for hearing a voice that is not there", "Hallucination"],
```

Add one `@critical` test that loops only over this array. For Medication, also assert `mode=prescribing`. For every mode, assert the Smart cue; while the command dropdown is open, assert that no visible option is named Documents, Answer, or Favourites. Then assert the ordinary route retaining raw `q` and `run=1`, and use the fourth tuple field for a visible-owner assertion on the exact expected catalogue record. Count both `/api/clinical-ask/stream` and `/api/search/universal` requests and require zero after every tuple; this proves the local-only guard across command typeahead, static cross-mode actions, and result-page also-matches without expanding the older seven-mode journey. The pure unit test above supplies the literal-query preservation case without adding another browser journey.

Keep the existing Documents unsupported assertion and add Answer and Favourites to the same lightweight unsupported matrix. Do not duplicate the 320/1440 Axe loop for each new mode; the shared cue is already covered once.

### Step 4: Run one focused browser test

Start the repository's verified Playwright server using the existing `test:e2e:pr` script contract, then run:

```powershell
npm run test:e2e:pr -- tests/ui-clinical-ask.spec.ts --grep "natural-language Smart search|local-only Smart|unsupported modes"
```

Expected: the five modes remain within ordinary catalogue routes, visible results are relevant, and no Clinical Ask request occurs.

### Step 5: Update the two owner documents

In `docs/search-chrome-behaviour.md`, change the supported list from seven to twelve and document the five local matchers. Keep the original-query, exact-match, one-composer, provider-free, and unsupported-mode language intact.

In `docs/clinical-governance.md`, add Medication, Tools, Calculators, Factsheets, and Dictionary to the provider-free Smart list. State explicitly that Medication Smart search is retrieval-only and does not infer suitability, dose, or treatment, and that these five Smart states suppress universal-search/Document/Answer requests while literal searches retain existing behaviour.

### Step 6: Run focused final checks

```powershell
npm run test -- tests/smart-search-intent.test.ts tests/search-command-surface.test.ts tests/universal-search-also-matches-state.test.ts tests/tools-catalog.test.ts tests/calculators-mode.dom.test.tsx tests/favourites-auth-gate.dom.test.tsx tests/factsheets-data.test.ts tests/factsheets-search-page.dom.test.tsx tests/dictionary-data.test.ts tests/medications.test.ts tests/medications-route.test.ts
npm run docs:check-links
npx prettier --write -- src/lib/smart-search-intent.ts src/lib/search-command-surface.ts src/components/clinical-dashboard/universal-search-command-surface.tsx src/components/clinical-dashboard/universal-search-also-matches-state.ts src/components/clinical-dashboard/universal-search-also-matches.tsx src/components/applications-launcher-page.tsx src/components/calculators/calculator-filters.ts src/components/calculators/search-page.tsx src/components/factsheets/factsheets-data.ts 'src/app/(search-app)/factsheets/search/page.tsx' src/components/factsheets/factsheets-search-page.tsx src/lib/dictionary.ts src/components/dictionary/dictionary-catalogue-pages.tsx src/lib/medication-query.ts src/app/api/medications/route.ts tests/smart-search-intent.test.ts tests/search-command-surface.test.ts tests/universal-search-also-matches-state.test.ts tests/tools-catalog.test.ts tests/calculators-mode.dom.test.tsx tests/favourites-auth-gate.dom.test.tsx tests/factsheets-data.test.ts tests/factsheets-search-page.dom.test.tsx tests/dictionary-data.test.ts tests/medications.test.ts tests/medications-route.test.ts tests/ui-clinical-ask.spec.ts docs/search-chrome-behaviour.md docs/clinical-governance.md docs/superpowers/specs/2026-09-01-native-smart-catalogue-search-design.md docs/superpowers/plans/2026-09-01-native-smart-catalogue-search.md
git diff --check
```

Do not run provider, Supabase, RAG, migration, production-readiness, physical-device, full Playwright, or equivalent duplicate gates.

At PR handoff only, run `npm run verify:pr-local` once. If the heavy-run admission reports `DATABASE_HEAVY_RUN_ADMISSION_BUSY`, wait and retry later; do not bypass or force-release another worktree's lease.

### Step 7: Inspect scope and secrets

```powershell
git status --short
git diff --stat origin/main
git diff --check origin/main...HEAD
git diff --name-only origin/main
```

Confirm the diff contains only the planned source, test, and documentation files; no `.env*`, `.local`, provider output, receipts, generated content, credentials, unrelated CSS, migration, or lockfile changes.

### Step 8: Commit

```powershell
git add src/lib/search-command-surface.ts src/components/clinical-dashboard/universal-search-command-surface.tsx src/components/clinical-dashboard/universal-search-also-matches-state.ts src/components/clinical-dashboard/universal-search-also-matches.tsx tests/search-command-surface.test.ts tests/universal-search-also-matches-state.test.ts tests/ui-clinical-ask.spec.ts docs/search-chrome-behaviour.md docs/clinical-governance.md docs/superpowers/specs/2026-09-01-native-smart-catalogue-search-design.md docs/superpowers/plans/2026-09-01-native-smart-catalogue-search.md
git commit -m "test(search): verify native smart catalogue modes"
```

## Final independent review and PR handoff

Dispatch the final `gpt-5.6-sol` reviewer with the design, this plan, `origin/main...HEAD`, focused-test evidence, and all task reviews. Require it to check:

- provider-free and deterministic behaviour;
- exact match and compact-code precedence;
- Medication retrieval-only safety;
- guest Favourites exclusion;
- Factsheet and Calculator result/count consistency;
- Dictionary exact-score preservation;
- original query and existing route contracts;
- Documents, Answer, and Favourites exclusions;
- zero Clinical Ask/universal requests and no prohibited command shortcuts for the five Smart-local flows;
- absence of unrelated source, provider, database, configuration, or UI work.

Fix only blocking findings, rerun the directly affected focused checks, and obtain a fresh final review. Then fetch `origin/main`, compare it with HEAD, and merge current main normally only if it advanced. Do not rebase, reset, or force-push.

Publication is a separate authorized step. When requested, push the feature branch normally and open one ready-for-review PR with auto-merge off. State that Smart is deterministic and provider-free, scope is the five added modes, Documents/Answer/Favourites remain excluded, no hosted or production systems changed, and GitHub checks are authoritative exact-head coverage.
