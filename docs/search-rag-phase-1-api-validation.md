# Search/RAG Phase 1: API Validation Contract

Date: 2026-06-29
Workspace: `C:\Dev\Apps\Database`
Status: started

## Objective

Replace route-local manual parsing and clamping with a shared, schema-first API validation boundary. This first pass targets the route families identified in Phase 0 without changing RAG answer generation behavior.

## Implemented in this pass

Added shared API validation helpers under `src/lib/validation/`:

- `src/lib/validation/query.ts`
- `src/lib/validation/body.ts`
- `src/lib/validation/form-data.ts`
- `src/lib/validation/params.ts`
- `src/lib/validation/http.ts`

The helpers centralize:

- Query integer parsing and clamping.
- Query boolean normalization.
- Optional non-empty query string handling.
- Optional UUID query handling.
- Strict JSON body parsing for mutation routes.
- Compatibility JSON body parsing with defaults where prior behavior intentionally allowed fallback.
- Optional form text validation.
- Route parameter validation.
- Shared `PublicApiError` handling for invalid query/body/form/param contracts.

The previous single helper file `src/lib/api-validation.ts` has been removed so new code imports from the explicit validation modules.

## Shared validation policy

- `coerce`: query strings may coerce compatible primitive values at the route boundary.
- `default`: missing or malformed numeric query values may fall back to the existing default when compatibility requires it.
- `clamp`: numeric query values may be clamped only through shared query helpers; route-local clamps are not allowed for request parsing.
- `reject`: JSON mutation bodies, route params, UUID query fields, and known multipart metadata fields reject malformed values with a public validation error.
- `unknown JSON fields`: strict mutation schemas reject unknown fields where migrated.
- `unknown multipart fields`: ignored for compatibility; known metadata fields are validated by schema.
- `public error shape`: validation failures use the existing stable public envelope `{ error: string }`.
- `server-side details`: validation error codes are stored in `PublicApiError.details.code` and remain server-side only through `jsonError` logging.

Updated route boundaries:

- `src/app/api/documents/route.ts`
  - Replaced local `parsePositiveInt` and `parseOffset`.
  - Added a Zod query schema for `limit`, `offset`, `q`, `status`, and `includeMeta`.
  - Preserved existing forgiving numeric behavior while centralizing parsing/clamping.

- `src/app/api/documents/[id]/route.ts`
  - Replaced local `boundedInteger`.
  - Added a Zod query schema for `chunk`, `page`, `pageLimit`, `chunkLimit`, and `chunkOffset`.
  - Preserved empty `chunk` behavior as "not provided".
  - Kept document-page clamping after document lookup because the max page depends on the retrieved document.
  - Migrated document id route-param validation to the shared route-param helper.
  - Migrated document rename JSON validation to the shared JSON body helper.
  - Made the rename body schema strict so unknown JSON fields are rejected.

- `src/app/api/documents/[id]/search/route.ts`
  - Replaced local `boundedLimit`.
  - Added a Zod query schema for `q` and `limit`.
  - Added route-param validation for real-mode searches.

- `src/app/api/ingestion/quality/route.ts`
  - Replaced inline `Number(...)` plus `Math.min/Math.max` limit handling.
  - Added a Zod query schema for `limit`.

- `src/app/api/ingestion/jobs/route.ts`
  - Added a Zod query schema for `batchId`.
  - Enforces UUID format for non-empty `batchId`.
  - Preserves empty `batchId` behavior as "not provided".

- `src/app/api/upload/route.ts`
  - Added a Zod form metadata schema for `title` and `description`.
  - Preserved existing file validation, MIME allowlist, size limit, and byte-signature checks.
  - Validates optional text metadata before document naming/insertion.
  - Rejects non-string known multipart metadata fields.

- `src/app/api/documents/[id]/reindex/route.ts`
  - Replaced direct JSON mode probing with a Zod-backed mode schema.
  - Preserved the prior compatibility behavior: missing, invalid, or unsupported mode values default to `full`; `enrichment` remains the explicit enrichment mode.
  - Added shared route-param validation.

Added focused route-contract coverage:

- `tests/api-validation-contract.test.ts`
  - Static guard for route-local request parsing in Phase 1 target files.
  - Document listing numeric clamp/default behavior.
  - Document detail empty optional `chunk` handling and page/chunk window clamping.
  - Direct document search empty query behavior before auth/Supabase access.
  - Direct document search invalid route-param rejection.
  - Ingestion quality limit clamping.
  - Ingestion jobs valid, invalid, and empty `batchId` handling.
  - Upload metadata rejection before storage/database writes.
  - Multipart known metadata field type rejection.
  - Document rename valid, malformed, missing-field, and unknown-field JSON handling.

## Deliberate compatibility choices

- Invalid numeric query values still fall back to route defaults, matching prior behavior.
- Out-of-range numeric query values are clamped, matching prior behavior.
- Empty optional query values such as `?chunk=` and `?batchId=` are treated as absent.
- Upload file security checks were not moved or weakened.
- Existing `jsonError` and `PublicApiError` response behavior remains the public error envelope.

## Not changed in this pass

- RAG retrieval, routing, answer synthesis, source display, and model behavior.
- Auth checks and Supabase ownership filters.
- Existing body schemas in document label/table/bulk routes that already use Zod.
- Routes with no request input surface in the first targeted pass.

## Remaining route audit notes

The continued audit did not find remaining manual query parsing in the targeted route files after this pass. A static guard now checks the target files for route-local query parsing patterns. Remaining search hits fall into these categories:

- Existing Zod body schemas: document bulk edits, bulk reindex, labels, table facts, and document rename.
- File-specific form handling: upload still uses `formData.get("file")`, then validates the value with `File` type checks, allowlisted MIME type, size limit, and byte signature.
- Non-input math/scoring: page-window calculations, search scoring, result snippets, and sort normalization.
- Route params outside the explicit Phase 1 target set: several nested routes still accept route params directly and rely on Supabase ownership filters or downstream helpers. A later hardening slice can centralize every nested route param if desired.

## Validation status

Focused route-contract tests have been added. Validation commands are run after edits and reported in the chat summary.

Recommended validation for this phase:

```powershell
npm run test -- tests/private-access-routes.test.ts
npm run test -- tests/rag-routing.test.ts tests/smart-rag-api.test.ts tests/rag-answer-fallback.test.ts
npm run check:production-readiness
```

If broader confidence is needed after this API boundary pass:

```powershell
npm run verify:cheap
```

## Next Phase 1 slice

Recommended next work:

1. Add focused route-contract tests for invalid/empty/clamped query values on the changed endpoints.
2. Audit the remaining `documents`, `jobs`, `ingestion`, and `upload` routes for route params/body schemas that should reuse the shared helper.
3. Add an API validation checklist to the master plan so future endpoints do not reintroduce route-local parsers.
