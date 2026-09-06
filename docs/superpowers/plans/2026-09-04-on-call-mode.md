# On Call Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a seventeenth app mode, `on-call`, giving a junior doctor one owner-scoped place for orientation manuals, role-based contacts, referral pathways, teaching, an escalation playbook, and site logistics.

**Architecture:** One owner-scoped Postgres table (`on_call_entries`) holds every section's entries, discriminated by a `section` column with a per-section Zod schema over a `details` JSON column. Service-role API routes enforce owner scope in application code, matching `clinical_registry_records`. The client fetches the owner's whole entry set once, filters and searches it locally, and caches it in browser storage so Contacts survives loss of signal. Six section pages plus a search page and a printable card render through the repository's existing shells — `InformationPageShell`, `InPageNavHeader`, `SearchResultsHeaderBand` — introducing no new design tokens.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6 strict, Zod 4, Supabase Postgres, Tailwind 4 with `@theme` tokens, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-04-on-call-mode-design.md` — read it before Task 1. The plan argues from it and does not repeat its reasoning.

## Global Constraints

Copied verbatim from the spec and the repository rules. Every task's requirements implicitly include this section.

- **No app-authored clinical content anywhere in this mode.** Clinical guidance appears only as a link to a document in the owner's corpus, rendered with that document's title and date.
- **`owner_id` is `not null`** on the new table. This table has no public state. The owner is always taken from the validated session, never from a request body or query string.
- **The owner predicate rides the same fluent chain as `.from()`** — `supabase.from("on_call_entries").select(...).eq("owner_id", ownerId)` — or `npm run check:owner-scope` cannot prove it.
- **Staleness interval is 12 months**, exported as `ON_CALL_REVIEW_INTERVAL_MONTHS = 12`. Staleness is derived at read time and never stored.
- **Signed out in production shows no entry content**, only a sign-in action. Synthetic fixtures appear only in demo mode.
- **Tap targets are `min-h-12` / `min-h-tap` (48px). Never `min-h-11`.**
- **No raw hex, no `shadow-sm|md|lg`, no arbitrary `text-[…px]`, no `z-[N]` outside the ladder, no `duration-200`, no `dark:` colour overrides.** Tokens only.
- **Status is never signalled by colour alone**, and a number is never painted in a status colour.
- **`aria-live` only on an `sr-only` node.** A visible banner is not itself a live region.
- **Every `<button type="button">` has an `onClick`, a `disabled`, or an `aria-disabled`** — never `disabled` and `aria-disabled` together.
- **Internal navigation via `<Link>` / `router.push` / server `redirect()`.** Never a raw `<a href="/…">`.
- **The PR body must carry:** `RAG impact: no retrieval behaviour change — new owner-scoped operational content mode with local-only search; no change to retrieval, ranking, the RPCs, or the eval fixtures.`
- **The migration merges only inside an approved window**, with auto-merge never armed on it, and the PR must not claim any deferred deploy.
- **Run `npm run format` and commit the result before every push.**

---

### Task 1: The domain model — sections, per-section detail schemas, and staleness

Pure TypeScript with no I/O, so it is fully testable offline and every later task depends on its names.

**Files:**

- Create: `src/lib/on-call/entry-model.ts`
- Create: `tests/on-call-entry-model.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces: `ON_CALL_SECTIONS`, `OnCallSection`, `OnCallEntry`, `onCallEntrySchema`, `onCallDetailsSchemaFor(section)`, `ON_CALL_REVIEW_INTERVAL_MONTHS`, `onCallEntryFreshness(entry, now)`, `OnCallFreshness`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  ON_CALL_REVIEW_INTERVAL_MONTHS,
  onCallDetailsSchemaFor,
  onCallEntryFreshness,
} from "@/lib/on-call/entry-model";

const NOW = new Date("2026-09-04T00:00:00.000Z");

describe("onCallEntryFreshness", () => {
  it("is stale when the entry has never been verified", () => {
    expect(onCallEntryFreshness({ lastVerifiedAt: null }, NOW)).toEqual({
      state: "stale",
      reason: "never-verified",
      lastVerifiedAt: null,
    });
  });

  it("is fresh one day inside the interval", () => {
    const justInside = new Date("2025-09-05T00:00:00.000Z").toISOString();
    expect(onCallEntryFreshness({ lastVerifiedAt: justInside }, NOW).state).toBe("fresh");
  });

  it("is stale exactly on the twelve-month boundary", () => {
    const onBoundary = new Date("2025-09-04T00:00:00.000Z").toISOString();
    expect(onCallEntryFreshness({ lastVerifiedAt: onBoundary }, NOW)).toEqual({
      state: "stale",
      reason: "overdue",
      lastVerifiedAt: onBoundary,
    });
  });

  it("uses a twelve-month interval", () => {
    expect(ON_CALL_REVIEW_INTERVAL_MONTHS).toBe(12);
  });
});

describe("onCallDetailsSchemaFor", () => {
  it("accepts a contact carrying only a role", () => {
    const parsed = onCallDetailsSchemaFor("contacts").safeParse({ role: "After-hours registrar" });
    expect(parsed.success).toBe(true);
  });

  it("rejects a contact with no role", () => {
    expect(onCallDetailsSchemaFor("contacts").safeParse({ phone: "9999 9999" }).success).toBe(false);
  });

  it("rejects unknown keys, so a typo cannot be silently stored", () => {
    const parsed = onCallDetailsSchemaFor("contacts").safeParse({
      role: "Ward 4B",
      phne: "9999 9999",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires an ordered escalation step to name who to call and when", () => {
    const parsed = onCallDetailsSchemaFor("playbook").safeParse({
      trigger: "Acute behavioural disturbance",
      escalationSteps: [{ order: 1, whoToCall: "In-house registrar", when: "Immediately" }],
    });
    expect(parsed.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run test:focused -- --files tests/on-call-entry-model.test.ts`
