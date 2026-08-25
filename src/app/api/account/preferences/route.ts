import { z } from "zod";

import { mergeAccountPreferences, normalizePreferences } from "@/lib/account-preferences";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

const preferencesPatchSchema = z
  .object({
    density: z.enum(["comfortable", "compact", "spacious"]),
    motion: z.enum(["system", "reduced", "full"]),
    jurisdiction: z.enum(["wa", "nsw", "vic", "qld", "sa", "tas", "act", "nt", "national"]),
    population: z.enum(["adults", "older-adults", "adolescents", "all"]),
    answerStyle: z.enum(["conservative", "balanced", "comprehensive"]),
    landing: z.enum(["ask", "search", "browse"]),
    showRecentOnHome: z.boolean(),
    showProtocolsOnHome: z.boolean(),
    compactCitations: z.boolean(),
    // Omitted keys are preserved from the stored account row on PUT — never
    // defaulted here, or a pre-change tab can overwrite a stored opt-out.
    saveRecentSearches: z.boolean(),
    notifyGuidelineUpdates: z.boolean(),
    notifyProductNews: z.boolean(),
    notifySavedChanges: z.boolean(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Account preferences must include at least one field.",
  });

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
    return Response.json({
      preferences: data ? normalizePreferences(data.preferences) : null,
      updatedAt: data?.updated_at,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const patch = await parseJsonBody(request, preferencesPatchSchema, "Account preferences are invalid.");
    const { data: existing, error: readError } = await supabase
      .from("user_preferences")
      .select("preferences")
      .eq("user_id", user.id)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    const preferences = mergeAccountPreferences(existing?.preferences ?? null, patch);
    const { error } = await supabase.from("user_preferences").upsert({
      user_id: user.id,
      preferences,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return Response.json({ preferences });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
