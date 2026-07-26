"use client";

import { useCallback, useRef, useState } from "react";

type SettingsGuideFlowOptions = {
  openGuide: () => void;
  closeGuide: () => void;
  openSettings: () => void;
  openAccountProfile: () => void;
  setSettingsOpen: (open: boolean) => void;
};

export function useSettingsGuideFlow(options: SettingsGuideFlowOptions) {
  const [settingsInitialFocus, setSettingsInitialFocus] = useState<"close" | "guide">("close");
  const guideReturnsToSettingsRef = useRef(false);

  const openGuideFromSettings = useCallback(() => {
    guideReturnsToSettingsRef.current = true;
    options.openGuide();
  }, [options]);
  const closeGuideWithRestore = useCallback(() => {
    options.closeGuide();
    if (!guideReturnsToSettingsRef.current) return;
    guideReturnsToSettingsRef.current = false;
    setSettingsInitialFocus("guide");
    options.setSettingsOpen(true);
  }, [options]);
  const openSettingsWithDefaultFocus = useCallback(() => {
    setSettingsInitialFocus("close");
    options.openSettings();
  }, [options]);
  const openAccountProfileWithDefaultFocus = useCallback(() => {
    setSettingsInitialFocus("close");
    options.openAccountProfile();
  }, [options]);

  return {
    settingsInitialFocus,
    openGuideFromSettings,
    closeGuideWithRestore,
    openSettingsWithDefaultFocus,
    openAccountProfileWithDefaultFocus,
  };
}
