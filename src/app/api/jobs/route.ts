import { NextResponse } from "next/server";
import { demoJobs } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ jobs: demoJobs, demoMode: true });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("ingestion_jobs")
      .select("*, documents(title,file_name,status)")
      .order("created_at", { ascending: false })
      .limit(30);

    if (error) throw new Error(error.message);
    return NextResponse.json({ jobs: data ?? [] });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing server environment")) {
      return NextResponse.json({
        jobs: demoJobs,
        demoMode: true,
        error: error.message,
      });
    }
    return jsonError(error);
  }
}
