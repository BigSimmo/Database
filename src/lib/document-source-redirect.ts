// Shared resolution for the /documents/source (and /documents/source/evidence)
// fallback redirects. Lives outside the page so src/proxy.ts can issue the same
// redirect as a plain HTTP 307 before rendering: a server-component redirect()
// on these routes streams a 200 page whose redirect completes client-side via an
// RSC navigation, and WebKit raises `_rsc` access-control pageerrors on that
// chain (issue #024). Keep this module free of non-URL imports — the proxy runs
// in the middleware runtime.

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const DOCUMENT_SOURCE_PATHS = ["/documents/source", "/documents/source/evidence"] as const;

export function isDocumentSourcePath(pathname: string): boolean {
  return (DOCUMENT_SOURCE_PATHS as readonly string[]).includes(pathname);
}

export type DocumentSourceRedirect = {
  pathname: string;
  params: URLSearchParams;
};

export function resolveDocumentSourceRedirect(searchParams: URLSearchParams): DocumentSourceRedirect {
  const id = searchParams.get("id") ?? "";
  if (!uuidPattern.test(id)) return { pathname: "/documents/search", params: new URLSearchParams() };
  const params = new URLSearchParams();
  const page = Number(searchParams.get("page") ?? NaN);
  const chunk = (searchParams.get("chunk") ?? "").trim().slice(0, 120);
  if (Number.isInteger(page) && page > 0) params.set("page", String(page));
  if (chunk) params.set("chunk", chunk);
  return { pathname: `/documents/${id}`, params };
}

export function documentSourceRedirectTarget(searchParams: URLSearchParams): string {
  const { pathname, params } = resolveDocumentSourceRedirect(searchParams);
  return `${pathname}${params.size ? `?${params.toString()}` : ""}`;
}
