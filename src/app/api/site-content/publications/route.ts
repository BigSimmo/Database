import { NextResponse } from "next/server";
import { z } from "zod";

import { jsonError } from "@/lib/http";
import { publishSiteContentCommand } from "@/lib/site-content/site-content-publication";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUserContext, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const commandSchema = z
  .object({
    action: z.enum(["publish", "retire"]),
    kind: z.enum(["service", "form", "medication", "differential", "presentation"]),
    sourceRowId: z.uuid(),
    expectedSourceVersion: z.string().trim().min(1).max(128),
    expectedChangeEpoch: z.string().regex(/^\d+$/),
    reconciliationPlanDigest: z
      .string()
      .regex(/^[0-9a-f]{64}$/)
      .optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const sourceSupabase = createAdminClient();
    const { publicationClient } = await requireAuthenticatedUserContext(request, sourceSupabase, {
      administrator: true,
    });
    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid site-content publication command." }, { status: 400 });
    }
    const parsed = commandSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid site-content publication command." }, { status: 400 });
    }
    const result = await publishSiteContentCommand({
      sourceSupabase: sourceSupabase as never,
      publicationSupabase: publicationClient as never,
      command: parsed.data,
    });
    if (result.outcome === "conflict") {
      return NextResponse.json(
        { error: "Site-content publication conflict or no-op." },
        { status: 409, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return NextResponse.json({ result }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
