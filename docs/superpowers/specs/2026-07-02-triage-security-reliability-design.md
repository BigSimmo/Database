# Triage Security & Reliability Fixes Design

Date: 2026-07-02  
Scope: Issue #53 (security), #55 (reliability gaps only), #56 (no change unless concrete gap appears)

## 1. Goals and non-goals

### Goals

- Remove authentication bypass behavior so protected APIs fail closed.
- Stop client-side reliance on persisted localStorage auth token hints.
- Redact high-risk identifiers from generated image captions before persistence.
- Ensure Supabase-related error logging uses redacted/safe detail formatting.
- Close currently open reliability gaps from #55 with minimal, targeted changes (especially embedding-dimension drift safeguards).

### Non-goals

- No front-end refactor work from #51.
- No performance-oriented search/ingestion optimization from #52.
- No broad operational redesign for #56; only patch ops docs/scripts if implementation reveals a concrete missing step.

## 2. Recommended approach

Use a surgical patch strategy that edits only existing touch points and preserves current architecture:

1. Enforce strict auth in `src/lib/supabase/auth.ts` by removing local fallback owner resolution for protected request flows.
2. Update client auth usage in `src/lib/supabase/client.tsx` and dependent dashboard checks in `src/components/ClinicalDashboard.tsx` so privileged behavior is derived from Supabase session state rather than localStorage token presence hints.
3. Add caption identifier sanitization before writing generated captions to `document_images` and `image_caption_cache`.
4. Normalize Supabase-related logging callsites to use existing safe redaction utilities.
5. Strengthen embedding dimension guardrails using a single expected-dimension source and explicit mismatch handling where ingestion asserts are performed.

This is preferred over broader rewrites because it directly addresses active risk while minimizing regression surface.

## 3. Architecture and component changes

### 3.1 Authentication boundary

- Primary file: `src/lib/supabase/auth.ts`.
- Change: remove environment-based no-auth fallback paths for protected API authorization.
- Result: auth gate requires valid Supabase-authenticated user identity; invalid/missing identity returns explicit unauthorized response paths.

### 3.2 Client-side session handling

- Primary files: `src/lib/supabase/client.tsx`, `src/components/ClinicalDashboard.tsx`.
- Change: stop relying on localStorage token presence scans and persisted auth-email hints for deciding private API/session capability.
- Result: UI behavior follows actual Supabase session/auth state only.

### 3.3 Caption redaction before persistence

- Primary file: `worker/main.ts` (with helper placement in shared privacy utility area where appropriate).
- Change: sanitize generated caption text before database/cache writes.
- Baseline redaction targets:
  - Email-like identifiers
  - Phone-like strings
  - MRN/NHS-style identifier patterns
- Result: ingestion remains functional, but persisted captions are safer by default.

### 3.4 Safe Supabase logging

- Primary files: worker/server/script callsites identified during implementation.
- Change: route Supabase-related error detail formatting through existing safe redaction utilities instead of direct raw detail logging.
- Result: operational logs remain actionable without leaking secret/token/identifier content.

### 3.5 Embedding-dimension drift safeguards

- Primary file: `src/lib/embedding-dimensions.ts` and nearby ingestion assertions/tests.
- Change: align expected dimension checks to a single configuration source used by ingestion-time assertions.
- Result: mismatches fail fast and predictably, avoiding silent search-quality corruption.

## 4. Data flow and behavior

1. Protected API request arrives.
2. Auth utility validates bearer token via Supabase.
3. If invalid/missing identity: return unauthorized; no fallback identity resolution.
4. Ingestion pipeline generates captions for images.
5. Caption text is sanitized for high-risk identifiers before persistence.
6. Sanitized caption is written to caption tables/cache.
7. Embedding generation/check asserts configured dimension; mismatch triggers deterministic failure with redacted diagnostics.
8. Supabase-related errors along these paths are logged via safe redaction formatting.

## 5. Error handling model

- Preserve existing control flow shape; do not add broad catch-and-ignore blocks.
- Fail closed on auth.
- Continue ingestion with sanitized captions when sanitization succeeds.
- Fail ingestion unit explicitly on embedding-dimension mismatch.
- Keep log messages actionable while redacting sensitive fields.

## 6. Verification strategy

1. Run targeted tests for modified auth and ingestion dimension/caption paths.
2. Run focused checks for fail-closed auth and redacted logging behavior in touched areas.
3. Run `npm run verify:cheap` after changes.
4. Only add #56 docs/script updates if a concrete ops gap is discovered during implementation.

## 7. Risks and mitigations

- Risk: strict auth may reveal latent callers depending on fallback behavior.  
  Mitigation: adjust only protected-path behavior and keep unauthorized responses explicit/consistent.

- Risk: caption redaction could over-redact useful text.  
  Mitigation: target clear identifier patterns first and keep clinical context text unchanged.

- Risk: logging redaction could remove needed diagnostics.  
  Mitigation: preserve non-sensitive context (operation, status, IDs safe for logs) while masking secrets/identifiers.

## 8. Implementation boundaries

- In scope now: #53 + #55 open gaps, with minimal #56 follow-up only if necessary.
- Out of scope now: #51 refactor, #52 performance program.
