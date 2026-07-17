const PUBLIC_FIXTURE_CACHE_CONTROL = "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400";
const PRIVATE_CACHE_CONTROL = "private, no-store";

function hasAuthenticationSignal(request: Request) {
  if (request.headers.get("authorization")?.trim()) return true;

  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return false;

  return cookieHeader.split(";").some((part) => {
    const separator = part.indexOf("=");
    const name = (separator === -1 ? part : part.slice(0, separator)).trim().toLowerCase();
    return name.startsWith("sb-");
  });
}

function addVary(headers: Headers, names: string[]) {
  const values = (headers.get("Vary") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const seen = new Set(values.map((value) => value.toLowerCase()));

  for (const name of names) {
    if (!seen.has(name.toLowerCase())) {
      values.push(name);
      seen.add(name.toLowerCase());
    }
  }

  headers.set("Vary", values.join(", "));
}

export function fixtureResponseHeaders(
  request: Request | undefined,
  options: { fixture?: boolean; headers?: HeadersInit } = {},
) {
  const headers = new Headers(options.headers);
  const isPublicFixture = Boolean(request && options.fixture && !hasAuthenticationSignal(request));

  headers.set("Cache-Control", isPublicFixture ? PUBLIC_FIXTURE_CACHE_CONTROL : PRIVATE_CACHE_CONTROL);
  if (request) addVary(headers, ["Cookie", "Authorization"]);

  return headers;
}
