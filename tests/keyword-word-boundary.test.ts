import { describe, expect, it } from "vitest";

import { matchesTermAtWordBoundary, matchesTermInWords, wordBoundaryWords } from "@/lib/keyword-query";

/**
 * `matchesTermAtWordBoundary` used to lowercase and split its haystack on every
 * call, so a caller scoring one document chunk against six query terms walked the
 * same multi-kilobyte string a dozen times. The haystack half is now split once by
 * `wordBoundaryWords` and reused via `matchesTermInWords`.
 *
 * These tests pin that the split-then-match pair answers exactly what the
 * single-call form answers, because the two now have to stay in step: a change to
 * the splitting rule in one without the other would silently change which terms a
 * search counts as covered.
 */

/** The implementation as it stood before the haystack split was hoisted. */
function singleCallWordBoundaryMatch(text: string, term: string) {
  if (!term) return false;
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((word) => word === term || word.startsWith(term));
}

const ALPHABET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJ0123456789 /-_.,()'\"éü\t\n";

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296;
}

describe("word-boundary term matching", () => {
  it("agrees with the single-call form across randomized text and terms", () => {
    const random = seededRandom(20260917);
    const build = (max: number) => {
      const length = Math.floor(random() * max);
      let out = "";
      for (let i = 0; i < length; i += 1) out += ALPHABET[Math.floor(random() * ALPHABET.length)];
      return out;
    };

    const failures: string[] = [];
    for (let i = 0; i < 30_000; i += 1) {
      const text = build(60);
      const term = build(8)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      const expected = singleCallWordBoundaryMatch(text, term);
      if (matchesTermAtWordBoundary(text, term) !== expected) failures.push(`single: ${JSON.stringify([text, term])}`);
      if (matchesTermInWords(wordBoundaryWords(text), term) !== expected) {
        failures.push(`split: ${JSON.stringify([text, term])}`);
      }
    }
    expect(failures.slice(0, 5)).toEqual([]);
  });

  it("keeps the clinical boundary rules the matcher exists for", () => {
    // A term must not hide inside a longer word...
    expect(matchesTermAtWordBoundary("adrenaline", "renal")).toBe(false);
    // ...but a word prefix still matches, so search-as-you-type works.
    expect(matchesTermAtWordBoundary("adrenaline", "adren")).toBe(true);
    // Non-alphanumerics split, so compound clinical tokens match on their parts.
    expect(matchesTermAtWordBoundary("IM/PO 5mg", "po")).toBe(true);
    expect(matchesTermAtWordBoundary("co-codamol", "codamol")).toBe(true);
    // An empty term never matches, on either entry point.
    expect(matchesTermAtWordBoundary("anything", "")).toBe(false);
    expect(matchesTermInWords(wordBoundaryWords("anything"), "")).toBe(false);
  });

  it("splits a haystack once into the words both entry points agree on", () => {
    expect(wordBoundaryWords("ECT (electroconvulsive therapy)")).toEqual(["ect", "electroconvulsive", "therapy", ""]);
    for (const term of ["ect", "electro", "therapy", "convulsive"]) {
      expect(matchesTermInWords(wordBoundaryWords("ECT (electroconvulsive therapy)"), term)).toBe(
        singleCallWordBoundaryMatch("ECT (electroconvulsive therapy)", term),
      );
    }
  });
});
