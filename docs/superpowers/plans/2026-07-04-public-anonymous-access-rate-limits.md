# Public Anonymous Access and Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the forced sign-in/authorization barrier so anonymous users can run live searches, generate answers, browse/view source documents, and use the app without logging in, while protecting costly APIs with server-side rate limits.

**Architecture:** Keep Supabase auth optional instead of required for public read/search/answer flows. Authenticated users keep owner-scoped behavior; anonymous users use a privacy-preserving anonymous caller key for rate limits and public/global search behavior. Uploads and owner-required mutations must either use a configured shared public workspace owner or stay disabled with setup copy that does not ask users to sign in.

**Tech Stack:** Next.js App Router API routes, React 19 client UI, Supabase service-role server client, existing `consume_api_rate_limit` RPC, new anonymous rate-limit RPC/table, Vitest route tests, existing `npm run verify:cheap` gate.

## Global Constraints

- Do not require Supabase Auth for live `/api/search`, `/api/answer`, or `/api/answer/stream` requests.
- Fix the visible UI error: “Search request was not authorized by the server.”
- Remove the sign-in panel/gate from the main website experience.
- Add rate-limit-only abuse protection, per user when authenticated and per anonymous caller when signed out.
- Do not add captcha, Turnstile, reCAPTCHA, or new third-party dependencies.
- Do not expose service-role keys or private env values to the browser.
- Preserve existing authenticated behavior where a real Supabase session is present.
- Keep destructive document management protected unless a shared public owner is explicitly configured.
- Run `npm run verify:cheap` after implementation; for UI changes also run `npm run ensure` and `npm run verify:ui` if feasible.
- Do not commit unless the user explicitly requests it.

---

## File Structure

- Modify: `src/lib/env.ts`
  - Add optional public workspace owner env support for anonymous upload/owner-required actions.
- Modify: `src/lib/supabase/auth.ts`
  - Add optional auth resolution instead of throwing for missing tokens.
- Create: `src/lib/public-api-access.ts`
  - Centralize anonymous caller key derivation, public access context, and public owner resolution.
- Modify: `src/lib/api-rate-limit.ts`
  - Add anonymous subject rate limiting while preserving existing authenticated owner rate limiting.
- Create: `supabase/migrations/YYYYMMDDHHMMSS_public_api_rate_limit_subjects.sql`
  - Add durable anonymous subject rate-limit storage and RPC.
- Modify: `supabase/schema.sql`
  - Mirror the new durable anonymous rate-limit table/function.
- Modify: `src/app/api/search/route.ts`
  - Stop requiring auth; apply public access context and anonymous rate limit.
- Modify: `src/app/api/answer/route.ts`
  - Stop requiring auth; apply public access context and anonymous rate limit.
- Modify: `src/app/api/answer/stream/route.ts`
  - Stop requiring auth; apply public access context and anonymous rate limit.
- Modify: `src/app/api/documents/route.ts`
  - Allow anonymous document listing for public/global search previews.
- Modify likely source-preview routes after inspection during execution:
  - `src/app/api/documents/[id]/route.ts`
  - `src/app/api/documents/[id]/search/route.ts`
  - `src/app/api/documents/[id]/signed-url/route.ts`
  - `src/app/api/images/[id]/signed-url/route.ts`
- Modify: `src/app/api/upload/route.ts`
  - If public upload is desired, use shared public owner; otherwise return a non-auth setup message.
- Modify: `src/components/ClinicalDashboard.tsx`
  - Remove main-page auth gate and make `canRunSearch` true when setup is ready even without auth.
- Modify: `src/components/clinical-dashboard/auth-panel.tsx`
  - Stop rendering forced sign-in for the public flow, or leave as optional account panel only.
- Modify: `src/components/clinical-dashboard/document-search-results.tsx`
  - Replace “Sign in...” copy with setup/rate-limit copy.
- Modify: `src/components/DocumentViewer.tsx`
  - Let anonymous users open source previews without auth when the route supports it.
- Modify: `tests/private-access-routes.test.ts`
  - Update old 401 expectations for search/answer/doc preview to anonymous success/rate-limit behavior.
- Add/modify focused tests as needed in `tests/api-validation-contract.test.ts` or a new `tests/public-access-rate-limit.test.ts` if the existing private access test becomes too large.

---

### Task 1: Add Public Access Context and Optional Auth

**Files:**
- Modify: `src/lib/supabase/auth.ts:32-83`
- Create: `src/lib/public-api-access.ts`
- Modify: `src/lib/env.ts:1-20`, `src/lib/env.ts:150-179`
- Test: `tests/private-access-routes.test.ts`

**Interfaces:**
- Consumes: existing `requireAuthenticatedUser(request, supabase)`.
- Produces:
  - `getOptionalAuthenticatedUser(request: Request, supabase: AdminClient): Promise<AuthenticatedUser | null>`
  - `anonymousApiSubjectKey(request: Request): string`
  - `publicAccessContext(request: Request, supabase: AdminClient): Promise<{ ownerId?: string; authenticated: boolean; rateLimitSubject: { kind: "owner"; ownerId: string } | { kind: "anonymous"; subjectKey: string } }>`
  - `publicWorkspaceOwnerId(): string | null`

- [ ] **Step 1: Write failing tests for optional auth and anonymous key stability**

