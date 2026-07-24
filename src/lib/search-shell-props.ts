import type { AppModeId } from "@/lib/app-modes";

export type SearchShellPathProps = {
  initialMode: AppModeId;
  availableModeIds?: AppModeId[];
  desktopSearchPlacement?: "default" | "hero";
  searchComposerVisible?: boolean;
  mobileChromeVisible?: boolean;
};

/**
 * Derive GlobalSearchShell props from the current pathname so a single shared
 * layout can own the shell across mode homes (avoids remounting the composer
 * when navigating between namespaced modes).
 */
export function searchShellPropsForPathname(pathname: string): SearchShellPathProps {
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
    return { initialMode: "tools", desktopSearchPlacement: "hero" };
  }

  if (pathname.startsWith("/therapy-compass")) {
    return { initialMode: "therapy-compass" };
  }

  if (pathname.startsWith("/factsheets")) {
    return { initialMode: "factsheets", desktopSearchPlacement: "hero" };
  }

  return { initialMode: "answer" };
}
