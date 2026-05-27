import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (isDemoMode()) return NextResponse.json({ jobs: [], demoMode: true });

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const batchId = new URL(request.url).searchParams.get("batchId");

    let query = supabase
      .from("ingestion_jobs")
      .select("*, documents!inner(title,file_name,status,owner_id)")
      .eq("documents.owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (batchId) query = query.eq("batch_id", batchId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return NextResponse.json({ jobs: data ?? [] });
  } catch (error) {
    if (error instanceof AuthenticationError) return unauthorizedResponse();
    return jsonError(error);
  }
}