Add tests near the auth/no-auth cases in `tests/private-access-routes.test.ts`:

```ts
it("derives a stable anonymous rate-limit subject without requiring Supabase auth", async () => {
  const client = createSupabaseMock();
  mockRuntime(client);
  const { publicAccessContext } = await import("../src/lib/public-api-access");

  const first = await publicAccessContext(
    request("/api/search", {
      headers: {
        "x-forwarded-for": "203.0.113.44, 10.0.0.1",
        "user-agent": "Vitest Browser",
      },
    }),
    client as never,
  );
  const second = await publicAccessContext(
    request("/api/search", {
      headers: {
        "x-forwarded-for": "203.0.113.44, 10.0.0.1",
        "user-agent": "Vitest Browser",
      },
    }),
    client as never,
  );

  expect(first.authenticated).toBe(false);
  expect(first.ownerId).toBeUndefined();
  expect(first.rateLimitSubject.kind).toBe("anonymous");
  expect(first.rateLimitSubject).toEqual(second.rateLimitSubject);
  expect(client.auth.getUser).not.toHaveBeenCalled();
});

it("uses authenticated owner rate limits when a valid bearer token is present", async () => {
  const client = createSupabaseMock();
  mockRuntime(client);
  const { publicAccessContext } = await import("../src/lib/public-api-access");

  const context = await publicAccessContext(authenticatedRequest("/api/search"), client as never);

  expect(context).toMatchObject({
    authenticated: true,
    ownerId: userId,
    rateLimitSubject: { kind: "owner", ownerId: userId },
  });
  expect(client.auth.getUser).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```powershell
npm run test -- tests/private-access-routes.test.ts -t "anonymous rate-limit subject|authenticated owner rate limits"
```

Expected: FAIL because `src/lib/public-api-access.ts` and optional auth helpers do not exist.

- [ ] **Step 3: Implement optional auth helper**

In `src/lib/supabase/auth.ts`, keep `requireAuthenticatedUser` unchanged and add:

```ts
export async function getOptionalAuthenticatedUser(
  request: Request,
  supabase: AdminClient,
): Promise<AuthenticatedUser | null> {
  const token = extractSessionAccessToken(request);
  if (!token) return null;

  const { data, error } = await supabase.auth.getUser(token);
  const userId = data.user?.id;
  if (error || !userId) {
    throw new AuthenticationError();
  }

  return { id: userId };
}
```

- [ ] **Step 4: Add public env fields**

In `src/lib/env.ts`, add optional keys to the env schema near the existing local no-auth owner fields:

```ts
PUBLIC_WORKSPACE_OWNER_ID: z.string().uuid().optional(),
NEXT_PUBLIC_PUBLIC_UPLOADS_ENABLED: z.enum(["true", "false"]).optional(),
```

Add helpers near `isLocalNoAuthMode()`:

```ts
export function publicWorkspaceOwnerId() {
  return env.PUBLIC_WORKSPACE_OWNER_ID?.trim() || null;
}

export function publicUploadsEnabled() {
  return process.env.NEXT_PUBLIC_PUBLIC_UPLOADS_ENABLED === "true";
}
```

- [ ] **Step 5: Create public access helper**

Create `src/lib/public-api-access.ts`:

```ts
import { createHash } from "node:crypto";
import { publicWorkspaceOwnerId } from "@/lib/env";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalAuthenticatedUser } from "@/lib/supabase/auth";

type AdminClient = ReturnType<typeof createAdminClient>;

export type RateLimitSubject =
  | { kind: "owner"; ownerId: string }
  | { kind: "anonymous"; subjectKey: string };

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function requestIpSignal(request: Request) {
  return (
    firstForwardedIp(request.headers.get("cf-connecting-ip")) ||
    firstForwardedIp(request.headers.get("x-forwarded-for")) ||
    firstForwardedIp(request.headers.get("x-real-ip")) ||
    "unknown-ip"
  );
}

export function anonymousApiSubjectKey(request: Request) {
  const userAgent = request.headers.get("user-agent")?.slice(0, 180) || "unknown-agent";
  const acceptLanguage = request.headers.get("accept-language")?.slice(0, 80) || "unknown-language";
  const raw = [requestIpSignal(request), userAgent, acceptLanguage].join("|");
  return `anon:${createHash("sha256").update(raw).digest("hex")}`;
}

export async function publicAccessContext(request: Request, supabase: AdminClient) {
  const user = await getOptionalAuthenticatedUser(request, supabase);
  if (user) {
    return {
      ownerId: user.id,
      authenticated: true,
      rateLimitSubject: { kind: "owner", ownerId: user.id } satisfies RateLimitSubject,
    };
  }

  return {
    ownerId: undefined,
    authenticated: false,
    rateLimitSubject: { kind: "anonymous", subjectKey: anonymousApiSubjectKey(request) } satisfies RateLimitSubject,
  };
}

