import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

/**
 * ⚠️ **THIS EXISTS BECAUSE THE TRAPS FILE COLLIDED WITH ITSELF TWICE IN ONE NIGHT, AND THE FILE IT
 * GUARDS IS THE ONE THAT DOCUMENTS THIS EXACT FAULT.**
 *
 * `docs/ward-flow/traps/silent-transforms.md` numbers its entries, and the numbers are load-bearing:
 * entries cross-reference each other by number ("this is entry 5's mirror", "the same family as
 * entry 8"). Several chats append to it concurrently.
 *
 * **2026-09-01:** Ward Lead and Ward Builder Two each appended entries 12 and 13. The merge was
 * TEXTUALLY CLEAN — different regions of an append-only file — so git had nothing to conflict on and
 * produced a document with two entry 12s, two entry 13s, and a cross-reference pointing at whichever
 * copy the reader reached first. Nothing failed.
 *
 * **2026-09-02:** it happened again, and Ward Lead's own copy had ALSO collided with itself
 * independently — an entry numbered 14 sitting after entry 17, two 14s on the master line with
 * nobody else involved. **The mechanism caught the chat that had just finished renumbering the file,
 * then caught it again.**
 *
 * ⚠️ **THE FAILURE MODE IS NOT "TWO CHATS APPEND TO ONE FILE". IT IS THAT WHETHER THE COLLISION IS
 * VISIBLE IS DECIDED BY BYTE OFFSETS.** The first time git merged silently; the second time it
 * conflicted, and only because the two appends landed at the same place. **The silent outcome is the
 * more likely one**, and no other gate in this repository reads a section number.
 *
 * That is entry 14's own subject — a rule existing twice with nothing comparing the copies — applied
 * to the file that documents it. Written here rather than in a commit message, because a guard whose
 * reason for existing lives inside the thing it guards is the only kind that survives somebody
 * wondering whether it is still needed.
 *
 * **Why a test and not simply unnumbering the entries:** removing the numbers would silently break
 * every cross-reference in the file without failing anything — the same defect one level out,
 * removing the guard by removing the thing it guards.
 */

const TRAPS_PATH = fileURLToPath(new URL("../docs/ward-flow/traps/silent-transforms.md", import.meta.url));

/** `## 12. A title` — the entry headings, and nothing else in the file uses this shape. */
const ENTRY_HEADING = /^## (\d+)\. /gm;

/**
 * The same shape without `/g`, for `.test()`. A global regex carries `lastIndex` between calls, so
 * `ENTRY_HEADING.test(a)` then `ENTRY_HEADING.test(b)` can return false for a string that matches —
 * which is entry 20's shape (an assertion that cannot fail) arriving through the regex rather than
 * through the assertion.
 */
const CANONICAL_ENTRY_HEADING = /^## \d+\. /;

/**
 * ⚠️ **A heading whose text starts with a number, at ANY depth and with ANY punctuation after it.**
 *
 * `ENTRY_HEADING` above matches only `## <n>. `, and the comment beside it says nothing else in the
 * file uses that shape — which is true, and is not the property that matters. **The converse is: an
 * entry the parse cannot SEE does not shorten the list or break contiguity. It is simply absent**, so
 * `### 14. Title` appended beneath a subsection produces a second entry 14 that
 * "uses each entry number exactly once" and "numbers the entries contiguously" both report green on.
 * A guard that cannot perceive a violation returns the same green as one that finds none.
 *
 * Found by Ward Builder Three, 2026-09-02, sweeping this file's own suite. It is entry 12's shape —
 * a check narrowed to what it can already see — sitting in the guard for entry 14.
 */
const NUMBERED_HEADING_ANY_SHAPE = /^#{1,6}[ \t]+\d+[^\n]*$/gm;

/**
 * The file states its own total in prose, as a WORD. That number has been corrected by hand twice,
 * and a prose count that can disagree with the headings eventually will.
 *
 * ⚠️ **`/g` is load-bearing, and its absence was a defect.** Without it `exec` returns match #1 and
 * stops, so a file stating its total TWICE with two different words passes on whichever copy comes
 * first. That is entry 14 — a rule existing twice with nothing comparing the copies — inside the
 * check that guards entry 14. Two chats each appending a closing summary land in different regions of
 * an append-only file and merge textually clean, which is this suite's whole subject.
 */
const PROSE_COUNT = /Read this before treating the ([a-z-]+) entries above as a list/g;

const NUMBER_WORDS: Record<string, number> = {
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  "twenty-one": 21,
  "twenty-two": 22,
  "twenty-three": 23,
  "twenty-four": 24,
  "twenty-five": 25,
  "twenty-six": 26,
  "twenty-seven": 27,
  "twenty-eight": 28,
  "twenty-nine": 29,
  thirty: 30,
};

function entryNumbers(): number[] {
  const source = readFileSync(TRAPS_PATH, "utf8");
  return [...source.matchAll(ENTRY_HEADING)].map((match) => Number(match[1]));
}

