export type ResolvedTheme = "light" | "dark";

/**
 * User-facing appearance choice. "system" follows the OS `prefers-color-scheme`
 * while "light"/"dark" pin the theme regardless of the OS. Only "light" and
 * "dark" are persisted; "system" is represented by the absence of a stored
 * value so the OS preference keeps flowing through on later visits.
 */
export type ThemePreference = ResolvedTheme | "system";

export const DEFAULT_THEME: ResolvedTheme = "dark";

export const APP_THEME_COLORS = {
  light: "#ffffff",
  dark: "#060708",
} as const satisfies Record<ResolvedTheme, string>;

/**
 * Runs before paint. Storage is deliberately isolated so privacy modes that
 * throw on localStorage still receive their OS-selected theme.
 */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){var t=null;try{t=localStorage.getItem("clinical-kb-theme");}catch(e){}var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);var c=d?"${APP_THEME_COLORS.dark}":"${APP_THEME_COLORS.light}";document.querySelectorAll('meta[name="theme-color"]').forEach(function(m){m.setAttribute("content",c);});})();`;

export function resolveThemePreference(storedTheme: string | null | undefined, prefersDark: boolean): ResolvedTheme {
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  return prefersDark ? "dark" : "light";
}

/**
 * Maps a raw stored value to the appearance choice shown in settings. Anything
 * that is not an explicit "light"/"dark" pin (null, "system", or a stale value)
 * reads back as "system" so the control mirrors what the app actually renders.
 */
export function readThemePreference(storedTheme: string | null | undefined): ThemePreference {
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "system";
}

export function nextTheme(currentTheme: ResolvedTheme): ResolvedTheme {
  return currentTheme === "dark" ? "light" : "dark";
}
