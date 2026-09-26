import "server-only";

import { randomUUID } from "node:crypto";

import { CME_MAX_ENTRIES } from "@/lib/cme/repository";
import {
  rowToCmeMissedSession,
  type CmeMissedSession,
  type CmeMissedSessionCreateInput,
  type CmeMissedSessionUpdateInput,
} from "@/lib/cme/missed-sessions";
import { PublicApiError } from "@/lib/http";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

/**
 * Owner-scoped reads and writes for `cme_missed_sessions`. Every query carries
 * the owner predicate on the same chain as `.from()`
 * (`npm run check:owner-scope`), matching `plan-goals-repository.ts`.
 *
 * This table is never joined into, and never reads from, anywhere `evaluate.ts`,
 * year close, the export or the annual summary looks — a missed session must
 * never be able to change hours or a requirement's status.
 */

function missedSessionRepositoryError(error: { message: string; code?: string }): Error {
  // A replacement link to an entry the owner does not own (or that does not exist) fails the
  // composite foreign key `(replacement_entry_id, owner_id) -> cme_entries (id, owner_id)`.
  // Map that to a plain 4xx rather than letting it surface as a 500.
  if (error.code === "23503") {
    return new PublicApiError("The selected activity is unavailable to link as a replacement.", 400, {
      code: "cme_missed_session_invalid_replacement",
    });
  }
  return new Error(error.message);
}

/** Every missed session for one owner, most recently occurred first. */
export async function fetchOwnerCmeMissedSessions(supabase: AdminClient, ownerId: string): Promise<CmeMissedSession[]> {
  if (!ownerId) throw new Error("Missing CME owner.");
  const { data, error } = await supabase
    .from("cme_missed_sessions")
    .select("*")
    .eq("owner_id", ownerId)
    .order("occurred_on", { ascending: false })
    .limit(CME_MAX_ENTRIES);
  if (error) throw missedSessionRepositoryError(error);
  return (data ?? []).map(rowToCmeMissedSession);
}

export async function createOwnerCmeMissedSession(
  supabase: AdminClient,
  ownerId: string,
  input: CmeMissedSessionCreateInput,
): Promise<CmeMissedSession> {
  if (!ownerId) throw new Error("Missing CME owner.");
  const { data, error } = await supabase
    .from("cme_missed_sessions")
    .insert({
      id: randomUUID(),
      owner_id: ownerId,
      occurred_on: input.occurredOn,
      kind: input.kind,
      title: input.title,
      minutes_lost: input.minutesLost,
      reason: input.reason,
    })
    .select("*")
    .single();
  if (error) throw missedSessionRepositoryError(error);
  return rowToCmeMissedSession(data);
}

export async function updateOwnerCmeMissedSession(
  supabase: AdminClient,
  ownerId: string,
  id: string,
  input: CmeMissedSessionUpdateInput,
): Promise<CmeMissedSession> {
  if (!ownerId) throw new Error("Missing CME owner.");
  const { data, error } = await supabase
    .from("cme_missed_sessions")
    .update({
      occurred_on: input.occurredOn,
      kind: input.kind,
      title: input.title,
      minutes_lost: input.minutesLost,
      reason: input.reason,
    })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .maybeSingle();
  if (error) throw missedSessionRepositoryError(error);
  if (!data) throw new PublicApiError("Missed session not found.", 404, { code: "cme_missed_session_not_found" });
  return rowToCmeMissedSession(data);
}

/**
 * A missed session may only be linked to a live activity in an open year, the
 * same rule plan goals follow: an archived activity or a closed year is frozen.
 */
async function assertReplacementEntryLinkable(supabase: AdminClient, ownerId: string, entryId: string) {
  const entry = await supabase
    .from("cme_entries")
    .select("archived_at,year_id")
    .eq("owner_id", ownerId)
    .eq("id", entryId)
    .maybeSingle();
  if (entry.error) throw missedSessionRepositoryError(entry.error);
  if (!entry.data) {
    throw new PublicApiError("That activity could not be found.", 400, { code: "cme_replacement_not_found" });
  }
  if (entry.data.archived_at) {
    throw new PublicApiError("An archived activity cannot replace a missed session.", 400, {
      code: "cme_replacement_archived",
    });
  }
  const year = await supabase
    .from("cme_years")
    .select("closed_at")
    .eq("owner_id", ownerId)
    .eq("id", entry.data.year_id)
    .maybeSingle();
  if (year.error) throw missedSessionRepositoryError(year.error);
  if (year.data?.closed_at) {
    throw new PublicApiError("That activity is in a closed year, so it cannot be linked.", 400, {
      code: "cme_year_closed",
    });
  }
}

/** Set or clear the replacement link. `replacementEntryId: null` unlinks it. */
export async function setOwnerCmeMissedSessionReplacement(
  supabase: AdminClient,
  ownerId: string,
  id: string,
  replacementEntryId: string | null,
): Promise<CmeMissedSession> {
  if (!ownerId) throw new Error("Missing CME owner.");
  if (replacementEntryId) await assertReplacementEntryLinkable(supabase, ownerId, replacementEntryId);
  const { data, error } = await supabase
    .from("cme_missed_sessions")
    .update({ replacement_entry_id: replacementEntryId })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .maybeSingle();
  if (error) throw missedSessionRepositoryError(error);
  if (!data) throw new PublicApiError("Missed session not found.", 404, { code: "cme_missed_session_not_found" });
  return rowToCmeMissedSession(data);
}

export async function deleteOwnerCmeMissedSession(supabase: AdminClient, ownerId: string, id: string): Promise<void> {
  if (!ownerId) throw new Error("Missing CME owner.");
  const { data, error } = await supabase
    .from("cme_missed_sessions")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("id")
    .maybeSingle();
  if (error) throw missedSessionRepositoryError(error);
  if (!data) throw new PublicApiError("Missed session not found.", 404, { code: "cme_missed_session_not_found" });
}
