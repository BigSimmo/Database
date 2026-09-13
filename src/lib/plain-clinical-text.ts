/**
 * Characters that survive a copy into a clinical record system.
 *
 * The vendored DSM export uses typographic characters throughout — 216 uses of
 * `≥` alone, plus `≤ ≈ × ² – — → ↑` and curly quotes. Several of the systems
 * this text is pasted into render those as replacement glyphs or drop them, and
 * `≥4` silently becoming `4` reverses the meaning of a threshold. Each one is
 * therefore spelled out rather than stripped.
 *
 * `â` (khyâl) and `é` (Guillain-Barré) are left alone: both are ordinary Latin-1
 * letters inside a correctly spelled clinical term, not typography.
 *
 * Semicolons are folded to commas because every semicolon in this corpus joins
 * list items or an "or" clause, where a comma reads identically and matches how
 * notes are written.
 *
 * This module holds no data imports on purpose. The Therapy catalogue reaches a
 * record through the same paste and needs the same guarantee, and importing it
 * from `dsm-note.ts` would pull the whole DSM corpus into the therapy bundle.
 */
const PLAIN_TEXT_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> = [
  [/≥\s*/g, "at least "],
  [/≤\s*/g, "no more than "],
  [/≈\s*/g, "approximately "],
  [/↑\s*/g, "increased "],
  [/\s*→\s*/g, " leading to "],
  [/×/g, "x"],
  [/²/g, "2"],
  [/[–—]/g, "-"],
  [/[‘’]/g, "'"],
  [/[“”]/g, '"'],
  [/;\s*/g, ", "],
];

export function plainClinicalText(value: string): string {
  let text = value;
  for (const [pattern, replacement] of PLAIN_TEXT_REPLACEMENTS) text = text.replace(pattern, replacement);
  return text.replace(/[ \t]{2,}/g, " ").trim();
}
