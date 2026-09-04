import {
  onCallDetailsSchemaFor,
  onCallEntrySchema,
  type OnCallEntry,
  type OnCallSection,
} from "@/lib/on-call/entry-model";

export const ON_CALL_MAX_ENTRIES = 1000;

type AdminClient = ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>;

const ROW_COLUMNS =
  "id, section, slug, title, subtitle, body, details, linked_document_ids, tags, is_personal, include_on_card, sort_order, last_verified_at";

export function rowToOnCallEntry(row: Record<string, unknown>): OnCallEntry & { details: unknown } {
  const base = onCallEntrySchema.parse({
    id: row.id,
    section: row.section,
    slug: row.slug,
    title: row.title,
    // The database column permits an empty string. Normalize whitespace-only
    // or empty subtitles to null so one blank subtitle does not reject the
    // entire list fetch.
    subtitle: typeof row.subtitle === "string" && row.subtitle.trim() === "" ? null : (row.subtitle ?? null),
    body: row.body ?? null,
    details: row.details ?? {},
    linkedDocumentIds: row.linked_document_ids ?? [],
    tags: row.tags ?? [],
    isPersonal: row.is_personal ?? false,
    includeOnCard: row.include_on_card ?? false,
    sortOrder: row.sort_order ?? 0,
    lastVerifiedAt: (row.last_verified_at as string | null) ?? null,
  });
  // A row whose details do not match its section is shown without them rather
  // than with a half-parsed shape a renderer would have to guess at.
  const parsed = onCallDetailsSchemaFor(base.section).safeParse(base.details);
  return { ...base, details: parsed.success ? parsed.data : null };
}

export function onCallEntryToRow(entry: OnCallEntry, ownerId: string) {
  return {
    owner_id: ownerId,
    section: entry.section,
    slug: entry.slug,
    title: entry.title,
    subtitle: entry.subtitle,
    body: entry.body,
    details: entry.details ?? {},
    linked_document_ids: entry.linkedDocumentIds,
    tags: entry.tags,
    is_personal: entry.isPersonal,
    include_on_card: entry.includeOnCard,
    sort_order: entry.sortOrder,
    last_verified_at: entry.lastVerifiedAt,
  };
}

export async function fetchOwnerOnCallEntries(
  supabase: AdminClient,
  ownerId: string,
  options: { section?: OnCallSection } = {},
) {
  if (!ownerId) {
    throw new Error("On Call entries were requested without an ownerId; refusing to run.");
  }
  let query = supabase.from("on_call_entries").select(ROW_COLUMNS).eq("owner_id", ownerId);
  if (options.section) query = query.eq("section", options.section);
  const { data, error } = await query.order("sort_order").limit(ON_CALL_MAX_ENTRIES);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToOnCallEntry(row as Record<string, unknown>));
}
