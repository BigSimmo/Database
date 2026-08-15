import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const globalsCss = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

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

  it("cycles through the positive dash-offset equivalent for WebKit", () => {
    const sweep = keyframes("answer-ecg-sweep");

    expect(sweep).toMatch(/from\s*{\s*stroke-dashoffset:\s*320;/);
    expect(sweep).toMatch(/to\s*{\s*stroke-dashoffset:\s*0;/);
    expect(sweep).not.toMatch(/stroke-dashoffset:\s*-/);
  });
});
