import { describe, expect, it } from "vitest";
import { APP_THEME_COLORS, nextTheme, readThemePreference, resolveThemePreference } from "../src/lib/theme";

describe("theme helpers", () => {
  it("uses stored explicit theme before system preference", () => {
    expect(resolveThemePreference("dark", false)).toBe("dark");
    expect(resolveThemePreference("light", true)).toBe("light");
  });

  it("falls back to system preference when no stored theme exists", () => {
    expect(resolveThemePreference(null, true)).toBe("dark");
    expect(resolveThemePreference(undefined, false)).toBe("light");
  });

  it("toggles between light and dark", () => {
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("light");
  });

  it("keeps installed-app browser chrome aligned with both application themes", () => {
    expect(APP_THEME_COLORS).toEqual({ light: "#ffffff", dark: "#060708" });
  });

  it("reads the appearance preference from the stored value", () => {
    expect(readThemePreference("light")).toBe("light");
    expect(readThemePreference("dark")).toBe("dark");
    // No pin and stale/system values both resolve to "system" so the OS
    // preference keeps flowing through the resolved theme.
    expect(readThemePreference(null)).toBe("system");
    expect(readThemePreference(undefined)).toBe("system");
    expect(readThemePreference("system")).toBe("system");
    expect(readThemePreference("sepia")).toBe("system");
  });
});
