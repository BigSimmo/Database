import { isOnCallComplianceCategory, mayContainOnCallCompliance } from "@/lib/on-call/compliance";
import {
  onCallDetailsSchemaFor,
  onCallEntrySchema,
  type OnCallEntry,
  type OnCallSection,
} from "@/lib/on-call/entry-model";
import { PublicApiError } from "@/lib/http";
import { withOwnerReadScope } from "@/lib/public-api-access";

export const ON_CALL_MAX_ENTRIES = 1000;

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

export async function assertValidLinkedDocumentIds(
  supabase: AdminClient,
  documentIds: readonly string[] | string[],
  ownerId: string,
  isPersonal = true,
): Promise<void> {
  const uniqueIds = Array.from(new Set(documentIds));
  if (uniqueIds.length === 0) return;

  const { data, error } = await withOwnerReadScope(
    supabase.from("documents").select("id").in("id", uniqueIds),
    isPersonal ? ownerId : undefined,
  );
  if (error) throw new Error(error.message);

  const existingIds = new Set((data ?? []).map((doc: { id: string }) => doc.id));
  const allExist = uniqueIds.every((id) => existingIds.has(id));
  if (!allExist) {
    throw new PublicApiError("Invalid linked document IDs: one or more documents do not exist.", 400);
  }
}

const ROW_COLUMNS =
  "id, section, slug, title, subtitle, body, details, linked_document_ids, tags, is_personal, include_on_card, sort_order, last_verified_at";

