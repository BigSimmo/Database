import { describe, expect, it } from "vitest";

import { blankCssComments, stripAllComments, stripSourceComments } from "./helpers/strip-source-comments";

/**
 * ⚠️ THIS FILE EXISTS BECAUSE A COMMENT BROKE A TEST BY CONTAINING CODE-SHAPED TEXT.
 *
 * On 2026-09-04 a comment was added to `handover.module.css` and `morning.module.css` explaining
 * why a print rule must stay. The explanation quoted the rule it was describing — the literal text
 * `.screen { background: none }`. Both print guards scan the file as TEXT, take the FIRST `.screen {`
 * and read to the next `}`. They matched the prose, truncated their extract to
 * `.screen { background: none ` and went red on a file whose CSS was correct.
 *
 * ⚠️ AND THE OPPOSITE FAILURE HAPPENED THE SAME DAY, FROM THE SAME ROOT. Five rows in another
 * guard's `KNOWN_HEX_BACKLOG` went stale the instant comment-stripping was ADDED to its scanner:
 * the pinned literals now live only in prose, so the scan finds nothing and the rows can never
 * clear. Same mechanism, opposite direction, both silent.
 *
 * 🔴 THE DANGEROUS DIRECTION IS THE SECOND ONE. A guard that breaks gets fixed within the hour,
 * because somebody is staring at a red. A guard that PASSES because a comment satisfied it is a
 * check that cannot fail, and nothing will ever tell you.
 */
