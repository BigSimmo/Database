import { buildDefaultDifferentialRows } from "@/lib/differential-fixtures";
import { type DifferentialRecordInsert, type DifferentialRecordRow } from "@/lib/differential-records";
import { embedDifferentialRows, registryCorpusEmbeddingEnabled } from "@/lib/registry-corpus";

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
  if (registryCorpusEmbeddingEnabled()) {
    try {
      await embedDifferentialRows(supabase, seededRows);
    } catch (embedError) {
      console.error(`[differentials] corpus embedding failed for owner ${ownerId}`, embedError);
    }
  }
  return seededRows;
}

export function buildDifferentialSeedRows(ownerId: string): DifferentialRecordInsert[] {
  return buildDefaultDifferentialRows(ownerId);
}
