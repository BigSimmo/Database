import "server-only";

import { rowToCmeDraft, type CmeDraft, type CmeDraftPayload, type CmeDraftWaitingOn } from "@/lib/cme/drafts";
import { CME_MAX_ENTRIES, cmeRepositoryError } from "@/lib/cme/repository";
import type { Database, Json } from "@/lib/supabase/database.types";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;
type CmeDraftUpdateRow = Database["public"]["Tables"]["cme_entry_drafts"]["Update"];

const DRAFT_COLUMNS = "id, payload, waiting_on, waiting_note, follow_up_on, created_at, updated_at";

/**
 * Owner-scoped CRUD for `cme_entry_drafts`. Every query carries the owner
 * predicate on the same chain as `.from()` (`npm run check:owner-scope`), the
 * same discipline `plan-goals-repository.ts` follows.
 */

export async function fetchOwnerCmeDrafts(supabase: AdminClient, ownerId: string): Promise<CmeDraft[]> {
  if (!ownerId) throw new Error("Missing CME owner.");
  const { data, error } = await supabase
    .from("cme_entry_drafts")
    .select(DRAFT_COLUMNS)
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(CME_MAX_ENTRIES);
  if (error) throw cmeRepositoryError(error);
  return (data ?? []).map(rowToCmeDraft);
}

export async function fetchOwnerCmeDraft(supabase: AdminClient, ownerId: string, id: string): Promise<CmeDraft | null> {
  if (!ownerId) throw new Error("Missing CME owner.");
  const { data, error } = await supabase
    .from("cme_entry_drafts")
    .select(DRAFT_COLUMNS)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw cmeRepositoryError(error);
  return data ? rowToCmeDraft(data) : null;
}

export async function createOwnerCmeDraft(
  supabase: AdminClient,
  ownerId: string,
  payload: CmeDraftPayload,
  waiting: Omit<CmeDraftPatch, "payload"> = {},
): Promise<CmeDraft> {
  if (!ownerId) throw new Error("Missing CME owner.");
  const { data, error } = await supabase
    .from("cme_entry_drafts")
    .insert({
      owner_id: ownerId,
      payload: payload as unknown as Json,
      waiting_on: waiting.waitingOn ?? null,
      waiting_note: waiting.waitingNote ?? null,
      follow_up_on: waiting.followUpOn ?? null,
    })
    .select(DRAFT_COLUMNS)
    .single();
  if (error) throw cmeRepositoryError(error);
  return rowToCmeDraft(data);
}

export type CmeDraftPatch = {
  payload?: CmeDraftPayload;
  waitingOn?: CmeDraftWaitingOn | null;
  waitingNote?: string | null;
  followUpOn?: string | null;
};

/** Returns `null` when the draft does not exist (or is not this owner's) — never throws for that. */
export async function updateOwnerCmeDraft(
  supabase: AdminClient,
  ownerId: string,
  id: string,
  patch: CmeDraftPatch,
): Promise<CmeDraft | null> {
  if (!ownerId) throw new Error("Missing CME owner.");
  const update: CmeDraftUpdateRow = {};
  if (patch.payload !== undefined) update.payload = patch.payload as unknown as Json;
  if (patch.waitingOn !== undefined) update.waiting_on = patch.waitingOn;
  if (patch.waitingNote !== undefined) update.waiting_note = patch.waitingNote;
  if (patch.followUpOn !== undefined) update.follow_up_on = patch.followUpOn;
  if (Object.keys(update).length === 0) return fetchOwnerCmeDraft(supabase, ownerId, id);
  const { data, error } = await supabase
    .from("cme_entry_drafts")
    .update(update)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select(DRAFT_COLUMNS)
    .maybeSingle();
  if (error) throw cmeRepositoryError(error);
  return data ? rowToCmeDraft(data) : null;
}

/** Deleting a draft that does not exist (or is already gone) is a no-op, not an error. */
export async function deleteOwnerCmeDraft(supabase: AdminClient, ownerId: string, id: string): Promise<void> {
  if (!ownerId) throw new Error("Missing CME owner.");
  const { error } = await supabase.from("cme_entry_drafts").delete().eq("id", id).eq("owner_id", ownerId);
  if (error) throw cmeRepositoryError(error);
}
