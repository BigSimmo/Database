import { NextResponse } from "next/server";

import {
  allowRateLimitInMemoryFallbackOnUnavailable,
  consumeSubjectApiRateLimit,
  rateLimitJsonResponse,
} from "@/lib/api-rate-limit";
import { isDemoMode } from "@/lib/env";
import { jsonError, publicErrorResponse } from "@/lib/http";
import {
  ON_CALL_DEMO_ENTRY_COUNT,
  ON_CALL_DEMO_SLUGS,
  ON_CALL_DEMO_SLUGS_BY_SECTION,
} from "@/lib/on-call/demo-content-identity";
import { DEMO_ON_CALL_ENTRIES } from "@/lib/on-call/demo-entries";
import { onCallEntryToRow } from "@/lib/on-call/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

/**
 * Load the example On Call corpus into the caller's own account, and take it
 * out again.
 *
 * ## Why this exists
 *
 * On Call ships empty, because every row in it — a ward extension, an
 * escalation ladder, a leave form — is the owner's own information and the app
 * cannot know any of it. That is correct, and it left one real gap: there was
 * no way to see what a filled hub looks like without filling it, and no way to
 * fill it except one row at a time through the editor. Ninety-four taps on a
 * phone is not an evaluation path.
 *
 * The demo corpus already exists and is already held to a standard that makes
 * it safe to render — `tests/on-call-demo-entries.test.ts` enforces that every
 * number is an all-zero placeholder, that no row states a clinical fact, and
 * that every link is `example.org`. This route is the only thing that was
 * missing: a way to put it somewhere a real signed-in reader can walk through
 * it on a real device.
 *
 * ## What it is not
 *
 * It is not a seed, a fixture loader, or a migration. It writes ordinary rows
 * owned by the caller, through the same `onCallEntryToRow` every hand-typed
 * entry goes through, so the compliance privacy stamp applies here exactly as
 * it does there. Nothing about these rows is special except that `DELETE` knows
 * their names.
 *
 * ## The visibility consequence, stated here because the code is where it binds
 *
 * `fetchSharedOnCallEntries` selects `is_personal = false` across EVERY owner,
 * with no owner filter — that is the 2026-09-04 owner decision that lets a
 * covering doctor read ward numbers without an account. It means the
 * non-personal rows loaded here are readable by an anonymous visitor to the
 * site for as long as they are loaded. Of the corpus, the Access folder and
 * every Compliance requirement are personal and stay private; the rest do not
 * and do not.
 *
 * That is a property of the data, not of this route, and it is deliberately NOT
 * papered over by forcing `is_personal` on the way in. Forcing it would hide
 * the shared/private distinction, which is one of the things a reader loads
 * this corpus to look at — every row would wear a "Private" pill and the
 * page-level scope notes would fire everywhere, so the thing on screen would no
 * longer be the design. The honest handling is to say so at the control that
 * triggers it, which `OnCallDemoContentControl` does, and to make removal one
 * request.
 */

/**
 * The same grouping `DELETE` walks, indexed for lookup. Derived from that one
 * export rather than rebuilt, so the count and the delete cannot come to
 * disagree about which (section, slug) pairs are the loader's.
 */
const DEMO_SLUGS_BY_SECTION = new Map(
  ON_CALL_DEMO_SLUGS_BY_SECTION.map(([section, slugs]) => [section, new Set(slugs)] as const),
);

function demoModeRefusal() {
  // Demo mode already serves this corpus from memory and never reaches
  // Supabase for this mode, so there is nothing to load it into. Mirrors the
  // guard on `POST /api/on-call/entries`.
  return publicErrorResponse(
    "Example content cannot be loaded in demo mode — it is already what you are seeing.",
    400,
    {
      code: "demo_mode_unavailable",
    },
  );
}

async function limit(supabase: ReturnType<typeof createAdminClient>, ownerId: string) {
  return consumeSubjectApiRateLimit({
    supabase,
    subject: { kind: "owner", ownerId },
    bucket: "on_call",
    allowInMemoryFallbackOnUnavailable: allowRateLimitInMemoryFallbackOnUnavailable(),
  });
}

