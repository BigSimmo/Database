"use client";

import { useCallback } from "react";

import type { AccountSetupIntent } from "@/components/clinical-dashboard/use-favourites-access";

type TransientSurface = "guide" | "settings" | "accountSetup" | "mobileSidebar" | "documents" | "upload";

/**
 * Shared open/close helpers for dashboard chrome (guide, settings, account setup).
 * Keeps ClinicalDashboard from growing when Favourites account-setup intent is wired in.
 */
export function useDashboardShellActions(options: {
  closeTransientSurfaces: (except?: TransientSurface) => void;
  openAccountSetupWithIntent: (intent?: AccountSetupIntent) => void;
  signedIn: boolean;
  setGuideOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  prefetch: (href: string) => void;
}) {
  const { closeTransientSurfaces, openAccountSetupWithIntent, signedIn, setGuideOpen, setSettingsOpen, prefetch } =
    options;

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
    openAccountSetup,
    openGuide,
    closeGuide,
    openSettings,
    closeSettings,
    openAccountProfile,
    prefetchApplications,
  };
}