Expected: FAIL — cannot resolve `@/lib/on-call/entry-model`.

- [ ] **Step 3: Write the implementation**

```ts
import { z } from "zod";

export const ON_CALL_SECTIONS = ["contacts", "playbook", "referrals", "orientation", "education", "logistics"] as const;

export type OnCallSection = (typeof ON_CALL_SECTIONS)[number];

/** Twelve months. Derived at read time, never stored, so changing this number
 *  never needs a migration or a backfill. */
export const ON_CALL_REVIEW_INTERVAL_MONTHS = 12;

export type OnCallFreshness =
  | { state: "fresh"; lastVerifiedAt: string }
  | { state: "stale"; reason: "never-verified"; lastVerifiedAt: null }
  | { state: "stale"; reason: "overdue"; lastVerifiedAt: string };

export function onCallEntryFreshness(
  entry: { lastVerifiedAt: string | null },
  now: Date = new Date(),
): OnCallFreshness {
  if (!entry.lastVerifiedAt) return { state: "stale", reason: "never-verified", lastVerifiedAt: null };
  const due = new Date(entry.lastVerifiedAt);
  due.setUTCMonth(due.getUTCMonth() + ON_CALL_REVIEW_INTERVAL_MONTHS);
  // On the boundary counts as overdue: a year-old number is not "still fine today".
  if (due.getTime() <= now.getTime()) {
    return { state: "stale", reason: "overdue", lastVerifiedAt: entry.lastVerifiedAt };
  }
  return { state: "fresh", lastVerifiedAt: entry.lastVerifiedAt };
}

const trimmed = z.string().trim().min(1);

const contactsDetails = z
  .object({
    role: trimmed,
    phone: trimmed.optional(),
    extension: trimmed.optional(),
    afterHoursPhone: trimmed.optional(),
    pager: trimmed.optional(),
    contactName: trimmed.optional(),
    availability: trimmed.optional(),
  })
  .strict();

const playbookDetails = z
  .object({
    trigger: trimmed,
    escalationSteps: z
      .array(
        z
          .object({
            order: z.number().int().min(1),
            whoToCall: trimmed,
            when: trimmed,
            phone: trimmed.optional(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

const referralsDetails = z
  .object({
    accepts: z.array(trimmed).default([]),
    exclusions: z.array(trimmed).default([]),
    catchment: trimmed.optional(),
    hours: trimmed.optional(),
    howToRefer: trimmed.optional(),
    phone: trimmed.optional(),
    fax: trimmed.optional(),
    referralFormUrl: z.string().url().optional(),
  })
  .strict();

const orientationDetails = z.object({ pinnedSummaryIsOwnerNote: z.literal(true) }).strict();

const educationDetails = z
  .object({
    recurrence: trimmed.optional(),
    nextOccurrence: trimmed.optional(),
    presenter: trimmed.optional(),
    location: trimmed.optional(),
    recordingUrl: z.string().url().optional(),
    topics: z.array(trimmed).default([]),
  })
  .strict();

const logisticsDetails = z
  .object({
    category: trimmed,
    location: trimmed.optional(),
    hours: trimmed.optional(),
    phone: trimmed.optional(),
    url: z.string().url().optional(),
  })
  .strict();

const detailsSchemas = {
  contacts: contactsDetails,
  playbook: playbookDetails,
  referrals: referralsDetails,
  orientation: orientationDetails,
  education: educationDetails,
  logistics: logisticsDetails,
} as const satisfies Record<OnCallSection, z.ZodTypeAny>;

export function onCallDetailsSchemaFor(section: OnCallSection) {
  return detailsSchemas[section];
}

export const onCallEntrySchema = z
  .object({
    id: z.string().uuid(),
    section: z.enum(ON_CALL_SECTIONS),
    slug: trimmed,
    title: trimmed,
    subtitle: trimmed.nullable().default(null),
    body: z.string().nullable().default(null),
    details: z.unknown(),
    linkedDocumentIds: z.array(z.string().uuid()).default([]),
    tags: z.array(trimmed).default([]),
    isPersonal: z.boolean().default(false),
    includeOnCard: z.boolean().default(false),
    sortOrder: z.number().int().default(0),
    lastVerifiedAt: z.string().nullable().default(null),
  })
  .strict();

export type OnCallEntry = z.infer<typeof onCallEntrySchema>;
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm run test:focused -- --files tests/on-call-entry-model.test.ts`
Expected: PASS, all seven assertions.

- [ ] **Step 5: Commit**

```bash
git add src/lib/on-call/entry-model.ts tests/on-call-entry-model.test.ts
git commit -m "feat(on-call): add the entry model, per-section schemas and twelve-month staleness"
```

---

### Task 2: The migration and the schema mirror

