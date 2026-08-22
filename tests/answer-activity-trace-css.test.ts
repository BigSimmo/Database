import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const answerStatusSource = readFileSync(
  new URL("../src/components/clinical-dashboard/answer-status.tsx", import.meta.url),
  "utf8",
);

function keyframes(name: string) {
  const start = globalsCss.indexOf(`@keyframes ${name}`);
  expect(start, `${name} keyframes are missing`).toBeGreaterThanOrEqual(0);

  let depth = 0;
  let opened = false;
  for (let index = start; index < globalsCss.length; index += 1) {
    if (globalsCss[index] === "{") {
      depth += 1;
      opened = true;
    } else if (globalsCss[index] === "}") {
      depth -= 1;
      if (opened && depth === 0) return globalsCss.slice(start, index + 1);
    }
  }

  throw new Error(`${name} keyframes are unterminated`);
}

describe("answer activity trace CSS", () => {
  it("does not paint-contain the animated SVG on WebKit", () => {
    expect(globalsCss).not.toMatch(/\.answer-activity-trace\s*{[^}]*contain:\s*paint;/s);
  });

  it("travels with transform instead of WebKit-unreliable SVG dash offsets", () => {
    const scroll = keyframes("answer-ecg-scroll");

    // translate3d only. A whole-line opacity pulse (the previous shape) technically
    // ran on WebKit but was too subtle on a phone hairline to read as motion, and
    // SVG dash offsets before that could animate without repainting at all.
    expect(scroll).toMatch(/transform:\s*translate3d\(0,\s*0,\s*0\);/);
    expect(scroll).toMatch(/transform:\s*translate3d\(-50%,\s*0,\s*0\);/);
    expect(scroll).not.toMatch(/stroke-dashoffset/);
    expect(scroll).not.toMatch(/opacity/);
  });

  it("hosts the animation on a regular HTML compositor layer instead of an SVG path", () => {
    expect(answerStatusSource).toMatch(/<span[^>]*data-slot="answer-activity-trace-sweep"/s);
    expect(answerStatusSource).not.toMatch(/<path[^>]*data-slot="answer-activity-trace-sweep"/s);
    expect(globalsCss).toMatch(/\.answer-activity-trace__sweep\s*{[^}]*will-change:\s*transform;/s);
    // The strip is 200% wide and holds two copies, so -50% is exactly one copy and
    // the loop has no seam. Without both halves the animation jumps every cycle.
    expect(answerStatusSource).toMatch(/answer-activity-trace__sweep[^"]*w-\[200%\]/);
    expect(answerStatusSource).toMatch(/\[0,\s*1\]\.map/);
  });

  it("gets its own compositor layer so WebKit repaints the moving strip", () => {
    expect(globalsCss).toMatch(/\.answer-activity-trace\s*{[^}]*isolation:\s*isolate;/s);
    expect(globalsCss).toMatch(/\.answer-activity-trace\s*{[^}]*transform:\s*translateZ\(0\);/s);
  });

  it("keeps the trace visible when motion is suppressed", () => {
    // Regression guard for the defect this file's earlier revisions missed entirely:
    // `opacity: 0` under reduced motion deleted the only progress indicator on the
    // panel, so every user with OS Reduce Motion on watched a frozen, blank box.
    // Suppressing motion must leave a static trace, never remove it.
    const suppressions = [...globalsCss.matchAll(/\.answer-activity-trace__sweep\s*{([^}]*)}/g)].map(
      (match) => match[1] ?? "",
    );
    const stopped = suppressions.filter((body) => /animation:\s*none/.test(body));

    expect(stopped.length, "expected reduced-motion and data-motion=reduced rules").toBeGreaterThanOrEqual(2);
    for (const body of stopped) {
      expect(body).not.toMatch(/opacity:\s*0\s*;/);
      expect(body).toMatch(/opacity:\s*0\.\d+;/);
    }
  });

  it("lets the in-app motion preference opt back in over the OS setting", () => {
    // iOS Reduce Motion is commonly on for reasons unrelated to vestibular
    // sensitivity. Without this override there is no in-app way to get the
    // answer-progress feedback back on a physical iPhone.
    expect(globalsCss).toMatch(/@custom-variant\s+motion-reduce\s*{/);
    expect(globalsCss).toMatch(/@custom-variant\s+motion-safe\s*{/);
    expect(globalsCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\) {\s*html:not\(\[data-motion="full"\]\) \.answer-activity-trace__sweep/s,
    );
    // The universal suppression is what froze the step spinner; it must be gated too.
    expect(globalsCss).toMatch(/html:not\(\[data-motion="full"\]\) \*,/);
  });
});
