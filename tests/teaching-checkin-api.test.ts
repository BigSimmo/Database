import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn(), optionalAuth: vi.fn(), demo: vi.fn(), rate: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
vi.mock("@/lib/supabase/auth", () => {
  class AuthenticationError extends Error {}
  return {
    requireAuthenticatedUser: mocks.auth,
    resolveOptionalAuthentication: mocks.optionalAuth,
    AuthenticationError,
    unauthorizedResponse: () => Response.json({ message: "Sign in" }, { status: 401 }),
  };
});
vi.mock("@/lib/env", () => ({ isDemoMode: mocks.demo }));
vi.mock("@/lib/api-rate-limit", () => ({
  consumeSubjectApiRateLimit: mocks.rate,
  allowRateLimitInMemoryFallbackOnUnavailable: () => false,
  rateLimitJsonResponse: (message: string) => Response.json({ message, code: "rate_limited" }, { status: 429 }),
}));
vi.mock("@/lib/public-api-access", () => ({ anonymousApiSubjectKey: () => "anon:hospital-network" }));
vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { POST as complete } from "@/app/api/teaching/checkin/complete/route";
import { POST as open } from "@/app/api/teaching/checkin/open/route";
import { GET as display } from "@/app/api/teaching/display/[token]/route";
import { AuthenticationError } from "@/lib/supabase/auth";

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const actor = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const occurrenceId = "33333333-3333-4333-8333-333333333333";
const token = `${occurrenceId.replaceAll("-", "")}r59663201${"a".repeat(32)}`;
const opened = { occurrenceId, title: "Invented journal club", startsAt: "2026-09-30T04:30:00+00:00", stream: "room" };
const mark = { occurrenceId, serviceId, method: "code_room", recordedAt: "2026-09-30T04:35:00+00:00" };

