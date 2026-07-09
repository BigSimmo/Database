import { buildDefaultDifferentialRows } from "@/lib/differential-fixtures";
import { type DifferentialRecordInsert, type DifferentialRecordRow } from "@/lib/differential-records";
import { bestEffortEmbedRows, embedDifferentialRows } from "@/lib/registry-corpus";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

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
  await bestEffortEmbedRows({
    scope: "differentials",
    ownerId,
    embed: () => embedDifferentialRows(supabase, seededRows),
  });
  return seededRows;
}

export function buildDifferentialSeedRows(ownerId: string): DifferentialRecordInsert[] {
  return buildDefaultDifferentialRows(ownerId);
}
