import { PublicApiError } from "@/lib/http";
import type {
  CmeAllocation,
  CmeCategory,
  CmeEntry,
  CmeRequirement,
  CmeRequirementSet,
  CmeRequirementSource,
  CmeRequirementSpec,
} from "@/lib/cme/types";
import type { Database } from "@/lib/supabase/database.types";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

type CmeEntryInsert = Database["public"]["Tables"]["cme_entries"]["Insert"];
type CmeYearRow = Database["public"]["Tables"]["cme_years"]["Row"];
type CmeRequirementRow = Database["public"]["Tables"]["cme_requirements"]["Row"];

/**
 * A generous ceiling on one owner's year, so a runaway import or a corrupted routine
 * cannot page forever. Reused for `cme_requirements`, whose per-year count is always a
 * handful, purely so every bounded read in this module shares one documented ceiling
 * rather than inventing a second magic number for a table that will never approach it.
 */
export const CME_MAX_ENTRIES = 2000;

/**
 * `CmeEntry` -> the `cme_entries` insert payload.
 *
 * `id` is deliberately not part of the returned row: it is spelled out again on the
 * insert call itself (see `insertCmeEntry`), the same explicit-restamp idiom
 * `src/lib/on-call/repository.ts` uses for `owner_id`, so the identity a caller writes is
 * visible on the statement that writes it rather than buried inside a mapper.
 */
export function cmeEntryToRow(entry: CmeEntry, ownerId: string, yearId: string): CmeEntryInsert {
  return {
    owner_id: ownerId,
    year_id: yearId,
    activity_date: entry.date,
    title: entry.title,
    reflection: entry.reflection,
    cost_cents: entry.costCents,
    // Stored as the instant it was transcribed, not a boolean column — see the migration.
    // `rowToCmeEntry` reads only whether this is null, never the instant itself, so the
    // exact timestamp carries no meaning a caller can rely on today.
    transcribed_at: entry.transcribed ? new Date().toISOString() : null,
    routine_id: entry.routineId,
    document_id: entry.documentId,
    buckets: [...entry.buckets],
  };
}

/**
 * A `cme_entries` row (plus its joined `cme_allocations`) -> `CmeEntry`.
 *
 * `row` is untyped `Record<string, unknown>` rather than `CmeEntryRow` because every
 * caller in this module selects `cme_allocations` as a joined relation alongside it
 * (`select("*, cme_allocations(category, hours)")`), a shape the generated `Database`
 * type does not describe. Allocations travel as a separate argument for the same reason
 * `src/lib/on-call/repository.ts` takes its joined shape apart before mapping it.
 */
export function rowToCmeEntry(row: Record<string, unknown>, allocations: readonly CmeAllocation[]): CmeEntry {
  return {
    id: String(row.id),
    date: String(row.activity_date),
    title: String(row.title),
    allocations: allocations.map((allocation) => ({ ...allocation })),
    reflection: String(row.reflection ?? ""),
    costCents: row.cost_cents == null ? null : Number(row.cost_cents),
    transcribed: row.transcribed_at != null,
    routineId: row.routine_id == null ? null : String(row.routine_id),
    documentId: row.document_id == null ? null : String(row.document_id),
    buckets: Array.isArray(row.buckets) ? row.buckets.map(String) : [],
  };
}

/**
 * A `cme_requirements` row -> `CmeRequirement`.
 *
 * `spec` is cast rather than schema-validated: the shape contract for it lives in Task 2's
 * `@/lib/cme/schemas.ts`, which this task does not own, and every row here was written by
 * this application's own insert path (mirrors `registry-records.ts`, which casts its own
 * jsonb governance columns the same way rather than re-validating application-written data
 * on every read).
 */
function rowToCmeRequirement(row: CmeRequirementRow): CmeRequirement {
  return {
    id: row.id,
    label: row.label,
    source: row.source as CmeRequirementSource,
    spec: row.spec as CmeRequirementSpec,
    completedOn: row.completed_on ?? null,
  };
}

