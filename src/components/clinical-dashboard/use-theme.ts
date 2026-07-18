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

// In-memory fallback when localStorage is unavailable (Safari private mode,
// blocked cookies, quota). Null means storage is the source of truth; otherwise
// the chosen preference is kept for the session so the theme still applies.
// Mirrors the fallback pattern in use-sidebar-collapsed.ts / use-app-preferences.ts.
let inMemoryPreference: ThemePreference | null = null;

function readStoredThemeValue(): string | null {
  if (inMemoryPreference !== null) {
    return inMemoryPreference === "system" ? null : inMemoryPreference;
  }
  try {
    return window.localStorage.getItem(themeStorageKey);
  } catch {
    return null;
  }
}

function getThemeSnapshot(): ResolvedTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  return resolveThemePreference(readStoredThemeValue(), prefersDark);
}

function getServerThemeSnapshot(): ResolvedTheme {
  return DEFAULT_THEME;
}

function getPreferenceSnapshot(): ThemePreference {
  if (typeof window === "undefined") return "system";
  return readThemePreference(readStoredThemeValue());
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
    try {
      // Clearing the stored pin lets the OS preference (and its live media
      // query) drive the theme again, matching the pre-hydration script.
      if (next === "system") window.localStorage.removeItem(themeStorageKey);
      else window.localStorage.setItem(themeStorageKey, next);
      inMemoryPreference = null;
    } catch {
      // Storage blocked: keep the choice in memory so the theme still applies
      // (and reads back correctly) for the rest of this session.
      inMemoryPreference = next;
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyResolvedTheme(resolveThemePreference(next === "system" ? null : next, prefersDark));
    window.dispatchEvent(new Event(themeChangeEvent));
  }, []);

  const toggleTheme = useCallback(() => {
    // A direct toggle always pins an explicit light/dark choice so a single tap
    // has a predictable result even when the current theme came from the OS.
    setPreference(nextTheme(getThemeSnapshot()));
  }, [setPreference]);

  return { theme, preference, toggleTheme, setPreference };
}
