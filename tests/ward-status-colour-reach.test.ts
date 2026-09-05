// tests/ward-status-colour-reach.test.ts
//
// 🔴 A WARD RULE THAT REACHES PAST THE WARD LAYER FOR A STATUS COLOUR LOSES ITS HIGH-CONTRAST
// HANDLING, AND NOTHING REPORTED IT.
//
// `ward-tokens.module.css` re-points `--ward-danger`, `--ward-warning`, `--ward-success` and their
// `-soft` partners to system colours inside `@media (forced-colors: active)`. Those aliases resolve
// to `--danger-text` / `--warning-text` / `--success-text` and the `-bg` partners in normal mode —
// and NEITHER app-level forced-colors block re-points those six names. Measured by extracting the
// declarations from inside each block rather than reading the file: `--danger`, `--warning` and
// `--success` are re-pointed; the six `-text` and `-bg` names are absent from both.
//
// So the two spellings behave identically in every mode a developer looks at, and differently in
// the one nobody renders: `var(--ward-danger)` becomes `CanvasText` under Windows High Contrast,
// and `var(--danger-text)` stays a themed colour the mode has already decided to ignore. **On a
// clinical screen that is a warning that stops looking like a warning**, and it was invisible to
// every test here — `ward-forced-colors-tokens.test.ts` reads the TOKEN LAYER only and never opens
// a consumer stylesheet, so it is green either way. That is the gap this fills.
//
// ⚠️ THIS DERIVES "PROTECTED" RATHER THAN LISTING IT. It reads the forced-colors blocks of both app
// layers and the ward layer, and treats a token as protected if any of them re-points it. That
// matters for the fix nobody in this room owns: if the six names are ever added to
// `ckb-v2-tokens.css` — the cleaner fix, which touches a file serving the whole product and so was
// written up as a proposal instead of taken — this guard notices on its own, with no edit and no
// stale list left behind. The first assertion says so in terms and asks to be deleted.
//
// ⚠️ AND IT IS A RATCHET, NOT A LINE IN THE SAND. 47 uses remain across five files that were not
// mine to edit; each is recorded below WITH ITS REASON. The number is a ceiling, so finishing the
// work passes and adding to it fails, and a file not listed has a ceiling of zero.
//
// Being a `readFileSync` scanner it imports nothing from `src/`, so `npm run test:focused` can
// never select it. It runs in the full suite.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const WARD = "src/components/ward-management";
const FORCED_COLOURS_LAYERS = [
  "src/app/ckb-v2-tokens.css",
  "src/app/globals.css",
  join(WARD, "ward-tokens.module.css"),
];

/** The six roles a ward rule must not reach for directly, each with the alias that is protected. */
const REACHES: Readonly<Record<string, string>> = {
  "--danger-text": "--ward-danger",
  "--warning-text": "--ward-warning",
  "--success-text": "--ward-success",
  "--danger-bg": "--ward-danger-soft",
  "--warning-bg": "--ward-warning-soft",
  "--success-bg": "--ward-success-soft",
};

/**
 * What remains, and why. **These are ceilings — reduce one when the work lands, never raise one.**
 * The reason is what makes an entry reviewable: "held by another chat on a date" is checkable and
 * expires, where a bare filename is a permanent excuse nobody can audit.
 */
