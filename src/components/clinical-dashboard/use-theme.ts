"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  APP_THEME_COLORS,
  DEFAULT_THEME,
  nextTheme,
  readThemePreference,
  resolveThemePreference,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

const themeStorageKey = "clinical-kb-theme";
const themeChangeEvent = "clinical-kb-theme-change";

function getThemeSnapshot(): ResolvedTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const storedTheme = window.localStorage.getItem(themeStorageKey);
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return resolveThemePreference(storedTheme, prefersDark);
}

function getServerThemeSnapshot(): ResolvedTheme {
  return DEFAULT_THEME;
}

function getPreferenceSnapshot(): ThemePreference {
  if (typeof window === "undefined") return "system";
  return readThemePreference(window.localStorage.getItem(themeStorageKey));
}

function getServerPreferenceSnapshot(): ThemePreference {
  return "system";
}

function syncThemeColorMetadata(theme: ResolvedTheme) {
  for (const element of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    element.content = APP_THEME_COLORS[theme];
  }
}

function applyResolvedTheme(theme: ResolvedTheme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  syncThemeColorMetadata(theme);
}

function subscribeTheme(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const notify = () => onStoreChange();

  window.addEventListener("storage", notify);
  window.addEventListener(themeChangeEvent, notify);
  mediaQuery.addEventListener("change", notify);

  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(themeChangeEvent, notify);
    mediaQuery.removeEventListener("change", notify);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getServerThemeSnapshot);
  const preference = useSyncExternalStore(subscribeTheme, getPreferenceSnapshot, getServerPreferenceSnapshot);

  useEffect(() => {
    applyResolvedTheme(theme);
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    if (next === "system") {
      // Clearing the stored pin lets the OS preference (and its live media
      // query) drive the theme again, matching the pre-hydration script.
      window.localStorage.removeItem(themeStorageKey);
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      applyResolvedTheme(prefersDark ? "dark" : "light");
    } else {
      window.localStorage.setItem(themeStorageKey, next);
      applyResolvedTheme(next);
    }
    window.dispatchEvent(new Event(themeChangeEvent));
  }, []);

  const toggleTheme = useCallback(() => {
    // A direct toggle always pins an explicit light/dark choice so a single tap
    // has a predictable result even when the current theme came from the OS.
    setPreference(nextTheme(getThemeSnapshot()));
  }, [setPreference]);

  return { theme, preference, toggleTheme, setPreference };
}