/** How much of the corpus is currently in this owner's account. */
export async function GET(request: Request) {
  try {
    if (isDemoMode()) return NextResponse.json({ loaded: 0, total: ON_CALL_DEMO_ENTRY_COUNT, demoMode: true });

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);

    // Narrow in the database on slug, then count on the PAIR, for the reason
    // spelled out over `DELETE`: (owner_id, section, slug) is the unique key, so
    // slug alone is half of it. Counting on the half would report an owner's own
    // row as loaded example content whenever it shares a slug with an example
    // row filed under a different section. Here that would only inflate a
    // number, but the same mistake one handler down deletes the wrong row, and
    // the two should not disagree about what an example row is.
    const { data, error } = await supabase
      .from("on_call_entries")
      .select("section, slug")
      .eq("owner_id", user.id)
      .in("slug", ON_CALL_DEMO_SLUGS);
    if (error) throw new Error(error.message);

    const loaded = (data ?? []).filter((row) => DEMO_SLUGS_BY_SECTION.get(row.section)?.has(row.slug)).length;

    return NextResponse.json({ loaded, total: ON_CALL_DEMO_ENTRY_COUNT });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    if (isDemoMode()) return demoModeRefusal();

    const supabase = createAdminClient();
    // The owner comes from the validated session only. There is no request body
    // at all here: the corpus is the payload, so nothing a caller sends can
    // choose what gets written or whose account it lands in.
    const user = await requireAuthenticatedUser(request, supabase);

    const rateLimit = await limit(supabase, user.id);
    if (rateLimit.limited) {
      return rateLimitJsonResponse("On Call requests are rate limited. Try again shortly.", rateLimit);
    }

    // Refuse if another account already holds the corpus.
    //
    // The conflict key below is (owner_id, section, slug), so a second account
    // does not collide with the first — it gets its own ninety-four rows. That
    // would be harmless if these rows were private, and they are not:
    // `fetchSharedOnCallEntries` returns every non-personal row across EVERY
    // account, and `fetchVisibleOnCallEntries` merges by row id, which differs
    // per copy. So a second load puts a second, undeduplicated copy of the
    // example corpus on the page of every reader of this site, signed in or
    // not — and repeated loads walk toward the ON_CALL_MAX_ENTRIES cap on the
    // shared read, where they would start crowding out real entries.
    //
    // A refusal rather than a silent merge, because the person who can undo it
    // is the account that loaded it: only that owner's DELETE can remove their
    // own rows.
    const { data: foreign, error: foreignError } = await supabase
      .from("on_call_entries")
      .select("owner_id")
      .neq("owner_id", user.id)
      .eq("is_personal", false)
      .in("slug", ON_CALL_DEMO_SLUGS)
      .limit(1);
    if (foreignError) throw new Error(foreignError.message);
    if ((foreign ?? []).length > 0) {
      return publicErrorResponse(
        "Example content is already loaded by another account on this site, and it is visible to everyone. That account needs to remove it first.",
        409,
        { code: "demo_content_loaded_elsewhere" },
      );
    }

    // Through the same conversion every hand-typed entry uses, so the
    // compliance privacy stamp is applied here by the same line of code rather
    // than by a copy of it. `onCallEntryToRow` emits no `id`, so Postgres
    // generates one per owner and the corpus's own fixed ids stay where they
    // belong — in the fixture.
    const rows = DEMO_ON_CALL_ENTRIES.map((entry) => ({ ...onCallEntryToRow(entry, user.id), owner_id: user.id }));

    // Upsert on the table's own unique key, so loading twice is loading once.
    // A row the owner has since edited is returned to its example state rather
    // than duplicated beside itself.
    const { data, error } = await supabase
      .from("on_call_entries")
      .upsert(rows, { onConflict: "owner_id,section,slug" })
      .select("id");
    if (error) throw new Error(error.message);

    return NextResponse.json({ loaded: data?.length ?? 0, total: ON_CALL_DEMO_ENTRY_COUNT }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    if (isDemoMode()) return demoModeRefusal();

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);

    const rateLimit = await limit(supabase, user.id);
    if (rateLimit.limited) {
      return rateLimitJsonResponse("On Call requests are rate limited. Try again shortly.", rateLimit);
    }

    // One delete per section, each scoped to that section's own slugs.
    //
    // The table's unique key is (owner_id, section, slug), so the PAIR is what
    // identifies a row and the pair is what this matches. A single
    // `.in("slug", ON_CALL_DEMO_SLUGS)` across all sections would be one query and is
    // deliberately not used: it deletes on half of a compound key, so an
    // owner's real row that happened to share a slug with a demo row in a
    // DIFFERENT section would be destroyed. Filtering the returned rows
    // afterwards does not help — by then the row is gone and the filter only
    // decides whether to admit it in the count.
    let removed = 0;
    for (const [section, slugs] of ON_CALL_DEMO_SLUGS_BY_SECTION) {
      const { data, error } = await supabase
        .from("on_call_entries")
        .delete()
        .eq("owner_id", user.id)
        .eq("section", section)
        .in("slug", [...slugs])
        .select("id");
      // A failure part-way through has already committed the sections before
      // it. Supabase's REST client gives no cross-statement transaction here,
      // so the honest handling is to report what actually happened rather than
      // to throw and let the client tell the reader "nothing was deleted" —
      // which would be false, and would leave them with a half-removed corpus
      // they have been told is intact. Pressing Remove again is safe and
      // finishes the job, because each delete is scoped to rows that still
      // match.
      if (error) {
        return NextResponse.json(
          {
            removed,
            total: ON_CALL_DEMO_ENTRY_COUNT,
            partial: true,
            error: `Removal stopped at the ${section} section: ${error.message}`,
          },
          { status: 500 },
        );
      }
      removed += data?.length ?? 0;
    }

    return NextResponse.json({ removed, total: ON_CALL_DEMO_ENTRY_COUNT });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