describe("the traps file's entry numbering", () => {
  it("⚠️ NON-VACUITY — the parse finds headings at all, so the assertions below can fail", () => {
    // Without this, a regex that stopped matching would make every assertion below pass over an
    // empty list. That is the exact shape this repository spent 2026-09-01 cataloguing: a check
    // that cannot fail reports the same green as a check that passed.
    expect(
      entryNumbers().length,
      "no `## <n>. ` entry headings were found in silent-transforms.md — the heading format changed " +
        "or the file moved, and every assertion in this suite is now passing over an empty list. " +
        "Fix the parse; do NOT delete these tests to make the suite green.",
    ).toBeGreaterThan(5);
  });

  it("uses each entry number exactly once", () => {
    const numbers = entryNumbers();
    const seen = new Map<number, number>();
    for (const value of numbers) seen.set(value, (seen.get(value) ?? 0) + 1);
    const duplicated = [...seen.entries()].filter(([, count]) => count > 1).map(([value]) => value);
    expect(
      duplicated,
      `silent-transforms.md uses ${duplicated.length === 1 ? "entry number" : "entry numbers"} ` +
        `${duplicated.join(", ")} more than once. Two chats appended entries with the same number and ` +
        "the merge was textually clean, so nothing conflicted. Renumber by FILE ORDER and repoint any " +
        "cross-reference to the renumbered entry — the entries reference each other by number.",
    ).toEqual([]);
  });

  it("⚠️ sees every numbered heading, so an entry cannot hide from the parse by changing shape", () => {
    // The three assertions around this one all read `entryNumbers()`, which sees `## <n>. ` and
    // nothing else. An entry appended at `### ` depth, or with `: ` or ` — ` after the number, is not
    // a MALFORMED entry to them — it is not an entry at all. It does not shorten the list and it does
    // not break contiguity, so `### 14.` beside an existing `## 14.` leaves both of those green while
    // the file carries two entry 14s and three cross-references that no longer resolve to one place.
    //
    // This assertion is the parse's own coverage: every heading in the file whose text begins with a
    // number must be in the canonical shape the other tests can read.
    const source = readFileSync(TRAPS_PATH, "utf8");
    const misshapen = [...source.matchAll(NUMBERED_HEADING_ANY_SHAPE)]
      .map((match) => match[0])
      .filter((line) => !CANONICAL_ENTRY_HEADING.test(line));
    expect(
      misshapen,
      "silent-transforms.md has a heading that starts with a number but is not in the `## <n>. ` " +
        "shape every other assertion in this suite reads. Those assertions cannot see it: it does not " +
        "shorten the entry list and it does not break contiguity, so a duplicate number appended this " +
        "way passes them both. Put it at `## ` depth with `<n>. ` after the hashes, or renumber it.",
    ).toEqual([]);
  });

  it("numbers the entries contiguously from 1, so no entry is missing or skipped", () => {
    const numbers = entryNumbers();
    const expected = Array.from({ length: numbers.length }, (_, index) => index + 1);
    expect(
      numbers,
      "silent-transforms.md's entry numbers are not 1..N in file order. A gap means an entry was " +
        "removed without renumbering, and an out-of-order number means one was inserted without it.",
    ).toEqual(expected);
  });

  it("⚠️ states its own total in prose, and that total matches the headings", () => {
    const source = readFileSync(TRAPS_PATH, "utf8");
    const matches = [...source.matchAll(PROSE_COUNT)];
    expect(
      matches.length,
      "the closing section's 'Read this before treating the <N> entries above' sentence is gone or " +
        "reworded. It is the file's own statement of its size and it has been wrong twice; if the " +
        "wording must change, update this pattern rather than dropping the check.",
    ).toBeGreaterThan(0);

    // ⚠️ EVERY copy, not the first one. Two chats each appending a closing summary land in different
    // regions of an append-only file and merge textually clean — this suite's whole subject — leaving
    // the file stating two totals. `exec` read copy #1 and stopped, so the second was free to be
    // wrong forever. That is entry 14 inside the guard for entry 14.
    const words = [...new Set(matches.map((match) => match[1]))];
    expect(
      words,
      `silent-transforms.md states its own total ${matches.length} times and the copies disagree: ` +
        `${words.join(", ")}. One of them is wrong and nothing else in the repository compares them. ` +
        "Make every copy agree, or leave exactly one.",
    ).toHaveLength(1);

    const word = words[0];
    const stated = NUMBER_WORDS[word];
    expect(
      stated,
      `the closing section says "${word} entries", which this test cannot convert to a number. Add it ` +
        "to NUMBER_WORDS — an unrecognised word must fail loudly rather than skip the comparison.",
    ).toBeDefined();

    expect(
      stated,
      `silent-transforms.md says "${word} entries" in its closing section but carries ` +
        `${entryNumbers().length} numbered headings. The prose count is corrected by hand on every ` +
        "append and has drifted twice; whichever is right, make them agree.",
    ).toBe(entryNumbers().length);
  });
});
