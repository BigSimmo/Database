/**
 * Authoritative route-family classification for standalone information pages.
 * Keep this shared by shell chrome and page-specific secondary navigation so
 * an information route can never accidentally render both navigation systems.
 */
export function isInformationPage(pathname: string): boolean {
  if (pathname.startsWith("/services/") && pathname !== "/services") return true;
  if (pathname.startsWith("/forms/") && pathname !== "/forms") return true;
  if (pathname.startsWith("/medications/") && pathname !== "/medications") return true;

  if (
    pathname.startsWith("/specifiers/") &&
    pathname !== "/specifiers" &&
    pathname !== "/specifiers/builder" &&
    pathname !== "/specifiers/compare" &&
    pathname !== "/specifiers/map"
  )
    return true;

  if (
    pathname.startsWith("/formulation/") &&
    pathname !== "/formulation" &&
    pathname !== "/formulation/builder" &&
    pathname !== "/formulation/compare" &&
    pathname !== "/formulation/map"
  )
    return true;

  if (pathname.startsWith("/factsheets/") && pathname !== "/factsheets" && pathname !== "/factsheets/search")
    return true;

  if (
    pathname.startsWith("/therapy-compass/") &&
    pathname !== "/therapy-compass" &&
    pathname !== "/therapy-compass/compare" &&
    pathname !== "/therapy-compass/pathways" &&
    pathname !== "/therapy-compass/recommend" &&
    pathname !== "/therapy-compass/review" &&
    pathname !== "/therapy-compass/search"
  )
    return true;

  if (pathname.startsWith("/differentials/diagnoses/") || pathname.startsWith("/differentials/presentations/"))
    return true;
  if (pathname.startsWith("/dsm/diagnoses/")) return true;
  if (pathname.startsWith("/documents/") && pathname !== "/documents/search") return true;

  return false;
}
