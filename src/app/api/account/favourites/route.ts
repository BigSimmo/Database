import { z } from "zod";

import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

const mutationSchema = z
  .object({
    contentType: z.enum(["service", "form", "differential"]),
    contentKey: z.string().trim().min(1).max(180),
    saved: z.boolean(),
  })
  .strict();

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data, error } = await supabase
      .from("user_favourites")
      .select("content_type,content_key,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return Response.json(
      {
        favourites: (data ?? []).map((row) => ({
          contentType: row.content_type,
          contentKey: row.content_key,
          createdAt: row.created_at,
        })),
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
    const input = await parseJsonBody(request, mutationSchema, "Saved-item request is invalid.");

    if (input.saved) {
      const { error } = await supabase
        .from("user_favourites")
        .upsert(
          { user_id: user.id, content_type: input.contentType, content_key: input.contentKey },
          { onConflict: "user_id,content_type,content_key", ignoreDuplicates: true },
        );
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("user_favourites")
        .delete()
        .eq("user_id", user.id)
        .eq("content_type", input.contentType)
        .eq("content_key", input.contentKey);
      if (error) throw new Error(error.message);
    }

    return Response.json({ saved: input.saved });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { error } = await supabase.from("user_favourites").delete().eq("user_id", user.id);
    if (error) throw new Error(error.message);
    return Response.json({ cleared: true });
  } catch (error) {
    return jsonError(error);
  }
}
