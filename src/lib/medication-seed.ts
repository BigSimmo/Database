import { buildDefaultMedicationRows, defaultMedicationRecords } from "@/lib/medication-fixtures";
import { type MedicationRecordInsert, type MedicationRecordRow } from "@/lib/medication-records";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

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
  return (data ?? []) as MedicationRecordRow[];
}

export { defaultMedicationRecords };
