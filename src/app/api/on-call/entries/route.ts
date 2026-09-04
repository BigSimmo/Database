import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import {
  ON_CALL_SECTIONS,
  onCallDetailsSchemaFor,
  onCallEntrySchema,
  type OnCallSection,
} from "@/lib/on-call/entry-model";
import { fetchOwnerOnCallEntries, onCallEntryToRow, rowToOnCallEntry } from "@/lib/on-call/repository";
import { publicAccessContext } from "@/lib/public-api-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";
import { parseRequestQuery } from "@/lib/validation/query";

export const runtime = "nodejs";

const onCallListQuerySchema = z.object({
  section: z.enum(ON_CALL_SECTIONS).optional(),
});

// A create body has no id — the server generates one. Validate everything else against the
// full entry contract, and validate `details` separately below because its shape depends on
// the section the caller chose.
const createOnCallEntrySchema = onCallEntrySchema.omit({ id: true });

/**
 * Obviously synthetic, non-clinical fixture entries shown only in demo mode. No real hospital
 * name, phone number, or clinical content — demo mode never reaches Supabase for this mode.
 */
const DEMO_ON_CALL_ENTRIES: readonly z.infer<typeof onCallEntrySchema>[] = [
  {
    id: "00000000-0000-4000-8000-000000000001",
    section: "contacts",
    slug: "demo-switchboard",
    title: "Demo Hospital Switchboard",
    subtitle: "Example entry shown in demo mode",
    body: null,
    details: { role: "Switchboard operator", phone: "0000 000 000" },
    linkedDocumentIds: [],
    tags: ["demo"],
    isPersonal: false,
    includeOnCard: true,
    sortOrder: 0,
    lastVerifiedAt: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000002",
    section: "orientation",
    slug: "demo-orientation-note",
    title: "Demo Orientation Note",
    subtitle: "Example entry shown in demo mode",
    body: "Placeholder orientation text shown only in demo mode.",
    details: { pinnedSummaryIsOwnerNote: true },
    linkedDocumentIds: [],
    tags: ["demo"],
    isPersonal: false,
    includeOnCard: false,
    sortOrder: 1,
    lastVerifiedAt: null,
  },
];

function demoOnCallEntries(section: OnCallSection | undefined) {
  return section ? DEMO_ON_CALL_ENTRIES.filter((entry) => entry.section === section) : DEMO_ON_CALL_ENTRIES;
}

export async function GET(request: Request) {
  try {
    const { section } = parseRequestQuery(request, onCallListQuerySchema, "Invalid On Call query.");

    if (isDemoMode()) {
      return NextResponse.json({ entries: demoOnCallEntries(section), signedOut: false, demoMode: true });
    }

    // Anonymous callers still resolve access + rate limit, matching the registry route: every
    // caller (authenticated or not) passes the limiter before we do anything else. The database
    // is never touched below this point when the caller has no owner id.
    const supabase = createAdminClient();
    const access = await publicAccessContext(request, supabase);

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: access.rateLimitSubject,
      bucket: "on_call",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("On Call requests are rate limited. Try again shortly.", rateLimit);
    }

    if (!access.ownerId) {
      return NextResponse.json({ entries: [], signedOut: true });
    }

    const entries = await fetchOwnerOnCallEntries(supabase, access.ownerId, { section });
    return NextResponse.json({ entries, signedOut: false });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (isDemoMode()) {
      return publicErrorResponse("On Call entries cannot be created in demo mode.", 400, {
        code: "demo_mode_unavailable",
      });
    }

    const supabase = createAdminClient();
    // The owner comes from the validated session only — never from the request body or a
    // query string.
    const user = await requireAuthenticatedUser(request, supabase);

    const rateLimit = await consumeSubjectApiRateLimit({
      supabase,
      subject: { kind: "owner", ownerId: user.id },
      bucket: "on_call",
      allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
    });
    if (rateLimit.limited) {
      return rateLimitJsonResponse("On Call requests are rate limited. Try again shortly.", rateLimit);
    }

    // Read the raw (size-bounded) body first, then validate it against the entry contract and,
    // separately, its section-specific `details` shape — so a failure of either can report its
    // own Zod issues instead of one opaque "invalid body" message.
    const rawBody = await parseJsonBody(request, z.unknown(), "Invalid request body.");
    const parsedEntry = createOnCallEntrySchema.safeParse(rawBody);
    if (!parsedEntry.success) {
      return NextResponse.json({ error: "Invalid On Call entry.", issues: parsedEntry.error.issues }, { status: 400 });
    }
    const parsedDetails = onCallDetailsSchemaFor(parsedEntry.data.section).safeParse(parsedEntry.data.details);
    if (!parsedDetails.success) {
      return NextResponse.json(
        { error: "Invalid On Call entry details.", issues: parsedDetails.error.issues },
        { status: 400 },
      );
    }

    const entry = onCallEntrySchema.parse({
      ...parsedEntry.data,
      id: randomUUID(),
      details: parsedDetails.data,
    });
    const row = onCallEntryToRow(entry, user.id);

    // `owner_id` is spelled out again here (it is already the same value inside `row`, set by
    // onCallEntryToRow) so the row this owner creates carries an explicit, statically-visible
    // owner stamp on the insert call itself.
    const { data, error } = await supabase
      .from("on_call_entries")
      .insert({ ...row, owner_id: user.id })
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    return NextResponse.json({ entry: rowToOnCallEntry(data as Record<string, unknown>) }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error);
  }
}
