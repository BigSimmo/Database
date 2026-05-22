import { NextResponse } from "next/server";
import { demoDocuments } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ documents: demoDocuments, demoMode: true });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ documents: data ?? [] });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    if (error instanceof Error && error.message.includes("Missing server environment")) {
      return NextResponse.json({
        documents: demoDocuments,
        demoMode: true,
        error: "Server environment is not configured; demo data is being served.",
      });
    }
    return jsonError(error);
  }
}
