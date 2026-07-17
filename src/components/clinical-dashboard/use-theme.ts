"use client";

import { useEffect, useSyncExternalStore } from "react";

import { APP_THEME_COLORS, DEFAULT_THEME, nextTheme, resolveThemePreference, type ResolvedTheme } from "@/lib/theme";

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

function syncThemeColorMetadata(theme: ResolvedTheme) {
  for (const element of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    element.content = APP_THEME_COLORS[theme];
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

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    syncThemeColorMetadata(theme);
  }, [theme]);

  function toggleTheme() {
    const resolved = nextTheme(theme);
    window.localStorage.setItem(themeStorageKey, resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    syncThemeColorMetadata(resolved);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  return { theme, toggleTheme };
}
