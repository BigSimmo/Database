import { NextResponse } from "next/server";
import { demoDocuments } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (isDemoMode()) {
      return NextResponse.json({ documents: demoDocuments, demoMode: true });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return NextResponse.json({ documents: data ?? [] });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Missing server environment")) {
      return NextResponse.json({
        documents: demoDocuments,
        demoMode: true,
        error: error.message,
      });
    }
    return jsonError(error);
  }
}
