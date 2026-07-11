import {
  buildDefaultDifferentialRows,
  loadDifferentialSnapshot,
  usableDifferentialPresentations,
} from "@/lib/differential-fixtures";
import { type DifferentialRecordInsert, type DifferentialRecordRow } from "@/lib/differential-records";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

function loadRegistryCorpus() {
  return import("@/lib/registry-corpus");
}

export { loadDifferentialSnapshot } from "@/lib/differential-fixtures";

export async function ensureDifferentialsSeeded(
  supabase: AdminClient,
  ownerId: string,
): Promise<DifferentialRecordRow[]> {
  const rows = buildDefaultDifferentialRows(ownerId);
  const { data, error } = await supabase
    .from("differential_records")
    .upsert(rows, { onConflict: "owner_id,kind,slug" })
    .select("*");
  if (error) throw new Error(`Differential seed failed: ${error.message}`);
  const seededRows = (data ?? []) as DifferentialRecordRow[];
  const { embedDifferentialRows, registryCorpusEmbeddingEnabled } = await loadRegistryCorpus();
  if (registryCorpusEmbeddingEnabled()) {
    await embedDifferentialRows(supabase, seededRows);
  }
  return seededRows;
}

export function buildDifferentialSeedRows(ownerId: string): DifferentialRecordInsert[] {
  return buildDefaultDifferentialRows(ownerId);
}

/** Seeded presentation rows whose slug the current snapshot no longer produces
 *  (e.g. removed export artifacts such as "urgency-urgent"). Seeding upserts
 *  and never deletes, so these linger for already-seeded owners until pruned.
 *  Diagnoses are deliberately not pruned: their slugs merge and churn across
 *  snapshot versions, so set-difference pruning would be unsafe there. */
export function staleSeededPresentations<Row extends { kind: string; slug: string }>(rows: Row[]): Row[] {
  const validSlugs = new Set(
    usableDifferentialPresentations(loadDifferentialSnapshot()).map((presentation) => presentation.id),
  );
  return rows.filter((row) => row.kind === "presentation" && !validSlugs.has(row.slug));
}
