import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy, shouldBlockProductionMockups } from "../src/proxy";
import { env } from "@/lib/env";
import * as ssr from "@supabase/ssr";
import { vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

type ProxyCookieOptions = {
  cookies: {
    setAll: (
      cookiesToSet: Array<{ name: string; value: string; options: Record<string, never> }>,
      responseHeaders: Record<string, string>,
    ) => void;
  };
};

// The proxy owns the per-request nonce CSP (see src/proxy.ts). CI's verify:ui
// only exercises the *dev* CSP path (Turbopack keeps 'unsafe-inline'); these
// unit tests run under NODE_ENV=test, so buildContentSecurityPolicy takes its
// production branch — this is the only automated coverage of the strict,
// shipped nonce policy. With no Supabase env configured the proxy short-circuits
// on the "no auth cookie" path, which is exactly where the nonce/CSP wiring runs.

function requestFor(path = "/"): NextRequest {
  return new NextRequest(new URL(`http://localhost${path}`));
}

function scriptSrcOf(csp: string): string {
  const directive = csp.split(";").find((d) => d.trim().startsWith("script-src"));
  if (!directive) throw new Error(`no script-src in CSP: ${csp}`);
  return directive.trim();
}

describe("proxy content-security-policy", () => {
  it("allows dedicated document mockup source routes to render instead of redirecting them", async () => {
    for (const path of ["/mockups/document-search/source", "/mockups/document-search/source/evidence"]) {
      const response = await proxy(requestFor(path));
      expect(response.headers.get("location")).toBeNull();
    }
  });

  it("emits a per-request nonce with strict-dynamic and no unsafe-inline (production shape)", async () => {
    const res = await proxy(requestFor("/"));
    const csp = res.headers.get("content-security-policy");
    expect(csp).toBeTruthy();

    const scriptSrc = scriptSrcOf(csp!);
    expect(scriptSrc).toMatch(/'nonce-[A-Za-z0-9+/=_-]+'/);
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it("preserves the other CSP directives unchanged", async () => {
    const csp = (await proxy(requestFor("/"))).headers.get("content-security-policy")!;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("img-src 'self' data: blob: https://*.supabase.co;");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co https://*.ingest.sentry.io");
    // OpenAI calls are server-side only; the browser must not be allowed to
    // reach the provider origin (2026-07-13 audit, finding 12).
    expect(csp).not.toContain("api.openai.com");
    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("generates a fresh, unguessable nonce on every request", async () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const csp = (await proxy(requestFor("/"))).headers.get("content-security-policy")!;
      const nonce = csp.match(/'nonce-([^']+)'/)![1];
      expect(nonce.length).toBeGreaterThanOrEqual(16);
      nonces.add(nonce);
    }
    expect(nonces.size).toBe(5);
  });

  it("threads the same nonce into the SSR request headers (x-nonce)", async () => {
    const res = await proxy(requestFor("/"));
    const cspNonce = res.headers.get("content-security-policy")!.match(/'nonce-([^']+)'/)![1];

    // NextResponse.next({ request: { headers } }) forwards overridden request
    // headers back through the response via x-middleware-request-* so the SSR
    // render sees x-nonce. Assert the forwarded nonce matches the enforced CSP.
    const overridden = res.headers.get("x-middleware-override-headers") ?? "";
    expect(overridden).toContain("x-nonce");
    expect(res.headers.get("x-middleware-request-x-nonce")).toBe(cspNonce);
  });
});

describe("proxy auth session refresh", () => {
  it("propagates custom response headers during cookie setAll", async () => {
    const originalUrl = env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "mock-key";

    // Setup the mock to trigger setAll when getClaims is called
    vi.mocked(ssr.createServerClient).mockImplementationOnce((url, key, options) => {
      const proxyOptions = options as unknown as ProxyCookieOptions;
      return {
        auth: {
          getClaims: async () => {
            proxyOptions.cookies.setAll([{ name: "sb-mock", value: "token", options: {} }], {
              "x-custom-security": "enabled",
              "x-other-header": "value",
            });
          },
        },
      } as unknown as ReturnType<typeof ssr.createServerClient>;
    });

    const req = requestFor("/");
    req.cookies.set("sb-access-token", "present"); // satisfy hasAuthCookie

    try {
      const res = await proxy(req);
      expect(res.headers.get("x-custom-security")).toBe("enabled");
      expect(res.headers.get("x-other-header")).toBe("value");
      expect(res.cookies.get("sb-mock")?.value).toBe("token");
    } finally {
      env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey;
    }
  });
});

describe("production mockup boundary", () => {
  it("blocks ordinary production traffic and permits only the explicit isolated Playwright advisory profile", () => {
    expect(shouldBlockProductionMockups("/mockups/tools-workflow-board", { NODE_ENV: "production" })).toBe(true);
    expect(
      shouldBlockProductionMockups("/mockups/tools-workflow-board", {
        NODE_ENV: "production",
        PLAYWRIGHT_OFFLINE_MODE: "true",
      }),
    ).toBe(true);
    expect(
      shouldBlockProductionMockups("/mockups/tools-workflow-board", {
        NODE_ENV: "production",
        NEXT_PUBLIC_MOCKUPS_ENABLED: "true",
      }),
    ).toBe(true);
    expect(
      shouldBlockProductionMockups("/mockups/tools-workflow-board", {
        NODE_ENV: "production",
        PLAYWRIGHT_OFFLINE_MODE: "true",
        NEXT_PUBLIC_MOCKUPS_ENABLED: "true",
      }),
    ).toBe(false);
    expect(shouldBlockProductionMockups("/applications", { NODE_ENV: "production" })).toBe(false);
  });

  it("lets the Care Plan subtree reach its own developer gate, and keeps look-alike prefixes blocked", () => {
    // The gated prefix is exactly `/mockups/care-plan`. Its base, a patient deep
    // route and an episode deep route must reach DeveloperAreaGate rather than a
    // bare 404; every neighbouring path that merely begins with the same
    // characters stays behind the blanket production block.
    for (const path of [
      "/mockups/care-plan",
      "/mockups/care-plan/patients/SYN-PATIENT-001/management-plan",
      "/mockups/care-plan/patients/SYN-PATIENT-001/presentations/SYN-PRESENTATION-001",
    ]) {
      expect(shouldBlockProductionMockups(path, { NODE_ENV: "production" }), path).toBe(false);
    }
    for (const path of [
      "/mockups/care-plan-archive",
      "/mockups/care-plan-archive/patients/SYN-PATIENT-001",
      "/mockups/care-plans",
      "/mockups/care-plan-2024/system-states",
    ]) {
      expect(shouldBlockProductionMockups(path, { NODE_ENV: "production" }), path).toBe(true);
    }
  });

  it("lets the developer-gated hub and Caring Contact subtree through the blanket block, without opting in the flag", () => {
    // These two subtrees carry their own signed-in-administrator gate
    // (DeveloperAreaGate) instead of the flat 404 — no NEXT_PUBLIC_MOCKUPS_ENABLED
    // opt-in should be required, and no OTHER /mockups/** path should be affected.
    for (const path of [
      "/mockups/development",
      "/mockups/caring-contacts",
      "/mockups/caring-contacts/patients",
      "/mockups/caring-contacts/patients/abc-123",
    ]) {
      expect(shouldBlockProductionMockups(path, { NODE_ENV: "production" })).toBe(false);
    }
    // A path that merely starts with the same characters is not a prefix match.
    expect(shouldBlockProductionMockups("/mockups/development-notes", { NODE_ENV: "production" })).toBe(true);
    expect(shouldBlockProductionMockups("/mockups/caring-contacts-archive", { NODE_ENV: "production" })).toBe(true);
  });
});

describe("developer-area header (x-developer-area)", () => {
  it("sets the header only for the two developer-gated paths, and strips a client-supplied copy elsewhere", async () => {
    const developmentRequest = requestFor("/mockups/development");
    const developmentResponse = await proxy(developmentRequest);
    expect(developmentResponse.headers.get("x-middleware-request-x-developer-area")).toBe("1");
    expect(developmentResponse.headers.get("x-middleware-request-x-developer-area-path")).toBe("/mockups/development");

    const carePlanRequest = requestFor("/mockups/care-plan/patients/SYN-PATIENT-001/presentations");
    const carePlanResponse = await proxy(carePlanRequest);
    expect(carePlanResponse.headers.get("x-middleware-request-x-developer-area")).toBe("1");
    expect(carePlanResponse.headers.get("x-middleware-request-x-developer-area-path")).toBe(
      "/mockups/care-plan/patients/SYN-PATIENT-001/presentations",
    );

    const carePlanLookAlikeResponse = await proxy(requestFor("/mockups/care-plan-archive"));
    expect(carePlanLookAlikeResponse.headers.get("x-middleware-request-x-developer-area")).toBeNull();

    const otherMockupRequest = requestFor("/mockups/tools-workflow-board");
    otherMockupRequest.headers.set("x-developer-area", "1");
    otherMockupRequest.headers.set("x-developer-area-path", "/mockups/development");
    const otherMockupResponse = await proxy(otherMockupRequest);
    // Spoofed header must not survive into the forwarded request.
    expect(otherMockupResponse.headers.get("x-middleware-request-x-developer-area")).toBeNull();
    expect(otherMockupResponse.headers.get("x-middleware-request-x-developer-area-path")).toBeNull();
  });
});

describe("static compatibility redirects", () => {
  it("forwards retired constellation deep-links to the network destination", async () => {
    const response = await proxy(requestFor("/ward-management/constellation"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/ward-management/network");
  });
});

describe("document-source fallback redirects", () => {
  const demoId = "11111111-1111-4111-8111-111111111111";

  it("redirects /documents/source with a valid id as a single HTTP 307 carrying the CSP", async () => {
    const response = await proxy(requestFor(`/documents/source?id=${demoId}&page=2&chunk=safety%20plan`));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe(`/documents/${demoId}`);
    expect(location.searchParams.get("page")).toBe("2");
    expect(location.searchParams.get("chunk")).toBe("safety plan");
    expect(response.headers.get("content-security-policy")).toBeTruthy();
  });

  it("redirects the evidence alias with an invalid id to /documents/search with an empty query", async () => {
    const response = await proxy(requestFor("/documents/source/evidence?id=not-a-uuid&page=2"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/documents/search");
    expect(location.search).toBe("");
  });

  it("leaves the document reader route itself untouched", async () => {
    const response = await proxy(requestFor(`/documents/${demoId}?page=2`));
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("cross-site mutation blocking", () => {
  it("blocks cross-site POST requests to API routes with 403", async () => {
    const request = new NextRequest(new URL("http://localhost/api/documents"), {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    });
    const response = await proxy(request);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("cross_site_forbidden");
  });

  it("allows same-origin API mutations", async () => {
    const request = new NextRequest(new URL("http://localhost/api/documents"), {
      method: "POST",
      headers: { "sec-fetch-site": "same-origin" },
    });
    const response = await proxy(request);
    expect(response.status).not.toBe(403);
  });
});
