import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CAPACITY_FIGURE_LABELS } from "@/components/ward-management/ward-morning-rollup";

/**
 * OWNER RULING R-B-09, 2026-09-04 — "READY", EVERYWHERE — CHECKED WHERE IT WAS RULED: EVERYWHERE.
 *
 * `min(allocatable, empty)` is the beds a coordinator can actually put somebody in. It was rendered
 * seven different ways across this product, and the owner replaced all seven with one word:
 * `docs/ward-flow/owner-rulings-2026-09-04-decision-batch.md` R-B-09, census in
 * `docs/ward-flow/bed-figure-wording-census-2026-09-04.md` §2.
 *
 * ⚠️ **THE RENAME FOLLOWED THE LABEL CONSTANT, SO IT MOVED EVERY LABEL AND NO SENTENCE.**
 * `CAPACITY_FIGURE_LABELS.availableNow` became `"Ready"` and every figure reading it changed with
 * it. Four rendered strings named the same figure in PROSE — two governance banners, a panel
 * caption, a referral sentence — and prose reads no constant, so all four kept the retired name and
 * nothing failed. The worst sat two lines above a card labelled `Ready` computed from the same
 * `headline.availableNow`: **one number, two names, adjacent, on one screen**, which is the precise
 * defect the ruling exists to end, surviving inside the screen that displays the ruled vocabulary.
 *
 * ⚠️ **AND THE ONLY GUARD THAT EXISTED WAS PER-SCREEN WHILE THE RULING IS PRODUCT-WIDE.**
 * `tests/ward-screen-capacity-wording.dom.test.tsx` pins that ONE screen uses ONE word for ONE
 * value. That is correct, and it is not this: it cannot see a second screen using a different word,
 * because it never looks at one. This file is the product-wide half.
 *
 * ⚠️ **WHY THE BANNED LIST IS THREE PHRASES AND NOT THE WORD "free".** The census's own rule is
 * RENAMED BY ARITHMETIC, NEVER BY WORD: several sites say "free" or "available" about a DIFFERENT
 * quantity, and relabelling one of those would put one number's name on another — the very defect
 * being repaired. So this file bans only phrasings that, in this codebase, can name nothing else:
 *
 *   - `"available now"`      — census row 2; every occurrence read `min(allocatable, empty)`
 *   - `"you can fill today"` — census row 1, the ward-board headline
 *   - `"no bed free"`        — census row 7, the same quantity stated as an absence
 *
 * ⚠️ **`ward-eligibility.ts`'s `"has no free bed"` IS A DELIBERATE NEAR-MISS AND MUST STAY LEGAL.**
 * It reads `unit.allocatable.value <= 0` — raw allocatable, not the min — so it describes a
 * different number and R-B-09 does not reach it. A reader who notices that `"no bed free"` is
 * banned while `"no free bed"` is not is looking at a real distinction rather than a hole in the
 * pattern: the two phrases are about two quantities. If that sentence is ever rewritten to describe
 * the min, it must take the ruled word with it.
 *
 * The scan strips comments before matching. Every retired phrase still appears in prose ACCOUNTS of
 * what the product used to say — `ward-board.tsx` describes its own old headline — and history is
 * not a competing live term. A guard that could not tell those apart would force the record to be
 * deleted to stay green, which is how this project loses its reasons.
 */

const WARD_ROOT = "src/components/ward-management";

/** Every phrasing R-B-09 retired that cannot, in this codebase, name a different quantity. */
const RETIRED_RENDERINGS = [
  { phrase: "available now", pattern: /available\s+now/i },
  { phrase: "you can fill today", pattern: /you\s+can\s+fill\s+today/i },
  { phrase: "no bed free", pattern: /no\s+bed\s+free/i },
] as const;

/**
 * The floor is on the POPULATION WALKED, never on the number of violations found. A count-based
 * floor goes red the day the last defect is fixed; a population floor goes red the day the walk
 * stops reaching the files, which is the failure that would otherwise be silent.
 */
const MINIMUM_WARD_SOURCE_FILES = 80;

function wardSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(path)) found.push(path.replaceAll("\\", "/"));
    }
  };
  walk(WARD_ROOT);
  return found;
}

/**
 * Block and line comments become spaces; newlines survive, so a reported line number is the line a
 * reader will open. String CONTENTS are deliberately not stripped — a rendered label is a string
 * literal, and stripping strings would leave this file scanning identifiers only.
 */
function stripComments(source: string): string {
  let out = "";
  let index = 0;
  let state: "code" | "block" | "line" = "code";
  while (index < source.length) {
    const here = source[index];
    const next = source[index + 1];
    if (state === "code") {
      if (here === "/" && next === "*") {
        state = "block";
        out += "  ";
        index += 2;
        continue;
      }
      if (here === "/" && next === "/") {
        state = "line";
        out += "  ";
        index += 2;
        continue;
      }
      out += here;
      index += 1;
      continue;
    }
    if (state === "block") {
      if (here === "*" && next === "/") {
        state = "code";
        out += "  ";
        index += 2;
        continue;
      }
      out += here === "\n" ? "\n" : " ";
      index += 1;
      continue;
    }
    if (here === "\n") {
      state = "code";
      out += "\n";
      index += 1;
      continue;
    }
    out += " ";
    index += 1;
  }
  return out;
}

function retiredRenderingsIn(source: string, label: string): string[] {
  const hits: string[] = [];
  stripComments(source)
    .split("\n")
    .forEach((line, offset) => {
      for (const { phrase, pattern } of RETIRED_RENDERINGS) {
        if (pattern.test(line)) hits.push(`${label}:${offset + 1} — "${phrase}"`);
      }
    });
  return hits;
}

describe("R-B-09: one word for min(allocatable, empty), product-wide", () => {
  it("walks the whole ward source tree", () => {
    expect(
      wardSourceFiles().length,
      "the walk stopped reaching ward source, so every assertion below would pass over an empty set",
    ).toBeGreaterThan(MINIMUM_WARD_SOURCE_FILES);
  });

  it("catches a retired rendering, and stays silent on a sentence about a different quantity", () => {
    /*
     * The positive control lives HERE rather than in a scratch script, so it runs on every pass and
     * a detector that has silently stopped matching cannot report green. Both directions are
     * asserted: a green run must mean the scan CAN fail, not merely that it found nothing.
     */
    const wouldCatch = retiredRenderingsIn(
      'const caption = "Available now is never softened by an expected bed.";',
      "fixture",
    );
    expect(wouldCatch, "the detector no longer sees the retired rendering it is the only guard for").toHaveLength(1);

    const mustNotCatch = retiredRenderingsIn(
      [
        // Raw `allocatable`, not the min — a different number, correctly still described as free.
        "return `${unit.name} has no free bed`;",
        // "free" about text, and about a bed emptying later. Neither is this figure.
        "<strong>The written history is free text.</strong>",
        "{count} beds expected to free today.",
        // The ruled word itself must obviously be legal.
        `<span>${CAPACITY_FIGURE_LABELS.availableNow}</span>`,
      ].join("\n"),
      "fixture",
    );
    expect(
      mustNotCatch,
      "the detector fired on a sentence about a DIFFERENT quantity — renaming that would put one " +
        "number's name on another, which is the defect R-B-09 exists to end",
    ).toEqual([]);
  });

  it("renders no retired name for this figure anywhere in ward source", () => {
    const offenders = wardSourceFiles().flatMap((file) => retiredRenderingsIn(readFileSync(file, "utf8"), file));
    expect(
      offenders,
      "these rendered strings still call min(allocatable, empty) by a name the owner retired on " +
        "2026-09-04 (R-B-09, one word for one number). The repair is the ruled word, " +
        `"${CAPACITY_FIGURE_LABELS.availableNow}" — not a new phrasing, and not a relaxation here. ` +
        "If a hit describes a DIFFERENT quantity, say which arithmetic it reads before exempting it.",
    ).toEqual([]);
  });
});