**Files:**

- Create: `supabase/migrations/20260904120000_on_call_entries.sql`
- Modify: `supabase/schema.sql` (append the table, indexes, trigger, RLS and grants to mirror the migration)
- Create: `tests/on-call-migration-contract.test.ts`

**Interfaces:**

- Consumes: `ON_CALL_SECTIONS` from Task 1 — the SQL `check` list must match it exactly, which the test asserts.
- Produces: table `public.on_call_entries`.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ON_CALL_SECTIONS } from "@/lib/on-call/entry-model";

const migration = readFileSync("supabase/migrations/20260904120000_on_call_entries.sql", "utf8");

describe("on_call_entries migration", () => {
  it("declares owner_id not null, because this table has no public state", () => {
    expect(migration).toContain("owner_id uuid not null references auth.users(id) on delete cascade");
  });

  it("checks section against exactly the sections the model defines", () => {
    for (const section of ON_CALL_SECTIONS) expect(migration).toContain(`'${section}'`);
  });

  it("enables row level security and revokes the table from anon and authenticated", () => {
    expect(migration).toContain("alter table public.on_call_entries enable row level security");
    expect(migration).toContain("revoke all on public.on_call_entries from anon, authenticated");
  });

  it("grants only service_role, matching the application-layer ownership model", () => {
    expect(migration).toContain("grant select, insert, update, delete on table public.on_call_entries to service_role");
  });

  it("stores no derived staleness column — freshness is computed at read time", () => {
    expect(migration).not.toContain("review_due_at");
    expect(migration).not.toContain("is_stale");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run test:focused -- --files tests/on-call-migration-contract.test.ts`
Expected: FAIL — `ENOENT`, the migration does not exist.

- [ ] **Step 3: Write the migration**

```sql
set search_path = public, pg_catalog, pg_temp;

-- The On Call mode's operational entries: orientation shelves, role-based
-- contacts, referral pathways, teaching sessions, escalation playbook cards and
-- site logistics. One table, discriminated by `section`, with the per-section
-- fields in `details` and validated in the API layer by a Zod schema per
-- section (src/lib/on-call/entry-model.ts).
--
-- `owner_id` is NOT NULL on purpose. Unlike `documents`, a null owner carries no
-- visibility meaning here: this table has no public state and must never gain
-- one, because its rows are a hospital's internal contact and orientation
-- information. Ownership is enforced at the API layer via the service-role
-- client, the same application-layer model as clinical_registry_records.
create table if not exists public.on_call_entries (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  section text not null check (
    section in ('contacts', 'playbook', 'referrals', 'orientation', 'education', 'logistics')
  ),
  slug text not null check (btrim(slug) <> ''),
  title text not null check (btrim(title) <> ''),
  subtitle text,
  body text,
  details jsonb not null default '{}'::jsonb,
  linked_document_ids uuid[] not null default '{}',
  tags text[] not null default '{}',
  -- A personal direct number. Excluded from the printable card and from any
  -- export; see src/lib/on-call/card-selection.ts.
  is_personal boolean not null default false,
  include_on_card boolean not null default false,
  sort_order integer not null default 0,
  -- When the owner last confirmed this entry is still correct. NULL means never.
  -- There is deliberately no stored due date or stale flag: freshness is derived
  -- at read time, so the twelve-month interval can change without a backfill.
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, section, slug)
);

create index if not exists on_call_entries_owner_section_idx
  on public.on_call_entries(owner_id, section, sort_order, title);

drop trigger if exists on_call_entries_updated_at on public.on_call_entries;
create trigger on_call_entries_updated_at
  before update on public.on_call_entries
  for each row execute function public.set_updated_at();

alter table public.on_call_entries enable row level security;

revoke all on public.on_call_entries from anon, authenticated;

grant select, insert, update, delete on table public.on_call_entries to service_role;

drop policy if exists "on call entries service role all" on public.on_call_entries;
create policy "on call entries service role all" on public.on_call_entries
  for all to service_role using (true) with check (true);
```

- [ ] **Step 4: Mirror it into `supabase/schema.sql` and run the checks**

Append the same table, index, trigger, RLS, revoke, grant and policy statements to `supabase/schema.sql` in the position matching the file's existing ordering.

Run: `npm run test:focused -- --files tests/on-call-migration-contract.test.ts && npm run check:migration-role`
Expected: the contract test PASSES, and `check:migration-role` reports no non-`postgres` role in the new SQL.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260904120000_on_call_entries.sql supabase/schema.sql tests/on-call-migration-contract.test.ts
git commit -m "feat(on-call): add the owner-scoped on_call_entries table"
```

---

### Task 3: Row mapping and the owner-scoped repository

**Files:**

- Create: `src/lib/on-call/repository.ts`
- Create: `tests/on-call-repository.test.ts`

**Interfaces:**

- Consumes: `OnCallEntry`, `OnCallSection`, `onCallDetailsSchemaFor` from Task 1.
- Produces: `rowToOnCallEntry(row)`, `onCallEntryToRow(entry, ownerId)`, `fetchOwnerOnCallEntries(supabase, ownerId, options?)`, `ON_CALL_MAX_ENTRIES`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from "vitest";
import { fetchOwnerOnCallEntries, rowToOnCallEntry } from "@/lib/on-call/repository";

function fakeClient(rows: unknown[]) {
  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve({ data: rows, error: null })),
  };
  return { from: vi.fn(() => chain), chain };
}

describe("fetchOwnerOnCallEntries", () => {
  it("filters by owner_id on the same chain as from()", async () => {
    const client = fakeClient([]);
    await fetchOwnerOnCallEntries(client as never, "owner-1");
    expect(client.from).toHaveBeenCalledWith("on_call_entries");
    expect(client.chain.eq).toHaveBeenCalledWith("owner_id", "owner-1");
  });

  it("refuses to run without an owner rather than returning another tenant's rows", async () => {
    const client = fakeClient([]);
    await expect(fetchOwnerOnCallEntries(client as never, "")).rejects.toThrow(/owner/i);
    expect(client.from).not.toHaveBeenCalled();
  });
});

describe("rowToOnCallEntry", () => {
  it("drops details that do not match the section's schema instead of trusting them", () => {
    const entry = rowToOnCallEntry({
      id: "11111111-1111-4111-8111-111111111111",
      section: "contacts",
      slug: "ward-4b",
      title: "Ward 4B",
      subtitle: null,
      body: null,
      details: { phne: "9999 9999" },
      linked_document_ids: [],
      tags: [],
      is_personal: false,
      include_on_card: false,
      sort_order: 0,
      last_verified_at: null,
    });
    expect(entry.details).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run test:focused -- --files tests/on-call-repository.test.ts`
Expected: FAIL — cannot resolve `@/lib/on-call/repository`.

- [ ] **Step 3: Write the implementation**

```ts
import {
  onCallDetailsSchemaFor,
  onCallEntrySchema,
  type OnCallEntry,
  type OnCallSection,
} from "@/lib/on-call/entry-model";

export const ON_CALL_MAX_ENTRIES = 1000;

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

const ROW_COLUMNS =
  "id, section, slug, title, subtitle, body, details, linked_document_ids, tags, is_personal, include_on_card, sort_order, last_verified_at";

export function rowToOnCallEntry(row: Record<string, unknown>): OnCallEntry & { details: unknown } {
  const base = onCallEntrySchema.parse({
    id: row.id,
    section: row.section,
    slug: row.slug,
    title: row.title,
    subtitle: row.subtitle ?? null,
    body: row.body ?? null,
    details: row.details ?? {},
    linkedDocumentIds: row.linked_document_ids ?? [],
    tags: row.tags ?? [],
    isPersonal: row.is_personal ?? false,
    includeOnCard: row.include_on_card ?? false,
    sortOrder: row.sort_order ?? 0,
    lastVerifiedAt: (row.last_verified_at as string | null) ?? null,
  });
  // A row whose details do not match its section is shown without them rather
  // than with a half-parsed shape a renderer would have to guess at.
  const parsed = onCallDetailsSchemaFor(base.section).safeParse(base.details);
  return { ...base, details: parsed.success ? parsed.data : null };
}

export function onCallEntryToRow(entry: OnCallEntry, ownerId: string) {
  return {
    owner_id: ownerId,
    section: entry.section,
    slug: entry.slug,
    title: entry.title,
    subtitle: entry.subtitle,
    body: entry.body,
    details: entry.details ?? {},
    linked_document_ids: entry.linkedDocumentIds,
    tags: entry.tags,
    is_personal: entry.isPersonal,
    include_on_card: entry.includeOnCard,
    sort_order: entry.sortOrder,
    last_verified_at: entry.lastVerifiedAt,
  };
}

export async function fetchOwnerOnCallEntries(
  supabase: AdminClient,
  ownerId: string,
  options: { section?: OnCallSection } = {},
) {
  if (!ownerId) {
    throw new Error("On Call entries were requested without an ownerId; refusing to run.");
  }
  let query = supabase.from("on_call_entries").select(ROW_COLUMNS).eq("owner_id", ownerId);
  if (options.section) query = query.eq("section", options.section);
  const { data, error } = await query.order("sort_order").limit(ON_CALL_MAX_ENTRIES);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToOnCallEntry(row as Record<string, unknown>));
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run: `npm run test:focused -- --files tests/on-call-repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/on-call/repository.ts tests/on-call-repository.test.ts
git commit -m "feat(on-call): add owner-scoped row mapping and entry fetching"
```

---

### Task 4: The API routes

**Files:**

- Create: `src/app/api/on-call/entries/route.ts` (GET, POST)
- Create: `src/app/api/on-call/entries/[id]/route.ts` (PATCH, DELETE)
- Create: `src/app/api/on-call/entries/[id]/verify/route.ts` (POST)
- Create: `tests/on-call-api-contract.test.ts`

**Interfaces:**

- Consumes: `fetchOwnerOnCallEntries`, `onCallEntryToRow` (Task 3); `publicAccessContext` from `@/lib/public-api-access`; `createAdminClient` from `@/lib/supabase/admin`.
- Produces: `GET /api/on-call/entries` returning `{ entries: OnCallEntry[]; signedOut: boolean }`.

Read `src/app/api/registry/records/route.ts` before writing these — it is the route this mode copies, including its rate limiting, its `AuthenticationError` to 401 mapping, and its anonymous branch that never reaches the database.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const list = readFileSync("src/app/api/on-call/entries/route.ts", "utf8");

describe("On Call entries route", () => {
  it("never reads the database for an anonymous caller", () => {
    expect(list).toContain("if (!access.ownerId)");
    expect(list).toMatch(/signedOut:\s*true/);
  });

  it("takes the owner from the access context, never from the request", () => {
    expect(list).not.toMatch(/body\.(owner_id|ownerId)/);
    expect(list).not.toMatch(/searchParams\.get\(\s*["']owner/);
  });

  it("uses the admin client and scopes through the repository helper", () => {
    expect(list).toContain("createAdminClient");
    expect(list).toContain("fetchOwnerOnCallEntries");
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm run test:focused -- --files tests/on-call-api-contract.test.ts`
Expected: FAIL — `ENOENT` on the route file.

- [ ] **Step 3: Write the three route files**

`GET` resolves `publicAccessContext(request, supabase)`. When `!access.ownerId` it returns `{ entries: [], signedOut: true }` in production, and the demo fixture set when `isDemoMode()`. When authenticated it calls `fetchOwnerOnCallEntries(supabase, access.ownerId, { section })`. `POST`, `PATCH`, `DELETE` and the verify route call `requireAuthenticatedUser` and reject with 401 otherwise; each write carries `.eq("owner_id", ownerId)` on the same chain as `.from("on_call_entries")`. The verify route sets `last_verified_at` to `new Date().toISOString()` and returns the updated entry. Validate every write body with `onCallEntrySchema` plus `onCallDetailsSchemaFor(section)`, returning 400 with the Zod issues on failure.

- [ ] **Step 4: Run the contract test and the owner-scope gate**

Run: `npm run test:focused -- --files tests/on-call-api-contract.test.ts && npm run check:owner-scope`
Expected: contract test PASSES; `check:owner-scope` reports the new routes proven, with no new `SCOPE_EXEMPTIONS` entry.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/on-call tests/on-call-api-contract.test.ts
git commit -m "feat(on-call): add owner-scoped entry API routes"
```

---

### Task 5: Register the mode in every type-enforced map

This task will not compile until every `Record<AppModeId, …>` has an `on-call` key. That is the point: the compiler is the checklist.

**Files:**

- Modify: `src/lib/app-modes.ts` — add `"on-call"` to `appModeIds`, add the definition, add to `namespaceIsolatedModes`
- Modify: `src/lib/ui-copy.ts` — `sharedHomePresentation`
- Modify: `src/lib/category-identity.ts` — `CATEGORY_ICON_KEYS` (add `"phoneCall"`), `APP_MODE_ICON`, `APP_MODE_ACCENT`
- Modify: `src/lib/category-identity-icons.ts` — map `phoneCall` to Lucide `PhoneCall`
- Modify: `src/lib/universal-search-mode-context.ts` — `preferredDomainsByMode`
- Modify: `src/lib/search-command-surface.ts` — `searchCommandSurfaceByMode`
- Modify: `tests/app-modes.test.ts`, `tests/ui-copy.test.ts`, `tests/shared-home-empty-state.dom.test.tsx`, `tests/mode-secondary-navigation.test.ts` — the hardcoded `16` and the exhaustive literals

**Interfaces:**

- Produces: `AppModeId` now includes `"on-call"`; `appModeHomeHref("on-call")` resolves.

- [ ] **Step 1: Add the mode id and definition**

In `src/lib/app-modes.ts`, append `"on-call"` to `appModeIds`, and add this definition after the `sources` entry:

```ts
  {
    id: "on-call",
    label: "On Call",
    description: "Your service's contacts, escalation, orientation and teaching",
    href: "/on-call",
    search: {
      // On Call searches the owner's own operational entries, which are already
      // in the browser — a local catalogue, like Factsheets and Dictionary — so
      // it borrows the benign "tools" command kind rather than adding a search
      // kind that would have to be threaded through universal search.
      kind: "tools",
      placeholder: "Search a ward, a number, a service, a session...",
      inputAriaLabel: "Search your on-call information",
      submitIdleLabel: "On Call",
      submitBusyLabel: "On Call",
      submitAriaLabel: "Search your on-call information",
      emptyTitle: "Search your on-call information",
      readyTitle: "Find a number, a pathway or a session",
      progressLabel: "Searching your on-call entries.",
      resultKind: "tools",
      resultHeading: "On Call",
      resultsSurface: "results-band",
      statusLabel: "On Call",
      nextStep: "Open an entry",
      badgeLabel: null,
    },
  },
```

Add `"on-call"` to `namespaceIsolatedModes`.

- [ ] **Step 2: Run the typecheck and let it enumerate every remaining map**

Run: `npm run typecheck`
Expected: FAIL, with one error per exhaustive record missing an `on-call` key. Work the list; do not guess at it.

- [ ] **Step 3: Fill in each map**

`sharedHomePresentation`:

```ts
  "on-call": {
    title: "On Call",
    subtitle: "Your service's numbers, escalation, orientation and teaching.",
    suggestions: ["after-hours registrar", "acute behavioural disturbance", "ward 4B number"],
  },
```

`CATEGORY_ICON_KEYS`: append `"phoneCall"`. `APP_MODE_ICON`: `"on-call": "phoneCall"` — a glyph no other mode uses, which `tests/category-identity.test.ts` requires. `APP_MODE_ACCENT`: `"on-call": "purple"` — shared with `formulation`, which the map's own note permits for modes that rarely share a four-slot also-matches grid; On Call is operational and Formulation is diagnostic, so they do not co-occur. `src/lib/category-identity-icons.ts`: `phoneCall: PhoneCall` imported from `lucide-react`. `preferredDomainsByMode`: `"on-call": []` — On Call contributes no cross-entity universal-search domain. `searchCommandSurfaceByMode`: an entry with non-empty `examples` and `suggestions`, which `tests/search-command-surface.test.ts` requires.

- [ ] **Step 4: Update the four tests that hold complete mode lists**

Change `expect(appModeIds).toHaveLength(16)` to `17` in `tests/app-modes.test.ts:203` and `tests/mode-secondary-navigation.test.ts`. Change the same count in `tests/ui-copy.test.ts`. Add the `on-call` row to the submitted-search href literal in `tests/app-modes.test.ts`, to `EXPECTED_MODE_TITLES` in `tests/ui-copy.test.ts`, and to `expectedPresentations` in `tests/shared-home-empty-state.dom.test.tsx` **at the same index as in `appModeIds`** — that assertion is ordered.

Run: `npm run typecheck && npm run test:focused -- --files tests/app-modes.test.ts tests/ui-copy.test.ts tests/category-identity.test.ts tests/search-command-surface.test.ts tests/shared-home-empty-state.dom.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib tests
git commit -m "feat(on-call): register the seventeenth mode in every mode-keyed map"
```

---

### Task 6: Navigation — secondary bar, phone sheet, sidebar

**Files:**

- Modify: `src/lib/mode-secondary-navigation.ts` — registry entry, `MODE_NAV_ADOPTED_MODES`, `activeModeSecondaryNavigationId`, `isModeSecondaryNavigationRoute`
- Modify: `src/components/mode-nav/registry-mode-nav.tsx` — `registryModeNavDensityProfiles`, `iconByItemId`
- Modify: `src/lib/phone-mode-groups.ts`
- Modify: `src/components/clinical-dashboard/ClinicalSidebar.tsx`, `src/components/clinical-dashboard/use-sidebar-pins.ts`
- Modify: `src/lib/search-route-ownership.ts`, `src/lib/search-shell-props.ts`, `src/lib/consolidated-mode-home-redirect.ts`
- Modify: `tests/mode-secondary-navigation.test.ts`, `tests/phone-mode-groups.test.ts`

- [ ] **Step 1: Add the six navigation entries**

```ts
  "on-call": [
    { id: "contacts", label: "Contacts", href: "/on-call/contacts" },
    { id: "playbook", label: "Playbook", href: "/on-call/playbook" },
    { id: "referrals", label: "Referrals", href: "/on-call/referrals" },
    { id: "orientation", label: "Orientation", href: "/on-call/orientation" },
    { id: "teaching", label: "Teaching", href: "/on-call/education" },
    { id: "logistics", label: "Logistics", href: "/on-call/logistics" },
  ],
```

Contacts leads because it is the page a shift actually opens. Add `"on-call"` to `MODE_NAV_ADOPTED_MODES`, give it `registryModeNavDensityProfiles["on-call"] = "extended"` (the profile Therapy Compass uses for five entries — six needs the evidence in Step 3), and add an icon for each of the six new routed ids to `iconByItemId`.

- [ ] **Step 2: Add the mode to the phone sheet and the sidebar**

Put `"on-call"` in exactly one `phoneModeGroups` group — `care` — or `tests/phone-mode-groups.test.ts` fails on exhaustiveness. Add it to `pinnableSidebarModeIds` and to either `sidebarToolItems` or `sidebarMoreModeIds`. Add `"/on-call"` to `alwaysStandaloneShellPathPrefixes`, a `pathname.startsWith("/on-call")` branch to `searchShellPropsForPathname` returning `{ initialMode: "on-call" }`, and `"/on-call": "on-call"` to `consolidatedModeHomePaths` — which obliges `/on-call/search` to exist (Task 12), or `appModeHomeHref` loops.

- [ ] **Step 3: Record the density evidence, and take the fallback if six labels do not fit**

Run: `npm run ensure` then `npx playwright test tests/ui-mode-nav-density.spec.ts --project=phone`
Expected: PASS with six labels inside the `extended` budget.

**If it fails:** apply the fallback the spec already decided — cut the registry to `contacts`, `playbook`, `referrals`, `orientation`, move to `"balanced-four"`, and reach Teaching and Logistics from the mode home and from search. Do not invent a third option.

- [ ] **Step 4: Run the navigation tests**

Run: `npm run test:focused -- --files tests/mode-secondary-navigation.test.ts tests/phone-mode-groups.test.ts tests/search-route-ownership.test.ts tests/consolidated-mode-home-redirect.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib src/components tests
git commit -m "feat(on-call): wire the mode into secondary nav, the phone sheet and the sidebar"
```

---

### Task 7: Routes and shells

**Files:**

- Create: `src/app/(search-app)/on-call/layout.tsx`, `loading.tsx`, `page.tsx`
- Create: `src/app/(search-app)/on-call/{contacts,playbook,referrals,orientation,education,logistics}/page.tsx`
- Create: `src/components/on-call/on-call-section-page.tsx` — the one module all six routes render, following `src/components/sources/sources-pages.tsx`
- Create: `src/components/on-call/on-call-nav-header.tsx` — the `"use client"` sibling exporting each page's `PageSection[]`
- Create: `tests/on-call-routes.dom.test.tsx`

Copy `src/app/(search-app)/factsheets/page.tsx` for the redirect stub and `dictionary/loading.tsx` for the loading route, which must render `ModeHomeRouteLoading`.

- [ ] **Step 1: Write the failing test** — assert each of the six routes renders its heading, that the signed-out state renders no entry content, and that each page's declared anchors exist in the rendered DOM (never by grepping for `id=`).
- [ ] **Step 2: Run it and confirm it fails.** Run: `npm run test:focused -- --files tests/on-call-routes.dom.test.tsx`
- [ ] **Step 3: Build the shared section module and the eight route files.** Every page: `InformationPageShell` + `InPageNavHeader` mounted through the colocated nav-header sibling, sections carrying `inPageAnchor`, no second sticky header, no page-local dock reserve.
- [ ] **Step 4: Run the route, reachability and chrome tests.** Run: `npm run test:focused -- --files tests/on-call-routes.dom.test.tsx tests/route-reachability.test.ts tests/mode-home-loading-contract.test.ts tests/in-page-nav-route-sections.dom.test.tsx tests/mode-nav-addon-slot.dom.test.tsx tests/viewport-fill-contract.test.ts`
- [ ] **Step 5: Commit.** `git commit -m "feat(on-call): add the mode routes and the shared section shell"`

---

### Task 8: The client entry store and the offline cache

**Files:**

- Create: `src/lib/on-call/entry-store.ts` — built on `createBrowserStore` from `src/lib/client-store-factory.ts`, following `src/lib/saved-registry-storage.ts`
- Create: `tests/on-call-entry-store.test.ts`

**Interfaces:**

- Produces: `useOnCallEntries()`, `cacheOnCallEntries(entries)`, `readCachedOnCallEntries()`, `clearOnCallEntryCache()`.

- [ ] **Step 1: Write the failing test** — a successful fetch writes the cache; a failed fetch renders the cached copy with its saved date; `clearOnCallEntryCache()` empties it; every read and write is wrapped so a browser blocking site data cannot throw into render.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement it,** and call `clearOnCallEntryCache()` from the existing sign-out path so personal numbers do not outlive the session on a shared machine.
- [ ] **Step 4: Run the test and confirm it passes.**
- [ ] **Step 5: Commit.** `git commit -m "feat(on-call): cache entries for offline contact access"`

---

### Task 9: Contacts — the reference section UI

The richest section and the template for the other five. Build it fully before the others.

**Files:**

- Create: `src/components/on-call/on-call-contacts-section.tsx`, `on-call-entry-row.tsx`, `on-call-freshness-badge.tsx`, `on-call-offline-banner.tsx`
- Create: `tests/on-call-contacts.dom.test.tsx`

- [ ] **Step 1: Write the failing test** — the whole row is one tap target of at least 48px; the number is a `tel:` link; rows group by area under headings; stale entries collect into a group at the top; the freshness badge carries an icon and the words "checked" with a date, never colour alone; the offline banner names its saved date and is not itself a live region.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement it** using `card-recipes.ts` and `ui-primitives.tsx` recipes only — no new tokens.
- [ ] **Step 4: Run the test and the style contract.** Run: `npm run test:focused -- --files tests/on-call-contacts.dom.test.tsx && npm run check:design-system-contract && npm run check:type-scale && npm run check:icon-scale`
- [ ] **Step 5: Commit.** `git commit -m "feat(on-call): build the contacts section"`

---

### Task 10: The remaining five sections

Each reuses `on-call-entry-row.tsx` and the freshness badge from Task 9 and adds only its own detail rendering.

**Files:** `src/components/on-call/on-call-{playbook,referrals,orientation,education,logistics}-section.tsx`; `tests/on-call-sections.dom.test.tsx`

- [ ] **Step 1: Write the failing test,** covering per section: **Playbook** — escalation steps render as an ordered list of who, when and a tap-to-call number; linked guidance shows each document's title and date; a card with no linked document renders an `EmptyState` offering a Documents search and **no clinical text**. **Referrals** — accepts and exclusions render as labelled text, not colour-coded chips alone. **Orientation** — a pinned summary is visibly attributed to the owner and sits above the document link. **Education** — ordered by next occurrence; a recording link is marked as leaving the app. **Logistics** — grouped rows.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement the five components.**
- [ ] **Step 4: Run the test and confirm it passes.**
- [ ] **Step 5: Commit.** `git commit -m "feat(on-call): build the playbook, referrals, orientation, teaching and logistics sections"`

---

### Task 11: Editing

**Files:** `src/components/on-call/on-call-entry-editor.tsx`; `tests/on-call-editor.dom.test.tsx`

Use `FormField`, `TextField`, `Select`, `Checkbox` and `Sheet` from `src/components/ui/`. The editor is a `Sheet` with a mandatory accessible name. A `ConfirmDialog` guards delete with an object-specific confirm label ("Delete Ward 4B"), never "Confirm".

- [ ] **Step 1: Write the failing test** — creating, editing and deleting an entry; the per-section fields follow the chosen section; validation errors surface through `FieldError`; the "still correct" action calls the verify route and clears the stale state.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement the editor.**
- [ ] **Step 4: Run the test and the lint rules.** Run: `npm run test:focused -- --files tests/on-call-editor.dom.test.tsx && npm run lint`
- [ ] **Step 5: Commit.** `git commit -m "feat(on-call): add in-app entry editing"`

---

### Task 12: Search

**Files:** `src/app/(search-app)/on-call/search/page.tsx`; `src/components/on-call/on-call-search-page.tsx`; `src/lib/on-call/search.ts`; `tests/on-call-search.test.ts`

Search filters the entry set already in the browser, so it works offline. The page mounts `SearchResultsHeaderBand`, which `tests/search-results-band-adoption.test.ts` requires because the mode declares `resultsSurface: "results-band"`.

- [ ] **Step 1: Write the failing test** — one query matches across all six sections; results name their section; a faulted search renders **no count at all**; sort is an `aria-pressed` group from `sm` up; the phone filter is the badged trigger opening a sheet, never a native select.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement the matcher and the page.**
- [ ] **Step 4: Run the test and the band adoption contract.** Run: `npm run test:focused -- --files tests/on-call-search.test.ts tests/search-results-band-adoption.test.ts`
- [ ] **Step 5: Commit.** `git commit -m "feat(on-call): add search across every section"`

---

### Task 13: The printable card

**Files:** `src/app/(search-app)/on-call/card/page.tsx`; `src/components/on-call/on-call-card.tsx`; `src/lib/on-call/card-selection.ts`; `tests/on-call-card.test.ts`

Compose `PrintSection`, `BrowserPrintButton` and `CONFIDENTIAL_DOCUMENT_FOOTER` from `src/components/ui/print-output.tsx`. The print action lives in the actions sheet, following `src/components/dictionary/dictionary-term-page.tsx:88`.

- [ ] **Step 1: Write the failing test** — `selectCardEntries` includes entries flagged `includeOnCard`, and **excludes every entry flagged `isPersonal` and every stale entry**, with a case for each exclusion separately and one for both at once.
- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement the selection and the page.**
- [ ] **Step 4: Run the test and confirm it passes.**
- [ ] **Step 5: Commit.** `git commit -m "feat(on-call): add the printable essentials card"`

---

### Task 14: Generated artefacts, documentation and the full gate

**Files:** `docs/site-map.md`, `data/repo-awareness-snapshot.json`, `docs/design-system/adoption-contract.json`, `docs/codebase-index.md`, `scripts/generate-site-map.ts`, `tests/helpers/phone-scroll.ts`, `CLAUDE.md`

- [ ] **Step 1: Add the mode to the site-map generator.** `renderModeRoutes()` has a `Record<AppModeId, string>` of examples — it will not compile without an `on-call` entry — and `renderModePageIndex()` needs a hand-written table row.
- [ ] **Step 2: Declare the routes and add the phone-scroll coverage.** Add all nine new `page.tsx` routes to `docs/design-system/adoption-contract.json` exactly once, under the existing `catalogues-forms-and-info` surface, with all five proofs. Add the mode home to `modeHomeRoutes` and the section routes to `appModeHeaderRoutes` in `tests/helpers/phone-scroll.ts`.
- [ ] **Step 3: Regenerate every derived document.** Run: `npm run docs:update`. Then update the counts: `docs/codebase-index.md` and `CLAUDE.md` both say "16 app modes"; `src/lib/phone-mode-groups.ts` says "sixteen-item list"; `src/lib/developer-area/hub-panels.ts:134` carries a user-visible "all 16 modes".
- [ ] **Step 4: Run the full local gate.**

Run: `npm run format && git add -A src tests docs data supabase && npm run verify:pr-local`
Then the focused browser proof: `npm run ensure && npm run plan:browser -- --run`

Expected: `verify:pr-local` green. Report the browser run as "focused browser proof at level `<x>`, full suite left to CI" — never as `verify:ui` passing.

- [ ] **Step 5: Commit and open the change for review.**

```bash
git add -A
git commit -m "docs(on-call): regenerate site map, snapshots and adoption manifest"
```

Push, then confirm the PR body carries the `RAG impact:` line from Global Constraints and states that the migration merges only inside an approved window with auto-merge unarmed.

---

## Self-review

**Spec coverage.** §3 sections → Tasks 9, 10. §4 data and staleness → Tasks 1, 2. §5 server surface → Task 4. §6 client behaviour: local search → Task 12; offline → Task 8; printable card → Task 13. §7 clinical-safety constraints → Task 10 Step 1 (playbook), Task 10 (owner attribution), Task 4 (demo fixtures). §8 design and phone behaviour → Tasks 6, 7, 9. §9 mode registration → Tasks 5, 6, 7, 14. §10 testing → each task's test step. §11 verification → Task 14 Step 4. §12 out of scope → no task, correctly.

**Type consistency.** `OnCallSection`, `OnCallEntry`, `onCallEntryFreshness`, `fetchOwnerOnCallEntries`, `rowToOnCallEntry`, `onCallEntryToRow`, `selectCardEntries` are each defined once and referred to by the same name everywhere.

**Known open point, decided in advance rather than left open.** Whether six navigation labels fit the phone bar is settled by evidence in Task 6 Step 3, and the fallback is written there. Nothing else in the plan waits on a decision.
