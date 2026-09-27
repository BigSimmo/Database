import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
function block(selector: string): Map<string, string> {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  const body = css.slice(start, css.indexOf("\n}", start));
  return new Map([...body.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("First Nations olive (standard v13.1 §3)", () => {
  const light = block('[data-mode-identity="first-nations"]');
  const dark = block('.dark [data-mode-identity="first-nations"]');
  it("uses the standard's olive values", () => {
    expect([
      light.get("--mode-identity"),
      light.get("--mode-identity-soft"),
      light.get("--mode-identity-border"),
    ]).toEqual(["#4d6b2f", "#f2f5ee", "#dce4d2"]);
    expect([
      dark.get("--mode-identity"),
      dark.get("--mode-identity-soft"),
      dark.get("--mode-identity-border"),
      dark.get("--mode-identity-contrast"),
    ]).toEqual(["#b5c98c", "#232b1d", "#3a4730", "#172009"]);
  });
  it("clears 4.5:1 as a disc against its own glyph colour and as text", () => {
    expect(contrast(light.get("--mode-identity")!, light.get("--mode-identity-contrast")!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.get("--mode-identity")!, dark.get("--mode-identity-contrast")!)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(light.get("--mode-identity")!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(dark.get("--mode-identity")!, "#1c2126")).toBeGreaterThanOrEqual(4.5);
  });
  it("remaps the accent locally and flattens under forced colours", () => {
    expect(light.get("--clinical-accent")).toBe("var(--mode-identity)");
    expect(css).toMatch(/\[data-mode-identity="first-nations"\] \{\s*--mode-identity: LinkText;/);
  });
});
