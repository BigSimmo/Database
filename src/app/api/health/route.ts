import { NextResponse } from "next/server";
import { env, isDemoMode } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Liveness/readiness probe for load balancers and uptime monitors. It reports
// whether the server is configured to operate for real (Supabase + OpenAI present)
// and, with ?deep=1, whether Supabase is actually reachable. The payload exposes only
// boolean configuration presence and operational status — never secret values.
export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const supabaseConfigured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

  const checks: Record<string, "ok" | "missing" | "error" | "skipped"> = {
    supabaseConfig: supabaseConfigured ? "ok" : "missing",
    openaiConfig: env.OPENAI_API_KEY ? "ok" : "missing",
  };

  if (deep) {
    if (supabaseConfigured && !isDemoMode()) {
      try {
        const [{ createAdminClient }, { probeSupabaseHealth }] = await Promise.all([
          import("@/lib/supabase/admin"),
          import("@/lib/supabase/health"),
        ]);
        const health = await probeSupabaseHealth(createAdminClient());
        checks.supabase = health.ok ? "ok" : "error";
      } catch {
        checks.supabase = "error";
      }
    } else {
      checks.supabase = "skipped";
    }
  }

  const ready = !Object.values(checks).includes("missing") && !Object.values(checks).includes("error");

  return NextResponse.json(
    {
      status: ready ? "ok" : "degraded",
      demoMode: isDemoMode(),
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks,
    },
    { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
