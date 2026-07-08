import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { env, isDemoMode } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function allowDeepHealthProbe(request: Request): boolean {
  const secret = env.HEALTH_DEEP_PROBE_SECRET;
  if (!secret) return false;
  const token = request.headers.get("x-health-deep-token");
  if (!token) return false;
  if (token.length !== secret.length) return false;
  const expected = Buffer.from(secret, "utf8");
  const received = Buffer.from(token, "utf8");
  return timingSafeEqual(expected, received);
}

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
