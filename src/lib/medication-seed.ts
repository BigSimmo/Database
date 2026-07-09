import { buildDefaultMedicationRows, defaultMedicationRecords } from "@/lib/medication-fixtures";
import { type MedicationRecordInsert, type MedicationRecordRow } from "@/lib/medication-records";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

function loadRegistryCorpus() {
  return import("@/lib/registry-corpus");
}

export function buildMedicationSeedRows(ownerId: string): MedicationRecordInsert[] {
  return buildDefaultMedicationRows(ownerId);
}

export async function ensureMedicationsSeeded(supabase: AdminClient, ownerId: string): Promise<MedicationRecordRow[]> {
  const rows = buildMedicationSeedRows(ownerId);
  const { data, error } = await supabase
    .from("medication_records")
    .upsert(rows, { onConflict: "owner_id,slug" })
    .select("*");
  if (error) throw new Error(`Medication seed failed: ${error.message}`);
  const seededRows = (data ?? []) as MedicationRecordRow[];
  const { embedMedicationRows, registryCorpusEmbeddingEnabled } = await loadRegistryCorpus();
  if (registryCorpusEmbeddingEnabled()) {
    await embedMedicationRows(supabase, seededRows);
  }
  return seededRows;
}

export { defaultMedicationRecords };

/**
 * Fetch an owner's medication rows, lazily seeding the curated defaults on the
 * first visit (extracted from /api/medications so the route and universal
 * search share one code path). Seed write is best-effort; re-read is not.
 */
export async function fetchOwnerMedicationRowsWithSeed(
  supabase: AdminClient,
  ownerId: string,
  maxRecords = 500,
): Promise<MedicationRecordRow[]> {
  const fetchRecords = async () => {
    const { data, error } = await supabase
      .from("medication_records")
      .select("*")
      .eq("owner_id", ownerId)
      .order("name")
      .limit(maxRecords);
    if (error) throw new Error(error.message);
    return (data ?? []) as MedicationRecordRow[];
  };

  let rows = await fetchRecords();
  if (rows.length === 0) {
    try {
      await ensureMedicationsSeeded(supabase, ownerId);
    } catch (seedError) {
      console.error(`[medications] auto-seed failed for owner ${ownerId}`, seedError);
      const { registryCorpusEmbeddingEnabled } = await loadRegistryCorpus();
      if (registryCorpusEmbeddingEnabled()) throw seedError;
    }
    rows = await fetchRecords();
  }
  return rows;
}
