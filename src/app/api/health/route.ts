import { NextResponse } from "next/server";
import { env, isDemoMode } from "@/lib/env";
import { allowDeepHealthProbe } from "@/lib/deep-probe-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const deep = new URL(request.url).searchParams.get("deep") === "1";
  const supabaseConfigured = Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);

  const checks: Record<string, "ok" | "missing" | "error" | "skipped" | "unauthorized"> = {
    supabaseConfig: supabaseConfigured ? "ok" : "missing",
    openaiConfig: env.OPENAI_API_KEY ? "ok" : "missing",
  };

  if (deep) {
    if (!allowDeepHealthProbe(request)) {
      checks.supabase = "unauthorized";
    } else if (supabaseConfigured && !isDemoMode()) {
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

  const ready = !Object.values(checks).some(
    (value) => value === "missing" || value === "error" || value === "unauthorized",
  );

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
