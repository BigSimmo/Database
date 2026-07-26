import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const globalStylesSource = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

describe("mobile chrome paint baseline", () => {
  it("keeps the header opaque while the edge-to-edge footer uses localized soft glass", () => {
    const phoneStyles = globalStylesSource.slice(globalStylesSource.indexOf("@media (max-width: 639px)"));

    expect(phoneStyles).toMatch(
      /\.edge-glass-header,\s*\n\s*\.universal-header\s*\{[\s\S]*?background: var\(--surface\);[\s\S]*?backdrop-filter: none/,
    );
    expect(phoneStyles).toMatch(/\.edge-glass-header-backdrop[\s\S]*?display: none/);
    expect(phoneStyles).toMatch(/\.answer-footer-search-dock\.answer-footer-search-edge[\s\S]*?bottom: 0;/);
    expect(phoneStyles).toMatch(
      /\.answer-footer-search-dock\.answer-footer-search-edge[\s\S]*?background: transparent;/,
    );
    expect(phoneStyles).toMatch(
      /\.answer-footer-search-dock \.answer-footer-search-backdrop[\s\S]*?display: block;[\s\S]*?position: absolute;/,
    );
    expect(phoneStyles).toMatch(
      /\.answer-footer-search-dock\.answer-footer-search-edge\[data-scroll-hidden="true"\][\s\S]*?opacity: 0;[\s\S]*?pointer-events: none/,
    );
    expect(phoneStyles).toMatch(
      /\.answer-footer-search-dock \.answer-footer-search-pill[\s\S]*?color-mix\(in srgb, var\(--surface\) 92%, transparent\)/,
    );
  });
});