function post(path: string, body: unknown, cookie?: string) {
  return new Request(`https://psychiatry.example${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

type SetCookie = { name: string; value: string; attributes: string[] };

function setCookieOf(response: Response): SetCookie | null {
  const header = response.headers.get("set-cookie");
  if (!header) return null;
  const [pair, ...attributes] = header.split(";").map((part) => part.trim());
  const separator = pair.indexOf("=");
  return {
    name: pair.slice(0, separator),
    value: pair.slice(separator + 1),
    attributes: attributes.map((attribute) => attribute.toLowerCase()),
  };
}

function pathOf(cookie: SetCookie): string {
  return cookie.attributes.find((attribute) => attribute.startsWith("path="))?.slice("path=".length) ?? "/";
}

/** RFC 6265 §5.1.4: does a browser send a cookie with this Path to this request path? */
function browserSends(cookiePath: string, requestPath: string): boolean {
  if (requestPath === cookiePath) return true;
  return requestPath.startsWith(cookiePath) && (cookiePath.endsWith("/") || requestPath[cookiePath.length] === "/");
}

/** A stand-in for the two check-in functions. A claim can be redeemed once. */
function fakeDatabase() {
  const claims = new Set<string>();
  mocks.rpc.mockImplementation(async (name: string, args: Record<string, unknown>) => {
    if (name === "teaching_checkin_open") {
      claims.add(String(args.p_claim_hash));
      return { data: { ...opened, occurrenceSecret: "leak" }, error: null };
    }
    if (name === "teaching_command" && args.p_action === "checkin.complete") {
      const { claimHash } = args.p_payload as { claimHash: string };
      return claims.delete(claimHash)
        ? { data: mark, error: null }
        : { data: null, error: { message: "teaching_code_expired" } };
    }
    return { data: null, error: { message: "unexpected call", code: "XX000" } };
  });
}

async function scan(): Promise<SetCookie> {
  const response = await open(post("/api/teaching/checkin/open", { token }));
  expect(response.status).toBe(200);
  const cookie = setCookieOf(response);
  if (!cookie) throw new Error("the scan left no claim cookie");
  return cookie;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.demo.mockReturnValue(false);
  mocks.optionalAuth.mockResolvedValue({ status: "absent" });
  mocks.auth.mockResolvedValue({ id: actor });
  mocks.rate.mockResolvedValue({ limited: false });
  fakeDatabase();
});

describe("scan, sign in, checked in (review focus 1)", () => {
  it("leaves a claim cookie that the complete route will actually receive, and checks the doctor in", async () => {
    const response = await open(post("/api/teaching/checkin/open", { token }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.json()).toEqual(opened);

    const cookie = setCookieOf(response);
    if (!cookie) throw new Error("the scan left no claim cookie");
    expect(cookie.name).toBe("ps_teaching_claim");
    expect(cookie.value).toMatch(/^[0-9a-f]{64}$/);
    expect(cookie.attributes).toEqual(expect.arrayContaining(["httponly", "secure", "samesite=lax", "max-age=600"]));
    expect(browserSends(pathOf(cookie), "/api/teaching/checkin/complete")).toBe(true);
    // The contract's first draft said `/teaching`: a browser would never send that cookie here.
    expect(browserSends("/teaching", "/api/teaching/checkin/complete")).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith("teaching_checkin_open", {
      p_token: token,
      p_claim_hash: sha256(cookie.value),
    });

    const done = await complete(post("/api/teaching/checkin/complete", {}, `${cookie.name}=${cookie.value}`));
    expect(done.status).toBe(200);
    expect(await done.json()).toEqual(mark);
    expect(mocks.rpc).toHaveBeenLastCalledWith("teaching_command", {
      p_actor_id: actor,
      p_service_id: null,
      p_action: "checkin.complete",
      p_payload: { claimHash: sha256(cookie.value) },
    });
    const cleared = setCookieOf(done);
    expect(cleared?.value).toBe("");
    expect(cleared?.attributes).toContain("max-age=0");
    expect(cleared ? pathOf(cleared) : null).toBe(pathOf(cookie));
  });

  it("checks in once per claim, and says to scan again after that", async () => {
    const cookie = await scan();
    await complete(post("/api/teaching/checkin/complete", {}, `${cookie.name}=${cookie.value}`));
    const again = await complete(post("/api/teaching/checkin/complete", {}, `${cookie.name}=${cookie.value}`));
    expect(again.status).toBe(410);
    expect(await again.json()).toMatchObject({ message: "The code changed. Scan the screen again." });
    expect(setCookieOf(again)?.attributes).toContain("max-age=0");
  });

  it("keeps the claim while the doctor is still signed out", async () => {
    const cookie = await scan();
    mocks.auth.mockRejectedValue(new AuthenticationError());
    const response = await complete(post("/api/teaching/checkin/complete", {}, `${cookie.name}=${cookie.value}`));
    expect(response.status).toBe(401);
    expect(setCookieOf(response)).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("says to scan again when the sign-in link was opened in another browser", async () => {
    const response = await complete(post("/api/teaching/checkin/complete", {}));
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({
      message: "Scan the screen again to check in.",
      code: "teaching_claim_missing",
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("keeps the claim for a retry when the server fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "connection reset", code: "XX000" } });
    const response = await complete(post("/api/teaching/checkin/complete", {}, `ps_teaching_claim=${"b".repeat(64)}`));
    expect(response.status).toBe(503);
    expect(setCookieOf(response)).toBeNull();
  });

  it("treats a stale sign-in as signed out rather than refusing the scan", async () => {
    mocks.optionalAuth.mockResolvedValue({ status: "invalid" });
    await scan();
    expect(mocks.rate).toHaveBeenCalledWith(
      expect.objectContaining({ subject: { kind: "anonymous", subjectKey: "anon:hospital-network" } }),
    );
  });

  it("sets no cookie when the scanned code has already changed", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "teaching_code_expired" } });
    const response = await open(post("/api/teaching/checkin/open", { token }));
    expect(response.status).toBe(410);
    expect(setCookieOf(response)).toBeNull();
  });
});

describe("a whole room scanning at once (review focus 4)", () => {
  it("charges a signed-in doctor's scan to their own allowance, not the network's", async () => {
    mocks.optionalAuth.mockResolvedValue({ status: "valid", user: { id: actor } });
    await scan();
    expect(mocks.rate).toHaveBeenCalledWith(
      expect.objectContaining({ subject: { kind: "owner", ownerId: actor }, bucket: "teaching" }),
    );
  });

  it("charges signed-out scans to the network's scan allowance and stops cleanly when it runs out", async () => {
    mocks.rate.mockResolvedValue({ limited: true, retryAfterSeconds: 30 });
    const response = await open(post("/api/teaching/checkin/open", { token }));
    expect(response.status).toBe(429);
    expect(mocks.rate).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: { kind: "anonymous", subjectKey: "anon:hospital-network" },
        bucket: "teaching_code",
      }),
    );
    expect(setCookieOf(response)).toBeNull();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses an unreadable scan before the rate limiter or the database", async () => {
    const response = await open(post("/api/teaching/checkin/open", { token: "not-a-check-in-code" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ message: "This code can't be read. Scan the screen again." });
    expect(mocks.rate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("offers no check-in in demo mode", async () => {
    mocks.demo.mockReturnValue(true);
    expect((await open(post("/api/teaching/checkin/open", { token }))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("GET /api/teaching/display/[token]", () => {
  const secret = "c".repeat(64);
  const code = {
    token,
    typedCode: "123456",
    window: 59663201,
    title: "Invented journal club",
    venue: null,
    closesAt: "2026-09-30T05:45:00+00:00",
  };

  it("shows the current code by the link's hash only, never cached, indexed or passed on", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...code, occurrenceSecret: "leak" }, error: null });
    const response = await display(new Request(`https://psychiatry.example/api/teaching/display/${secret}`), {
      params: Promise.resolve({ token: secret }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(code);
    expect(mocks.rpc).toHaveBeenCalledWith("teaching_display_code", { p_link_hash: sha256(secret) });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(mocks.rate).toHaveBeenCalledWith(expect.objectContaining({ bucket: "teaching_code" }));
  });

  it("answers a malformed link with a plain 404 before the database", async () => {
    const response = await display(new Request("https://psychiatry.example/api/teaching/display/abc"), {
      params: Promise.resolve({ token: "abc" }),
    });
    expect(response.status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("says when a display link has expired", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "teaching_link_expired" } });
    const response = await display(new Request(`https://psychiatry.example/api/teaching/display/${secret}`), {
      params: Promise.resolve({ token: secret }),
    });
    expect(response.status).toBe(410);
    expect(await response.json()).toMatchObject({
      message: "This display link has expired. Open a new one from the session page.",
    });
  });
});
