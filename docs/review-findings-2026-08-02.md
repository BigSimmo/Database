# Mega-review report — TypeScript, code, quality, explicit-any, unchecked indexed access

**Date:** 2026-08-02  
**Scope:** Full repository (`src/`, `tests/`, `worker/`, `scripts/`, `supabase/functions/` as included by `tsconfig.json`) at maximum depth, report-only, no fixes applied.  
**Working tree:** Review performed on the current working tree. At the time of the report, uncommitted modifications were present in `Dockerfile`, `Dockerfile.worker`, `scripts/build-worker.mjs`, and `worker/main.ts`, plus several untracked worker files (`worker/run-loop.ts`, `worker/types.ts`, `worker/validate-runtime.ts`, etc.).

## Executive summary

| Skill                         | Key finding                                                                                                                                                                              | Severity |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `typescript-review`           | Main `npm run typecheck` is red due to stale `.next` generated types; source-only typecheck is clean. Widespread `as unknown as` casts and unvalidated `JSON.parse` trust external data. | High     |
| `code-review`                 | Many `response.json().catch(() => ({}))` and `void fetch(...).catch(() => undefined)` patterns silently swallow runtime/API errors.                                                      | High     |
| `code-quality-review`         | `ClinicalDashboard.tsx` (4119 lines), `src/lib/rag/rag.ts` (4337 lines), `DocumentViewer.tsx` (1693 lines) are at/near maintainability budget limits. Lint and `knip` are clean.         | Medium   |
| `no-explicit-any`             | Only one explicit `any` in source: `export type Json = any` in generated `database.types.ts` (eslint disabled). No `as any` or `: any` in source.                                        | Low      |
| `no-unchecked-indexed-access` | `tsconfig.json` does not enable `noUncheckedIndexedAccess`. Enabling it surfaces **1266 type errors**, heavily concentrated in tests, scripts, worker, and some RAG/evidence files.      | High     |

---

## 1. Baseline

- **Node:** `v24.18.0`, **npm:** `11.17.0` (matches `engines`).
- **Lock parity:** `npm run check:installed-lock-parity` passed.
- **Lint:** `npm run lint` passed with exit code 0.
- **Git status:** `git status --short` reported 4 modified tracked files (`Dockerfile`, `Dockerfile.worker`, `scripts/build-worker.mjs`, `worker/main.ts`) and 6 untracked files, mostly under `worker/`.

---

## 2. Skill 1 — `typescript-review`

### 2.1 Typecheck baseline

- `npm run typecheck` (using `tsconfig.json`) failed with 14 errors in `.next/dev/types/validator.ts` (Next.js generated validator) referencing missing mockup pages:
  - `Cannot find module '../../../src/app/mockups/favourites-hub-continue/page.js'`
  - Similar errors for `favourites-hub-register`, `favourites-hub-sets`, `favourites-redesign-collections`, `favourites-redesign-reader`, `favourites-redesign-register`, `favourites-redesign-resume`, `favourites-redesign-search`, `tools-dashboard-command-list`, `tools-dashboard-priority-desk`, `tools-dashboard-task-lanes`, `tools-search-intent-lanes`, `tools-search-tool-brief`, `tools-search-triage-ledger`.
- Running `npx tsc --noEmit` against a temporary `tsconfig` that excludes `.next/**` produced **exit code 0** — the authored source is type-clean without the stale build artifacts.

**Implication:** The standard typecheck gate is currently blocked by stale `.next` output. A `npm run clean:worktree` or `next` clean build is likely required before `npm run typecheck` will pass.

### 2.2 Unsafe casts (`as unknown as` / `as never`)

A grep for `\bas (any|unknown|never)\b` in `src/` found **48 matches**. These are broad type assertions, not type narrowing. High-risk locations include:

