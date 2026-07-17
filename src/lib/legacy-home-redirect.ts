const legacyModePaths = {
  favourites: "/favourites",
  differentials: "/differentials",
  specifiers: "/specifiers",
} as const;

type LegacyHomeRequestUrl = Pick<URL, "pathname" | "searchParams" | "toString">;

export function legacyHomeRedirectUrl(requestUrl: LegacyHomeRequestUrl, method: string) {
  if ((method !== "GET" && method !== "HEAD") || requestUrl.pathname !== "/") return null;

  const mode = requestUrl.searchParams.get("mode");
  const destinationPath = mode ? legacyModePaths[mode as keyof typeof legacyModePaths] : undefined;
  if (!destinationPath) return null;

  const destination = new URL(requestUrl.toString());
  destination.pathname = destinationPath;
  destination.search = "";
  destination.hash = "";

  const query = requestUrl.searchParams.get("q")?.trim();
  if (query) destination.searchParams.set("q", query);
  if (requestUrl.searchParams.get("focus") === "1") destination.searchParams.set("focus", "1");
  if (requestUrl.searchParams.get("run") === "1") destination.searchParams.set("run", "1");

  return destination;
}
