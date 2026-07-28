import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const globalStylesSource = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

describe("mobile chrome paint baseline", () => {
  it("uses one opaque edge-to-edge phone header and one footer surface", () => {
    const phoneStyles = globalStylesSource.slice(globalStylesSource.indexOf("@media (max-width: 639px)"));

    expect(phoneStyles).toMatch(
      /\.edge-glass-header,\s*\n\s*\.universal-header\s*\{[\s\S]*?background: var\(--surface\);[\s\S]*?backdrop-filter: none/,
    );
    expect(phoneStyles).toMatch(/\.edge-glass-header-backdrop[\s\S]*?display: none/);
    expect(phoneStyles).toMatch(/\.answer-footer-search-dock\.answer-footer-search-edge[\s\S]*?bottom: 0;/);
    expect(phoneStyles).toMatch(
      /\.answer-footer-search-dock \.answer-footer-search-backdrop\s*\{\s*\n\s*display: none/,
    );
    expect(phoneStyles).toMatch(
      /\.answer-footer-search-dock \.answer-footer-search-pill[\s\S]*?color-mix\(in srgb, var\(--surface\) 92%, transparent\)/,
    );
  });
});
