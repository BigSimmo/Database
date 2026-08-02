"use client";

import { useCallback, useState } from "react";

import { canAccessFavouritesMode } from "@/lib/app-modes";

export type AccountSetupIntent = "default" | "favourites";

/**
 * Shared Favourites visibility + account-setup intent for shell and dashboard.
 * Favourites stay hidden until authenticated (or demo mode allows prototype access).
 */
export function useFavouritesAccess(authenticated: boolean, demoMode: boolean) {
  const favouritesAccessible = canAccessFavouritesMode({ authenticated, demoMode });
  const [accountSetupOpen, setAccountSetupOpen] = useState(false);
  const [accountSetupIntent, setAccountSetupIntent] = useState<AccountSetupIntent>("default");

  const openAccountSetup = useCallback((intent: AccountSetupIntent = "default") => {
    setAccountSetupIntent(intent);
    setAccountSetupOpen(true);
  }, []);

  const closeAccountSetup = useCallback(() => {
    setAccountSetupOpen(false);
    setAccountSetupIntent("default");
  }, []);

  return {
    favouritesAccessible,
    accountSetupOpen,
    accountSetupIntent,
    openAccountSetup,
    closeAccountSetup,
  };
}
