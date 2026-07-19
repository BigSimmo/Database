"use client";

import { useCallback } from "react";

import { useFavouritesAccess, type AccountSetupIntent } from "@/components/clinical-dashboard/use-favourites-access";

type TransientSurface = "guide" | "settings" | "accountSetup" | "mobileSidebar" | "documents" | "upload";

/**
 * Dashboard chrome helpers: Favourites session access, account-setup intent, and
 * guide/settings openers. Keeps ClinicalDashboard under the maintainability budget.
 */
export function useDashboardShellActions(options: {
  authenticated: boolean;
  demoMode: boolean;
  signedIn: boolean;
  setGuideOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  setDocumentsDrawerOpen: (open: boolean) => void;
  setUploadDrawerOpen: (open: boolean) => void;
  prefetch: (href: string) => void;
}) {
  const {
    authenticated,
    demoMode,
    signedIn,
    setGuideOpen,
    setSettingsOpen,
    setMobileSidebarOpen,
    setDocumentsDrawerOpen,
    setUploadDrawerOpen,
    prefetch,
  } = options;

  const {
    favouritesAccessible,
    accountSetupOpen,
    accountSetupIntent,
    openAccountSetup: openAccountSetupWithIntent,
    closeAccountSetup,
  } = useFavouritesAccess(authenticated, demoMode);

  const closeTransientSurfaces = useCallback(
    (except?: TransientSurface) => {
      if (except !== "guide") setGuideOpen(false);
      if (except !== "settings") setSettingsOpen(false);
      if (except !== "accountSetup") closeAccountSetup();
      if (except !== "mobileSidebar") setMobileSidebarOpen(false);
      if (except !== "documents") setDocumentsDrawerOpen(false);
      if (except !== "upload") setUploadDrawerOpen(false);
    },
    [
      closeAccountSetup,
      setDocumentsDrawerOpen,
      setGuideOpen,
      setMobileSidebarOpen,
      setSettingsOpen,
      setUploadDrawerOpen,
    ],
  );

  const openAccountSetup = useCallback(
    (intent: AccountSetupIntent = "default") => {
      closeTransientSurfaces("accountSetup");
      openAccountSetupWithIntent(intent);
    },
    [closeTransientSurfaces, openAccountSetupWithIntent],
  );

  const openGuide = useCallback(() => {
    closeTransientSurfaces("guide");
    setGuideOpen(true);
  }, [closeTransientSurfaces, setGuideOpen]);

  const closeGuide = useCallback(() => setGuideOpen(false), [setGuideOpen]);

  const openSettings = useCallback(() => {
    closeTransientSurfaces("settings");
    setSettingsOpen(true);
  }, [closeTransientSurfaces, setSettingsOpen]);

  const closeSettings = useCallback(() => setSettingsOpen(false), [setSettingsOpen]);

  const openAccountProfile = useCallback(() => {
    if (signedIn) {
      closeTransientSurfaces("settings");
      setSettingsOpen(true);
      return;
    }
    openAccountSetup("default");
  }, [closeTransientSurfaces, openAccountSetup, setSettingsOpen, signedIn]);

  const prefetchApplications = useCallback(() => {
    prefetch("/?mode=tools");
    prefetch("/favourites");
    prefetch("/differentials");
  }, [prefetch]);

  return {
    favouritesAccessible,
    accountSetupOpen,
    accountSetupIntent,
    closeAccountSetup,
    closeTransientSurfaces,
    openAccountSetup,
    openGuide,
    closeGuide,
    openSettings,
    closeSettings,
    openAccountProfile,
    prefetchApplications,
  };
}
