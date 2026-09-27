import "server-only";

import { z } from "zod";

import type { CodeMeaning } from "@/lib/roster/import/grid";
import { SHIFT_KINDS, type ShiftKind } from "@/lib/roster/shift-kind";

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

/**
 * Roster's own remembered settings: which row on an imported roster is the
 * doctor, what each workplace's shift codes mean, and whether Roster shifts
 * are added to the doctor's private calendar link.
 *
 * These live at `user_preferences.preferences.roster`, a key of the same row
 * `/api/account/preferences` reads and writes, but that route never reads or
 * writes this key: `useAppPreferences` copies its whole response into the
 * phone's local storage, and a roster (workplaces, shift codes, which row is
 * the doctor) must never sit there. `/api/roster/settings` is the only route
 * that touches this key, and every reminder is decided elsewhere: this file
 * only knows the calendar switch, never the reminder settings themselves
 * (`@/lib/reminders/settings-model`), which already live safely in
 * `preferences.reminders`.
 */

export const ROSTER_SETTINGS_MAX_WORKPLACES = 10;
export const ROSTER_SETTINGS_MAX_CODES_PER_WORKPLACE = 60;
export const ROSTER_SETTINGS_CODE_KEY_MAX = 12;
export const ROSTER_SETTINGS_ROW_NAME_MAX = 80;
/** A workplace key: the same limit as an import's own workplace name. */
const ROSTER_SETTINGS_WORKPLACE_KEY_MAX = 80;

/** What one shift code means for this doctor at one workplace; shared with the import reader. */
export type { CodeMeaning };

export type RosterSettings = {
  /** Off by default: Roster shifts reach the calendar link only once the doctor turns this on. */
  readonly calendarShifts: boolean;
  /** The row the doctor chose on their last import, remembered so it need not be asked again. */
  readonly rowName: string | null;
  /** Keyed by workplace ("" for an import with no workplace), then by the code as it appears on the roster. */
  readonly codes: Readonly<Record<string, Readonly<Record<string, CodeMeaning>>>>;
};

export type RosterSettingsPatch = Partial<RosterSettings>;

export const DEFAULT_ROSTER_SETTINGS: RosterSettings = { calendarShifts: false, rowName: null, codes: {} };

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected an HH:MM time.");

const codeMeaningSchema = z.union([
  z.object({ kind: z.literal("off") }).strict(),
  z.object({ kind: z.enum(SHIFT_KINDS), start: timeSchema, end: timeSchema }).strict(),
]);

const codeKeySchema = z.string().trim().min(1).max(ROSTER_SETTINGS_CODE_KEY_MAX);
const workplaceKeySchema = z.string().max(ROSTER_SETTINGS_WORKPLACE_KEY_MAX);

const codesForWorkplaceSchema = z
  .record(codeKeySchema, codeMeaningSchema)
  .refine((codes) => Object.keys(codes).length <= ROSTER_SETTINGS_MAX_CODES_PER_WORKPLACE, {
    message: `At most ${ROSTER_SETTINGS_MAX_CODES_PER_WORKPLACE} codes per workplace.`,
  });

const codesSchema = z
  .record(workplaceKeySchema, codesForWorkplaceSchema)
  .refine((codes) => Object.keys(codes).length <= ROSTER_SETTINGS_MAX_WORKPLACES, {
    message: `At most ${ROSTER_SETTINGS_MAX_WORKPLACES} workplaces.`,
  });

const rowNameSchema = z.string().trim().min(1).max(ROSTER_SETTINGS_ROW_NAME_MAX).nullable();

/** What a PUT may send: any of the three fields, each a whole replacement. Unknown keys are refused. */
export const rosterSettingsPatchSchema = z
  .object({ calendarShifts: z.boolean(), rowName: rowNameSchema, codes: codesSchema })
  .partial()
  .strict();

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Any stored value, including garbage, becomes a complete and valid settings object. */
export function normalizeRosterSettings(input: unknown): RosterSettings {
  if (!isPlainObject(input)) return DEFAULT_ROSTER_SETTINGS;
  const calendarShifts =
    typeof input.calendarShifts === "boolean" ? input.calendarShifts : DEFAULT_ROSTER_SETTINGS.calendarShifts;
  const rowNameParsed = rowNameSchema.safeParse(input.rowName ?? null);
  const codesParsed = codesSchema.safeParse(input.codes ?? {});
  return {
    calendarShifts,
    rowName: rowNameParsed.success ? rowNameParsed.data : DEFAULT_ROSTER_SETTINGS.rowName,
    codes: codesParsed.success ? codesParsed.data : DEFAULT_ROSTER_SETTINGS.codes,
  };
}

function requireOwner(ownerId: string) {
  if (!ownerId) throw new Error("Missing settings owner.");
}

/** The owner's Roster settings, read from their own preferences row only. Used by the calendar feed too. */
export async function fetchRosterSettings(supabase: AdminClient, ownerId: string): Promise<RosterSettings> {
  requireOwner(ownerId);
  const { data, error } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  const preferences = data?.preferences as { roster?: unknown } | null | undefined;
  return normalizeRosterSettings(preferences?.roster);
}

const MAX_WRITE_ATTEMPTS = 3;

function nextUpdatedAt(previous: string | null): string {
  const previousTime = previous ? Date.parse(previous) : Number.NaN;
  const minimumTime = Number.isFinite(previousTime) ? previousTime + 1 : 0;
  return new Date(Math.max(Date.now(), minimumTime)).toISOString();
}

/**
 * Apply a patch and persist it, touching only the `roster` key of the stored
 * preferences JSON: every other key on that row (account preferences,
 * reminders) is carried through byte-for-byte. Optimistic on `updated_at`,
 * the same compare-and-swap the account preferences route uses, because both
 * routes write the same underlying row.
 */
export async function writeRosterSettings(
  supabase: AdminClient,
  ownerId: string,
  patch: RosterSettingsPatch,
): Promise<RosterSettings> {
  requireOwner(ownerId);
  for (let attempt = 0; attempt < MAX_WRITE_ATTEMPTS; attempt += 1) {
    const { data: existing, error: readError } = await supabase
      .from("user_preferences")
      .select("preferences,updated_at")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (readError) throw readError;

    const rawPreferences = isPlainObject(existing?.preferences) ? existing.preferences : {};
    const current = normalizeRosterSettings(rawPreferences.roster);
    const merged = normalizeRosterSettings({ ...current, ...patch });
    const nextPreferences = { ...rawPreferences, roster: merged };
    const updatedAt = nextUpdatedAt(existing?.updated_at ?? null);

    if (!existing) {
      const { error: insertError } = await supabase
        .from("user_preferences")
        .insert({ user_id: ownerId, preferences: nextPreferences, updated_at: updatedAt });
      if (!insertError) return merged;
      if (insertError.code === "23505") continue;
      throw insertError;
    }

    const { data: updated, error: updateError } = await supabase
      .from("user_preferences")
      .update({ preferences: nextPreferences, updated_at: updatedAt })
      .eq("user_id", ownerId)
      .eq("updated_at", existing.updated_at)
      .select("updated_at")
      .maybeSingle();
    if (updateError) throw updateError;
    if (updated) return merged;
  }
  throw new Error("Roster settings changed too frequently. Please retry.");
}