| File                                                                     | Line          | Evidence                                                                                                                      | Risk                                                |
| ------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `src/lib/rag/rag.ts`                                                     | 2108, 2217    | `query_embedding: embedding as unknown as string`                                                                             | Embedding may not be a string; cast hides mismatch. |
| `src/lib/rag/rag-candidate-sources.ts`                                   | 93            | `const client = supabase as unknown as SupabaseRpcClient`                                                                     | Supabase client RPC typing bypassed.                |
| `src/lib/rag/rag-candidate-sources.ts`                                   | 1050, 1117    | `query_embedding: args.queryEmbedding as unknown as string`                                                                   | Same embedding cast issue.                          |
| `src/lib/document-detail.ts`                                             | 290, 496, 519 | `rawPayload as unknown as {...}`, `document as unknown as Record<string, unknown>`, `document as unknown as ClinicalDocument` | Document object trusted without validation.         |
| `src/app/api/ingestion/quality/route.ts`                                 | 346, 384–388  | `(documentsData ?? []) as unknown as DocumentRow[]`, `(qualityResult.data ?? []) as unknown as QualityRow[]`, etc.            | Supabase row data cast without validation.          |
| `src/app/api/search/route.ts`                                            | 679, 740      | `} as unknown as Json`                                                                                                        | Unknown shape coerced to `Json`.                    |
| `src/lib/extractors/document.ts`                                         | 511, 549      | `buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]`, `(file as unknown as { _data?: ... })._data`                 | Buffer/file shape assumed.                          |
| `src/lib/health-response.ts`                                             | 66, 81        | `admin as unknown as SloProbeClient`, `admin as unknown as SpendProbeClient`                                                  | Admin client shape asserted.                        |
| `src/lib/upload-structure.ts`                                            | 65, 78        | `(entry as unknown as { unsafeOriginalName?: string }).unsafeOriginalName`, `(entry as unknown as { _data?: ... })._data`     | ZIP entry metadata accessed through cast.           |
| `src/lib/openai.ts`                                                      | 473           | `responseBody(input, options, format) as never`                                                                               | `never` return for abort path.                      |
| `src/lib/openai.ts`                                                      | 816           | `zodTextFormat(schema, ...) as unknown as Record<...>`                                                                        | OpenAI format type coerced.                         |
| `src/components/clinical-dashboard/universal-search-command-surface.tsx` | 1012          | `handleComposerKeyDown(event as unknown as ReactKeyboardEvent<HTMLInputElement>)`                                             | Event type asserted without guard.                  |

### 2.3 Unvalidated runtime data

`JSON.parse` is used ~24 times in `src/`; several locations cast the result but do not validate:

| File                                                       | Line   | Evidence                                                                                      | Risk                                                             |
| ---------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `src/lib/openai.ts`                                        | 1164   | `JSON.parse(response.text) as Record<string, unknown>`                                        | OpenAI response trusted to be JSON.                              |
| `src/lib/document-enrichment.ts`                           | 502    | `JSON.parse(raw) as Record<string, unknown>`                                                  | Enrichment output trusted.                                       |
| `src/lib/model-index-extraction.ts`                        | 243    | `JSON.parse(raw) as Record<string, unknown>`                                                  | Model index JSON trusted.                                        |
| `src/lib/private-search-scope.ts`                          | 51     | `JSON.parse(raw) as Partial<StoredPrivateSearchScope>`                                        | Storage data cast.                                               |
| `src/lib/universal-search-stream.ts`                       | 21     | `JSON.parse(line) as Partial<UniversalSearchStreamEvent>`                                     | Stream line parsed without validation.                           |
| `src/lib/api-client-error.ts`                              | 33, 47 | `JSON.parse(data) as Record<string, unknown>` / `JSON.parse(text) as Record<string, unknown>` | Error payload shape assumed.                                     |
| `src/lib/answer-feedback-token.ts`                         | 85     | `JSON.parse(...)`                                                                             | Token claims parsed.                                             |
| `src/components/ClinicalDashboard.tsx`                     | 848    | `JSON.parse(window.localStorage.getItem(...) ?? "{}")`                                        | Preferences JSON parsed with try/catch but no schema validation. |
| `src/components/clinical-dashboard/use-app-preferences.ts` | 74     | `JSON.parse(raw)` normalized                                                                  | Same localStorage pattern.                                       |

