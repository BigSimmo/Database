"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  APP_THEME_COLORS,
  DEFAULT_THEME,
  nextTheme,
  readThemeCookie,
  readThemePreference,
  resolveThemePreference,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemePreference,
} from "@/lib/theme";

const themeChangeEvent = "clinical-kb-theme-change";

// In-memory fallback when localStorage is unavailable (Safari private mode,
// blocked cookies, quota). Null means storage is the source of truth; otherwise
// the chosen preference is kept for the session so the theme still applies.
// Mirrors the fallback pattern in use-sidebar-collapsed.ts / use-app-preferences.ts.
let inMemoryPreference: ThemePreference | null = null;

function readThemeCookieValue(): string | null {
  try {
    return readThemeCookie(document.cookie);
  } catch {
    return null;
  }
}

function writeThemeCookie(next: ThemePreference) {
  try {
    if (next === "system") {
      document.cookie = `${THEME_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
      return;
    }
    document.cookie = `${THEME_COOKIE_NAME}=${next}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Cookie write blocked — localStorage / in-memory still drive the session.
  }
}

function readStoredThemeValue(): string | null {
  if (inMemoryPreference !== null) {
    return inMemoryPreference === "system" ? null : inMemoryPreference;
  }
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // fall through to cookie
  }
  return readThemeCookieValue();
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

// The transition class comes off on a short timer. Track the pending timer so a
// rapid second toggle replaces it instead of stacking removals, and bail out if
// it fires after the owning environment is gone — a leaked firing after DOM test
// teardown ("document is not defined") intermittently failed Unit coverage.
let themeTransitionTimer: ReturnType<typeof setTimeout> | null = null;

function applyResolvedTheme(theme: ResolvedTheme) {
  const isCurrentlyDark = document.documentElement.classList.contains("dark");
  const willBeDark = theme === "dark";

  if (isCurrentlyDark !== willBeDark) {
    document.documentElement.classList.add("theme-transitioning");
    document.documentElement.classList.toggle("dark", willBeDark);
    syncThemeColorMetadata(theme);
    if (themeTransitionTimer !== null) clearTimeout(themeTransitionTimer);
    themeTransitionTimer = setTimeout(() => {
      themeTransitionTimer = null;
      if (typeof document === "undefined") return;
      document.documentElement.classList.remove("theme-transitioning");
    }, 200);
  } else {
    syncThemeColorMetadata(theme);
  }
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
      if (next === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
      else window.localStorage.setItem(THEME_STORAGE_KEY, next);
      inMemoryPreference = null;
    } catch {
      // Storage blocked: keep the choice in memory so the theme still applies
      // (and reads back correctly) for the rest of this session.
      inMemoryPreference = next;
    }
    writeThemeCookie(next);
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