export { publicWorkspaceOwnerId };
```

- [ ] **Step 6: Run the focused tests and verify they pass**

Run:

```powershell
npm run test -- tests/private-access-routes.test.ts -t "anonymous rate-limit subject|authenticated owner rate limits"
```

Expected: PASS.

---

### Task 2: Add Durable Anonymous Rate Limiting

**Files:**
- Modify: `src/lib/api-rate-limit.ts:1-160`
- Create: `supabase/migrations/YYYYMMDDHHMMSS_public_api_rate_limit_subjects.sql`
- Modify: `supabase/schema.sql`
- Test: `tests/private-access-routes.test.ts`

**Interfaces:**
- Consumes: `RateLimitSubject` from `src/lib/public-api-access.ts`.
- Produces:
  - `consumeSubjectApiRateLimit(args: { supabase: SupabaseAdmin; subject: RateLimitSubject; bucket: ApiRateLimitBucket; limit?: number; windowSeconds?: number; allowInMemoryFallbackOnUnavailable?: boolean }): Promise<ApiRateLimitResult>`

- [ ] **Step 1: Write failing anonymous limiter test**

Add near existing rate-limit tests in `tests/private-access-routes.test.ts`:

```ts
it("rate limits anonymous answer requests by anonymous subject key", async () => {
  const client = createSupabaseMock();
  client.rpc.mockImplementation(async (name: string, args?: Record<string, unknown>) =>
    name === "consume_api_subject_rate_limit" && args?.p_bucket === "answer"
      ? { data: [rateLimitRow({ limited: true, limit_value: 10, remaining: 0 })], error: null }
      : ok([]),
  );
  mockRuntime(client);
  const { consumeSubjectApiRateLimit } = await import("../src/lib/api-rate-limit");

  const result = await consumeSubjectApiRateLimit({
    supabase: client as never,
    subject: { kind: "anonymous", subjectKey: "anon:test-key" },
    bucket: "answer",
  });

  expect(result.limited).toBe(true);
  expect(client.rpc).toHaveBeenCalledWith(
    "consume_api_subject_rate_limit",
    expect.objectContaining({ p_subject_key: "anon:test-key", p_bucket: "answer" }),
  );
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm run test -- tests/private-access-routes.test.ts -t "anonymous answer requests by anonymous subject key"
```

Expected: FAIL because `consumeSubjectApiRateLimit` does not exist.

- [ ] **Step 3: Add SQL migration for anonymous subjects**

Create `supabase/migrations/YYYYMMDDHHMMSS_public_api_rate_limit_subjects.sql` with a timestamp later than existing migrations:

```sql
set search_path = public, extensions, pg_temp;

create table if not exists public.api_rate_limit_subjects (
  subject_key text not null,
  bucket text not null,
  window_start timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject_key, bucket),
  constraint api_rate_limit_subjects_subject_key_nonempty check (btrim(subject_key) <> ''),
  constraint api_rate_limit_subjects_bucket_nonempty check (btrim(bucket) <> '')
);

create index if not exists api_rate_limit_subjects_bucket_updated_idx
  on public.api_rate_limit_subjects(bucket, updated_at desc);

create or replace function public.consume_api_subject_rate_limit(
  p_subject_key text,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  limited boolean,
  limit_value integer,
  remaining integer,
  retry_after_seconds integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_window_start timestamptz := v_now;
  v_count integer;
  v_reset_at timestamptz;
begin
  if p_subject_key is null or btrim(p_subject_key) = '' then
    raise exception 'subject_key is required';
  end if;
  if p_bucket is null or btrim(p_bucket) = '' then
    raise exception 'bucket is required';
  end if;
  if p_limit < 1 then
    raise exception 'limit must be positive';
  end if;
  if p_window_seconds < 1 then
    raise exception 'window must be positive';
  end if;

  loop
    update public.api_rate_limit_subjects
    set
      window_start = case
        when window_start + make_interval(secs => p_window_seconds) <= v_now then v_window_start
        else window_start
      end,
      request_count = case
        when window_start + make_interval(secs => p_window_seconds) <= v_now then 1
        else request_count + 1
      end,
      updated_at = v_now
    where subject_key = p_subject_key
      and bucket = p_bucket
    returning request_count, window_start + make_interval(secs => p_window_seconds)
      into v_count, v_reset_at;

    exit when found;

    begin
      insert into public.api_rate_limit_subjects(subject_key, bucket, window_start, request_count, updated_at)
      values (p_subject_key, p_bucket, v_window_start, 1, v_now)
      returning request_count, window_start + make_interval(secs => p_window_seconds)
        into v_count, v_reset_at;
      exit;
    exception when unique_violation then
    end;
  end loop;

  return query
  select
    v_count > p_limit as limited,
    p_limit as limit_value,
    greatest(p_limit - v_count, 0) as remaining,
    greatest(1, ceiling(extract(epoch from (v_reset_at - v_now)))::integer) as retry_after_seconds,
    v_reset_at as reset_at;
end;
$$;

revoke all privileges on table public.api_rate_limit_subjects from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limit_subjects to service_role;

revoke execute on function public.consume_api_subject_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_subject_rate_limit(text, text, integer, integer) to service_role;

alter table public.api_rate_limit_subjects enable row level security;

drop policy if exists "api rate limit subjects service role all" on public.api_rate_limit_subjects;
create policy "api rate limit subjects service role all" on public.api_rate_limit_subjects
  for all to service_role
  using (true)
  with check (true);
```

- [ ] **Step 4: Mirror SQL in `supabase/schema.sql`**

Add the table, index, function, grants, RLS enable, and service-role policy to `supabase/schema.sql` near the existing `api_rate_limits` definitions.

- [ ] **Step 5: Implement subject limiter**

In `src/lib/api-rate-limit.ts`, import the type:

```ts
import type { RateLimitSubject } from "@/lib/public-api-access";
```

Add below `consumeApiRateLimit`:

```ts
export async function consumeSubjectApiRateLimit(args: {
  supabase: SupabaseAdmin;
  subject: RateLimitSubject;
  bucket: ApiRateLimitBucket;
  limit?: number;
  windowSeconds?: number;
  allowInMemoryFallbackOnUnavailable?: boolean;
}): Promise<ApiRateLimitResult> {
  if (args.subject.kind === "owner") {
    return consumeApiRateLimit({
      supabase: args.supabase,
      ownerId: args.subject.ownerId,
      bucket: args.bucket,
      limit: args.limit,
      windowSeconds: args.windowSeconds,
      allowInMemoryFallbackOnUnavailable: args.allowInMemoryFallbackOnUnavailable,
    });
  }

  const defaults = apiRateLimitDefaults[args.bucket];
  const limit = args.limit ?? defaults.limit;
  const windowSeconds = args.windowSeconds ?? defaults.windowSeconds;
  const { data, error } = await args.supabase.rpc("consume_api_subject_rate_limit", {
    p_subject_key: args.subject.subjectKey,
    p_bucket: args.bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    if (args.allowInMemoryFallbackOnUnavailable) {
      console.warn("Durable anonymous API rate limit check unavailable; using local in-memory fallback.", {
        bucket: args.bucket,
        code: error.code,
        message: error.message,
      });
      return consumeInMemoryApiRateLimit({ ownerId: args.subject.subjectKey, bucket: args.bucket, limit, windowSeconds });
    }
    throw new ApiRateLimitUnavailableError();
  }

  const row = parseRateLimitRow(data);
  if (!row || typeof row.limited !== "boolean") {
    if (args.allowInMemoryFallbackOnUnavailable) {
      return consumeInMemoryApiRateLimit({ ownerId: args.subject.subjectKey, bucket: args.bucket, limit, windowSeconds });
    }
    throw new ApiRateLimitUnavailableError();
  }

  return {
    limited: row.limited,
    limit: Number(row.limit_value ?? limit),
    remaining: Number(row.remaining ?? 0),
    retryAfterSeconds: Math.max(1, Number(row.retry_after_seconds ?? windowSeconds)),
    resetAt: String(row.reset_at ?? new Date(Date.now() + windowSeconds * 1000).toISOString()),
  };
}
```

- [ ] **Step 6: Run focused limiter test**

Run:

```powershell
npm run test -- tests/private-access-routes.test.ts -t "anonymous answer requests by anonymous subject key"
```

Expected: PASS.

---

### Task 3: Make Search and Answer Public While Rate Limited

**Files:**
- Modify: `src/app/api/search/route.ts:882-909`
- Modify: `src/app/api/answer/route.ts:64-108`
- Modify: `src/app/api/answer/stream/route.ts:220-236`
- Test: `tests/private-access-routes.test.ts:2688-2804`

**Interfaces:**
- Consumes: `publicAccessContext`, `consumeSubjectApiRateLimit`.
- Produces: anonymous `/api/search`, `/api/answer`, and `/api/answer/stream` success instead of 401.

- [ ] **Step 1: Replace the old failing 401 test with anonymous live-search expectations**

Replace `it("rejects unauthenticated search and answer requests"...)` in `tests/private-access-routes.test.ts:2688` with:

```ts
it("allows anonymous search and answer requests with anonymous rate limits", async () => {
  const searchChunksWithTelemetry = vi.fn(async () => ({
    results: [],
    telemetry: {
      search_cache_hit: false,
      text_fast_path_latency_ms: 0,
      embedding_skipped: true,
      embedding_latency_ms: 0,
      embedding_cache_hit: false,
      supabase_rpc_latency_ms: 0,
      rerank_latency_ms: 0,
      retrieval_strategy: "text_fast_path",
    },
  }));
  const answerQuestionWithScope = vi.fn(async () => ({
    answer: "No evidence found.",
    grounded: false,
    confidence: "unsupported",
    citations: [],
    sources: [],
  }));
  const client = createSupabaseMock();
  client.rpc.mockImplementation(async (name: string) =>
    name === "consume_api_subject_rate_limit" || name === "match_documents_hybrid"
      ? { data: name === "consume_api_subject_rate_limit" ? [rateLimitRow()] : [], error: null }
      : ok([]),
  );
  mockRuntime(client, { searchChunksWithTelemetry, answerQuestionWithScope });

  const searchRoute = await import("../src/app/api/search/route");
  const answerRoute = await import("../src/app/api/answer/route");

  const anonymousHeaders = {
    "x-forwarded-for": "203.0.113.20",
    "user-agent": "Vitest Browser",
  };
  const searchResponse = await searchRoute.POST(
    request("/api/search", {
      method: "POST",
      headers: anonymousHeaders,
      body: JSON.stringify({ query: "monitoring", documentIds: [otherDocumentId] }),
    }),
  );
  const answerResponse = await answerRoute.POST(
    request("/api/answer", {
      method: "POST",
      headers: anonymousHeaders,
      body: JSON.stringify({ query: "monitoring", documentId: otherDocumentId }),
    }),
  );

  expect(searchResponse.status).toBe(200);
  expect(answerResponse.status).toBe(200);
  expect(searchChunksWithTelemetry).toHaveBeenCalledWith(expect.objectContaining({ ownerId: undefined }));
  expect(answerQuestionWithScope).toHaveBeenCalledWith(expect.objectContaining({ ownerId: undefined, allowGlobalSearch: true }));
  expect(client.auth.getUser).not.toHaveBeenCalled();
  expect(client.rpc).toHaveBeenCalledWith(
    "consume_api_subject_rate_limit",
    expect.objectContaining({ p_subject_key: expect.stringMatching(/^anon:/), p_bucket: "search" }),
  );
  expect(client.rpc).toHaveBeenCalledWith(
    "consume_api_subject_rate_limit",
    expect.objectContaining({ p_subject_key: expect.stringMatching(/^anon:/), p_bucket: "answer" }),
  );
});
```

- [ ] **Step 2: Add a stream route anonymous test**

Add below the anonymous search/answer test:

```ts
it("allows anonymous streamed answers with anonymous rate limits", async () => {
  const answerQuestionWithScope = vi.fn(async () => ({
    answer: "Streamed public answer.",
    grounded: false,
    confidence: "unsupported",
    citations: [],
    sources: [],
  }));
  const client = createSupabaseMock();
  client.rpc.mockImplementation(async (name: string) =>
    name === "consume_api_subject_rate_limit" ? { data: [rateLimitRow()], error: null } : ok([]),
  );
  mockRuntime(client, { answerQuestionWithScope });
  const answerStreamRoute = await import("../src/app/api/answer/stream/route");

  const response = await answerStreamRoute.POST(
    request("/api/answer/stream", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.21", "user-agent": "Vitest Browser" },
      body: JSON.stringify({ query: "monitoring" }),
    }),
  );
  const body = await response.text();

  expect(response.status).toBe(200);
  expect(ssePayload(body, "final")).toMatchObject({ answer: "Streamed public answer." });
  expect(answerQuestionWithScope).toHaveBeenCalledWith(expect.objectContaining({ ownerId: undefined, allowGlobalSearch: true }));
  expect(client.rpc).toHaveBeenCalledWith(
    "consume_api_subject_rate_limit",
    expect.objectContaining({ p_subject_key: expect.stringMatching(/^anon:/), p_bucket: "answer" }),
  );
});
```

- [ ] **Step 3: Run the focused tests and verify they fail**

Run:

```powershell
npm run test -- tests/private-access-routes.test.ts -t "anonymous search and answer|anonymous streamed answers"
```

Expected: FAIL with old 401 behavior.

- [ ] **Step 4: Update `/api/search`**

In `src/app/api/search/route.ts`, replace the authenticated-only block at `882-897` with:

```ts
supabase = createAdminClient();
const access = await publicAccessContext(request, supabase);
ownerId = access.ownerId;

const rateLimit = await consumeSubjectApiRateLimit({
  supabase,
  subject: access.rateLimitSubject,
  bucket: "search",
  allowInMemoryFallbackOnUnavailable: isLocalNoAuthMode(),
});
if (rateLimit.limited) {
  return rateLimitJsonResponse(
    "Search is temporarily rate limited because too many requests were received. Retry shortly.",
    rateLimit,
  );
}
```

Add imports:

```ts
import { publicAccessContext } from "@/lib/public-api-access";
import { consumeSubjectApiRateLimit, rateLimitJsonResponse } from "@/lib/api-rate-limit";
```

Remove `serverAuth.requireAuthenticatedUser` use from this route but keep `AuthenticationError` catch only if optional auth can throw for invalid tokens.

- [ ] **Step 5: Update `/api/answer`**

In `src/app/api/answer/route.ts`, replace `requireAuthenticatedUser` and owner-only rate limit with:

```ts
const supabase = createAdminClient();
const access = await publicAccessContext(request, supabase);

const rateLimit = await consumeSubjectApiRateLimit({
  supabase,
  subject: access.rateLimitSubject,
  bucket: "answer",
  allowInMemoryFallbackOnUnavailable: isLocalNoAuthMode(),
});
if (rateLimit.limited) {
  return rateLimitJsonResponse("Too many answer requests. Retry shortly.", rateLimit);
}

const scope = await resolveSearchScope({
  supabase,
  ownerId: access.ownerId,
  documentIds: body.documentIds ?? (body.documentId ? [body.documentId] : undefined),
  filters: body.filters,
});
```

Then call answer generation with:

```ts
const answer = await answerQuestionWithScope({
  query: body.query,
  documentId: singleDocumentScope ? body.documentId : undefined,
  documentIds: singleDocumentScope
    ? undefined
    : (scope.documentIds ?? body.documentIds ?? (body.documentId ? [body.documentId] : undefined)),
  ownerId: access.ownerId,
  allowGlobalSearch: !access.ownerId,
  queryMode: body.queryMode,
  skipCache: body.skipCache,
  signal: request.signal,
});
```

- [ ] **Step 6: Update `/api/answer/stream`**

In `src/app/api/answer/stream/route.ts`, replace `requireAuthenticatedUser` and owner-only rate limit with the same `publicAccessContext` and `consumeSubjectApiRateLimit` pattern. Return:

```ts
return streamAnswer(body, access.ownerId, request.signal);
```

Inside `streamAnswer`, keep the existing `allowGlobalSearch: !ownerId` behavior.

- [ ] **Step 7: Run focused tests**

Run:

```powershell
npm run test -- tests/private-access-routes.test.ts -t "anonymous search and answer|anonymous streamed answers|rate limits authenticated answer"
```

Expected: PASS.

---

### Task 4: Allow Anonymous Document Listing and Source Preview for Live Search Results

**Files:**
- Modify: `src/app/api/documents/route.ts:118-203`
- Modify after inspection: `src/app/api/documents/[id]/route.ts`
- Modify after inspection: `src/app/api/documents/[id]/search/route.ts`
- Modify after inspection: `src/app/api/documents/[id]/signed-url/route.ts`
- Modify after inspection: `src/app/api/images/[id]/signed-url/route.ts`
- Test: `tests/private-access-routes.test.ts`

**Interfaces:**
- Consumes: `publicAccessContext`.
- Produces: anonymous document browsing/source previews; authenticated users remain owner-scoped.

- [ ] **Step 1: Write failing anonymous document list test**

Add near document listing tests:

```ts
it("lists documents anonymously for public browsing without an auth session", async () => {
  const documents = [{ id: documentId, owner_id: userId, title: "Public guideline", status: "indexed" }];
  const client = createSupabaseMock((call) => (call.table === "documents" ? ok(documents) : ok([])));
  mockRuntime(client);
  const { GET } = await import("../src/app/api/documents/route");

  const response = await GET(request("/api/documents?includeMeta=false"));
  const body = await payload(response);

  expect(response.status).toBe(200);
  expect(body.documents).toEqual(documents);
  expect(client.auth.getUser).not.toHaveBeenCalled();
  expect(client.calls[0].filters).not.toContainEqual({ column: "owner_id", value: userId });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm run test -- tests/private-access-routes.test.ts -t "lists documents anonymously"
```

Expected: FAIL with 401.

- [ ] **Step 3: Implement anonymous document list**

In `src/app/api/documents/route.ts`, replace:

```ts
const user = await requireAuthenticatedUser(request, supabase);
let query = supabase
  .from("documents")
  .select(DOCUMENT_LIST_COLUMNS, { count: "exact" })
  .eq("owner_id", user.id)
```

with:

```ts
const access = await publicAccessContext(request, supabase);
let query = supabase
  .from("documents")
  .select(DOCUMENT_LIST_COLUMNS, { count: "exact" });
if (access.ownerId) query = query.eq("owner_id", access.ownerId);
query = query
```

then keep the existing `.order(...).range(...)` chain after `query = query`.

- [ ] **Step 4: Update source-preview routes using the same pattern**

For each route that currently calls `requireAuthenticatedUser` and then filters by `owner_id`, change to:

```ts
const access = await publicAccessContext(request, supabase);
let documentQuery = supabase.from("documents").select("...").eq("id", id);
if (access.ownerId) documentQuery = documentQuery.eq("owner_id", access.ownerId);
```

Apply this to GET/search/signed-url preview routes only. Do not apply it to delete, label mutation, reindex, or bulk mutation routes in this task.

- [ ] **Step 5: Add route-specific tests for one source preview and one signed URL**

Add tests for anonymous success on `documents/[id]` and signed URL routes. Expected assertions:

```ts
expect(response.status).toBe(200);
expect(client.auth.getUser).not.toHaveBeenCalled();
expect(documentSelect?.filters).toContainEqual({ column: "id", value: documentId });
expect(documentSelect?.filters).not.toContainEqual({ column: "owner_id", value: userId });
```

- [ ] **Step 6: Run focused document tests**

Run:

```powershell
npm run test -- tests/private-access-routes.test.ts -t "documents anonymously|source preview|signed URL"
```

Expected: PASS.

---

### Task 5: Decide and Implement Anonymous Upload Behavior

**Files:**
- Modify: `src/app/api/upload/route.ts:24-238`
- Modify: `src/components/clinical-dashboard/DocumentManagerPanel.tsx`
- Test: `tests/private-access-routes.test.ts`, `tests/api-validation-contract.test.ts`

**Interfaces:**
- Consumes: `publicWorkspaceOwnerId()`, `publicUploadsEnabled()`, `publicAccessContext`.
- Produces: either public upload to shared owner when configured, or no login prompt when not configured.

- [ ] **Step 1: Write tests for the chosen upload contract**

Use this contract: anonymous upload is allowed only when `NEXT_PUBLIC_PUBLIC_UPLOADS_ENABLED="true"` and `PUBLIC_WORKSPACE_OWNER_ID` is configured. Otherwise the app shows setup-required copy, not sign-in-required copy.

Add tests:

```ts
it("rejects anonymous upload with setup guidance when public uploads are not configured", async () => {
  const client = createSupabaseMock();
  mockRuntime(client);
  const { POST } = await import("../src/app/api/upload/route");
  const formData = new FormData();
  formData.set("file", new File(["hello"], "guideline.txt", { type: "text/plain" }));

  const response = await POST(request("/api/upload", { method: "POST", body: formData }));

  expect(response.status).toBe(503);
  expect(await payload(response)).toEqual({ error: "Public uploads are not configured for this workspace." });
  expect(client.auth.getUser).not.toHaveBeenCalled();
});

it("uploads anonymous documents to the configured public workspace owner", async () => {
  const publicOwnerId = "99999999-9999-4999-8999-999999999999";
  const client = createSupabaseMock((call) => {
    if (call.table === "documents" && call.operation === "select" && call.maybeSingle) return ok(null);
    if (call.table === "documents" && call.operation === "insert") return ok({ id: documentId, owner_id: publicOwnerId });
    if (call.table === "ingestion_jobs" && call.operation === "insert") return ok({ id: "job-1" });
    if (call.table === "audit_log" && call.operation === "insert") return ok([]);
    return ok([]);
  });
  mockRuntime(client, undefined, { publicUploadsEnabled: true, publicWorkspaceOwnerId: publicOwnerId });
  const { POST } = await import("../src/app/api/upload/route");
  const formData = new FormData();
  formData.set("file", new File(["hello"], "guideline.txt", { type: "text/plain" }));

  const response = await POST(request("/api/upload", { method: "POST", body: formData }));

  expect(response.status).toBe(200);
  expect(client.auth.getUser).not.toHaveBeenCalled();
  expect(client.calls.find((call) => call.table === "documents" && call.operation === "insert")?.insertPayload).toMatchObject({
    owner_id: publicOwnerId,
  });
});
```

- [ ] **Step 2: Run upload tests and verify they fail**

Run:

```powershell
npm run test -- tests/private-access-routes.test.ts -t "anonymous upload|Public uploads"
```

Expected: FAIL with old auth requirement.

- [ ] **Step 3: Implement owner resolution in upload route**

In `src/app/api/upload/route.ts`, replace the required auth block with:

```ts
const access = await publicAccessContext(request, adminSupabase);
const publicOwnerId = publicWorkspaceOwnerId();
const uploadOwnerId = access.ownerId ?? (publicUploadsEnabled() ? publicOwnerId : null);
if (!uploadOwnerId) {
  return NextResponse.json({ error: "Public uploads are not configured for this workspace." }, { status: 503 });
}
```

Then replace every `user.id` in upload ownership/storage/audit/naming code with `uploadOwnerId`.

- [ ] **Step 4: Update upload UI copy**

In `DocumentManagerPanel.tsx`, replace copy like:

```ts
"Sign in before uploading private guideline files."
```

with:

```ts
"Uploads are unavailable until this public workspace is configured."
```

- [ ] **Step 5: Run upload tests**

Run:

```powershell
npm run test -- tests/private-access-routes.test.ts -t "anonymous upload|Public uploads"
```

Expected: PASS.

---

### Task 6: Remove Forced Login UI and Fix “Search request was not authorized” UX

**Files:**
- Modify: `src/components/ClinicalDashboard.tsx:3652-3664`, `src/components/ClinicalDashboard.tsx:5341-5893`
- Modify: `src/components/clinical-dashboard/auth-panel.tsx`
- Modify: `src/components/clinical-dashboard/document-search-results.tsx`
- Modify: `src/components/DocumentViewer.tsx:1928-2256`
- Test: `tests/ui-smoke.spec.ts` or focused component route tests if present

**Interfaces:**
- Consumes: public API behavior from Tasks 3-5.
- Produces: no forced sign-in panel; search controls enabled when backend setup is ready; no 401 authorization banner for anonymous users.

- [ ] **Step 1: Write or update a UI smoke test**

Add/update Playwright assertion in `tests/ui-smoke.spec.ts`:

```ts
test("anonymous user can see enabled live search without sign-in gate", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Sign in for private documents")).toHaveCount(0);
  await expect(page.getByText("Search request was not authorized by the server.")).toHaveCount(0);
  await expect(page.getByTestId("global-search-input")).toBeEnabled();
});
```

- [ ] **Step 2: Run the UI test and verify it fails or exposes current issue**

Run:

```powershell
npm run ensure
npm run test:e2e:chromium -- tests/ui-smoke.spec.ts -g "anonymous user can see enabled live search"
```

Expected: FAIL if the sign-in gate or disabled search is still present.

- [ ] **Step 3: Update dashboard readiness logic**

In `src/components/ClinicalDashboard.tsx`, change:

```ts
const canUsePrivateApis =
  localProjectReady && (localNoAuthMode || localDevCanAttemptPrivateApis || authStatus === "authenticated");
const canRunSearch = explicitDemoMode || (hasReadyPublicSearchSetup(setupChecks) && canUsePrivateApis);
```

to:

```ts
const publicApiReady = localProjectReady && hasReadyPublicSearchSetup(setupChecks);
const canUsePrivateApis = publicApiReady;
const canRunSearch = explicitDemoMode || publicApiReady;
```

Keep `authStatus === "authenticated"` only for optional account-specific UI, not for search availability.

- [ ] **Step 4: Hide the forced auth panel**

Change:

```ts
const showAuthPanel = !clientDemoMode && !canUsePrivateApis;
```

or its equivalent to:

```ts
const showAuthPanel = false;
```

If an optional account panel should remain in settings, render `AuthPanel` only inside settings/account surfaces, not in the main dashboard flow.

- [ ] **Step 5: Replace user-facing authUnavailable copy**

Search for strings:

```text
Sign in
not authorized
Authentication required
Sign in or enable local no-auth mode
```

Replace public-flow copy with:

```text
The public workspace is not ready yet. Check setup status and try again.
```

For actual 429 errors, show:

```text
Too many requests. Please wait and retry shortly.
```

- [ ] **Step 6: Update DocumentViewer public readiness**

In `src/components/DocumentViewer.tsx`, change public source preview readiness from auth-dependent to setup-dependent. Replace logic equivalent to:

```ts
const canUsePrivateApis = localProjectReady && (clientDemoMode || authStatus === "authenticated");
```

with:

```ts
const canUsePrivateApis = localProjectReady && (clientDemoMode || setupReadyForPublicApis);
```

Use the same existing setup signal used by the dashboard if available; if not available, derive it from successful setup-status/document fetch state in that component.

- [ ] **Step 7: Run UI smoke test**

Run:

```powershell
npm run ensure
npm run test:e2e:chromium -- tests/ui-smoke.spec.ts -g "anonymous user can see enabled live search"
```

Expected: PASS.

---

### Task 7: Verify Authenticated Behavior Still Works and Destructive Routes Stay Protected

**Files:**
- Modify tests only unless failures reveal route regressions:
  - `tests/private-access-routes.test.ts`
  - `tests/api-validation-contract.test.ts`

**Interfaces:**
- Consumes: public access route changes.
- Produces: confidence that anonymous access did not expose destructive actions.

- [ ] **Step 1: Add protected mutation regression tests**

Add tests proving anonymous delete/reindex/label mutation still fails:

```ts
it("keeps destructive document mutations protected from anonymous callers", async () => {
  const client = createSupabaseMock();
  mockRuntime(client);
  const documentRoute = await import("../src/app/api/documents/[id]/route");
  const reindexRoute = await import("../src/app/api/documents/[id]/reindex/route");

  const deleteResponse = await documentRoute.DELETE(request(`/api/documents/${documentId}`, { method: "DELETE" }), {
    params: Promise.resolve({ id: documentId }),
  });
  const reindexResponse = await reindexRoute.POST(request(`/api/documents/${documentId}/reindex`, { method: "POST" }), {
    params: Promise.resolve({ id: documentId }),
  });

  expect(deleteResponse.status).toBe(401);
  expect(reindexResponse.status).toBe(401);
  expect(client.calls.some((call) => call.operation === "delete" || call.operation === "update")).toBe(false);
});
```

- [ ] **Step 2: Run protected mutation tests**

Run:

```powershell
npm run test -- tests/private-access-routes.test.ts -t "destructive document mutations"
```

Expected: PASS.

- [ ] **Step 3: Run broader private/public route tests**

Run:

```powershell
npm run test -- tests/private-access-routes.test.ts
npm run test -- tests/api-validation-contract.test.ts
```

Expected: PASS.

---

### Task 8: Full Verification and Production Readiness Checks

**Files:**
- No source changes unless verification fails.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: verified anonymous live-search behavior.

- [ ] **Step 1: Run cheap verification**

Run:

```powershell
npm run verify:cheap
```

Expected: PASS.

- [ ] **Step 2: Run UI verification because this changes frontend/auth UX**

Run:

```powershell
npm run ensure
npm run verify:ui
```

Expected: PASS. If browser setup is unavailable, record the exact failure and run the focused Playwright smoke test from Task 6 instead.

- [ ] **Step 3: Run production readiness because this changes auth/public access**

Run:

```powershell
npm run check:production-readiness
```

Expected: PASS or known environment-only warnings. Fix any new failures caused by public access env checks.

- [ ] **Step 4: Manual smoke path**

Use the URL printed by `npm run ensure` and verify:

```text
1. Open the app in a fresh/incognito browser.
2. Confirm no "Sign in for private documents" panel appears.
3. Type a clinical query into the composer.
4. Submit the query.
5. Confirm no "Search request was not authorized by the server" message appears.
6. Confirm search/answer either returns live source-backed content or a non-auth setup/rate-limit message.
7. Open a source preview from results.
8. Confirm source preview does not ask for login.
9. Repeat rapid submissions until a 429 appears.
10. Confirm 429 copy tells the user to retry shortly, not sign in.
```

Expected: anonymous users can run live searches; excessive use is rate-limited.

---

## Self-Review

**Spec coverage:**
- Forced login removal: Task 6.
- “Search request was not authorized” fix: Tasks 3 and 6.
- Live anonymous search: Task 3.
- Source preview without login: Task 4.
- Abuse control without captcha: Task 2 plus Task 3 route use.
- Upload behavior without login: Task 5, with shared public owner guard.
- Destructive action safety: Task 7.
- Verification: Task 8.

**Placeholder scan:** No TODO/TBD placeholders remain. The SQL migration filename needs a real timestamp at execution time because migration names must be unique in the executing branch.

**Type consistency:** `RateLimitSubject`, `publicAccessContext`, and `consumeSubjectApiRateLimit` signatures are used consistently across tasks.

**Non-commit note:** This plan intentionally excludes commit steps because the user has not requested a commit.
