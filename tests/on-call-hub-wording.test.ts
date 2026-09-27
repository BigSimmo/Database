import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { FORBIDDEN_VERDICTS, readerFacingStrings } from "./helpers/reader-facing-strings";

/**
 * The hub pages (the kit and the five shift pages) render no verdict. The
 * directories are globbed, so a lane adds files without editing this test, and
 * a page folder that does not exist yet (`now/`) is skipped rather than failing.
 */
const HUB_DIRS = ["kit", "now", "whos-on", "call", "refer", "find"]
  .map((dir) => path.join("src/components/on-call", dir))
  .filter((dir) => existsSync(dir));
const EXTRA = [
  { pattern: /\bsafe\b/i, why: "a verdict on a number or a plan" },
  { pattern: /^\s*checked\b|\bchecked (on|\d)/i, why: "handbook rows have no trustworthy check date; say Updated" },
];

function files(): string[] {
  return HUB_DIRS.flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => /\.tsx?$/.test(name))
      .map((name) => path.join(dir, name)),
  ).concat(
    ["src/components/on-call/service-import-panel.tsx", "src/components/on-call/service-checking-panel.tsx"].filter(
      (file) => existsSync(file),
    ),
  );
}

describe("On Call hub pages render no verdict", () => {
  it("finds prose to check", () => {
    expect(files().flatMap((file) => readerFacingStrings(file)).length).toBeGreaterThan(10);
  });

  it("uses none of the banned words", () => {
    const hits = files()
      .flatMap((file) => readerFacingStrings(file))
      .flatMap(({ file, line, text }) =>
        [...FORBIDDEN_VERDICTS, ...EXTRA]
          .filter(({ pattern }) => pattern.test(text))
          .map(({ pattern, why }) => `${file}:${line} ${pattern} (${why}) ${JSON.stringify(text)}`),
      );
    expect(hits).toEqual([]);
  });
});
