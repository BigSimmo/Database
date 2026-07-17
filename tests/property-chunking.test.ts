import fc from "fast-check";
import "./property-seed";
import { describe, expect, it } from "vitest";
import { chunkTextWithOverlap } from "../src/lib/chunking";

// Properties: chunking always terminates and never loses or invents content.
//
// The 2026-07-01 audit found chunkTextBySentence could spin forever when
// CHUNK_OVERLAP >= CHUNK_SIZE (M17) — both values pass env validation
// independently, so the combination is reachable by configuration alone. The
// generators here include that region on purpose: completion of every run IS
// the termination proof (vitest's 15s test timeout is the backstop).
//
// The generated text avoids line shapes removePageNoise is contracted to drop
// (standalone page footers, bare page numbers, boilerplate) so the coverage
// assertions target the chunker itself, not the noise filter: every paragraph
// starts with an alphabetic word and no vocabulary word can form a
// noise-pattern line.

const vocabulary = [
  "monitor",
  "serum",
  "level",
  "renal",
  "function",
  "clozapine",
  "lithium",
  "review",
  "daily",
  "weekly",
  "titrate",
  "dose",
  "before",
  "after",
  "the",
  "and",
  "with",
  "until",
  "stable",
  "baseline",
  "thyroid",
  "calcium",
  "escalate",
  "urgent",
  "assessment",
  "12.5",
  "mg",
  "0.8-1.2",
  "mmol",
] as const;

const word = fc.constantFrom(...vocabulary);
// removePageNoise treats whole lines of <= 2 characters as extraction debris
// (looksLikeMetadataNoise), so every paragraph anchors on a word long enough
// to keep its line alive; the anchor is alphabetic so no line can match the
// bare-number or page-footer noise patterns either. (One contract exception:
// a unit-only line like "mg" directly after a digit-ending line is rejoined
// to that line rather than dropped — rejoinWrappedDoseUnits in chunking.ts.
// The generators never emit that shape: unit tokens only appear space-joined
// inside a paragraph line, never alone on their own line.)
const anchorWord = fc.constantFrom(...vocabulary.filter((entry) => /^[a-z]{3,}/.test(entry)));

const paragraph = fc
  .tuple(anchorWord, fc.array(word, { minLength: 0, maxLength: 120 }))
  .map(([first, rest]) => [first, ...rest].join(" "));

const documentText = fc.array(paragraph, { minLength: 1, maxLength: 6 }).map((paragraphs) => paragraphs.join("\n\n"));

function strippedChars(value: string) {
  return value.replace(/\s+/g, "");
}

// True when `needle`'s characters appear in `haystack` in order (gaps allowed).
// Overlapping chunks duplicate content in the haystack, which a plain equality
// check would reject; a subsequence check accepts duplication but still fails
// on any dropped or reordered character.
function isSubsequence(needle: string, haystack: string) {
  let position = 0;
  for (const char of haystack) {
    if (char === needle[position]) position += 1;
    if (position === needle.length) return true;
  }
  return position === needle.length;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

describe("property: chunking terminates and covers its input", () => {
  it("terminates and preserves every character for any size/overlap combination, including overlap >= chunkSize (M17)", () => {
    fc.assert(
      fc.property(
        documentText,
        fc.integer({ min: 40, max: 400 }),
        fc.integer({ min: 0, max: 500 }),
        (text, chunkSize, overlap) => {
          const chunks = chunkTextWithOverlap(text, chunkSize, overlap);

          // Coverage: nothing the cleaner kept may be lost. The generated text
          // contains no removable noise, so the input's own character stream
          // (whitespace aside) must survive into the chunks, in order.
          expect(isSubsequence(strippedChars(text), strippedChars(chunks.join("")))).toBe(true);

          // No invention or reordering: every chunk reads as a contiguous run
          // of the input. (Overlap tails are suffixes of the preceding
          // paragraph, so they remain contiguous in the normalized input.)
          const normalizedInput = normalizeWhitespace(text);
          for (const chunk of chunks) {
            expect(normalizedInput).toContain(normalizeWhitespace(chunk));
          }
        },
      ),
    );
  });

  it("returns the whole cleaned text as a single chunk when it fits", () => {
    fc.assert(
      fc.property(paragraph, (text) => {
        const chunks = chunkTextWithOverlap(text, text.length + 10, 20);
        expect(chunks).toEqual([text]);
      }),
    );
  });
});
