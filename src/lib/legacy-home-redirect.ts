const legacyModePaths = {
  favourites: "/favourites",
  differentials: "/differentials",
  specifiers: "/specifiers",
} as const;

type LegacyHomeRequestUrl = Pick<URL, "pathname" | "searchParams" | "toString">;

/**
 * Early proxy redirect for a few modes that used to live only as `/?mode=…`
 * aliases. `/` is now the shared home for every mode, so bare `/?mode=…` must
 * stay on `/` with that mode preselected. Only a *submitted* deep link
 * (`q` plus `run=1`) still hops to the mode's own search surface — matching
 * `src/app/(search-app)/page.tsx`.
 */
export function legacyHomeRedirectUrl(requestUrl: LegacyHomeRequestUrl, method: string) {
  if ((method !== "GET" && method !== "HEAD") || requestUrl.pathname !== "/") return null;

  const mode = requestUrl.searchParams.get("mode");
  const destinationPath = mode ? legacyModePaths[mode as keyof typeof legacyModePaths] : undefined;
  if (!destinationPath) return null;

  const query = requestUrl.searchParams.get("q")?.trim();
  const run = requestUrl.searchParams.get("run") === "1";
  // Shared-home contract: selection-only URLs render `/`. Submitted results
  // still resolve to the standalone mode surface.
  if (!query || !run) return null;

  const destination = new URL(requestUrl.toString());
  destination.pathname = destinationPath;
  destination.search = "";
  destination.hash = "";

  destination.searchParams.set("q", query);
  if (requestUrl.searchParams.get("focus") === "1") destination.searchParams.set("focus", "1");
  destination.searchParams.set("run", "1");

  return destination;
}
