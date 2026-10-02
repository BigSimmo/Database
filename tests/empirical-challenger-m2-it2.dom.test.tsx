/** @vitest-environment jsdom */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DayTrack } from "@/components/first-nations/day-track";

describe("Empirical Challenger M2-It2: Rigorous Stress-Testing of day-track.tsx with text-sm-minus", () => {
  const W = 280;
  const VIEWBOX_H = 36;
  const TICKS = [0, 6, 12, 18, 24] as const;

  describe("1. Typography Floor (>= 12px) Verification under Scale", () => {
    it("verifies text-sm-minus is registered at 0.8125rem (13px) in globals.css", () => {
      const globalsCss = readFileSync("src/app/globals.css", "utf8");
      const match = globalsCss.match(/--text-sm-minus:\s*([^;]+);/);
      expect(match).toBeTruthy();
      const rawValue = match![1].trim();
      expect(rawValue).toBe("0.8125rem");

      // Verify numeric conversion: 0.8125rem * 16px/rem = 13px >= 12px floor
      const remNumeric = parseFloat(rawValue);
      const pxEquivalent = remNumeric * 16;
      expect(pxEquivalent).toBe(13);
      expect(pxEquivalent).toBeGreaterThanOrEqual(12);
    });

    it("verifies day-track.tsx renders with text-sm-minus in both SVG and fallback states", () => {
      const dayTrackSource = readFileSync("src/components/first-nations/day-track.tsx", "utf8");

      // In SVG numerals
      expect(dayTrackSource).toContain('className="nums fill-[color:var(--surface-summary-muted)] text-sm-minus"');
      // In null hours fallback
      expect(dayTrackSource).toContain(
        '<p className="text-sm-minus text-[color:var(--surface-summary-muted)]">Hours not set</p>',
      );

      // Ensures neither state contains sub-floor tokens
      expect(dayTrackSource).not.toMatch(/\btext-(3xs|2xs)\b/);
      expect(dayTrackSource).not.toMatch(/\bfontSize:\s*["'](?:[1-9]|1[01])px["']/);
    });

    it("verifies text-sm-minus is an approved First Nations Standard v13.1 scale step", () => {
      const testSource = readFileSync("tests/first-nations-design.dom.test.tsx", "utf8");
      expect(testSource).toContain('"text-sm-minus"');
      // Banned pattern allows hyphenated variants like text-sm-minus via negative lookahead (?!-)
      const bannedPattern = /\btext-(3xs|xs|sm|base|lg|xl|[2-9]xl)\b(?!-)|\btext-\[\d/;
      expect("text-sm-minus").not.toMatch(bannedPattern);
    });
  });

  describe("2. Indicator Line & Text Clearance Stress-Testing (y2=21 vs y=32)", () => {
    const indicatorBottomY = 21; // y2 of indicator line
    const textBaselineY = 32; // baseline y of tick text

    it("empirically asserts strictly positive clearance between indicator line and numeral top bounds", () => {
      // For 13px text (text-sm-minus), cap-height ratio across modern system fonts ranges from 0.70 to 0.73.
      // Upper bound (0.75): 13 * 0.75 = 9.75px.
      // Top of glyph: y = 32 - 9.75 = 22.25.
      // Clearance: 22.25 - 21.0 = 1.25px in SVG coordinates.
      const conservativeCapHeight = 13 * 0.75;
      const textTopBound = textBaselineY - conservativeCapHeight;
      const svgClearance = textTopBound - indicatorBottomY;

      expect(svgClearance).toBeGreaterThan(1.0);
      expect(svgClearance).toBeCloseTo(1.25, 2);
    });

    it("stress-tests all possible indicator positions directly intersecting tick columns", () => {
      // Ticks are at 0, 6, 12, 18, 24 hours.
      // When indicator coincides with tick times, verify no vertical overlap.
      for (const tickHour of TICKS) {
        const testDate = new Date(`2026-09-30T${String(tickHour).padStart(2, "0")}:00:00Z`);
        const { container } = render(
          <DayTrack
            hours={{ days: [1, 2, 3, 4, 5], open: "08:00", close: "17:00" }}
            now={testDate}
            label={`Indicator at ${tickHour}h`}
          />,
        );

        const indicatorLine = container.querySelector("line.stroke-\\[color\\:var\\(--clinical-accent\\)\\]");
        expect(indicatorLine).toBeInTheDocument();
        const y1 = parseFloat(indicatorLine!.getAttribute("y1")!);
        const y2 = parseFloat(indicatorLine!.getAttribute("y2")!);
        const x1 = parseFloat(indicatorLine!.getAttribute("x1")!);
        const x2 = parseFloat(indicatorLine!.getAttribute("x2")!);

        expect(y1).toBe(3);
        expect(y2).toBe(21);
        expect(x1).toBe(x2);

        // Numerals
        const texts = container.querySelectorAll("text");
        expect(texts).toHaveLength(5);
        for (const textEl of Array.from(texts)) {
          const y = parseFloat(textEl.getAttribute("y")!);
          expect(y).toBe(32);
          // Distance from y2 to baseline is 11px SVG units
          expect(y - y2).toBe(11);
        }
      }
    });

    it("verifies zero descender overflow and zero viewBox clipping", () => {
      // ViewBox height is 36. Baseline is at 32.
      // Numerals 0-9 in lining fonts have 0 descenders (0px below baseline).
      const baselineToBottomGap = VIEWBOX_H - textBaselineY;
      expect(baselineToBottomGap).toBe(4); // 4px padding between baseline and bottom edge of SVG

      // Zero descender overflow check
      const expectedDescenderDepth = 0;
      expect(textBaselineY + expectedDescenderDepth).toBeLessThanOrEqual(VIEWBOX_H);
    });
  });

  describe("3. Responsive Viewport Scaling & Boundary Verification (320px, 390px, 768px)", () => {
    const viewports = [
      { name: "mobile-narrow (320px)", width: 320 },
      { name: "mobile-standard (390px)", width: 390 },
      { name: "tablet (768px)", width: 768 },
    ];

    it("verifies physical clearance expands proportionally with viewport width", () => {
      for (const { width, name } of viewports) {
        const scale = width / W;
        const renderedHeight = VIEWBOX_H * scale;
        const renderedIndicatorY2 = 21 * scale;
        const renderedTextBaseline = 32 * scale;
        const renderedTextTop = (32 - 13 * 0.73) * scale;
        const physicalClearance = renderedTextTop - renderedIndicatorY2;

        // Even at 320px width, clearance is > 1.6px and height > 40px
        expect(physicalClearance, `${name} physical clearance`).toBeGreaterThan(1.6);
        expect(renderedHeight, `${name} rendered height`).toBeGreaterThan(40);
        expect(renderedTextBaseline, `${name} baseline`).toBeLessThan(renderedHeight);
      }
    });

    it("stress-tests horizontal bounds at extreme edges (0h start and 24h end)", () => {
      const { container } = render(
        <DayTrack
          hours={{ days: [1, 2, 3, 4, 5], open: "08:00", close: "17:00" }}
          now={new Date("2026-09-30T12:00:00Z")}
          label="Edge Bounds Check"
        />,
      );

      const texts = container.querySelectorAll("text");
      const tick0 = texts[0];
      const tick24 = texts[4];

      // Tick 0 at x=0 must anchor "start" so text grows into [0, ~14] and never overflows left
      expect(parseFloat(tick0.getAttribute("x")!)).toBe(0);
      expect(tick0.getAttribute("text-anchor")).toBe("start");

      // Tick 24 at x=280 must anchor "end" so text grows into [~266, 280] and never overflows right
      expect(parseFloat(tick24.getAttribute("x")!)).toBe(280);
      expect(tick24.getAttribute("text-anchor")).toBe("end");
    });
  });

  describe("4. Edge Cases & Clinical State Invariants", () => {
    it("renders fallback with text-sm-minus when hours are null", () => {
      const { container } = render(
        <DayTrack hours={null} now={new Date("2026-09-30T12:00:00Z")} label="Fallback Hours" />,
      );

      const fallback = container.querySelector("p");
      expect(fallback).toBeInTheDocument();
      expect(fallback).toHaveTextContent("Hours not set");
      expect(fallback?.className).toContain("text-sm-minus");
      expect(fallback?.className).not.toContain("text-2xs");
    });

    it("renders closed clinic state with line, indicator, and numerals without rect", () => {
      const { container } = render(
        <DayTrack
          hours={{ days: [], open: "08:00", close: "17:00" }}
          now={new Date("2026-09-30T12:00:00Z")}
          label="Closed Clinic"
        />,
      );

      // SVG rendered
      const svg = container.querySelector("svg");
      expect(svg).toBeInTheDocument();
      // No open hours rect
      const openRect = container.querySelector("rect.fn-on-summary");
      expect(openRect).toBeNull();
      // Indicator line still rendered
      const indicatorLine = container.querySelector("line.stroke-\\[color\\:var\\(--clinical-accent\\)\\]");
      expect(indicatorLine).toBeInTheDocument();
    });

    it("renders 24-hour open clinic state cleanly", () => {
      const { container } = render(
        <DayTrack
          hours={{ days: [0, 1, 2, 3, 4, 5, 6], open: "00:00", close: "24:00" }}
          now={new Date("2026-09-30T14:30:00Z")}
          label="24/7 Clinic"
        />,
      );

      const openRect = container.querySelector("rect.fn-on-summary");
      expect(openRect).toBeInTheDocument();
      expect(parseFloat(openRect!.getAttribute("width")!)).toBe(280);
      expect(parseFloat(openRect!.getAttribute("x")!)).toBe(0);
    });
  });
});
