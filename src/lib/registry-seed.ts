import { formRecords } from "@/lib/forms";
import { buildDefaultFormRows, buildDefaultServiceRows, defaultServiceRecords } from "@/lib/registry-fixtures";
import {
  deriveGovernanceColumns,
  normalizeRegistrySlug,
  rowGovernance,
  rowToServiceRecord,
  type RegistryRecordInsert,
  type RegistryRecordKind,
  type RegistryRecordRow,
} from "@/lib/registry-records";
import type { ServiceRecord } from "@/lib/services";

// Type-only reference to the admin client so this module carries no runtime
// dependency on the Supabase admin singleton — the CLI can import the row
// builders without pulling in service-role env, and callers pass their own
// client into `ensureRegistrySeeded`.
type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

function loadRegistryCorpus() {
  return import("@/lib/registry-corpus");
}

/** The curated shared registry fixtures for a kind — the same baseline the CLI
 *  can materialize and every API caller receives automatically. */
export function defaultRegistryRecords(kind: RegistryRecordKind) {
  return kind === "form" ? formRecords : defaultServiceRecords();
}

/** Build insertable rows for an owner from the shared fixtures. Used by
 *  explicit operator seeding; GET requests do not materialize catalogue rows. */
export function buildDefaultRegistryRows(ownerId: string, kind: RegistryRecordKind): RegistryRecordInsert[] {
  return kind === "form" ? buildDefaultFormRows(ownerId) : buildDefaultServiceRows(ownerId);
}

/**
 * Merge private owner records over the reviewed shared catalogue. The bundled
 * catalogue is the baseline product content and is therefore available to
 * every caller; owner rows are optional overrides/additions, never a gate on
 * seeing the baseline. This avoids copying the same catalogue into every new
 * account while preserving existing owner-specific edits.
 */
export function mergeRegistryRecordsWithDefaults(
  kind: RegistryRecordKind,
  ownerRows: RegistryRecordRow[],
): ServiceRecord[] {
  const defaults = defaultRegistryRecords(kind);
  const ownerRecords = ownerRows.map(rowToServiceRecord);
  const ownerBySlug = new Map(ownerRecords.map((record) => [normalizeRegistrySlug(record.slug), record] as const));
  const defaultSlugs = new Set(defaults.map((record) => normalizeRegistrySlug(record.slug)));
  const merged = defaults.map((record) => {
    const ownerRecord = ownerBySlug.get(normalizeRegistrySlug(record.slug));
    if (!ownerRecord) return record;
    // Database nulls become undefined in rowToServiceRecord. They should not
    // erase reviewed baseline fields for every viewer; explicit arrays and
    // strings still override normally.
    const definedOwnerRecord = Object.fromEntries(
      Object.entries(ownerRecord).filter(([, value]) => value !== undefined),
    ) as Partial<ServiceRecord>;
    return {
      ...record,
      ...definedOwnerRecord,
      catalogPayload: {
        ...(record.catalogPayload ?? {}),
        ...(ownerRecord.catalogPayload ?? {}),
      },
    };
  });
  const ownerAdditions = ownerRecords
    .filter((record) => !defaultSlugs.has(normalizeRegistrySlug(record.slug)))
    .sort((left, right) => left.title.localeCompare(right.title));
  return [...merged, ...ownerAdditions];
}

export function mergeRegistryGovernanceWithDefaults(kind: RegistryRecordKind, ownerRows: RegistryRecordRow[]) {
  const governance: Record<string, ReturnType<typeof rowGovernance>> = Object.fromEntries(
    defaultRegistryRecords(kind).map((record) => {
      const derived = deriveGovernanceColumns(record);
      return [
        normalizeRegistrySlug(record.slug),
        {
          sourceStatus: derived.source_status,
          validationStatus: derived.validation_status,
          lastReviewedAt: null,
          reviewDueAt: null,
        },
      ];
    }),
  );
  for (const row of ownerRows) governance[normalizeRegistrySlug(row.slug)] = rowGovernance(row);
  return governance;
}

/**
 * Idempotently seed the curated default registry records for an owner + kind
 * and return the stored rows. This is an explicit operator/maintenance action;
 * normal reads merge the shared fixtures in-memory and perform no seed write.
 * Safe under concurrent requests — the (owner_id, kind, slug) conflict target
 * dedupes the upsert.
 *
 * Missing-fixture helper: conflicts are ignored so a catalogue expansion can
 * add newly published forms without overwriting owner edits or reviewed
 * governance on records already present.
 */
export async function ensureRegistrySeeded(
  supabase: AdminClient,
  ownerId: string,
  kind: RegistryRecordKind,
): Promise<RegistryRecordRow[]> {
  const rows = buildDefaultRegistryRows(ownerId, kind);
  const { data, error } = await supabase
    .from("clinical_registry_records")
    .upsert(rows, { onConflict: "owner_id,kind,slug", ignoreDuplicates: true })
    .select("*");
  if (error) throw new Error(`Registry seed failed: ${error.message}`);
  const seededRows = (data ?? []) as RegistryRecordRow[];
  const { bestEffortSyncClinicalRegistryRows } = await loadRegistryCorpus();
  await bestEffortSyncClinicalRegistryRows(supabase, seededRows);
  return seededRows;
}

/**
 * Fetch only an owner's private registry overrides/additions. Shared catalogue
 * defaults are merged by callers and are never materialized as a side effect
 * of a GET request.
 */
export async function fetchOwnerRegistryRows(
  supabase: AdminClient,
  ownerId: string,
  kind: RegistryRecordKind,
  maxRecords = 500,
): Promise<RegistryRecordRow[]> {
  const { data, error } = await supabase
    .from("clinical_registry_records")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("kind", kind)
    .order("title")
    .limit(maxRecords);
  if (error) throw new Error(error.message);
  return (data ?? []) as RegistryRecordRow[];
}
