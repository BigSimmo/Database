import { z } from "zod";

import { normalizePreferences } from "@/lib/account-preferences";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

const preferencesSchema = z
  .object({
    density: z.enum(["comfortable", "compact", "spacious"]),
    motion: z.enum(["system", "reduced"]),
    jurisdiction: z.enum(["wa", "nsw", "vic", "qld", "sa", "tas", "act", "nt", "national"]),
    population: z.enum(["adults", "older-adults", "adolescents", "all"]),
    answerStyle: z.enum(["conservative", "balanced", "comprehensive"]),
    landing: z.enum(["ask", "search", "browse"]),
    showRecentOnHome: z.boolean(),
    showProtocolsOnHome: z.boolean(),
    compactCitations: z.boolean(),
    notifyGuidelineUpdates: z.boolean(),
    notifyProductNews: z.boolean(),
    notifySavedChanges: z.boolean(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data, error } = await supabase
      .from("user_preferences")
      .select("preferences,updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return Response.json(
      {
        preferences: data ? normalizePreferences(data.preferences) : null,
        updatedAt: data?.updated_at,
      },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const preferences = await parseJsonBody(request, preferencesSchema, "Account preferences are invalid.");
    const { error } = await supabase.from("user_preferences").upsert({
      user_id: user.id,
      preferences,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return Response.json(
      { preferences },
      {
        headers: {
          "Cache-Control": "private, no-store",
        },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
