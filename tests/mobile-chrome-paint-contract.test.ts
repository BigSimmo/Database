import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const globalStylesSource = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const calculatorsSource = readFileSync(
  new URL("../src/components/calculators/search-page.tsx", import.meta.url),
  "utf8",
);
const scrollHideSource = readFileSync(
  new URL("../src/components/clinical-dashboard/use-hide-on-scroll.ts", import.meta.url),
  "utf8",
);

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

  it("keeps every footer-glass fallback terminal translucent", () => {
    const footerBackdropStart = globalStylesSource.indexOf(
      ".answer-footer-search-dock .answer-footer-search-backdrop {",
    );
    const supportsFallbackStart = globalStylesSource.indexOf("@supports not ((backdrop-filter: blur(1px))");
    const reducedTransparencyStart = globalStylesSource.indexOf("@media (prefers-reduced-transparency: reduce)");
    const footerBackdropSource = globalStylesSource.slice(footerBackdropStart, supportsFallbackStart);
    const supportsFallbackSource = globalStylesSource.slice(supportsFallbackStart, reducedTransparencyStart);
    const reducedTransparencySource = globalStylesSource.slice(reducedTransparencyStart);

    expect(footerBackdropSource).toContain("color-mix(in srgb, var(--background) 72%, transparent) 100%");
    expect(supportsFallbackSource).toContain("color-mix(in srgb, var(--background) 88%, transparent) 100%");
    expect(reducedTransparencySource).toContain("color-mix(in srgb, var(--background) 90%, transparent) 100%");
    expect(`${footerBackdropSource}\n${supportsFallbackSource}\n${reducedTransparencySource}`).not.toContain(
      "var(--background) 100%",
    );
  });

  it("registers the calculator page reserve with the shared hide and transition contracts", () => {
    expect(calculatorsSource).toContain("useReserveTransitionMarker(dockHidden, activeCalc)");
    expect(calculatorsSource).toContain('reserveOwner="calculator"');
    expect(calculatorsSource).toContain('reserveHiddenPad="0rem"');
    expect(calculatorsSource).toContain("reserveTransitioning={reserveTransitioning}");
    expect(globalStylesSource).toContain('[data-reserve-owner][data-reserve-transitioning="true"]');
    expect(scrollHideSource).toContain('querySelectorAll("[data-reserve-owner]")');
    expect(scrollHideSource).toContain("dataset.reserveHiddenPad");
  });
});
