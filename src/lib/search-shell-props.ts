import type { AppModeId } from "@/lib/app-modes";

export type SearchShellPathProps = {
  initialMode: AppModeId;
  availableModeIds?: AppModeId[];
  desktopSearchPlacement?: "default" | "hero";
  mobileHomeComposerPlacement?: "hero" | "footer";
  searchComposerVisible?: boolean;
  mobileChromeVisible?: boolean;
};

/**
 * Derive GlobalSearchShell props from the current pathname so a single shared
 * layout can own the shell across mode homes (avoids remounting the composer
 * when navigating between namespaced modes).
 */
export function searchShellPropsForPathname(pathname: string): SearchShellPathProps {
  // Exact `/documents` is the Documents mode home — it matches neither
  // `/documents/search` nor the `/documents/` prefix below, so it needs its own
  // case. ClinicalDashboard owns the body here (see `dashboardOwnedModeHomePaths`),
  // so it also owns composer placement, exactly as it does on `/`. Declaring a
  // shell hero on top of that gives the route two hero owners, and the shell's one
  // then overlaps the Documents home actions.
  if (pathname === "/documents") {
    return { initialMode: "documents" };
  }

  if (pathname === "/documents/search" || pathname.startsWith("/documents/")) {
    const isDocumentSearchRoute = pathname === "/documents/search";
    const documentFlowOwnsMobileChrome = pathname.startsWith("/documents/source");
    return {
      initialMode: "documents",
      searchComposerVisible: isDocumentSearchRoute,
      mobileChromeVisible: !documentFlowOwnsMobileChrome,
    };
  }

  if (pathname.startsWith("/medications")) {
    return { initialMode: "prescribing", desktopSearchPlacement: "hero" };
  }

  if (pathname.startsWith("/services")) {
    return { initialMode: "services", desktopSearchPlacement: "hero" };
  }

  if (pathname.startsWith("/forms")) {
    return { initialMode: "forms", availableModeIds: ["forms"], desktopSearchPlacement: "hero" };
  }

  if (pathname.startsWith("/favourites")) {
    return { initialMode: "favourites", availableModeIds: ["favourites"], desktopSearchPlacement: "hero" };
  }

  if (pathname.startsWith("/differentials")) {
    return { initialMode: "differentials", desktopSearchPlacement: "hero" };
  }

  if (pathname.startsWith("/dsm")) {
    return { initialMode: "dsm", desktopSearchPlacement: "hero" };
  }

  if (pathname.startsWith("/specifiers")) {
    return { initialMode: "specifiers", desktopSearchPlacement: "hero" };
  }

  if (pathname.startsWith("/formulation")) {
    return { initialMode: "formulation", desktopSearchPlacement: "hero" };
  }

  if (pathname.startsWith("/tools")) {
    return {
      initialMode: "tools",
      desktopSearchPlacement: "hero",
      mobileHomeComposerPlacement: "footer",
    };
  }

  if (pathname.startsWith("/calculators")) {
    return { initialMode: "calculators", desktopSearchPlacement: "hero" };
  }

  if (pathname.startsWith("/therapy-compass")) {
    // Recommend owns an in-flow clinical-situation composer. The shared phone
    // dock would be a second search on the same page, so this exact route
    // hides the shell composer the same way `/dictionary/sources` does.
    return {
      initialMode: "therapy-compass",
      desktopSearchPlacement: "hero",
      ...(pathname === "/therapy-compass/recommend" ? { searchComposerVisible: false } : {}),
    };
  }

  if (pathname.startsWith("/factsheets")) {
    return { initialMode: "factsheets", desktopSearchPlacement: "hero" };
  }

  if (pathname.startsWith("/dictionary")) {
    // `/dictionary/sources` is a read-only governance page — the source method,
    // the authority hierarchy, the index and the review cadence. Nothing on it
    // is searched, so it carries no composer (the mode nav still reaches every
    // other dictionary surface). Every other dictionary route keeps one.
    return {
      initialMode: "dictionary",
      desktopSearchPlacement: "hero",
      ...(pathname === "/dictionary/sources" ? { searchComposerVisible: false } : {}),
    };
  }

  return { initialMode: "answer" };
}
