// tests/ward-design-language-canonical.test.ts
//
// ⚠️ `npm run test:focused` CAN NEVER SELECT THIS FILE. That command is
// `vitest related --run`, which picks by the import graph, and this file imports
// nothing from `src/` — it reads HTML off disk. A focused run that comes back
// green has not run this guard, and the guard is the only thing standing between
// the second-edition style block and four hand-edited copies of it. Run it by
// name, or let the full suite run it.
//
// WHY THIS EXISTS. The second-edition design language is one <style> block that
// lives in `design-language.html` and is copied verbatim into each mockup that
// uses it, with each screen's own rules appended below a marker. Nothing in this
// repository checked that the copies still matched. On 2026-09-05 the print
// block inside that language was fixed at its source and three mockups were
// re-cut from it BY HAND, which is exactly the operation this test exists to
// catch when it goes wrong.
//
// WHY IT NAMES ITS MEMBERS instead of matching a filename pattern. The plan that
// specified this test filtered `/^mockup-.*-v3\.html$/`, which would have
// omitted `mockup-ward-home-v4.html` — the file the owner locked in as the ward
// home spec that same day. A pattern silently defines its own population, so a
// new second-edition mockup joins the folder and the guard keeps passing without
// ever having looked at it. An explicit list cannot do that: adding a file is a
// deliberate edit here, and removing one goes red.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DIR = join(process.cwd(), "docs/ward-flow/design/prototypes");

/** The source of record. Its whole style block IS the language. */
const SOURCE = "design-language.html";

/**
 * Every file that carries a copy of the second-edition block. Listed, not
 * discovered — see the header. If you add a second-edition mockup, add it here;
 * if you retire one, remove it here and say so in the commit.
 */
/*
 * ⚠️ THE FOUR STATISTICS PROTOTYPES JOINED THIS FOLDER ON 2026-09-05 AND WERE NOT LISTED, so this
 * guard was red on the integration line and nobody noticed — the ward suite was being checked from
 * hand-picked file lists, and no list anyone typed included this file.
 *
 * The guard did its job exactly as designed: it names the arrivals rather than counting them, so
 * the failure said which four files carried the second-edition block without being registered.
 * Adding them is the whole fix; the block itself was already byte-identical, which is the property
 * the assertions below check.
 */
const CARRIERS = [
  "mockup-ward-home-v4.html",
  "mockup-ward-home-v3.html",
  "mockup-ward-board-v3.html",
  "mockup-statistics-cmht-v1.html",
  "mockup-statistics-ed-v1.html",
  "mockup-statistics-overview-v1.html",
  "mockup-statistics-ward-v1.html",
] as const;

function styleBlock(file: string): string {
  const html = readFileSync(join(DIR, file), "utf8");
  const open = html.indexOf("<style>");
  expect(open, `${file} has no <style> block`).toBeGreaterThan(-1);
  const from = open + "<style>".length;
  const close = html.indexOf("</style>", from);
  expect(close, `${file} has no closing </style>`).toBeGreaterThan(-1);
  return html.slice(from, close);
}

describe("the second-edition design language lives in exactly one place", () => {
  const canonical = styleBlock(SOURCE);

  it("the source of record is a real style block, not an empty one", () => {
    // Floor the POPULATION this test walks, never the finding. A byte-identity
    // check against an empty string passes for every file on disk.
    expect(canonical.length).toBeGreaterThan(20_000);
    expect(canonical).toContain("--accent:");
    expect(canonical).toContain("@media print");
    expect(canonical).toContain("@media (forced-colors: active)");
  });

  it("every listed carrier still exists in the folder", () => {
    const onDisk = new Set(readdirSync(DIR));
    for (const file of CARRIERS) expect(onDisk.has(file), `${file} is listed here but not on disk`).toBe(true);
  });

  it("no second-edition mockup has joined the folder without being listed here", () => {
    // The complement of the explicit list: a file carrying the block's own
    // fingerprint but absent from CARRIERS is the case a pattern would have
    // missed silently. `design-language.html` is the source, not a carrier.
    const fingerprint = canonical.slice(0, 400);
    const unlisted = readdirSync(DIR)
      .filter((f) => f.endsWith(".html") && f !== SOURCE && !CARRIERS.includes(f as (typeof CARRIERS)[number]))
      .filter((f) => readFileSync(join(DIR, f), "utf8").includes(fingerprint));
    expect(
      unlisted,
      `these carry the second-edition block but are not listed in CARRIERS: ${unlisted.join(", ")}`,
    ).toEqual([]);
  });

  it.each(CARRIERS)("%s begins with the canonical block, byte for byte", (file) => {
    const block = styleBlock(file);
    // Report WHERE it diverged rather than just that it did — a boolean on a
    // 40,000-character string sends the next reader to diff two files by hand.
    if (!block.startsWith(canonical)) {
      let i = 0;
      while (i < canonical.length && block[i] === canonical[i]) i += 1;
      const line = canonical.slice(0, i).split("\n").length;
      throw new Error(
        `${file} diverges from ${SOURCE} at character ${i} (line ${line} of the block).\n` +
          `  ${SOURCE} has: ${JSON.stringify(canonical.slice(i, i + 70))}\n` +
          `  ${file} has: ${JSON.stringify(block.slice(i, i + 70))}\n` +
          `Do not hand-patch the copy. Edit ${SOURCE} and re-cut the mockups from it.`,
      );
    }
    expect(block.startsWith(canonical)).toBe(true);
  });

  it("a carrier may add rules below the block but never above it", () => {
    // The marker convention: each screen's own rules follow the copied block.
    // A rule inserted ABOVE it would be overridden by the copy and read as dead
    // code, and `startsWith` above is what makes that impossible — this test
    // states the intent so the next reader knows the ordering is deliberate.
    for (const file of CARRIERS) {
      const block = styleBlock(file);
      expect(block.length).toBeGreaterThanOrEqual(canonical.length);
    }
  });
});