const REMAINING: readonly { readonly file: string; readonly ceiling: number; readonly because: string }[] = [
  {
    file: "ward-tokens.module.css",
    ceiling: 6,
    because:
      "THE BRIDGE ITSELF — these six uses ARE the alias definitions that make every other file safe. " +
      "Re-pointing them at their own aliases would be circular. Permanent and correct.",
  },
  {
    file: "ward/ward.module.css",
    ceiling: 0,
    because:
      "CLEARED at the fold on 2026-09-06. The ceiling of 24 was a hold while Ward Builder Four was " +
      "walking every route; that work landed, and the fold then pushed the file to 29 — the ceiling " +
      "caught it, which is the gate doing its job. All 31 uses are now on the aliases, so the hold " +
      "has no subject. A ceiling above zero on a file nobody is holding is a licence, not a record.",
  },
  { file: "patients/add-patient.module.css", ceiling: 8, because: "held by Ward Builder Four on 2026-09-06" },
  { file: "ed/ed.module.css", ceiling: 7, because: "held by Ward Builder Four on 2026-09-06" },
  { file: "patients/person.module.css", ceiling: 2, because: "held by Ward Builder Four on 2026-09-06" },
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

const posix = (path: string): string => path.split("\\").join("/");

/**
 * Blank block-comment bodies, preserving newlines. **Written with string operations and no regex at
 * all**, because a token named in prose must never be read as a declaration — and because an escape
 * inside a pattern is a thing that can be mangled on the way to disk. This repository has already
 * shipped a guard whose word-boundary escape reached the file as a literal backspace byte, matched
 * nothing anywhere, and passed green over an empty list for a whole commit.
 */
function stripComments(css: string): string {
  let out = "";
  let index = 0;
  while (index < css.length) {
    if (css[index] === "/" && css[index + 1] === "*") {
      const close = css.indexOf("*/", index + 2);
      const end = close < 0 ? css.length : close + 2;
      for (const character of css.slice(index, end)) out += character === "\n" ? "\n" : " ";
      index = end;
      continue;
    }
    out += css[index];
    index += 1;
  }
  return out;
}

/**
 * Every custom property re-pointed inside a `forced-colors` block, across all three layers.
 * Brace-matched rather than read to end of file, so a block that is not the last one in its file
 * cannot swallow the rules that follow it.
 */
function protectedTokens(): ReadonlySet<string> {
  const found = new Set<string>();
  for (const file of FORCED_COLOURS_LAYERS) {
    const css = readFileSync(file, "utf8");
    let index = 0;
    for (;;) {
      const at = css.indexOf("@media", index);
      if (at < 0) break;
      const open = css.indexOf("{", at);
      if (open < 0) break;
      const header = css.slice(at, open);
      let depth = 0;
      let end = open;
      for (; end < css.length; end += 1) {
        if (css[end] === "{") depth += 1;
        else if (css[end] === "}") {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      if (header.includes("forced-colors")) {
        for (const line of css.slice(open, end).split("\n")) {
          const colon = line.indexOf(":");
          const name = colon < 0 ? "" : line.slice(0, colon).trim();
          if (name.startsWith("--")) found.add(name);
        }
      }
      index = end + 1;
    }
  }
  return found;
}

/** Every `var(--token)` in the source, found without a regex. */
function tokensUsedIn(css: string): string[] {
  const used: string[] = [];
  let index = css.indexOf("var(");
  while (index >= 0) {
    const rest = css.slice(index + "var(".length);
    // Cut at the first separator, so a FALLBACK is not swallowed into the token name and a longer
    // hyphenated property is never truncated into a shorter one.
    let end = rest.length;
    for (const separator of [",", ")", " "]) {
      const at = rest.indexOf(separator);
      if (at >= 0 && at < end) end = at;
    }
    used.push(rest.slice(0, end).trim());
    // ⚠️ ADVANCE PAST THE `var(`, NEVER PAST THE CLOSING PAREN. This resumed at the first `)` until
    // 2026-09-06, which STEPPED OVER A NESTED `var(` ENTIRELY: on
    // `var(--success-bg-hover, var(--success-bg))` the outer read returned
    // "--success-bg-hover, var(--success-bg" — correctly not a token — and the scan then resumed
    // after the inner `)`, so the unprotected fallback was never visited. **An unprotected token
    // hidden in a fallback was invisible to this guard**, which is the one place it is easiest to
    // hide and the shape the ward stylesheets already use in seven other rules.
    //
    // Not live when found — none of those seven named a status token in the fallback position — so
    // nothing was being missed today. It was a hole in the detector, not a defect in the estate,
    // and the two are indistinguishable from a green.
    index = css.indexOf("var(", index + "var(".length);
  }
  return used;
}

function unprotectedUsesIn(css: string, safe: ReadonlySet<string>): string[] {
  return tokensUsedIn(stripComments(css)).filter((token) => token in REACHES && !safe.has(token));
}

const SAFE = protectedTokens();
const SHEETS = walk(WARD)
  .map(posix)
  .filter((file) => file.endsWith(".css"));

describe("no ward rule reaches past the ward layer for a status colour", () => {
  it("reads a real population and a real set of protected tokens (anti-vacuity)", () => {
    // Floored on what was WALKED, never on what was found. A scanner that reads nothing reports a
    // clean estate, and these two assertions are the only thing standing between the two.
    expect(SHEETS.length, `only ${SHEETS.length} ward stylesheets found — the walk is broken`).toBeGreaterThan(40);
    expect(
      SAFE.size,
      "no tokens were read out of any forced-colors block, so every use below would look protected",
    ).toBeGreaterThan(50);

    // The premise, asserted rather than assumed.
    expect(
      Object.keys(REACHES).filter((token) => SAFE.has(token)),
      "an app layer now re-points these six directly, which is the cleaner fix and makes every " +
        "ceiling below meaningless. This guard has served its purpose: DELETE it, rather than " +
        "adjusting it to stay green.",
    ).toEqual([]);
  });

  it("finds a reaching use, ignores an aliased one, and ignores one written in a comment", () => {
    // 🔴 WITHOUT THIS THE GUARD IS DECORATION. Every file that was mine now reports zero, so the
    // assertion below passes over an empty list — which is precisely what a detector matching
    // nothing at all produces. This is the arm that tells the two apart, and it is checked in both
    // directions so that widening the exemptions cannot quietly disarm it.
    const fixture = [
      "/* prose mentioning var(--danger-text), which is evidence and must not be read as code */",
      ".reaches { color: var(--danger-text); }",
      ".alsoReaches { background: var(--warning-bg); }",
      ".aliased { color: var(--ward-danger); }",
      ".unrelated { color: var(--ward-text); }",
      // 🔴 THE NESTED-FALLBACK PAIR, ADDED 2026-09-06 BECAUSE THE DETECTOR MISSED THE FIRST ONE.
      // A fallback is the easiest place in CSS to hide a token, and the parser used to resume
      // scanning after the first `)` — stepping over the inner `var(` entirely. The ward
      // stylesheets already use this shape in seven rules, so it was one edit away from mattering.
      // Both directions: the unprotected fallback must be FOUND, and the aliased one must not,
      // because a fix that simply matched more aggressively would fire on `--success-bg-hover`,
      // a real and separate property whose name merely starts with a token name.
      ".hidesInFallback { background: var(--success-bg-hover, var(--success-bg)); }",
      ".fallbackIsAliased { background: var(--warning-bg-hover, var(--ward-warning-soft)); }",
    ].join("\n");
    expect(unprotectedUsesIn(fixture, SAFE).sort()).toEqual(["--danger-text", "--success-bg", "--warning-bg"]);
  });

  it("keeps every file at or below its recorded ceiling, and every unlisted file at zero", () => {
    const ceilings = new Map(REMAINING.map((entry) => [entry.file, entry]));
    const over: string[] = [];
    for (const sheet of SHEETS) {
      const relative = sheet.slice(`${WARD}/`.length);
      const count = unprotectedUsesIn(readFileSync(sheet, "utf8"), SAFE).length;
      const entry = ceilings.get(relative);
      if (count > (entry?.ceiling ?? 0)) {
        over.push(
          `  ${relative}: ${count} use(s), ceiling ${entry?.ceiling ?? 0}` +
            (entry ? `\n      recorded because: ${entry.because}` : ""),
        );
      }
    }
    expect(
      over,
      "these ward stylesheets reach past the --ward-* layer for a status colour, so those rules lose " +
        "their high-contrast handling:\n" +
        over.join("\n") +
        "\n\n  Use the alias instead: " +
        Object.entries(REACHES)
          .map(([from, to]) => `${from} -> ${to}`)
          .join(", ") +
        "\n  The alias resolves to the same value in every ordinary mode, so nothing changes on screen " +
        "except under forced colours, where it starts working.",
    ).toEqual([]);
  });
});