Some files correctly pair `JSON.parse` with a Zod schema (e.g., `src/lib/extractors/document.ts:62`, `src/lib/publication-manifest.ts:47`, `src/lib/validation/body.ts:39`), but the unvalidated cases dominate in RAG and API boundaries.

### 2.4 `any` in generated types

`src/lib/supabase/database.types.ts:4-5`:

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
export type Json = any;
```

This is the only explicit `any` type in the source tree. It is a generated Supabase type and the `no-explicit-any` rule is disabled for the file.

---

## 3. Skill 2 — `code-review` (max effort)

### 3.1 Silent error swallowing

A grep for `\.catch\(\(\) =>` found **51 matches** across `src/`. The most common patterns are `response.json().catch(() => ({}))` and `void ...catch(() => undefined)`. These hide network, JSON, and auth failures from telemetry, retries, and user feedback.

| File                                                   | Lines                                                                | Pattern                                                                                   | Failure mode                                                                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/components/ClinicalDashboard.tsx`                 | 958, 980, 1208, 1249, 1354, 1438, 1450, 1488, 1514, 2425, 2592, 2631 | `await x.catch(() => null/undefined/{})`                                                  | API or JSON errors become `null`/`{}`; downstream code may proceed with bad data or show generic messages. |
| `src/components/DocumentViewer.tsx`                    | 906, 1114                                                            | `await response.json().catch(() => null/{})`                                              | Document detail/search payload silently becomes empty.                                                     |
| `src/components/clinical-dashboard/source-actions.tsx` | 107, 134, 156                                                        | `void fetch(...).catch(() => undefined)`                                                  | Analytics/telemetry fetches fire-and-forget with no observability.                                         |
| `src/lib/extractors/document.ts`                       | 238, 319, 427–429, 504                                               | `await ...catch(() => null/undefined)`                                                    | File system cleanup and metadata reads ignored.                                                            |
| `src/lib/rag/rag.ts`                                   | 1261, 2540                                                           | `void insertRagQuery(...).catch(() => undefined)`, `void setCachedAnswer(...).catch(...)` | Telemetry and cache writes may fail silently.                                                              |
| `src/lib/universal-search-stream.ts`                   | 47                                                                   | `void reader.cancel(...).catch(() => undefined)`                                          | Stream cancelation error swallowed.                                                                        |

### 3.2 Concrete example — `ClinicalDashboard.tsx:1208`

```ts
const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  throw new Error(typeof payload.error === "string" ? payload.error : "Job retry could not be started.");
}
```

If `response.json()` throws, `payload` is `{}`, so `payload.error` is `undefined`, and the user receives a generic message instead of the actual server error body.

### 3.3 Untyped `new Promise`

`src/components/clinical-dashboard/DocumentManagerPanel.tsx:163`:

```ts
return new Promise((resolve) => {
```

The generic is inferred from the return type (`Promise<UploadOutcome>`), but the resolver lacks an explicit type, making it easier to accidentally resolve with the wrong shape during future edits.

### 3.4 `response.json()` after `response.ok` check missing

In many fetch call sites the code does `await response.json().catch(...)` without first checking `response.ok`. When combined with `.catch(() => ({}))`, a 4xx/5xx HTML error page will throw during JSON parsing and be silently replaced with `{}`, masking the failure reason.

---

## 4. Skill 3 — `code-quality-review`

### 4.1 Maintainability budgets

`npm run check:maintainability-budgets` passed, but the largest files are close to or over reasonable thresholds:

| File                                            | Lines | Budget / note                           |
| ----------------------------------------------- | ----- | --------------------------------------- |
| `src/lib/rag/rag.ts`                            | 4337  | Very large; RAG orchestration monolith. |
| `src/components/ClinicalDashboard.tsx`          | 4119  | Very large; dashboard shell monolith.   |
| `supabase/functions/indexing-v3-agent/index.ts` | 1971  | Large Edge Function.                    |
| `src/components/DocumentViewer.tsx`             | 1693  | Large component.                        |

These sizes increase the risk of merge conflicts, make unit testing difficult, and obscure ownership boundaries. The budget is currently configured to allow these sizes, but the trend is worth watching.

### 4.2 Lint and unused code

- `npm run lint` passed with no errors and `--max-warnings 0`.
- `npx knip --no-progress --include dependencies,unlisted,unresolved,duplicates` passed with no actionable findings.
- Grep for `TODO|FIXME|HACK|XXX` in `src/` returned zero matches.

### 4.3 Console usage

`console.log/warn/error` appears ~30 times in `src/`. Most are in error paths, telemetry, PWA lifecycle, or the `logger.ts` fallback. No egregious debugging logs were found; usage is largely intentional.

### 4.4 Long parameter lists

Many React component props lists are long, but they are typed with props interfaces and are consistent with the design system. This is not flagged as a quality defect.

---

## 5. Skill 4 — `no-explicit-any`

- Grep for `\bas\s+any\b` across the repository found **1 match** in `tests/rag-round-trip-budget.test.ts:207` — a code comment, not a type.
- Grep for `:\s*any\b` found 4 matches, all inside string literals or comments (e.g. a regex in `src/lib/rag/rag-extractive-answer.ts` and a comment in `src/lib/upload-structure.ts`).
- Grep for `\btype\s+\w+\s*=\s*any\b` found 1 match: `src/lib/supabase/database.types.ts:5` (`export type Json = any;`), inside an `eslint-disable` block for a generated Supabase file.

**Conclusion:** The project enforces `@typescript-eslint/no-explicit-any` effectively. The only `any` is the generated `Json` type in Supabase types, which is an accepted/generated exception.

---

## 6. Skill 5 — `no-unchecked-indexed-access`

### 6.1 Baseline

`tsconfig.json` has `strict: true` but does **not** set `noUncheckedIndexedAccess`. Without the flag, `array[0]` is typed as `T` even if the array may be empty.

### 6.2 Impact assessment

A temporary `tsconfig` was created extending the project config and adding `"noUncheckedIndexedAccess": true` (`.next` excluded to avoid the unrelated build-artifact errors). Running `npx tsc --noEmit` produced **1266 type errors**.

### 6.3 Top affected files

| File                                                                     | Error count | Notes                                                  |
| ------------------------------------------------------------------------ | ----------- | ------------------------------------------------------ |
| `src/lib/demo-data.ts`                                                   | 44          | Synthetic demo data access.                            |
| `src/components/master-document-flow-mockups.tsx`                        | 41          | Mockup route (production 404).                         |
| `src/lib/answer-verification.ts`                                         | 41          | Answer quality verification — high clinical impact.    |
| `tests/evidence.test.ts`                                                 | 40          | Tests.                                                 |
| `tests/ui-phone-scroll-page-owned.spec.ts`                               | 38          | Tests.                                                 |
| `tests/clinical-search.test.ts`                                          | 28          | Tests.                                                 |
| `tests/private-access-routes.test.ts`                                    | 23          | Tests.                                                 |
| `src/lib/rag/rag-extractive-answer.ts`                                   | 23          | Extractive answer generation — high clinical impact.   |
| `src/components/favourites-page-mockups/favourites-page-mockup-page.tsx` | 22          | Mockup route.                                          |
| `src/components/formulation/formulation-compare-page.tsx`                | 20          | UI.                                                    |
| `src/lib/evidence.ts`                                                    | 19          | Evidence presentation — high clinical impact.          |
| `worker/main.ts`                                                         | 21          | Ingestion worker image handling — high runtime impact. |
| `src/components/specifiers/specifier-compare-page.tsx`                   | 17          | UI.                                                    |
| `src/lib/document-summary-formatting.ts`                                 | 16          | Summary rendering.                                     |
| `tests/ward-output.test.ts`                                              | 13          | Tests.                                                 |

### 6.4 High-risk examples

`worker/main.ts:901–942` contains repeated index access on `preparedImage` and `image` arrays. With `noUncheckedIndexedAccess` enabled, TypeScript reports that these indexes may return `undefined` and the values are then passed to functions expecting `ExtractedImage`. If the worker ever receives an empty or shorter array, these will throw at runtime.

`src/lib/rag/rag-extractive-answer.ts:1671–1861` accesses `answer.answerSections[0]`, `citation.chunk_id`, `citation_chunk_ids[0]`, etc., without proving the arrays are non-empty. These are in the extractive fallback path used when the model fails the quality gate; an out-of-bounds access could cause the fallback itself to fail.

`src/lib/answer-verification.ts` has 41 errors; verification of generated answers relies on index access into arrays that may be empty, which could crash the verification gate.

### 6.5 Recommendation

Enabling `noUncheckedIndexedAccess` is valuable but will require a dedicated cleanup pass. The ~1266 errors are not a one-session fix. A sensible approach is:

1. Enable the flag in a branch.
2. Add non-null assertions `!` or optional chaining `?.` only where the invariants are provable.
3. Re-run the full test suite (`npm run test`) and `npm run typecheck`.

---

## 7. Cross-cutting themes

1. **External data is trusted too freely.** Supabase rows, OpenAI responses, localStorage, and file metadata are frequently cast with `as unknown as Type` or parsed with `JSON.parse(...)` and a cast. Zod validation exists in some places (`src/lib/validation/body.ts`, `src/lib/env.ts`, `src/lib/extractors/document.ts`) but is not applied consistently at API/model boundaries.
2. **Errors are swallowed by default.** `.catch(() => ({}))` and `void ...catch(() => undefined)` are pervasive. This makes production debugging harder and can mask provider failures, auth expiration, and data corruption.
3. **Monolithic files are growing.** `ClinicalDashboard.tsx` and `rag.ts` are over 4,000 lines. Refactoring them into smaller, owner-scoped modules would improve testability and reduce review risk.
4. **Typecheck gate is blocked by `.next` artifacts.** The authoritative `npm run typecheck` is currently red for reasons unrelated to authored code; stale generated types reference removed mockup pages.
5. **`noUncheckedIndexedAccess` is a large latent risk.** 1,266 type errors indicate many places where `arr[0]` / `arr[i]` / `obj[key]` are used without proving the index is valid. High-consequence paths include `worker/main.ts`, `src/lib/rag/rag-extractive-answer.ts`, and `src/lib/answer-verification.ts`.

---

## 8. Suggested next steps

1. **Restore the typecheck gate:** clean `.next/` and regenerate, or update `.next/dev/types/validator.ts` references, so `npm run typecheck` reflects source health.
2. **Reduce `as unknown as` casts:** introduce Zod schemas or runtime guards at Supabase, OpenAI, and extraction boundaries. Start with `src/lib/rag/rag.ts` and `src/app/api/*` routes.
3. **Stop swallowing errors:** replace `response.json().catch(() => ({}))` with an explicit check of `response.ok` and a typed error path; for telemetry, consider a small `safeFetch` wrapper that logs failure without losing the failure signal.
4. **Plan a `noUncheckedIndexedAccess` migration:** pick the 15–20 highest-risk files (tests excluded) and add `?.`/`??` guards or non-null assertions where invariants are provable.
5. **Watch the maintainability budgets:** set a lower internal target for `ClinicalDashboard.tsx` and `rag.ts` to prevent further growth.

---

## 9. Commands and artifacts

- `npm run check:installed-lock-parity` — passed.
- `npm run lint` — passed.
- `npm run typecheck` — failed (stale `.next` types).
- `npx tsc --noEmit --project <temp-tsconfig-excluding-.next>` — passed.
- `npx tsc --noEmit --project tsconfig.no-unchecked.json` — failed (1266 errors).
- `npx knip --no-progress --include dependencies,unlisted,unresolved,duplicates` — passed.
- `npm run check:maintainability-budgets` — passed.
- Temporary files `tsconfig.typescript-review.json` and `tsconfig.no-unchecked.json` were created and then deleted; the repository is unchanged except for this report.
