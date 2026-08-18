/**
 * Information pages are per-mode detail / record surfaces (not mode homes, builders,
 * compare/map tools, or search results). The global search shell uses this to suppress
 * the floating composer on read-focused routes.
 *
 * Basic chrome for these pages lives in `src/components/information-page-shell.tsx`.
 * Intentional opt-outs from that shell (different product chrome): document viewer
 * and the differentials presentation workflow.
 */

export type InformationPageMode =
  | "services"
  | "forms"
  | "prescribing"
  | "specifiers"
  | "formulation"
  | "factsheets"
  | "dictionary"
  | "therapy-compass"
  | "differentials"
  | "dsm"
  | "documents";

const TOOL_SUFFIXES = new Set(["builder", "compare", "map"]);

/**
 * `/services/some-slug`, but not `/services`, a tool suffix, or a deeper path.
 *
 * Exported so `isHeaderAddonSlotOwnedRoute` can share the one implementation:
 * every claimant route it names must also be `isInformationPage`, and a second
 * hand-copied slug test is how that agreement would silently diverge.
 */
export function isSlugDetail(pathname: string, home: string, extraExcluded: string[] = []): boolean {
  if (!pathname.startsWith(`${home}/`) || pathname === home) return false;
  const rest = pathname.slice(home.length + 1);
  if (!rest || rest.includes("/")) return false;
  if (extraExcluded.includes(rest) || TOOL_SUFFIXES.has(rest)) return false;
  return true;
}

/**
 * True when `pathname` is a mode information (detail/record) page.
 * Keep in sync with adoption notes on `InformationPageShell`.
 */
export function isInformationPage(pathname: string): boolean {
  if (isSlugDetail(pathname, "/services")) return true;
  if (isSlugDetail(pathname, "/forms")) return true;
  if (isSlugDetail(pathname, "/medications")) return true;
  if (isSlugDetail(pathname, "/specifiers")) return true;
  if (isSlugDetail(pathname, "/formulation")) return true;
  if (isSlugDetail(pathname, "/factsheets", ["search"])) return true;
  if (isSlugDetail(pathname, "/dictionary", ["search", "browse", "topics", "compare", "sources"])) return true;
  if (pathname.startsWith("/dictionary/topics/") && !pathname.slice("/dictionary/topics/".length).includes("/"))
    return true;

  // Therapy compass detail: /therapy-compass/[slug]/brief or /sheet (and bare slug if present)
  if (
    pathname.startsWith("/therapy-compass/") &&
    pathname !== "/therapy-compass" &&
    pathname !== "/therapy-compass/compare" &&
    pathname !== "/therapy-compass/pathways" &&
    pathname !== "/therapy-compass/recommend" &&
    pathname !== "/therapy-compass/review" &&
    pathname !== "/therapy-compass/search"
  ) {
    return true;
  }

  if (pathname.startsWith("/differentials/diagnoses/") || pathname.startsWith("/differentials/presentations/")) {
    return true;
  }

  if (pathname.startsWith("/dsm/diagnoses/")) return true;

  if (pathname.startsWith("/documents/") && pathname !== "/documents/search") return true;

  return false;
}

/** Modes that use the shared `InformationPageShell` for outer chrome. */
export const informationPageShellModes = [
  "services",
  "forms",
  "prescribing",
  "specifiers",
  "formulation",
  "factsheets",
  "dictionary",
  "therapy-compass",
  "dsm",
] as const satisfies readonly InformationPageMode[];
