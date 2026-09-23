import "server-only";
import { PublicApiError } from "@/lib/http";
import { cmeEvidenceSchema } from "@/lib/cme/evidence-model";
import type { Database } from "@/lib/supabase/database.types";
import { z } from "zod";

type Client = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;
type EvidenceRow = Database["public"]["Tables"]["cme_evidence"]["Row"];

/** Only for a newly uploaded object proven to have no committed metadata. */
export async function cleanUnlinkedCmeEvidence(client: Client, ownerId: string, storagePath: string) {
  let removed = false;
  try {
    removed = !(await client.storage.from("cme-private-evidence").remove([storagePath])).error;
  } catch {
    /* queue compensation below */
  }
  if (removed) return;
  const { error } = await client.from("storage_cleanup_jobs").insert({
    owner_id: ownerId,
    document_bucket: "cme-private-evidence",
    document_paths: [storagePath],
    image_bucket: "cme-private-evidence",
    image_paths: [],
    status: "pending",
  });
  if (error)
    throw new PublicApiError("Evidence was not attached; an unlinked upload needs administrator cleanup.", 503);
}

export async function fetchCmeEvidenceCounts(
  client: Client,
  ownerId: string,
  year: number,
): Promise<Record<string, number>> {
  const { data, error } = await client.rpc("cme_evidence_counts", { p_owner_id: ownerId, p_year: year });
  if (error) throw new PublicApiError("Evidence counts could not be loaded. Try again.", 503);
  return z.record(z.string(), z.number().int().nonnegative()).parse(data);
}

export function evidenceFromRow(row: EvidenceRow) {
  return cmeEvidenceSchema.parse({
    id: row.id,
    entryId: row.entry_id,
    fileName: row.file_name,
    contentType: row.content_type,
    byteSize: row.byte_size,
    kind: row.kind,
    uploadedAt: row.uploaded_at,
  });
}

export async function assertEvidenceEntry(client: Client, ownerId: string, entryId: string, writable = false) {
  const { data: entry, error } = await client
    .from("cme_entries")
    .select("id,year_id,archived_at")
    .eq("owner_id", ownerId)
    .eq("id", entryId)
    .maybeSingle();
  if (error) throw new PublicApiError("Your activity could not be checked. Try again.", 503);
  if (!entry) throw new PublicApiError("Activity not found.", 404);
  if (writable) {
    const { data: year, error: yearError } = await client
      .from("cme_years")
      .select("closed_at")
      .eq("owner_id", ownerId)
      .eq("id", entry.year_id)
      .maybeSingle();
    if (yearError || !year) throw new PublicApiError("Your activity year could not be checked.", 503);
    if (entry.archived_at || year.closed_at)
      throw new PublicApiError("Restore the activity in an open year before adding evidence.", 409);
  }
  return entry;
}

export async function listCmeEvidence(client: Client, ownerId: string, entryId: string) {
  await assertEvidenceEntry(client, ownerId, entryId);
  const { data, error } = await client
    .from("cme_evidence")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("entry_id", entryId)
    .order("uploaded_at");
  if (error) throw new PublicApiError("Evidence could not be loaded. Try again.", 503);
  return (data ?? []).map(evidenceFromRow);
}
