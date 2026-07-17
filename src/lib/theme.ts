export type ResolvedTheme = "light" | "dark";

export const DEFAULT_THEME: ResolvedTheme = "dark";

export const APP_THEME_COLORS = {
  light: "#ffffff",
  dark: "#060708",
} as const satisfies Record<ResolvedTheme, string>;

export function resolveThemePreference(storedTheme: string | null | undefined, prefersDark: boolean): ResolvedTheme {
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  return prefersDark ? "dark" : "light";
}

export function nextTheme(currentTheme: ResolvedTheme): ResolvedTheme {
  return currentTheme === "dark" ? "light" : "dark";
}
