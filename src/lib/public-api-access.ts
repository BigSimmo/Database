import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalAuthenticatedUser } from "@/lib/supabase/auth";

type AdminClient = ReturnType<typeof createAdminClient>;

export type RateLimitSubject = { kind: "owner"; ownerId: string } | { kind: "anonymous"; subjectKey: string };

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

function requestIpSignal(request: Request) {
  return (
    firstForwardedIp(request.headers.get("cf-connecting-ip")) ||
    firstForwardedIp(request.headers.get("x-forwarded-for")) ||
    firstForwardedIp(request.headers.get("x-real-ip")) ||
    "unknown-ip"
  );
}

export function anonymousApiSubjectKey(request: Request) {
  const userAgent = request.headers.get("user-agent")?.slice(0, 180) || "unknown-agent";
  const source = `${requestIpSignal(request)}\n${userAgent}`;
  return `anon:${createHash("sha256").update(source).digest("hex").slice(0, 32)}`;
}

export async function publicAccessContext(request: Request, supabase: AdminClient) {
  const user = await getOptionalAuthenticatedUser(request, supabase);
  if (user) {
    return {
      authenticated: true,
      ownerId: user.id,
      rateLimitSubject: { kind: "owner", ownerId: user.id } satisfies RateLimitSubject,
    };
  }

  return {
    authenticated: false,
    ownerId: undefined,
    rateLimitSubject: { kind: "anonymous", subjectKey: anonymousApiSubjectKey(request) } satisfies RateLimitSubject,
  };
}
