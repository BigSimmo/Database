import { describe, expect, it } from "vitest";
import { nextTheme, resolveThemePreference } from "../src/lib/theme";

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
});
