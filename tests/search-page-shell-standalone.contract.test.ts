import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import PrivacyPage from "@/app/privacy/page";
import ColourCodingReferencePage from "@/app/reference/colour-coding/page";
import { searchPageShell, searchPageShellStandalone } from "@/components/ui-primitives";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    back: vi.fn(),
    push: vi.fn(),
  }),
}));

const read = (relativePath: string) => readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");

const SAFE_AREA_TOP_PAD = "pt-[max(0.75rem,var(--safe-area-top))]";
const SAFE_AREA_TOP_PAD_SM = "sm:pt-[max(1.25rem,var(--safe-area-top))]";

describe("searchPageShellStandalone contract", () => {
  it("owns the OS top inset without axis py-* that would fight side-specific pt-*", () => {
    expect(searchPageShellStandalone).toContain(SAFE_AREA_TOP_PAD);
    expect(searchPageShellStandalone).toContain(SAFE_AREA_TOP_PAD_SM);
    expect(searchPageShellStandalone).toContain("pb-4");
    expect(searchPageShellStandalone).toContain("sm:pb-8");
    // Axis padding would reintroduce the Tailwind sort-order dependency that
    // made per-page pt-* overrides fragile when cn() does not de-dupe utilities.
    expect(searchPageShellStandalone).not.toMatch(/(?:^|\s)py-\S+/);
    expect(searchPageShellStandalone).not.toMatch(/(?:^|\s)sm:py-\S+/);
    // Shell pages keep the ordinary py rhythm; standalone is the only owner of
    // max(safe-area-top) so future routes do not re-derive the values.
    expect(searchPageShell).toMatch(/(?:^|\s)py-3(?:\s|$)/);
    expect(searchPageShell).not.toContain("var(--safe-area-top)");
  });

  it("is the shell used by every production standalone search-page route", () => {
    const colourCoding = read("src/app/reference/colour-coding/page.tsx");
    expect(colourCoding).toContain("searchPageShellStandalone");
    expect(colourCoding).not.toMatch(/\bsearchPageShell\b(?!Standalone)/);

    // Quiet Signal privacy owns the same safe-area top pad on sticky chrome
    // rather than wrapping the page in the ordinary standalone shell string.
    const privacyPage = read("src/app/privacy/page.tsx");
    expect(privacyPage).toContain("PrivacyQuietSignalPage");
    expect(privacyPage).not.toMatch(/\bsearchPageShell\b(?!Standalone)/);
    const privacySurface = read("src/components/privacy-quiet-signal-page.tsx");
    expect(privacySurface).toContain(SAFE_AREA_TOP_PAD);
    expect(privacySurface).toContain(SAFE_AREA_TOP_PAD_SM);
  });

  it("renders the safe-area top pad and tap-token back row on /privacy", () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPage));
    expect(markup).toContain(SAFE_AREA_TOP_PAD);
    expect(markup).toContain(SAFE_AREA_TOP_PAD_SM);
    expect(markup).toContain("min-h-tap");
  });

  it("renders the same safe-area pad and tap-token back row on /reference/colour-coding", () => {
    const markup = renderToStaticMarkup(createElement(ColourCodingReferencePage));
    expect(markup).toContain(searchPageShellStandalone);
    expect(markup).toContain(SAFE_AREA_TOP_PAD);
    expect(markup).toContain(SAFE_AREA_TOP_PAD_SM);
    expect(markup).toContain("min-h-tap");
  });
});
