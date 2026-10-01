/** @vitest-environment jsdom */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

import { DsmSearchPage } from "@/components/dsm/dsm-search-page";
import { PhoneFooterLayerFrame } from "@/components/clinical-dashboard/phone-footer-layer-portal";
import type { DsmCategory, DsmDiagnosisSummary } from "@/lib/dsm";

vi.mock("@/components/clinical-dashboard/universal-search-also-matches", () => ({
  UniversalSearchAlsoMatches: () => <div data-testid="universal-search-also-matches">Also matches</div>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

function setupMatchMedia(isPhone: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => {
    return {
      matches: query.includes("max-width: 639px") ? isPhone : !isPhone,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    };
  });
}

const mockCategories: DsmCategory[] = [
  { key: "mood", label: "Mood disorders", diagnosis_count: 5 },
  { key: "anxiety", label: "Anxiety disorders", diagnosis_count: 5 },
];

const mockResults: DsmDiagnosisSummary[] = [
  {
    slug: "diag-1",
    title: "Major Depressive Disorder",
    icd_code: "F32",
    category: { key: "mood", label: "Mood disorders" },
    summary: "Depression summary",
    criteriaCount: 9,
    criteriaProvenance: "dsm_criteria",
    differentialCount: 4,
    specifierCount: 2,
  },
  {
    slug: "diag-2",
    title: "Bipolar I Disorder",
    icd_code: "F31",
    category: { key: "mood", label: "Mood disorders" },
    summary: "Bipolar summary",
    criteriaCount: 7,
    criteriaProvenance: "dsm_criteria",
    differentialCount: 3,
    specifierCount: 1,
  },
  {
    slug: "diag-3",
    title: "Generalized Anxiety Disorder",
    icd_code: "F41.1",
    category: { key: "anxiety", label: "Anxiety disorders" },
    summary: "GAD summary",
    criteriaCount: 6,
    criteriaProvenance: "dsm_criteria",
    differentialCount: 5,
    specifierCount: 0,
  },
  {
    slug: "diag-4",
    title: "Panic Disorder",
    icd_code: "F41.0",
    category: { key: "anxiety", label: "Anxiety disorders" },
    summary: "Panic summary",
    criteriaCount: 4,
    criteriaProvenance: "dsm_criteria",
    differentialCount: 2,
    specifierCount: 0,
  },
];

describe("Empirical Challenger M1-1: Stress-Testing Phone Chrome & Layout Stability", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/dsm/search?q=disorder");
    setupMatchMedia(true); // Default to phone viewport (<640px)
  });

  describe("1. DocumentViewer Invariant 4 Zero-Reserve Verification", () => {
    const docViewerSource = readFileSync("src/components/DocumentViewer.tsx", "utf8");

    it("verifies Invariant 4: hidden composer releases content padding to 0rem (max-sm:pb-0)", () => {
      expect(docViewerSource).toContain(': "max-sm:pb-0"');
      expect(docViewerSource).not.toContain(': "max-sm:pb-3"');
      expect(docViewerSource).toContain('Invariant 4 ("Hidden means zero reserve")');
    });

    it("verifies visible composer preserves full 9rem + safe-area + keyboard clearance", () => {
      expect(docViewerSource).toContain("max-sm:pb-[calc(9rem+var(--safe-area-bottom)+var(--keyboard-height,0px))]");
      expect(docViewerSource).toContain(
        "max-sm:[--phone-focus-bottom-clearance:calc(9rem+var(--safe-area-bottom)+var(--keyboard-height,0px))]",
      );
    });

    it("verifies DocumentViewer composer scroll-hide styling in globals.css", () => {
      const globalsCss = readFileSync("src/app/globals.css", "utf8");
      expect(globalsCss).toContain('.document-viewer-composer[data-scroll-hidden="true"]');
      expect(globalsCss).toContain("transform: translateY(calc(100% + max(0.75rem, var(--safe-area-bottom))));");
    });
  });

  describe("2. DSM Compare Strip: Multi-Item Selection & FIFO Lifecycle (0, 1, 2, 3, 4+ items)", () => {
    it("renders null and leaves portal host completely empty when 0 items selected", () => {
      render(
        <PhoneFooterLayerFrame className="phone-viewport-frame">
          <DsmSearchPage query="disorder" categories={mockCategories} results={mockResults} initialIds={[]} />
        </PhoneFooterLayerFrame>,
      );

      expect(screen.queryByTestId("dsm-search-compare-mobile")).toBeNull();
      const host = screen.getByTestId("phone-footer-layer-host");
      expect(host).toBeEmptyDOMElement();
    });

    it("handles 1, 2, 3 items and enforces FIFO shift on 4th item", async () => {
      const user = userEvent.setup();
      render(
        <PhoneFooterLayerFrame className="phone-viewport-frame">
          <DsmSearchPage query="disorder" categories={mockCategories} results={mockResults} initialIds={[]} />
        </PhoneFooterLayerFrame>,
      );

      expect(screen.queryByTestId("dsm-search-compare-mobile")).toBeNull();

      const compareButtons = screen.getAllByRole("button", { name: /Add .* to comparison/i });
      expect(compareButtons).toHaveLength(4);

      // Select item 1
      await user.click(compareButtons[0]);
      let mobileCompare = screen.getByTestId("dsm-search-compare-mobile");
      expect(mobileCompare).toBeVisible();
      expect(mobileCompare).toHaveTextContent("Compare1");
      expect(mobileCompare).toHaveAttribute("href", "/dsm/compare?ids=diag-1");

      // Verify it is mounted inside phone-footer-layer-host
      const host = screen.getByTestId("phone-footer-layer-host");
      expect(host).toContainElement(mobileCompare);

      // Select item 2
      await user.click(compareButtons[1]);
      mobileCompare = screen.getByTestId("dsm-search-compare-mobile");
      expect(mobileCompare).toHaveTextContent("Compare2");
      expect(mobileCompare).toHaveAttribute("href", "/dsm/compare?ids=diag-1%2Cdiag-2");

      // Select item 3
      await user.click(compareButtons[2]);
      mobileCompare = screen.getByTestId("dsm-search-compare-mobile");
      expect(mobileCompare).toHaveTextContent("Compare3");
      expect(mobileCompare).toHaveAttribute("href", "/dsm/compare?ids=diag-1%2Cdiag-2%2Cdiag-3");

      // Select item 4: FIFO rotation (diag-1 removed, diag-4 added)
      await user.click(compareButtons[3]);
      mobileCompare = screen.getByTestId("dsm-search-compare-mobile");
      expect(mobileCompare).toHaveTextContent("Compare3");
      expect(mobileCompare).toHaveAttribute("href", "/dsm/compare?ids=diag-2%2Cdiag-3%2Cdiag-4");

      // Deselect item 2 -> 2 left
      const removeBtn2 = screen.getByRole("button", { name: /Remove Bipolar I Disorder from comparison/i });
      await user.click(removeBtn2);
      mobileCompare = screen.getByTestId("dsm-search-compare-mobile");
      expect(mobileCompare).toHaveTextContent("Compare2");

      // Deselect item 3 -> 1 left
      const removeBtn3 = screen.getByRole("button", { name: /Remove Generalized Anxiety Disorder from comparison/i });
      await user.click(removeBtn3);
      mobileCompare = screen.getByTestId("dsm-search-compare-mobile");
      expect(mobileCompare).toHaveTextContent("Compare1");

      // Deselect item 4 -> 0 left
      const removeBtn4 = screen.getByRole("button", { name: /Remove Panic Disorder from comparison/i });
      await user.click(removeBtn4);
      expect(screen.queryByTestId("dsm-search-compare-mobile")).toBeNull();
      expect(host).toBeEmptyDOMElement();
    });
  });

  describe("3. DSM Compare Strip: Portalling, Breakpoints & Positioning Contracts", () => {
    it("ensures DsmMobileCompareStrip carries the .phone-footer-layer and responsive classes", () => {
      const dsmPageSource = readFileSync("src/components/dsm/dsm-search-page.tsx", "utf8");

      expect(dsmPageSource).toContain("<PhoneFooterLayerPortal>");
      expect(dsmPageSource).toContain("</PhoneFooterLayerPortal>");

      const stripLine = dsmPageSource.split("\n").find((line) => line.includes("dsm-mobile-compare-strip")) ?? "";
      expect(stripLine).toContain("phone-footer-layer");
      expect(stripLine).toContain("dsm-mobile-compare-strip");
      expect(stripLine).toContain("pointer-events-none");
      expect(stripLine).toContain("inset-x-0");
      expect(stripLine).toContain("z-[var(--z-chrome)]");
      expect(stripLine).toContain("pl-[max(1rem,env(safe-area-inset-left))]");
      expect(stripLine).toContain("pr-[max(1rem,env(safe-area-inset-right))]");
      expect(stripLine).toContain("sm:fixed");
      expect(stripLine).toContain("lg:hidden");

      expect(dsmPageSource).toContain('className="pointer-events-auto inline-flex min-h-tap w-full');
    });

    it("verifies portalling on phone (<640px) vs inline rendering on tablet/desktop (>=640px)", () => {
      // 1) On phone (<640px):
      setupMatchMedia(true);
      const { unmount } = render(
        <PhoneFooterLayerFrame className="phone-viewport-frame">
          <DsmSearchPage query="disorder" categories={mockCategories} results={mockResults} initialIds={["diag-1"]} />
        </PhoneFooterLayerFrame>,
      );

      const phoneHost = screen.getByTestId("phone-footer-layer-host");
      const comparePhone = screen.getByTestId("dsm-search-compare-mobile");
      expect(phoneHost).toContainElement(comparePhone);
      unmount();

      // 2) On tablet/desktop (>=640px):
      setupMatchMedia(false);
      render(
        <PhoneFooterLayerFrame className="phone-viewport-frame">
          <DsmSearchPage query="disorder" categories={mockCategories} results={mockResults} initialIds={["diag-1"]} />
        </PhoneFooterLayerFrame>,
      );

      const tabletHost = screen.getByTestId("phone-footer-layer-host");
      const compareTablet = screen.getByTestId("dsm-search-compare-mobile");
      // Must NOT be in the phone-footer-layer-host; must render inline!
      expect(tabletHost).not.toContainElement(compareTablet);
    });

    it("verifies container clearance replaces max-lg double padding with sm:max-lg:pb-16", () => {
      const dsmPageSource = readFileSync("src/components/dsm/dsm-search-page.tsx", "utf8");
      expect(dsmPageSource).toContain('selected.length > 0 && "sm:max-lg:pb-16"');
      expect(dsmPageSource).not.toContain("max-lg:pb-[calc(4rem+var(--safe-area-bottom))]");
    });
  });

  describe("4. Scroll-Hide CSS Rules & Motion Invariants", () => {
    const globalsCss = readFileSync("src/app/globals.css", "utf8");

    it("verifies scroll-hidden translate calculation clears the full element and bottom dock", () => {
      expect(globalsCss).toContain(
        "transform: translateY(calc(100% + 5.5rem + var(--safe-area-bottom, 0px) + var(--keyboard-height, 0px) + 0.5rem));",
      );
      expect(globalsCss).toContain("opacity: 0;");
      expect(globalsCss).toContain("pointer-events: none;");
    });

    it("verifies motion durations and easing synchronize with chrome contracts", () => {
      expect(globalsCss).toMatch(
        /transition:\s*transform\s+var\(--duration-moderate\)\s+var\(--ease-chrome-reveal\),\s*opacity\s+var\(--duration-moderate\)\s+var\(--ease-chrome-reveal\);/,
      );
      expect(globalsCss).toMatch(
        /transition:\s*transform\s+var\(--duration-slow\)\s+var\(--ease-chrome-hide\),\s*opacity\s+var\(--duration-slow\)\s+var\(--ease-chrome-hide\);/,
      );
    });

    it("verifies reduced-motion overrides are present for both media query and data-motion attribute", () => {
      expect(globalsCss).toContain("@media (prefers-reduced-motion: reduce)");
      expect(globalsCss).toContain('.dsm-mobile-compare-strip[data-scroll-hidden="true"]');

      expect(globalsCss).toContain('html[data-motion="reduced"] .dsm-mobile-compare-strip');
      expect(globalsCss).toContain('html[data-motion="reduced"] .dsm-mobile-compare-strip[data-scroll-hidden="true"]');
    });
  });

  describe("5. Standalone PWA Architecture Contract", () => {
    const globalsCss = readFileSync("src/app/globals.css", "utf8");

    it("verifies phone-footer-layer is position: absolute in standalone PWA mode", () => {
      const standalonePwaMatch = globalsCss.match(
        /@media\s*\(max-width:\s*639px\)\s*and\s*\(display-mode:\s*standalone\)[\s\S]*?\.phone-footer-layer\s*\{[\s\S]*?position:\s*absolute;/,
      );
      expect(standalonePwaMatch).toBeTruthy();
    });

    it("verifies phone-footer-layer is position: fixed in standard browser mode", () => {
      const standardMatch = globalsCss.match(/\.phone-footer-layer\s*\{[\s\S]*?position:\s*fixed;/);
      expect(standardMatch).toBeTruthy();
    });
  });
});
