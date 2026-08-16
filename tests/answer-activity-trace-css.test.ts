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

  it("pulses with opacity instead of WebKit-unreliable SVG dash offsets", () => {
    const pulse = keyframes("answer-ecg-pulse");

    expect(pulse).toMatch(/opacity:\s*0\.2;/);
    expect(pulse).toMatch(/opacity:\s*1;/);
    expect(pulse).not.toMatch(/stroke-dashoffset/);
  });

  it("hosts the animation on a regular HTML compositor layer instead of an SVG path", () => {
    expect(answerStatusSource).toMatch(/<span[^>]*data-slot="answer-activity-trace-sweep"/s);
    expect(answerStatusSource).not.toMatch(/<path[^>]*data-slot="answer-activity-trace-sweep"/s);
    expect(globalsCss).toMatch(/\.answer-activity-trace__sweep\s*{[^}]*will-change:\s*opacity;/s);
  });
});
