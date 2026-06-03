import { NextResponse } from "next/server";
import type { LocalProjectIdentityPayload } from "@/lib/local-project-identity";
import { appName, localProjectId, projectPortEnd, projectPortStart } from "../../scripts/local-server-utils.mjs";

const localHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function portFor(url: URL) {
  const explicit = Number.parseInt(url.port, 10);
  if (Number.isInteger(explicit)) return explicit;
  if (url.protocol === "http:") return 80;
  if (url.protocol === "https:") return 443;
  return null;
}

export function isLocalUrl(url: URL) {
  return localHosts.has(url.hostname.toLowerCase());
}

export function isManagedProjectPort(port: number | null) {
  return port !== null && port >= projectPortStart && port <= projectPortEnd;
}

export function localProjectIdentityPayload(requestUrl: string): LocalProjectIdentityPayload {
  const url = new URL(requestUrl);
  const local = isLocalUrl(url);
  const port = local ? portFor(url) : null;
  const currentUrl = local && port ? `${url.protocol}//${url.hostname}:${port}` : null;

  return {
    appName,
    projectId: localProjectId(process.cwd()),
    identityPath: "/api/local-project-id",
    localServer: {
      currentUrl,
      currentPort: port,
      projectPortStart,
      projectPortEnd,
      safeLocalOrigin: !local || isManagedProjectPort(port),
      requestOrigin: null,
      requestReferer: null,
      unsafeLocalCaller: null,
    },
  };
}

function unsafeLocalCallerFromHeader(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!isLocalUrl(url)) return null;
    return isManagedProjectPort(portFor(url)) ? null : url.origin;
  } catch {
    return null;
  }
}

export function localProjectRequestIdentityPayload(request: Request): LocalProjectIdentityPayload {
  const payload = localProjectIdentityPayload(request.url);
  const requestOrigin = request.headers.get("origin");
  const requestReferer = request.headers.get("referer");
  const unsafeLocalCaller = unsafeLocalCallerFromHeader(requestOrigin) ?? unsafeLocalCallerFromHeader(requestReferer);

  return {
    ...payload,
    localServer: {
      ...payload.localServer,
      requestOrigin,
      requestReferer,
      unsafeLocalCaller,
      safeLocalOrigin: payload.localServer.safeLocalOrigin && !unsafeLocalCaller,
    },
  };
}

export function isSafeLocalProjectRequest(request: Request) {
  return localProjectRequestIdentityPayload(request).localServer.safeLocalOrigin;
}

export class UnsafeLocalProjectOriginError extends Error {
  constructor(readonly payload: LocalProjectIdentityPayload) {
    super(
      `Local requests for ${payload.appName} must use a managed project port. Run npm run ensure and use the printed URL.`,
    );
    this.name = "UnsafeLocalProjectOriginError";
  }
}

export function assertSafeLocalProjectRequest(request: Request) {
  const payload = localProjectRequestIdentityPayload(request);
  if (!payload.localServer.safeLocalOrigin) {
    throw new UnsafeLocalProjectOriginError(payload);
  }
}

export function unsafeLocalProjectResponse(payload: LocalProjectIdentityPayload) {
  return NextResponse.json(
    {
      error: "Use the ensured Clinical KB local URL before calling this API.",
      run: "npm run ensure",
      identity: payload,
    },
    {
      status: 409,
      headers: {
        "Cache-Control": "no-store",
        "X-Clinical-KB-Local-Guard": "unsafe-local-origin",
      },
    },
  );
}

export function localProjectOriginErrorResponse(error: UnsafeLocalProjectOriginError) {
  return unsafeLocalProjectResponse(error.payload);
}
