import { describe, expect, it } from "vitest";
import {
  UnsafeLocalProjectOriginError,
  assertSafeLocalProjectRequest,
  isLocalUrl,
  isManagedProjectPort,
  isSafeLocalProjectRequest,
  localProjectIdentityPayload,
  localProjectOriginErrorResponse,
  localProjectRequestIdentityPayload,
  unsafeLocalProjectResponse,
} from "../src/lib/local-project-guard";
import { projectPortEnd, projectPortStart } from "../src/lib/local-server-utils.mjs";

const managedUrl = `http://localhost:${projectPortStart}/api/setup-status`;
const unmanagedUrl = "http://localhost:3000/api/setup-status";

function request(url: string, headers?: Record<string, string>) {
  return new Request(url, headers ? { headers } : undefined);
}

describe("local project guard", () => {
  it("recognizes loopback hosts and the managed project port range", () => {
    expect(isLocalUrl(new URL("http://127.0.0.1:3100/"))).toBe(true);
    expect(isLocalUrl(new URL("http://[::1]:3100/"))).toBe(true);
    expect(isLocalUrl(new URL("http://LOCALHOST:3100/"))).toBe(true);
    expect(isLocalUrl(new URL("https://psychiatry.tools/"))).toBe(false);

    expect(isManagedProjectPort(projectPortStart)).toBe(true);
    expect(isManagedProjectPort(projectPortEnd)).toBe(true);
    expect(isManagedProjectPort(projectPortStart - 1)).toBe(false);
    expect(isManagedProjectPort(projectPortEnd + 1)).toBe(false);
    expect(isManagedProjectPort(null)).toBe(false);
  });

  it("reports the ensured local URL as a safe managed origin", () => {
    const payload = localProjectIdentityPayload(managedUrl);

    expect(payload).toMatchObject({
      appName: "PsychSift",
      identityPath: "/api/local-project-id",
      localServer: {
        currentUrl: `http://localhost:${projectPortStart}`,
        currentPort: projectPortStart,
        projectPortStart,
        projectPortEnd,
        safeLocalOrigin: true,
        requestOrigin: null,
        requestReferer: null,
        unsafeLocalCaller: null,
      },
    });
    expect(payload.projectId).toMatch(/^clinical-kb:[0-9a-f]{12}$/);
  });

  it("flags an unmanaged local port so callers are pushed back to npm run ensure", () => {
    expect(localProjectIdentityPayload(unmanagedUrl).localServer).toMatchObject({
      currentUrl: "http://localhost:3000",
      currentPort: 3000,
      safeLocalOrigin: false,
    });
  });

  it("infers the protocol default port when the URL carries none", () => {
    expect(localProjectIdentityPayload("http://localhost/api/setup-status").localServer).toMatchObject({
      currentPort: 80,
      safeLocalOrigin: false,
    });
    expect(localProjectIdentityPayload("https://localhost/api/setup-status").localServer).toMatchObject({
      currentPort: 443,
      safeLocalOrigin: false,
    });
  });

  it("leaves deployed hosts unguarded because the port range is a local-only concept", () => {
    expect(localProjectIdentityPayload("https://psychiatry.tools/api/setup-status").localServer).toMatchObject({
      currentUrl: null,
      currentPort: null,
      safeLocalOrigin: true,
    });
  });

  it("treats an unmanaged local Origin as an unsafe caller even on a managed server port", () => {
    const payload = localProjectRequestIdentityPayload(request(managedUrl, { origin: "http://localhost:3000" }));

    expect(payload.localServer).toMatchObject({
      requestOrigin: "http://localhost:3000",
      requestReferer: null,
      unsafeLocalCaller: "http://localhost:3000",
      safeLocalOrigin: false,
    });
    expect(isSafeLocalProjectRequest(request(managedUrl, { origin: "http://localhost:3000" }))).toBe(false);
  });

  it("falls back to the Referer when no Origin header is present", () => {
    const payload = localProjectRequestIdentityPayload(
      request(managedUrl, { referer: "http://127.0.0.1:3000/documents" }),
    );

    expect(payload.localServer).toMatchObject({
      unsafeLocalCaller: "http://127.0.0.1:3000",
      safeLocalOrigin: false,
    });
  });

  it("accepts managed, remote, and unparseable caller headers", () => {
    const managedOrigin = `http://localhost:${projectPortStart}`;

    expect(
      localProjectRequestIdentityPayload(request(managedUrl, { origin: managedOrigin })).localServer,
    ).toMatchObject({ unsafeLocalCaller: null, safeLocalOrigin: true });
    expect(
      localProjectRequestIdentityPayload(request(managedUrl, { origin: "https://psychiatry.tools" })).localServer,
    ).toMatchObject({ unsafeLocalCaller: null, safeLocalOrigin: true });
    expect(localProjectRequestIdentityPayload(request(managedUrl, { origin: "null" })).localServer).toMatchObject({
      unsafeLocalCaller: null,
      safeLocalOrigin: true,
    });
    expect(isSafeLocalProjectRequest(request(managedUrl))).toBe(true);
  });

  it("asserts safe requests and throws a payload-carrying error for unsafe ones", () => {
    expect(() => assertSafeLocalProjectRequest(request(managedUrl))).not.toThrow();

    let thrown: unknown;
    try {
      assertSafeLocalProjectRequest(request(unmanagedUrl));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(UnsafeLocalProjectOriginError);
    const error = thrown as UnsafeLocalProjectOriginError;
    expect(error.name).toBe("UnsafeLocalProjectOriginError");
    expect(error.message).toContain("npm run ensure");
    expect(error.payload.localServer.safeLocalOrigin).toBe(false);
  });

  it("answers an unsafe local caller with an uncached 409 that names the remediation", async () => {
    const error = new UnsafeLocalProjectOriginError(localProjectIdentityPayload(unmanagedUrl));
    const response = localProjectOriginErrorResponse(error);
    const body = (await response.json()) as { error: string; run: string; identity: { projectId: string } };

    expect(response.status).toBe(409);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Clinical-KB-Local-Guard")).toBe("unsafe-local-origin");
    expect(body.run).toBe("npm run ensure");
    expect(body.error).toContain("ensured PsychSift local URL");
    expect(body.identity.projectId).toBe(error.payload.projectId);

    const direct = unsafeLocalProjectResponse(error.payload);
    expect(direct.status).toBe(409);
  });
});