describe("blankCssComments — the instrument the ward text-scanning guards need", () => {
  it("blanks the exact comment that broke both print guards, leaving the real rule visible", () => {
    const css = [
      "@media print {",
      "  /*",
      "   * The `background: none` line below stays. Quoted here as it appeared in the defect:",
      "   * `.screen { background: none }` — this sentence is what the guards matched.",
      "   */",
      "  .screen {",
      "    background: none;",
      "    color-scheme: light;",
      "  }",
      "}",
    ].join("\n");

    const blanked = blankCssComments(css);

    // The scanner's own logic: first textual `.screen {`, read to the next `}`.
    const start = blanked.indexOf(".screen {");
    const rule = blanked.slice(start, blanked.indexOf("}", start));

    expect(rule, "the guard must reach the real rule, not the comment quoting it").toContain("color-scheme: light");
    expect(rule).toContain("background: none");
  });

  it("finds the comment first WITHOUT blanking — the defect itself, pinned", () => {
    // ⚠️ This asserts the BROKEN behaviour on purpose. If it ever goes green-by-accident it means
    // the raw scan stopped being vulnerable, and the whole reason this helper is applied would
    // have changed. A fix must update this test deliberately, not silently satisfy it.
    const css = ["  /* `.screen { background: none }` */", "  .screen {", "    color-scheme: light;", "  }"].join("\n");
    const start = css.indexOf(".screen {");
    const rule = css.slice(start, css.indexOf("}", start));
    expect(rule, "raw text scanning matches the comment, which is the defect").not.toContain("color-scheme: light");
  });

  /**
   * ⚠️ THE REQUIREMENT THAT MAKES THIS USABLE IN A GUARD AT ALL. A stripper that DELETES comments
   * shifts every line below the first one, so the guard reports a line number that does not hold
   * the offence. A guard naming the wrong line is worse than one naming none: the reader goes
   * there, finds nothing, and concludes the guard is broken rather than the file.
   */
  it("preserves line numbers, so a guard's reported line still lands on the offence", () => {
    const css = [
      "/* line 1 of a comment",
      " * line 2",
      " * line 3 */",
      ".a { color: red; }",
      "/* another */",
      ".b { color: blue; }",
    ].join("\n");

    const blanked = blankCssComments(css);

    expect(blanked.split("\n"), "line count must not change").toHaveLength(css.split("\n").length);
    expect(blanked.split("\n")[3], "the rule must still be on its own original line").toContain(".a {");
    expect(blanked.split("\n")[5]).toContain(".b {");
  });

  it("preserves column offsets, so an index into the blanked text indexes the original", () => {
    const css = "  /* hi */ .a { color: red; }";
    const blanked = blankCssComments(css);
    expect(blanked).toHaveLength(css.length);
    expect(blanked.indexOf(".a {")).toBe(css.indexOf(".a {"));
  });

  it("leaves real code byte-identical when there are no comments", () => {
    const css = ".a {\n  color: red;\n}\n";
    expect(blankCssComments(css)).toBe(css);
  });

  it("does not run past an unterminated comment into a truncated file", () => {
    const css = ".a { color: red; }\n/* never closed\n.b { color: blue; }";
    const blanked = blankCssComments(css);
    expect(blanked, "the real rule above the comment survives").toContain(".a { color: red; }");
    expect(blanked, "everything inside the unterminated comment is blanked").not.toContain(".b {");
    expect(blanked.split("\n")).toHaveLength(css.split("\n").length);
  });

  /**
   * 🔴 NAMING WHAT THIS INSTRUMENT CANNOT SEE, so nobody reads the greens above as more than they
   * are. `blankCssComments` knows nothing about strings or `url()`. A CSS string containing the
   * two characters `/*` — `content: "/*"` — opens a comment as far as this scanner is concerned
   * and blanks real code up to the next `*` + `/`. That is a SILENT FALSE NEGATIVE inside a safety
   * guard, the worst shape a defect in a check can take.
   *
   * It is left unhandled because that shape does not occur in any ward stylesheet today (checked
   * 2026-09-04) and because the TS/TSX sibling in this helper documents the identical limitation
   * from its own hard-won version. This test PINS the limitation rather than hiding it: it passes
   * on the defect, and must be rewritten — not deleted — the day the scanner learns about strings.
   */
  it("pins the one place it errs unsafely: a `/*` inside a CSS string opens a comment", () => {
    const css = '.a { content: "/*"; }\n.b { color: red; }\n/* real */\n.c { color: blue; }';
    const blanked = blankCssComments(css);
    expect(blanked, "the rule after the string-opened comment is wrongly blanked").not.toContain(".b { color: red; }");
  });

  /**
   * 🔴 CHARACTERISATION, NOT A REQUIREMENT. This asserts what the shared stripper DOES today, so
   * that the narrowing it leaves in every guard built on it is executable rather than described.
   *
   * `stripSourceComments` strips a line comment ONLY when the line begins with `//`. That is
   * deliberate and argued in the helper's own source (see its header): widening it would eat the
   * `//` inside a URL or a regular expression. The consequence — recorded NOWHERE executable until
   * this test — is that a TRAILING comment survives stripping and can still satisfy a
   * text-matching guard.
   *
   * ⚠️ IF THIS TEST GOES RED, SOMEBODY HAS CLOSED THE HOLE. That is good news. Delete this test
   * and the "narrowed, not closed" pins in the guards that point at it. Do NOT make it pass again.
   *
   * It lives here once rather than being copied into each hardened guard: a characterisation
   * duplicated across thirty-four files is thirty-four things to update on the day it changes, and
   * the copies that get missed become false claims. Each guard carries a one-line pointer instead.
   */
  it("CHARACTERISATION: a trailing comment survives stripping, so guards are narrowed not closed", () => {
    const trailing = "urgency: event.urgency, // triagedAt: event.triagedAt";
    expect(
      stripSourceComments(trailing),
      "if this no longer contains the commented text, the hole is closed — delete this test",
    ).toContain("triagedAt: event.triagedAt");

    // The realistic shape — a comment on its OWN line — IS removed. Asserting that here stops the
    // expectation above being read as "stripping does nothing".
    const ownLine = ["// triagedAt: event.triagedAt, -- temporarily disabled", "urgency: event.urgency,"].join(
      String.fromCharCode(10),
    );
    expect(stripSourceComments(ownLine)).not.toContain("triagedAt");
    expect(stripSourceComments(ownLine), "real code must survive").toContain("urgency: event.urgency");
  });

  /**
   * 🔴 THE WIDER SCAN, FOR GUARDS THAT WATCH A CODE WRITE. The realistic way such a guard is
   * disarmed is not prose — it is the watched line COMMENTED OUT with a note saying why, which is
   * an ordinary and careful act. `stripSourceComments` leaves a trailing comment alone on purpose,
   * so `stripAllComments` exists for those guards only.
   *
   * ⚠️ THE ONLY REASON WIDENING IS SAFE IS THAT THE SCAN IS STRING-AWARE. The rationale recorded
   * against widening — that it would eat the `//` inside a URL — is true of a REGEX. This scanner
   * copies string literals through untouched, so it is not true here, and the test below is what
   * makes that claim checkable rather than asserted.
   */
  it("strips a TRAILING commented-out write, which is what disarms a write-watching guard", () => {
    const line = "urgency: event.urgency, // triagedAt: event.triagedAt,";
    expect(stripAllComments(line)).not.toContain("triagedAt");
    expect(stripAllComments(line), "the real write on the same line must survive").toContain("urgency: event.urgency,");
  });

  it("does NOT eat the // inside a URL in a string, which is why widening is safe here", () => {
    const code = 'const help = "https://example.com/guide"; // triagedAt: event.triagedAt';
    const stripped = stripAllComments(code);
    expect(stripped, "the URL is a string literal and must be copied through").toContain("https://example.com/guide");
    expect(stripped, "the trailing comment must still go").not.toContain("triagedAt");
  });

  it("leaves stripSourceComments' narrower contract alone, so its three consumers do not move", () => {
    const line = "import x from 'y'; // service-state";
    expect(stripSourceComments(line), "the narrow scan keeps trailing comments BY DESIGN").toContain("service-state");
    expect(stripAllComments(line), "only the opt-in wide scan removes them").not.toContain("service-state");
  });
});
