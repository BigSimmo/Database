import "server-only";

import type { Json } from "@/lib/supabase/database.types";
import { diffRoster } from "@/lib/on-call/shifts/diff";
import {
  onCallShiftChangeSchema,
  type OnCallShift,
  type OnCallShiftImportRequest,
  type OnCallShiftImportSummary,
} from "@/lib/on-call/shifts/model";
import { addDaysToDate, perthWallToIso } from "@/lib/on-call/shifts/perth-time";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

/**
 * Reads and writes for My shifts. Every query here filters by `owner_id`, and
 * the owner always comes from the validated session in the route, never from
 * the request body: a doctor's roster is theirs alone.
 */

const SHIFT_COLUMNS = "id,starts_at,ends_at,title,location,source_uid";
const IMPORT_COLUMNS = "id,imported_at,format,window_start,window_end,added,changed,removed,changes,seen_at";

type ShiftRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  title: string;
  location: string | null;
  source_uid: string | null;
};

type ImportRow = {
  id: string;
  imported_at: string;
  format: string;
  window_start: string;
  window_end: string;
  added: number;
  changed: number;
  removed: number;
  changes: Json;
  seen_at: string | null;
};

function rowToShift(row: ShiftRow): OnCallShift {
  return {
    id: row.id,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    title: row.title,
    location: row.location,
    sourceUid: row.source_uid,
  };
}

function rowToImport(row: ImportRow): OnCallShiftImportSummary {
  const changes = Array.isArray(row.changes)
    ? row.changes.flatMap((change) => {
        const parsed = onCallShiftChangeSchema.safeParse(change);
        return parsed.success ? [parsed.data] : [];
      })
    : [];
  return {
    id: row.id,
    importedAt: row.imported_at,
    format: row.format === "csv" ? "csv" : "ics",
    windowStart: row.window_start,
    windowEnd: row.window_end,
    added: row.added,
    changed: row.changed,
    removed: row.removed,
    changes,
    seenAt: row.seen_at,
  };
}

function requireOwner(ownerId: string) {
  if (!ownerId) throw new Error("Missing shift owner.");
}

/** Shifts that have not finished before `from`, soonest first. */
export async function fetchOwnerShifts(supabase: AdminClient, ownerId: string, from: Date): Promise<OnCallShift[]> {
  requireOwner(ownerId);
  const { data, error } = await supabase
    .from("on_call_shifts")
    .select(SHIFT_COLUMNS)
    .eq("owner_id", ownerId)
    .gt("ends_at", from.toISOString())
    .order("starts_at", { ascending: true })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map(rowToShift);
}

/** The owner's most recent import, or null if they have never imported. */
export async function fetchLatestShiftImport(
  supabase: AdminClient,
  ownerId: string,
): Promise<OnCallShiftImportSummary | null> {
  requireOwner(ownerId);
  const { data, error } = await supabase
    .from("on_call_shift_imports")
    .select(IMPORT_COLUMNS)
    .eq("owner_id", ownerId)
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToImport(data) : null;
}

async function fetchOwnerShiftsInWindow(
  supabase: AdminClient,
  ownerId: string,
  window: { start: string; end: string },
): Promise<OnCallShift[]> {
  const from = perthWallToIso(window.start, "00:00");
  const to = perthWallToIso(addDaysToDate(window.end, 1), "00:00");
  if (!from || !to) throw new Error("Invalid roster dates.");
  const { data, error } = await supabase
    .from("on_call_shifts")
    .select(SHIFT_COLUMNS)
    .eq("owner_id", ownerId)
    .gte("starts_at", from)
    .lt("starts_at", to)
    .limit(2000);
  if (error) throw error;
  return (data ?? []).map(rowToShift);
}

/**
 * Save a roster: replace the owner's shifts inside its dates and record what
 * changed, in one database transaction. The change list is worked out here,
 * from what is stored, never taken from the request.
 */
export async function replaceOwnerShifts(
  supabase: AdminClient,
  ownerId: string,
  request: OnCallShiftImportRequest,
): Promise<string> {
  requireOwner(ownerId);
  const window = { start: request.windowStart, end: request.windowEnd };
  const stored = await fetchOwnerShiftsInWindow(supabase, ownerId, window);
  const diff = diffRoster(stored, request.shifts, window);
  const { data, error } = await supabase.rpc("on_call_shifts_replace", {
    p_owner_id: ownerId,
    p_window_start: window.start,
    p_window_end: window.end,
    p_format: request.format,
    p_shifts: request.shifts as unknown as Json,
    p_changes: diff.changes as unknown as Json,
    p_added: diff.added,
    p_changed: diff.changed,
    p_removed: diff.removed,
  });
  if (error) throw error;
  return String(data);
}

export async function markShiftImportSeen(supabase: AdminClient, ownerId: string, importId: string): Promise<boolean> {
  requireOwner(ownerId);
  const { data, error } = await supabase
    .from("on_call_shift_imports")
    .update({ seen_at: new Date().toISOString() })
    .eq("owner_id", ownerId)
    .eq("id", importId)
    .select("id");
  if (error) throw error;
  return (data ?? []).length > 0;
}

/** Delete every shift and import record the owner has. */
export async function deleteOwnerShifts(supabase: AdminClient, ownerId: string): Promise<void> {
  requireOwner(ownerId);
  const shifts = await supabase.from("on_call_shifts").delete().eq("owner_id", ownerId);
  if (shifts.error) throw shifts.error;
  const imports = await supabase.from("on_call_shift_imports").delete().eq("owner_id", ownerId);
  if (imports.error) throw imports.error;
}
