import { NextResponse } from "next/server";
import { demoJobs } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ jobs: demoJobs, demoMode: true });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const { data, error } = await supabase
      .from("ingestion_jobs")
      .select("*, documents!inner(title,file_name,status)")
      .eq("documents.owner_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);
    return NextResponse.json({ jobs: data ?? [] });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    if (error instanceof Error && error.message.includes("Missing server environment")) {
      return NextResponse.json({
        jobs: demoJobs,
        demoMode: true,
        error: "Server environment is not configured; demo jobs are being served.",
      });
    }
    return jsonError(error);
  }
}