/**
 * A `cme_years` row plus its `cme_requirements` rows -> `CmeRequirementSet`.
 *
 * Carries the year row's `id` alongside the `CmeRequirementSet` fields, even though
 * `CmeRequirementSet` itself has no id column: `insertCmeEntry` below takes a `yearId` it
 * has no other way to obtain, and `fetchOwnerCmeYear` is the one read this module offers
 * that resolves an owner+calendar-year pair to that row.
 */
function rowToCmeRequirementSet(
  yearRow: CmeYearRow,
  requirementRows: readonly CmeRequirementRow[],
): CmeRequirementSet & { readonly id: string } {
  return {
    id: yearRow.id,
    year: yearRow.year,
    confirmedOn: yearRow.confirmed_on,
    confirmedSource: yearRow.confirmed_source,
    totalHours: yearRow.total_hours,
    requirements: requirementRows
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(rowToCmeRequirement),
  };
}

/**
 * The owner's confirmed targets and requirements for one CPD year, or `null` when that
 * year has not been confirmed yet (no `cme_years` row exists for it).
 */
export async function fetchOwnerCmeYear(
  supabase: AdminClient,
  ownerId: string,
  year: number,
): Promise<(CmeRequirementSet & { readonly id: string }) | null> {
  if (!ownerId) throw new Error("A CME year was requested without an ownerId; refusing to run.");

  // The owner predicate rides the same chain as `.from()` on every read below.
  // `npm run check:owner-scope` is the gate that proves no query here can read another
  // owner's records; splitting the builder across a variable would defeat it.
  const { data: yearRow, error: yearError } = await supabase
    .from("cme_years")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("year", year)
    .maybeSingle();
  if (yearError) throw new Error(yearError.message);
  if (!yearRow) return null;

  const { data: requirementRows, error: requirementError } = await supabase
    .from("cme_requirements")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("year_id", yearRow.id)
    .order("sort_order", { ascending: true })
    .limit(CME_MAX_ENTRIES);
  if (requirementError) throw new Error(requirementError.message);

  return rowToCmeRequirementSet(yearRow, requirementRows ?? []);
}

/** Every logged entry for one owner's CPD year, most recent first. */
export async function fetchOwnerCmeEntries(
  supabase: AdminClient,
  ownerId: string,
  yearId: string,
): Promise<CmeEntry[]> {
  if (!ownerId) throw new Error("CME entries were requested without an ownerId; refusing to run.");

  // The owner predicate rides the same chain as `.from()`. `npm run check:owner-scope`
  // cannot prove it in any other form, and this is the single regression class this
  // tenancy design is exposed to.
  const { data, error } = await supabase
    .from("cme_entries")
    .select("*, cme_allocations(category, hours)")
    .eq("owner_id", ownerId)
    .eq("year_id", yearId)
    .order("activity_date", { ascending: false })
    .limit(CME_MAX_ENTRIES);
  if (error) throw new Error(error.message);

  return (data ?? []).map((entryRow) => {
    // Cast once, through the index-signature type, rather than a second direct cast from
    // the generated row type: the generated `Database` types carry no `Relationships` for
    // these tables yet (see `cme_entries`/`cme_allocations` in database.types.ts), so
    // supabase-js cannot resolve the joined `cme_allocations` embed's type and a second
    // direct cast on the original row type is rejected as insufficiently overlapping.
    const row = entryRow as Record<string, unknown>;
    const joinedAllocations = (row.cme_allocations as { category: string; hours: number }[] | undefined) ?? [];
    return rowToCmeEntry(
      row,
      joinedAllocations.map((allocation) => ({
        category: allocation.category as CmeCategory,
        hours: allocation.hours,
      })),
    );
  });
}

/**
 * Insert one CME entry and its allocations for an owner's CPD year, returning the entry as
 * stored.
 *
 * `entry.id` is expected to already be set by the caller (the same convention
 * `src/app/api/on-call/entries/route.ts` uses: generate the id with `randomUUID()` before
 * building the value, so the identity a caller writes is decided once, outside the
 * database). `cme_entries` and `cme_allocations` are two separate inserts — this client
 * has no cross-table transaction — so if the second insert fails, the just-written entry
 * row is deleted rather than left behind with zero allocations, which no reader of this
 * table may ever see.
 */
