import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy, shouldBlockProductionMockups } from "../src/proxy";
import * as ssr from "@supabase/ssr";
import { vi } from "vitest";

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(),
}));

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
    expect(csp).toContain("img-src 'self' data: blob: https://*.supabase.co");
    expect(csp).toContain("connect-src 'self' https://*.supabase.co;");
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
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "mock-key";
    
    // Setup the mock to trigger setAll when getClaims is called
    let capturedOptions: any;
    vi.mocked(ssr.createServerClient).mockImplementationOnce((url, key, options: any) => {
      capturedOptions = options;
      return {
        auth: {
          getClaims: async () => {
            options.cookies.setAll(
              [{ name: "sb-mock", value: "token", options: {} }],
              { "x-custom-security": "enabled", "x-other-header": "value" }
            );
          }
        }
      } as any;
    });

    const req = requestFor("/");
    req.cookies.set("sb-access-token", "present"); // satisfy hasAuthCookie

    const res = await proxy(req);
    expect(res.headers.get("x-custom-security")).toBe("enabled");
    expect(res.headers.get("x-other-header")).toBe("value");
    expect(res.cookies.get("sb-mock")?.value).toBe("token");
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
});