export function rowToOnCallEntry(row: Record<string, unknown>): OnCallEntry & { details: unknown } {
  const base = onCallEntrySchema.parse({
    id: row.id,
    section: row.section,
    slug: row.slug,
    title: row.title,
    // The database column permits an empty string. Normalize whitespace-only
    // or empty subtitles to null so one blank subtitle does not reject the
    // entire list fetch.
    subtitle: typeof row.subtitle === "string" && row.subtitle.trim() === "" ? null : (row.subtitle ?? null),
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

/**
 * Whether these details carry a compliance `kind` at all — the WRITE-side
 * question, which is narrower than the read's on purpose. See the comment
 * inside `onCallEntryToRow` for why the two differ.
 *
 * Any `kind`, not `kind === "compliance"`: `compliance` is the only value this
 * section defines, so anything else is a typo of it or something newer than
 * this function, and both should be stored private rather than shared.
 */
function detailsCarryComplianceKind(details: unknown): boolean {
  if (typeof details !== "object" || details === null || Array.isArray(details)) return false;
  return "kind" in details;
}

export function onCallEntryToRow(entry: OnCallEntry, ownerId: string) {
  // Both write handlers — `POST /api/on-call/entries` and the `PATCH` beside
  // it — funnel through here, which is why the compliance privacy stamp lives
  // in this function rather than twice in two routes that could drift apart.
  //
  // The client editor already stores these rows private. This does not trust
  // it: the request body is the client's word, and an authenticated caller can
  // send whatever they like straight to the API. A compliance requirement is
  // about one person by definition, so `is_personal` is not a setting on one —
  // it is a property of what the row is.
  //
  // DELIBERATELY NARROWER than `rowMayBeComplianceRequirement`, which is the
  // read filter, and the asymmetry is the point rather than an oversight.
  //
  // Withholding on read costs nothing and undoes itself the moment the row is
  // corrected. Stamping on write is a stored mutation that sticks, and the
  // owner cannot take it back: `is_personal: entry.isPersonal || isCompliance`
  // means unticking "Private" and saving is silently overruled — the request
  // succeeds, the tick box springs back, and nothing says why. For a genuine
  // compliance requirement that is right, and the editor hides the tick box
  // there so no control lies. Widening this stamp to everything the read
  // withholds would put that silent override behind a tick box the Admin form
  // still shows, on rows the owner deliberately shared.
  //
  // So this asks the narrow question the editor's own taxonomy asks — does the
  // row carry a `kind` or a compliance category — and the read additionally
  // withholds malformed details and stranded compliance fields.
  const isCompliance =
    entry.section === "logistics" &&
    (detailsCarryComplianceKind(entry.details) ||
      isOnCallComplianceCategory((entry.details as { category?: unknown } | null)?.category));
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
    is_personal: entry.isPersonal || isCompliance,
    include_on_card: entry.includeOnCard,
    sort_order: entry.sortOrder,
    last_verified_at: entry.lastVerifiedAt,
  };
}

/**
 * The sections this read may publish to a stranger — an allow-list, so the
 * default for anything new is withheld.
 *
 * This is the control the compliance leak got past, and the reason it is worth
 * having is that the leak was not a coding mistake. `section` was already an
 * exhaustive union; the shared read already filtered on `is_personal`; every
 * line of it was correct. What happened was that a page storing a doctor's
 * registration and police clearance was added to a section that had been made
 * public a fortnight earlier for ward phone numbers, and nothing anywhere
 * required anyone to re-decide.
 *
 * Restating the six values here looks redundant against `ON_CALL_SECTIONS` and
 * is deliberately not: that constant answers "what may be stored", and this one
 * answers "what may be published", which is a different question with a
 * different reviewer. Adding a seventh section to the union does not add it
 * here, so a new section is withheld from anonymous readers until somebody
 * writes its name in this list on purpose — and `tests/on-call-repository.test.ts`
 * fails until they do.
 *
 * `logistics` is on the list and carries the Compliance page's rows, which is
 * why the row-level predicate below exists as well. A section allow-list alone
 * cannot see a page hiding inside a section.
 */
export const PUBLIC_ON_CALL_SECTIONS = [
  "contacts",
  "playbook",
  "referrals",
  "orientation",
  "education",
  "logistics",
] as const satisfies readonly OnCallSection[];

/**
 * The `logistics` detail keys that only a compliance requirement carries.
 *
 * `kind` alone was the original test and it was not enough, which a review
 * caught before this branch merged. `kind` is optional in `logisticsDetails`,
 * so `{ category: "Registration", expiresOn: "2027-03-12", issuingBody:
 * "Ahpra", evidenceUrl: "…/certificate.pdf" }` is a VALID logistics row with no
 * `kind` at all. It parses cleanly, `isComplianceEntry` calls it ordinary
 * admin, and the old predicate published it to anonymous callers with its
 * details intact — the expiry, the issuer and the link to the certificate. A
 * compliance requirement that merely lost one key was the worst case, and it
 * was the case the old test suite did not have.
 *
 * So the question this asks is no longer "is it labelled compliance" but "does
 * it look like a compliance record", and the answer is deliberately generous.
 * The cost of a false positive is one Admin row about, say, a parking permit
 * with an expiry date being withheld from anonymous readers while its owner
 * still sees it. The cost of a false negative is publishing a named doctor's
 * registration. Those are not comparable, so this errs in the cheap direction.
 *
 * The complement — `category`, `location`, `hours`, `phone`, `url` — is what an
 * ordinary Admin row uses, and `tests/on-call-repository.test.ts` fails if a
 * new key is added to `logisticsDetails` without being sorted into one list or
 * the other. That is the same deny-by-default discipline as
 * `PUBLIC_ON_CALL_SECTIONS` above: a new field is withheld until somebody
 * decides on purpose that it may be published.
 */
export { COMPLIANCE_MARKER_KEYS } from "@/lib/on-call/compliance";

/**
 * Whether a raw row is — or might be — a compliance requirement, and therefore
 * must never leave this server to an anonymous caller.
 *
 * The 2026-09-04 decision that made this surface world-readable was about ward
 * phone numbers and escalation ladders. The Compliance page stores something
 * else entirely: one named doctor's registration, indemnity, credentialing,
 * Working with Children Check and police clearance, and often a link to the
 * certificate. Nobody decided to publish that, and there is no case for
 * sharing it — a compliance requirement is by definition about one person.
 *
 * Three properties matter, and each is why this is here rather than only in
 * the editor:
 *
 * 1. **It reads the RAW row, not a parsed entry.** `rowToOnCallEntry` sets
 *    `details: null` when the details fail their schema, so a compliance row
 *    with one stray character in `kind` parses into something
 *    `isComplianceEntry` calls an ordinary Admin row. Asking the parsed entry
 *    would publish exactly the rows most likely to be malformed.
 * 2. **It fails closed.** Unreadable details on a `logistics` row — null, a
 *    string, an array, or any object the section schema refuses — are treated
 *    as compliance and withheld. Withholding a broken parking note from the
 *    public page costs nothing; publishing a broken registration record cannot
 *    be undone.
 * 3. **Any marker key, not `kind === "compliance"`.** See
 *    `COMPLIANCE_MARKER_KEYS` below for why `kind` alone was not enough.
 *
 * The write path stores these rows `is_personal: true`, which would exclude
 * them anyway. That is the belt; this is the braces, and it is the one that
 * also covers a row written before the fix, an import, or a direct database
 * edit.
 *
 * Compliance categories are also withheld, even if an older row lost its
 * discriminator and kept personal information in the title or body.

 */
export function rowMayBeComplianceRequirement(row: Record<string, unknown>): boolean {
  return mayContainOnCallCompliance(row.section, row.details);
}

/**
 * On Call is a shared reference surface: every entry is readable by any visitor, signed in or
 * not. That is a deliberate visibility decision (owner request, 2026-09-04) and a reversal of
 * this mode's original owner-only design — see docs/superpowers/specs/2026-09-04-on-call-mode-design.md.
 *
 * The app has no login wall, so "public" here means readable by anyone who reaches the site,
 * not "readable by signed-in colleagues". There is no cohort tier to fall back on.
 *
 * TWO things are never published, and both stay with the account that wrote them, returned only
 * to that owner by `fetchOwnerOnCallEntries`:
 *
 * - An entry flagged `is_personal`. The editor offers that as a choice, and a world-readable
 *   fetch is an export.
 * - A compliance requirement, whatever its flags say. That is not a choice — see
 *   `rowMayBeComplianceRequirement` below for why it is decided here, on the raw row, and why
 *   it fails closed.
 *
 * Writes are unchanged: creating or editing still requires an account and still stamps owner_id.
 */
export async function fetchSharedOnCallEntries(supabase: AdminClient, options: { section?: OnCallSection } = {}) {
  let query = supabase
    .from("on_call_entries")
    .select(ROW_COLUMNS)
    .eq("is_personal", false)
    .in("section", [...PUBLIC_ON_CALL_SECTIONS]);
  if (options.section) query = query.eq("section", options.section);
  const { data, error } = await query.order("sort_order").limit(ON_CALL_MAX_ENTRIES);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((row) => !rowMayBeComplianceRequirement(row as Record<string, unknown>))
    .map((row) => rowToOnCallEntry(row as Record<string, unknown>));
}

/**
 * What a given viewer sees: every shared entry, plus their own entries including the personal
 * ones the shared read withholds.
 *
 * Two queries rather than one `or(...)` filter, because a PostgREST `or=` string interpolates
 * the owner id into filter syntax where a comma or parenthesis stops being data — the trap
 * `withOwnerReadScope` guards with a UUID pattern. Merging two `.eq()` reads has no such edge,
 * and both are capped at ON_CALL_MAX_ENTRIES.
 */
export async function fetchVisibleOnCallEntries(
  supabase: AdminClient,
  viewerOwnerId: string | undefined,
  options: { section?: OnCallSection } = {},
) {
  // `isOwn` is derived from WHICH query returned a row, not from an `owner_id` column: the shared
  // read's column list is part of a reviewed tenancy declaration and stays as narrow as it is.
  // A shared row the viewer owns also comes back from the owner query, and that copy wins below.
  const shared = (await fetchSharedOnCallEntries(supabase, options)).map((entry) => ({ ...entry, isOwn: false }));
  if (!viewerOwnerId) return shared;

  const own = await fetchOwnerOnCallEntries(supabase, viewerOwnerId, options);
  const byId = new Map(shared.map((entry) => [entry.id, entry]));
  // The owner's own copy wins on collision: it is the same row, and this keeps one identity per
  // entry rather than two objects a renderer would key twice.
  for (const entry of own) byId.set(entry.id, { ...entry, isOwn: true });
  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder);
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