export async function insertCmeEntry(
  supabase: AdminClient,
  ownerId: string,
  yearId: string,
  entry: CmeEntry,
): Promise<CmeEntry> {
  if (!ownerId) throw new Error("A CME entry was submitted without an ownerId; refusing to run.");
  if (entry.allocations.length === 0) {
    throw new PublicApiError("A CME entry needs at least one category allocation.", 400);
  }
  const categories = entry.allocations.map((allocation) => allocation.category);
  if (new Set(categories).size !== categories.length) {
    throw new PublicApiError("A CME entry cannot allocate hours to the same category twice.", 400);
  }

  const row = cmeEntryToRow(entry, ownerId, yearId);
  // `id` and `owner_id` are spelled out again here (already the same values inside `row`,
  // set by `cmeEntryToRow`) so the row this owner creates carries an explicit,
  // statically-visible identity and owner stamp on the insert call itself — a write is
  // scoped by what it writes.
  const { data: entryRow, error: entryError } = await supabase
    .from("cme_entries")
    .insert({ ...row, id: entry.id, owner_id: ownerId })
    .select("*")
    .single();
  if (entryError) throw new Error(entryError.message);

  const allocationRows = entry.allocations.map((allocation) => ({
    owner_id: ownerId,
    entry_id: entryRow.id,
    category: allocation.category,
    hours: allocation.hours,
  }));
  const { data: insertedAllocations, error: allocationError } = await supabase
    .from("cme_allocations")
    .insert(allocationRows)
    .select("category, hours");
  if (allocationError) {
    // Best-effort clean-up so a failed second insert never leaves an entry with zero
    // allocations behind. If the clean-up itself fails, surface both errors together
    // rather than silently swallowing the delete failure.
    const { error: cleanupError } = await supabase
      .from("cme_entries")
      .delete()
      .eq("owner_id", ownerId)
      .eq("id", entryRow.id);
    if (cleanupError) {
      throw new Error(`${allocationError.message} (cleanup also failed: ${cleanupError.message})`);
    }
    throw new Error(allocationError.message);
  }

  return rowToCmeEntry(
    entryRow as Record<string, unknown>,
    (insertedAllocations ?? allocationRows).map((allocation) => ({
      category: allocation.category as CmeCategory,
      hours: allocation.hours,
    })),
  );
}

/**
 * Reject `routineId` / `documentId` that do not belong to this owner.
 *
 * Foreign keys only prove the target row exists somewhere. Without an owner
 * check, a caller who knows another owner's UUID can attach it and learn
 * whether it exists from success versus failure — an existence oracle on an
 * otherwise owner-scoped record. Same closed message for missing and
 * cross-owner ids, matching `assertValidLinkedDocumentIds` for On Call.
 */
export async function assertValidCmeLinkedIds(
  supabase: AdminClient,
  ownerId: string,
  links: { readonly routineId: string | null; readonly documentId: string | null },
): Promise<void> {
  if (!ownerId) throw new Error("CME linked ids were checked without an ownerId; refusing to run.");

  if (links.documentId) {
    const { data, error } = await supabase
      .from("documents")
      .select("id")
      .eq("id", links.documentId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      throw new PublicApiError("Invalid linked document ID: the document does not exist.", 400);
    }
  }

  if (links.routineId) {
    const { data, error } = await supabase
      .from("cme_routines")
      .select("id")
      .eq("id", links.routineId)
      .eq("owner_id", ownerId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
      throw new PublicApiError("Invalid linked routine ID: the routine does not exist.", 400);
    }
  }
}

/**
 * Stamp `transcribed_at` after a successful clipboard copy. Never clears an
 * already-transcribed entry — copying again refreshes the instant.
 */
