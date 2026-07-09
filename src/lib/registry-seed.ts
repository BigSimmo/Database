import { formRecords } from "@/lib/forms";
import { buildDefaultFormRows, buildDefaultServiceRows, defaultServiceRecords } from "@/lib/registry-fixtures";
import { bestEffortEmbedRows, embedClinicalRegistryRows } from "@/lib/registry-corpus";
import { type RegistryRecordInsert, type RegistryRecordKind, type RegistryRecordRow } from "@/lib/registry-records";

// Type-only reference to the admin client so this module carries no runtime
// dependency on the Supabase admin singleton — the CLI can import the row
// builders without pulling in service-role env, and callers pass their own
// client into `ensureRegistrySeeded`.
type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

/** The curated default registry fixtures for a kind — the same set the CLI
 *  seeds and the API falls back to when an owner has no records yet. */
export function defaultRegistryRecords(kind: RegistryRecordKind) {
  return kind === "form" ? formRecords : defaultServiceRecords();
}

/** Build insertable rows for an owner from the default fixtures. Shared by the
 *  CLI (`scripts/seed-registry-records.ts`) and the lazy API auto-seed so both
 *  map fixtures → rows identically. */
export function buildDefaultRegistryRows(ownerId: string, kind: RegistryRecordKind): RegistryRecordInsert[] {
  return kind === "form" ? buildDefaultFormRows(ownerId) : buildDefaultServiceRows(ownerId);
}

/**
 * Idempotently seed the curated default registry records for an owner + kind
 * and return the stored rows. Called lazily by the registry API when an
 * authenticated owner has no records yet, so new accounts get populated
 * Services/Forms instead of the empty state. Safe under concurrent first
 * requests — the (owner_id, kind, slug) conflict target dedupes the upsert.
 *
 * First-seed helper only: it does NOT preserve post-seed governance edits, so
 * the reseed path (the CLI) layers its own preservation on top.
 */
export async function ensureRegistrySeeded(
  supabase: AdminClient,
  ownerId: string,
  kind: RegistryRecordKind,
): Promise<RegistryRecordRow[]> {
  const rows = buildDefaultRegistryRows(ownerId, kind);
  const { data, error } = await supabase
    .from("clinical_registry_records")
    .upsert(rows, { onConflict: "owner_id,kind,slug" })
    .select("*");
  if (error) throw new Error(`Registry seed failed: ${error.message}`);
  const seededRows = (data ?? []) as RegistryRecordRow[];
  await bestEffortEmbedRows({
    scope: "registry",
    ownerId,
    detail: `(${kind})`,
    embed: () => embedClinicalRegistryRows(supabase, seededRows),
  });
  return seededRows;
}

/**
 * Fetch an owner's registry rows for a kind, lazily seeding the curated
 * defaults on the first visit (the registry API's long-standing behaviour,
 * extracted so /api/registry/records and universal search share one code
 * path). The seed write is best-effort; the re-read is not, so a genuine
 * read failure still surfaces instead of a misleading empty registry.
 */
export async function fetchOwnerRegistryRowsWithSeed(
  supabase: AdminClient,
  ownerId: string,
  kind: RegistryRecordKind,
  maxRecords = 500,
): Promise<RegistryRecordRow[]> {
  const fetchRecords = async () => {
    const { data, error } = await supabase
      .from("clinical_registry_records")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("kind", kind)
      .order("title")
      .limit(maxRecords);
    if (error) throw new Error(error.message);
    return (data ?? []) as RegistryRecordRow[];
  };

  let rows = await fetchRecords();
  if (rows.length === 0) {
    try {
      await ensureRegistrySeeded(supabase, ownerId, kind);
    } catch (seedError) {
      console.error(`[registry] auto-seed failed for owner ${ownerId} (${kind})`, seedError);
    }
    rows = await fetchRecords();
  }
  return rows;
}
