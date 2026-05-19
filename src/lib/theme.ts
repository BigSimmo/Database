export type ResolvedTheme = "light" | "dark";

export function resolveThemePreference(
  storedTheme: string | null | undefined,
  prefersDark: boolean,
): ResolvedTheme {
  if (storedTheme === "light" || storedTheme === "dark") return storedTheme;
  return prefersDark ? "dark" : "light";
}

export function nextTheme(currentTheme: ResolvedTheme): ResolvedTheme {
  return currentTheme === "dark" ? "light" : "dark";
}