export async function markCmeEntryTranscribed(
  supabase: AdminClient,
  ownerId: string,
  entryId: string,
): Promise<CmeEntry> {
  if (!ownerId) throw new Error("A CME entry was transcribed without an ownerId; refusing to run.");

  const { data: existing, error: existingError } = await supabase
    .from("cme_entries")
    .select("*, cme_allocations(category, hours)")
    .eq("id", entryId)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (existingError) throw new Error(existingError.message);
  if (!existing) throw new PublicApiError("CME entry not found.", 404, { code: "cme_entry_not_found" });

  const { data: updated, error: updateError } = await supabase
    .from("cme_entries")
    .update({ transcribed_at: new Date().toISOString() })
    .eq("id", entryId)
    .eq("owner_id", ownerId)
    .select("*, cme_allocations(category, hours)")
    .maybeSingle();
  if (updateError) throw new Error(updateError.message);
  if (!updated) throw new PublicApiError("CME entry not found.", 404, { code: "cme_entry_not_found" });

  const row = updated as Record<string, unknown>;
  const joined = (row.cme_allocations as { category: string; hours: number }[] | undefined) ?? [];
  return rowToCmeEntry(
    row,
    joined.map((allocation) => ({
      category: allocation.category as CmeCategory,
      hours: allocation.hours,
    })),
  );
}

/**
 * Replace one entry's allocations. Reads prior rows first and restores them if
 * the insert fails, so a rejected edit cannot leave the entry with zero
 * categories. Callers that then fail updating `cme_entries` should call
 * `restoreCmeAllocations` with the returned `prior` snapshot.
 */
export async function replaceCmeAllocations(
  supabase: AdminClient,
  ownerId: string,
  entryId: string,
  allocations: readonly CmeAllocation[],
): Promise<{ readonly written: CmeAllocation[]; readonly prior: CmeAllocation[] }> {
  if (!ownerId) throw new Error("CME allocations were replaced without an ownerId; refusing to run.");
  if (allocations.length === 0) {
    throw new PublicApiError("A CME entry needs at least one category allocation.", 400);
  }
  const categories = allocations.map((allocation) => allocation.category);
  if (new Set(categories).size !== categories.length) {
    throw new PublicApiError("A CME entry cannot allocate hours to the same category twice.", 400);
  }

  const { data: priorRows, error: priorError } = await supabase
    .from("cme_allocations")
    .select("category, hours")
    .eq("owner_id", ownerId)
    .eq("entry_id", entryId);
  if (priorError) throw new Error(priorError.message);
  const prior: CmeAllocation[] = (priorRows ?? []).map((row) => ({
    category: row.category as CmeCategory,
    hours: row.hours,
  }));

  const { error: deleteError } = await supabase
    .from("cme_allocations")
    .delete()
    .eq("owner_id", ownerId)
    .eq("entry_id", entryId);
  if (deleteError) throw new Error(deleteError.message);

  const allocationRows = allocations.map((allocation) => ({
    owner_id: ownerId,
    entry_id: entryId,
    category: allocation.category,
    hours: allocation.hours,
  }));
  const { data: insertedAllocations, error: insertError } = await supabase
    .from("cme_allocations")
    .insert(allocationRows)
    .select("category, hours");
  if (insertError) {
    if (prior.length > 0) {
      const { error: restoreError } = await supabase.from("cme_allocations").insert(
        prior.map((allocation) => ({
          owner_id: ownerId,
          entry_id: entryId,
          category: allocation.category,
          hours: allocation.hours,
        })),
      );
      if (restoreError) {
        throw new Error(
          `Allocation insert failed (${insertError.message}); restore also failed (${restoreError.message}).`,
        );
      }
    }
    throw new Error(insertError.message);
  }

  const written = (insertedAllocations ?? allocationRows).map((allocation) => ({
    category: allocation.category as CmeCategory,
    hours: allocation.hours,
  }));
  return { written, prior };
}

/** Re-insert a prior allocation snapshot after a later step in the same PATCH failed. */
export async function restoreCmeAllocations(
  supabase: AdminClient,
  ownerId: string,
  entryId: string,
  prior: readonly CmeAllocation[],
): Promise<void> {
  const { error: deleteError } = await supabase
    .from("cme_allocations")
    .delete()
    .eq("owner_id", ownerId)
    .eq("entry_id", entryId);
  if (deleteError) throw new Error(deleteError.message);
  if (prior.length === 0) return;
  const { error: insertError } = await supabase.from("cme_allocations").insert(
    prior.map((allocation) => ({
      owner_id: ownerId,
      entry_id: entryId,
      category: allocation.category,
      hours: allocation.hours,
    })),
  );
  if (insertError) throw new Error(insertError.message);
}
