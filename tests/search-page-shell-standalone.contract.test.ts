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

const STANDALONE_PAGES = ["src/app/privacy/page.tsx", "src/app/reference/colour-coding/page.tsx"] as const;

describe("searchPageShellStandalone contract", () => {
  it("owns the OS top inset without axis py-* that would fight side-specific pt-*", () => {
    expect(searchPageShellStandalone).toContain("pt-[max(0.75rem,var(--safe-area-top))]");
    expect(searchPageShellStandalone).toContain("sm:pt-[max(1.25rem,var(--safe-area-top))]");
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
    for (const relativePath of STANDALONE_PAGES) {
      const source = read(relativePath);
      expect(source, relativePath).toContain("searchPageShellStandalone");
      expect(source, relativePath).not.toMatch(/\bsearchPageShell\b(?!Standalone)/);
    }
  });

  it("renders the safe-area top pad and tap-token back row on /privacy", () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPage));
    expect(markup).toContain(searchPageShellStandalone);
    expect(markup).toContain("pt-[max(0.75rem,var(--safe-area-top))]");
    expect(markup).toContain("sm:pt-[max(1.25rem,var(--safe-area-top))]");
    expect(markup).toContain("min-h-tap");
    expect(markup).not.toContain("min-h-12");
  });

  it("renders the same safe-area pad and tap-token back row on /reference/colour-coding", () => {
    const markup = renderToStaticMarkup(createElement(ColourCodingReferencePage));
    expect(markup).toContain(searchPageShellStandalone);
    expect(markup).toContain("pt-[max(0.75rem,var(--safe-area-top))]");
    expect(markup).toContain("sm:pt-[max(1.25rem,var(--safe-area-top))]");
    expect(markup).toContain("min-h-tap");
  });
});
