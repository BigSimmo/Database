import { buildDefaultDifferentialRows } from "@/lib/differential-fixtures";
import { type DifferentialRecordInsert, type DifferentialRecordRow } from "@/lib/differential-records";

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
  return (data ?? []) as DifferentialRecordRow[];
}

export function buildDifferentialSeedRows(ownerId: string): DifferentialRecordInsert[] {
  return buildDefaultDifferentialRows(ownerId);
}
