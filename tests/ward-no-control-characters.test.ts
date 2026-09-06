// tests/ward-no-control-characters.test.ts
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * NO WARD SOURCE OR TEST FILE MAY CONTAIN A RAW CONTROL CHARACTER.
 *
 * 🔴 WHY, AND IT IS THREE SEPARATE INCIDENTS IN ONE NIGHT — 2026-09-05.
 *
 * Writing a word-boundary escape inside a JavaScript **template literal** does not produce the two
 * characters a backslash and a `b`. It produces **one byte, 0x08, BACKSPACE**. So
 * `` new RegExp(`of ${n}\b`) `` becomes the pattern `/of 43<BACKSPACE>/`, which demands an actual
 * backspace character in the rendered text and therefore matches nothing, anywhere, ever.
 *
 * Three instances tonight, in three sessions:
 *
 *   1. A count assertion on the delays screen. **It presented as "unable to find an element", so
 *      the natural repair is to weaken the matcher until it passes.** Caught only because its
 *      author asked why a number plainly on screen could not be found.
 *   2. A helper in a phone-layout guard whose pattern ended in the same escape. It matched nothing
 *      in the whole repository and made a new assertion **pass over an empty list — four tests
 *      green, no warning.** Found by reading the file, not by running it.
 *   3. The COMMENT written to explain incident 1 contained the byte too, because typing the escape
 *      into the explanation reproduces it. That comment rendered as `/of 43/` — silently deleting
 *      the very character it existed to warn about.
 *
 * ⚠️ **EVERY ONE OF THOSE WAS GREEN, AND THE BYTE IS INVISIBLE IN AN EDITOR AND IN `git diff`
 * ALIKE.** A guard is the only thing that sees it. This repository has been bitten by this before;
 * a note existed and did not prevent three recurrences in one session, which is the argument for a
 * check over a memo.
 *
 * ⚠️ **AND THE FAILURE MODE IS ALWAYS VACUITY, NEVER A CRASH.** A pattern that cannot match makes
 * an assertion pass over nothing. That is why this guard matters more than its size suggests: it
 * catches a class of defect whose entire signature is a test that looks like it is working.
 *
 * 🔴 **FOURTH INSTANCE: THIS FILE, WHILE BEING WRITTEN, BY THE PERSON WRITING IT.** Explaining the
 * `U+0003` found below meant quoting a ZIP magic number, and quoting it put the real byte into this
 * comment. **The guard went red on its own documentation, having been green a minute earlier.**
 *
 * That is not an amusing coincidence, it is the measurement that justifies the file: **four
 * instances in one night, one of them committed by somebody who had just finished cataloguing the
 * other three and was actively looking for it.** A note cannot prevent this. Only a check that
 * reads bytes can, because the character is invisible in an editor, in `git diff`, and in the
 * rendered comment that warns about it.
 *
 * **The rule that follows: in prose, DESCRIBE a control character in words. Never type it.**
 */

const ROOTS = ["tests", "src/components/ward-management", "scripts/ward-flow"];

/**
 * Ward Flow's own files only.
 *
 * ⚠️ **SCOPED DELIBERATELY, AND THE FIRST VERSION WAS NOT — which found a real and LEGITIMATE use
 * outside this remit.** Walking all of `tests/` flagged `tests/upload-structure.test.ts:65`, where
 * a `U+0003` sits inside a buffer built from the two characters P and K followed by that byte.
 * That is the ZIP magic number,
 * written on purpose to build a deliberately-corrupt archive for a rejection test. **Correct code,
 * correctly flagged, outside this guard's business.**
 *
 * Policing another area's tests from a ward guard would have meant either "fixing" a deliberate
 * fixture or carrying a permanent exemption for somebody else's file. Both are worse than a
 * narrower scope. The hazard this exists for — a word-boundary escape in a template literal —
 * has bitten three ward sessions in one night, and that is the population it watches.
 */
const isWardFile = (file: string) =>
  file.startsWith("src/components/ward-management/") ||
  file.startsWith("scripts/ward-flow/") ||
  /^tests\/ward-/.test(file);

/** Every text file under a root. */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

/**
 * Control characters that should never appear raw in source. TAB (0x09), LF (0x0a) and CR (0x0d)
 * are legitimate whitespace and excluded; everything else in the C0 range, plus DEL, is not.
 */
const FORBIDDEN =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u200b-\u200d\ufeff\u202a-\u202e\u2066-\u2069]/;

function describeByte(code: number): string {
  const names: Record<number, string> = {
    0x00: "NUL",
    0x07: "BEL",
    0x08: "BACKSPACE — almost certainly a word-boundary escape written inside a template literal",
    0x0b: "VERTICAL TAB",
    0x0c: "FORM FEED",
    0x1b: "ESCAPE",
    0x7f: "DELETE",
    0x00ad: "SOFT HYPHEN - invisible, and it breaks a text pin exactly as 0x08 does",
    0x200b: "ZERO WIDTH SPACE - invisible; if it quotes a delimiter inside itself, reword instead",
    0x200c: "ZERO WIDTH NON-JOINER",
    0x200d: "ZERO WIDTH JOINER",
    0xfeff: "BYTE ORDER MARK",
    0x202e: "RIGHT-TO-LEFT OVERRIDE - reorders VISIBLE text; source can read one way and run another",
  };
  return names[code] ?? `control character U+${code.toString(16).padStart(4, "0").toUpperCase()}`;
}

describe("no ward file carries a raw control character", () => {
  const files = ROOTS.flatMap((root) => walk(root))
    .map((file) => file.split("\\").join("/"))
    .filter((file) => /\.(ts|tsx|mjs|js|css|json|md)$/.test(file))
    .filter(isWardFile);

  it("walks a plausible number of files, so a clean report is not an empty one", () => {
    // Floor the DENOMINATOR. A moved directory or a broken filter would make every assertion below
    // pass over nothing and read exactly like an estate with no problems.
    expect(files.length, `only ${files.length} files walked across ${ROOTS.join(", ")}`).toBeGreaterThan(300);
  });

  it("finds no backspace or other C0 control character in any of them", () => {
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const match = FORBIDDEN.exec(text);
      if (!match) continue;
      const index = match.index;
      const line = text.slice(0, index).split("\n").length;
      offenders.push(`${file}:${line} — ${describeByte(match[0].charCodeAt(0))}`);
    }
    expect(
      offenders,
      "a raw control character is present. If it is 0x08, it is a word-boundary escape written " +
        "inside a template literal: it became ONE byte rather than two characters, so the pattern " +
        "demands a literal backspace and can never match. The assertion using it passes over " +
        "nothing. Double the backslash, or — in a comment — describe the escape in words rather " +
        "than typing it, because typing it into the explanation reproduces the byte:\n" +
        offenders.join("\n"),
    ).toEqual([]);
  });
});
