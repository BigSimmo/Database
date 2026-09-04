// tests/ward-statistics-claims.test.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  MODEL_CLAIMS,
  REGISTERED_SURFACES,
  UNEVIDENCED_CLAIMS,
  type ModelClaim,
} from "../src/components/ward-management/statistics/statistics-claims-register";

/**
 * ⚠️ **EXACT COUNTS, NOT FLOORS.** These were `>= 40` against 74 claims, which says only that
 * somebody once chose a number below the real one — thirty-four claims could have been deleted in
 * silence, and **deleting the claim is exactly how a red gets resolved by somebody who wants a green
 * suite.** Pinned the way `ADMISSION_STATES.length` is pinned at 4: adding a claim or moving one to
 * `UNEVIDENCED_CLAIMS` is a deliberate act that updates a number here and says why in the commit.
 *
 * Moved by one in each direction here: `community-index/reachability/nothing-links-to-this-index-yet`
 * stopped being an absence once `ward-nav.ts` registered the route, so it moved from
 * `UNEVIDENCED_CLAIMS` into `MODEL_CLAIMS` as `community-index/reachability/the-root-rail-links-this-index`,
 * carrying a real citation and a `falsifiedBy` edit instead of a reason no line could be cited.
 */
const EXPECTED_MODEL_CLAIMS = 86;
const EXPECTED_UNEVIDENCED_CLAIMS = 12;
const EXPECTED_REGISTERED_SURFACES = 9;

/**
 * THE ONE TEST THAT READS AN EXPLANATION.
 *
 * ⚠️ **WHY IT EXISTS.** Seven statements the statistics and community screens make about the data
 * model were found false on 2026-09-01. Every one passed the entire suite; every one was found by a
 * person reading. Nothing in a test suite can check that a sentence is true — but it CAN check that
 * the source line the sentence was written from still says what it said. That is what this file
 * does, and it is the whole of what it does.
 *
 * ⚠️ **EVERY CITATION IS RESOLVED AGAINST THE REAL FILE, READ FROM DISK HERE.** Nothing is compared
 * against a copy held in the register. A copy cannot go stale, so a register of copies would be
 * green forever and worth nothing.
 *
 * ⚠️ **EXACTLY ONCE, NOT "CONTAINS".** A citation that matches twice no longer identifies a unique
 * fact — the reader following it lands on two different lines and has to guess which one the claim
 * meant. That is its own failure with its own message, distinct from "gone".
 *
 * ⚠️ **EVERY FAILURE NAMES THE CLAIM, NOT THE STRING.** A red reading "expected 1, got 0" over a
 * forty-character fragment tells the next person nothing. The messages below lead with the claim id
 * and the claim in words, so the question a reader is left with is "is that still true?", which is
 * the question worth asking.
 *
 * ⚠️ **AND SINCE 2026-09-01 IT ASKS THE QUESTION THAT MATTERS: WOULD THE CLAIM'S FALSITY MOVE THE
 * CITED BYTES?** Presence is not connection. An audit put every citation in the register to that
 * test and twelve failed it — a doc comment restating its own claim, a two-field slice cited for an
 * "only", four figures claimed to be DERIVED while citing their type declaration, a signature cited
 * for a behaviour `?? fallback` would change without touching it. Each was present, unique, and
 * gave the right answer, and not one of them would have stopped giving it. So every claim now
 * carries a `falsifiedBy` edit, this file applies it to an IN-MEMORY copy of the source, and the
 * evidence must then be GONE. Nothing is written to disk and nothing is executed.
 *
 * ⚠️ **WHAT THIS CANNOT CATCH IS WRITTEN OUT IN THE REGISTER'S OWN DOC COMMENT**, and this file
 * deliberately does not restate it. The short version: it cannot catch a claim that was wrong the
 * day it was written and cited correspondingly wrongly, it cannot witness an absence at all, and it
 * cannot tell a genuine falsifying edit from a misleading one an author wrote to get past this
 * check. `UNEVIDENCED_CLAIMS` carries the absences by name so the gap is countable.
 */

const REPO_ROOT = process.cwd();

/**
 * Whitespace is the ONLY thing normalised, on both sides. Prettier re-wraps JSX paragraphs and doc
 * comments on formatting-only changes, and a guard that goes red for that is a guard people learn
 * to switch off. Nothing else is touched: no case folding, no punctuation stripping, no
 * near-matching, so a renamed field or a changed type still fails.
 */
function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** Non-overlapping occurrence count. Every citation here is a code or prose fragment, none of which
 *  can overlap itself, so the distinction does not arise in practice. */
function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

/**
 * A literal backslash-b written into a citation becomes a backspace byte (0x08): it prints as
 * nothing, matches nothing, and looks perfectly valid in a diff. This is checked by code point
 * rather than by a regular expression precisely so that no escape sequence is needed to write the
 * check itself.
 */
function hasControlCharacter(text: string): boolean {
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    const isAllowedWhitespace = code === 9 || code === 10 || code === 13;
    if (code === 127) return true;
    if (code < 32 && !isAllowedWhitespace) return true;
  }
  return false;
}

/**
 * ⚠️ **A CITATION THAT IS NOTHING BUT A COMMENT CANNOT WITNESS ANYTHING, AND THE REGISTER HAS ALREADY
 * SHIPPED ONE.** Read this before deciding the rule is pedantic.
 *
 * Until 2026-09-01, `community-index/enumeration/a-team-name-is-what-a-referral-stores` cited the
 * doc comment beside the field — "Exactly the string a referral stores in `teamName`. Never composed
 * or prettified here." — as evidence for the claim that a team's name is never composed or
 * prettified. The two say the same thing in the same words, which is exactly the problem. Compose
 * the name, title-case it, add a prefix: the comment sits precisely where it is, the citation stays
 * green, and the page goes on telling a reader something that is no longer true. The ONLY edit that
 * broke that citation was DELETING the comment — and deleting a comment is the one action that does
 * not make the claim false.
 *
 * The property every citation must have is not length and not specificity. It is: **would the
 * claim's falsity change the cited bytes?** Code that produces or consumes the value has that
 * property. Prose describing the code does not, because prose is not what changes when behaviour
 * changes.
 *
 * If a claim genuinely rests on a convention with no mechanism behind it, that is an honest answer
 * and it belongs in `UNEVIDENCED_CLAIMS` with the reason — not in `MODEL_CLAIMS` with a comment
 * standing in for evidence.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * ⚠️ **THIS RULE IS NO LONGER LOAD-BEARING, AND ITS HOLES ARE WRITTEN DOWN RATHER THAN PATCHED.**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * The falsifying-edit check further down is the guard now. This one is kept as a cheap fast-fail
 * with a clearer message, because a citation that IS a comment has a much better error to give than
 * "your evidence survived its own falsifying edit". Two holes, both real, neither patched:
 *
 *   1. **It only inspects the citation's OPENING character.** A slice cut to begin on the second
 *      line of a doc comment never matches, and a slice cut from the middle of a single-line comment
 *      never matches either. Three citations walked straight through it — the null-referral-id one
 *      opened with a `*` continuation mid-string, the ED-verbal one opened with a backtick.
 *   2. **Its code-token test passes almost any real doc comment.** `[;{}=()[\]]` or a bare `word:`
 *      is enough, and prose containing a parenthesis, a `Note:` or a `Reason:` has one. The single
 *      rejection case below is, by coincidence, the one prose comment in this repository that
 *      contains none of them.
 *
 * **Tightening the character test was considered and rejected**: it is a better heuristic about
 * characters when characters are not the property, and every version of it still loses to a slice
 * cut from the middle of a single-line comment. What WOULD close it exactly is locating the
 * citation's match index in the file and testing whether it falls inside a block comment or a
 * `//`-to-newline span — no heuristic, no evasion. That is not built here because it needs a real
 * tokeniser to be correct (a regex literal desynced this repository's last hand-rolled comment
 * scanner — see `tests/ward-flow-single-source.test.ts`, which moved to the TypeScript AST for
 * exactly that reason), and because it would be buying a second guard for a case the first one
 * already reports.
 *
 * ⚠️ **AND THE FALSIFYING-EDIT CHECK DOES NOT FULLY SUBSUME THIS ONE — SAY SO RATHER THAN IMPLYING
 * IT DOES.** For a comment citation an author can record `find: <the comment>, replaceWith: ""` and
 * the evidence duly disappears, so the check passes mechanically. What it cannot do is hide: the
 * edit's `change` field has to say, in the register, in words, that the change to the world is
 * "the comment is deleted" — which is visibly not a change to the world at all. The defect moves
 * from invisible to written down, which is the whole of what this repair claims.
 */
function isEntirelyComment(evidence: string): boolean {
  const trimmed = collapseWhitespace(evidence).trim();
  // Only citations that OPEN as a comment are candidates. A fragment that starts in code and runs
  // into a trailing comment — `edId: string; /** WHY. … */` — is witnessing the code.
  if (!/^(\/\*\*|\/\*|\/\/|\*)/.test(trimmed)) return false;
  const withoutMarkers = trimmed.replace(/^(\/\*\*|\/\*|\/\/|\*)/, "").replace(/\*\/$/, "");
  // A code token: a statement or block character, or a property/annotation `name:`. Written without
  // any backslash escape that could arrive as a control byte — a literal backslash-b becomes 0x08,
  // matches nothing, and prints as valid, which is how a guard comes to be unable to fail.
  const codeToken = /[;{}=()[\]]|[A-Za-z_$][A-Za-z0-9_$]*\s*:/;
  return !codeToken.test(withoutMarkers);
}

/**
 * ⚠️ **THE CHECK THIS FILE GAINED ON 2026-09-01, AND THE ONE THAT ASKS THE RIGHT QUESTION.**
 *
 * Every other check here asks whether the cited bytes are PRESENT. Presence and connection are not
 * the same thing: a citation can be present, unique, and give the right answer today while nothing
 * about it tracks the fact it stands for. Twelve of this register's citations were in exactly that
 * state — right by accident. So the register now records, for each claim, the change to
 * `sourceFile` that would make the claim FALSE, and this applies it to an in-memory copy and
 * demands the evidence has gone.
 *
 * ⚠️ **A CITATION THAT IS RIGHT BY ACCIDENT IS REJECTED, AND THAT IS THE POINT RATHER THAN
 * OVER-STRICTNESS.** "It works today" is not the property being guarded. "It would stop working if
 * the claim stopped being true" is.
 *
 * Three failures are distinguished, because they call for three different fixes:
 *
 *   - `anchor-missing` / `anchor-ambiguous` — the EDIT has gone stale, not the citation. Without
 *     this, an edit that matches nothing would apply nothing, leave the evidence in place, and be
 *     indistinguishable from an unfalsifiable citation.
 *   - `no-op` — `replaceWith` equals `find`, so the "edit" changes nothing and the check cannot
 *     fail. That is the shape of every dead guard this project has found.
 *   - `evidence-survives` — the real finding. The claim can become false with every cited byte
 *     still in place.
 *
 * Nothing is written to disk. This is one `split`/`join` and one `includes` per claim.
 */
type FalsifiabilityProblem = "anchor-missing" | "anchor-ambiguous" | "no-op" | "evidence-survives";

function falsifiabilityProblem(source: string, claim: ModelClaim): FalsifiabilityProblem | null {
  const find = collapseWhitespace(claim.falsifiedBy.find);
  const replaceWith = collapseWhitespace(claim.falsifiedBy.replaceWith);
  if (find === replaceWith) return "no-op";
  const anchors = countOccurrences(source, find);
  if (anchors === 0) return "anchor-missing";
  if (anchors > 1) return "anchor-ambiguous";
  const falsified = source.split(find).join(replaceWith);
  return falsified.includes(collapseWhitespace(claim.evidence)) ? "evidence-survives" : null;
}

const fileCache = new Map<string, string>();

function readRepoFile(relativePath: string): string {
  const cached = fileCache.get(relativePath);
  if (cached !== undefined) return cached;
  const contents = collapseWhitespace(readFileSync(join(REPO_ROOT, relativePath), "utf8"));
  fileCache.set(relativePath, contents);
  return contents;
}

/** The first line of every failure message: which claim, and what it says. Never the fragment. */
function name(claim: ModelClaim): string {
  return `CLAIM ${claim.id}\n  says: ${claim.claim}\n  made in: ${claim.renderedIn}`;
}

/** A fragment is quoted last and truncated — it is the least useful part of a failure. */
function quote(fragment: string): string {
  const collapsed = collapseWhitespace(fragment);
  return collapsed.length <= 120 ? `"${collapsed}"` : `"${collapsed.slice(0, 117)}…"`;
}

describe("the model-claims register", () => {
  /**
   * The zero-match guard, first, and it is not a formality. Every check below iterates the register,
   * so an emptied or accidentally-filtered register would pass all of them by checking nothing and
   * report itself green — the same shape as an `ls` that matches no files and silently runs the
   * whole suite instead.
   */
  it("holds exactly the claims it is meant to hold, so none can be deleted in silence", () => {
    expect(
      MODEL_CLAIMS.length,
      "the number of pinned claims changed. If a claim was ADDED, raise EXPECTED_MODEL_CLAIMS and say so. If one " +
        "was REMOVED, the only two legitimate reasons are that the page sentence went with it, or that it moved to " +
        "UNEVIDENCED_CLAIMS as an absence — and a red resolved by deleting the claim is the failure this exact " +
        "count exists to make impossible.",
    ).toBe(EXPECTED_MODEL_CLAIMS);
    expect(UNEVIDENCED_CLAIMS.length, "the count of admitted gaps changed — raise or lower it deliberately").toBe(
      EXPECTED_UNEVIDENCED_CLAIMS,
    );
    expect(REGISTERED_SURFACES.length, "a surface was added to or removed from the sweep").toBe(
      EXPECTED_REGISTERED_SURFACES,
    );
  });

  /**
   * ⚠️ **A SURFACE CAN BE DECLARED SWEPT WHILE RESTING ON NOTHING**, and until 2026-09-01 one was:
   * `statistics-disclaimers.tsx` sat in `REGISTERED_SURFACES` — documented as "the surfaces this
   * register claims to have swept" — with no entry pointing at it in either list. A sweep and a
   * failure to sweep were indistinguishable, which is the same shape as an empty category rendered
   * as an absence.
   *
   * Either list satisfies this. A surface whose every claim is an ABSENCE is honestly swept — that
   * is what `UNEVIDENCED_CLAIMS` is for, and requiring a `MODEL_CLAIMS` entry would force a fake
   * citation onto exactly the page that must not have one.
   */
  it("leaves no registered surface with nothing recorded against it", () => {
    const covered = new Set([
      ...MODEL_CLAIMS.map((claim) => claim.renderedIn),
      ...UNEVIDENCED_CLAIMS.map((claim) => claim.renderedIn),
    ]);
    const bare = REGISTERED_SURFACES.filter((surface) => !covered.has(surface));
    expect(
      bare,
      "these surfaces are listed as swept and carry no claim of any kind, so nothing distinguishes them from " +
        "surfaces nobody has read. Either record what they claim, or take them out of REGISTERED_SURFACES.",
    ).toEqual([]);
  });

  it("gives every claim a distinct id", () => {
    const ids = MODEL_CLAIMS.map((claim) => claim.id);
    const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
    expect(duplicates, `these claim ids appear more than once, so a red could not identify one claim`).toEqual([]);
  });

  it("never reuses a claim id between the evidenced and unevidenced lists", () => {
    const evidenced = new Set(MODEL_CLAIMS.map((claim) => claim.id));
    const collisions = UNEVIDENCED_CLAIMS.filter((claim) => evidenced.has(claim.id)).map((claim) => claim.id);
    expect(collisions, "an id in both lists would read as pinned when it is not").toEqual([]);
  });

  it("names only surfaces that exist on disk", () => {
    for (const surface of REGISTERED_SURFACES) {
      expect(existsSync(join(REPO_ROOT, surface)), `registered surface is missing from disk: ${surface}`).toBe(true);
    }
  });

  it("makes every claim on a registered surface", () => {
    const surfaces = new Set(REGISTERED_SURFACES);
    for (const claim of MODEL_CLAIMS) {
      expect(
        surfaces.has(claim.renderedIn),
        `${name(claim)}\n  but ${claim.renderedIn} is not in REGISTERED_SURFACES — either add it, or the claim is ` +
          `recorded against the wrong file.`,
      ).toBe(true);
    }
  });

  /**
   * A two-word citation would match somewhere in almost any file and would pass forever. The floor
   * is deliberately low — some real declarations are short — but it is not nothing.
   */
  it("cites fragments long enough to identify something", () => {
    for (const claim of MODEL_CLAIMS) {
      expect(
        collapseWhitespace(claim.evidence).length,
        `${name(claim)}\n  its evidence is too short to identify a fact: ${quote(claim.evidence)}`,
      ).toBeGreaterThanOrEqual(12);
      expect(
        collapseWhitespace(claim.rendered).length,
        `${name(claim)}\n  its rendered locator is too short to identify a place: ${quote(claim.rendered)}`,
      ).toBeGreaterThanOrEqual(12);
      expect(
        claim.claim.trim().length,
        `${name(claim)}\n  a claim with no words in it cannot be checked by a reader`,
      ).toBeGreaterThan(20);
    }
  });

  /**
   * A literal `\b` in a citation becomes a backspace byte (0x08), which prints as nothing and
   * matches nothing while looking perfectly valid in a diff. It has already cost this project a
   * silent day. Same for any other control character pasted in from a terminal.
   */
  /**
   * ⚠️ **THE PREDICATE IS EXERCISED ON AN INPUT IT MUST REJECT, FIRST.** Until 2026-09-01 the sweep
   * below was the ONLY use of `hasControlCharacter`, and every citation in the register is clean —
   * so the predicate was only ever run on inputs it accepts. Replace its body with `return false;`
   * and every assertion in this file stays green while the guard against the pasted-backspace defect
   * is silently dead. That is the same defect this whole module exists to catch, one level up, and
   * the comment-only rule two blocks down already held the standard this one was breaking.
   *
   * The bytes are constructed with `String.fromCodePoint` rather than written as escapes, for the
   * same reason the predicate itself avoids them: a literal backslash-b typed into a source file
   * becomes the byte, prints as nothing, and looks perfectly valid in a diff.
   */
  it("recognises a control character, on an input it must reject", () => {
    const backspace = String.fromCodePoint(8);
    const del = String.fromCodePoint(127);
    expect(
      hasControlCharacter(`referredUnitIds${backspace}: string[];`),
      "the control-character rule no longer recognises a backspace byte, so it is guarding nothing",
    ).toBe(true);
    expect(hasControlCharacter(`a${del}b`), "the control-character rule no longer recognises DEL").toBe(true);

    // And it must not fire on ordinary citations, or the next person deletes the rule.
    expect(hasControlCharacter("preparing: boolean;")).toBe(false);
    expect(hasControlCharacter("a citation\n  wrapped over two lines\tis fine")).toBe(false);
  });

  it("cites no invisible control characters", () => {
    for (const claim of MODEL_CLAIMS) {
      expect(
        hasControlCharacter(claim.evidence),
        `${name(claim)}\n  its evidence contains a control character, so it can never match anything`,
      ).toBe(false);
      expect(
        hasControlCharacter(claim.rendered),
        `${name(claim)}\n  its rendered locator contains a control character, so it can never match anything`,
      ).toBe(false);
      // The claim's own WORDS and its falsifying edit were unchecked until 2026-09-01. A backspace
      // in a claim prints as nothing in the failure message a reader is handed; one in `find` makes
      // an edit that can never apply, which is a falsifiability check that cannot fail.
      expect(
        hasControlCharacter(claim.claim),
        `${name(claim)}\n  its claim contains a control character, so the failure message misprints it`,
      ).toBe(false);
      expect(
        hasControlCharacter(claim.falsifiedBy.find) ||
          hasControlCharacter(claim.falsifiedBy.replaceWith) ||
          hasControlCharacter(claim.falsifiedBy.change),
        `${name(claim)}\n  its falsifying edit contains a control character, so the edit can never apply and the\n` +
          `  falsifiability check would pass by doing nothing`,
      ).toBe(false);
    }
    for (const claim of UNEVIDENCED_CLAIMS) {
      expect(
        hasControlCharacter(claim.claim) || hasControlCharacter(claim.reason),
        `unevidenced claim ${claim.id} contains a control character in its claim or reason`,
      ).toBe(false);
    }
  });

  /**
   * The rule is exercised on the historical example before it is applied to the register, because a
   * predicate that returns `false` for everything would pass the sweep below by checking nothing —
   * and today, correctly, the register holds no comment-only citation for it to catch. Without this
   * block the guard would be indistinguishable from a guard that does not work.
   */
  it("recognises a comment-only citation, using the one the register actually shipped", () => {
    expect(
      isEntirelyComment(
        "/** Exactly the string a referral stores in `teamName`. Never composed or prettified here. */",
      ),
      "the comment-only rule no longer recognises the citation it was written for, so it is guarding nothing",
    ).toBe(true);

    // And it must NOT fire on the fragments that legitimately quote prose alongside code, or the
    // next person deletes the rule instead of the citation.
    expect(isEntirelyComment("id: communityTeamSlug(name), name, }));")).toBe(false);
    expect(isEntirelyComment("preparing: boolean;")).toBe(false);
    expect(
      isEntirelyComment(
        "// A bed nobody has yet left is not being made ready. Preparation only ever begins after " +
          "// `RELEASE_BED`, and only through `SET_BED_PREPARATION` — see that case. preparing: false,",
      ),
      "a citation that runs from a comment into the code it sits above is witnessing that code",
    ).toBe(false);
  });

  /** A fast-fail with a better message than the falsifiability check would give. Its holes are
   *  written out on `isEntirelyComment` itself; the guard is the falsifiability check below. */
  it("cites code rather than a comment restating the claim", () => {
    for (const claim of MODEL_CLAIMS) {
      expect(
        isEntirelyComment(claim.evidence),
        `${name(claim)}\n` +
          `  ITS EVIDENCE IS ENTIRELY A COMMENT, so it cannot fail when the claim goes false. Prose describing the\n` +
          `  code does not change when the code changes: compose the value, rename what produces it, invert the\n` +
          `  behaviour — the comment sits exactly where it is and this register stays green beside a page sentence\n` +
          `  that has become false. The only edit that breaks a comment citation is deleting the comment, which is\n` +
          `  the one change that does NOT make the claim false. Cite the code that produces or consumes the value.\n` +
          `  If no such code exists and the claim rests on a convention, it belongs in UNEVIDENCED_CLAIMS with that\n` +
          `  reason instead.\n` +
          `  cited fragment: ${quote(claim.evidence)}`,
      ).toBe(false);
    }
  });

  /**
   * ⚠️ **THE PREDICATE IS EXERCISED ON THE HISTORICAL DEFECT BEFORE IT IS TURNED ON THE REGISTER**,
   * against a synthetic source rather than a real file, so it keeps working when the real files
   * move. A predicate that returned `null` for everything would pass the sweep below by checking
   * nothing, and **this register has already made exactly that mistake once** — see
   * `hasControlCharacter`, which was never once shown to reject anything.
   *
   * The rejection case is the real shape of four of the twelve: a figure claimed to be DERIVED,
   * citing its TYPE DECLARATION. Replace the computing line with a literal null — which is
   * precisely what has already happened to `averageWaitlistWaitMinutes` — and the declaration is
   * untouched, so the citation survives an edit that makes its claim false.
   */
  it("recognises a citation that survives its own falsifying edit, using the shape the register shipped", () => {
    const source = collapseWhitespace(
      "export type WardStatistics = { averageLengthOfStayDays: number | null; };\n" +
        "const averageLengthOfStayDays = averageStayMinutes === null ? null : averageStayMinutes / MINUTES_PER_DAY;\n",
    );
    const base = {
      id: "synthetic/derived-figure",
      renderedIn: "synthetic-screen.tsx",
      rendered: "a locator long enough",
      claim: "The figure is derived rather than declared and never computed.",
      sourceFile: "synthetic-source.ts",
      falsifiedBy: {
        change: "The figure stops being derived and is returned as a literal null.",
        find: "const averageLengthOfStayDays = averageStayMinutes === null ? null : averageStayMinutes / MINUTES_PER_DAY;",
        replaceWith: "const averageLengthOfStayDays = null;",
      },
    };

    expect(
      falsifiabilityProblem(source, { ...base, evidence: "averageLengthOfStayDays: number | null;" }),
      "the falsifiability rule no longer recognises a type declaration cited for a computation — the exact shape " +
        "four of the twelve findings had — so it is guarding nothing",
    ).toBe("evidence-survives");

    // The same edit against the citation the repair moved to: the computing line itself.
    expect(
      falsifiabilityProblem(source, { ...base, evidence: base.falsifiedBy.find }),
      "a citation of the line the edit removes must PASS, or the rule rejects correct citations too",
    ).toBeNull();

    // A stale edit must be its own failure rather than silently applying nothing and passing.
    expect(
      falsifiabilityProblem(source, {
        ...base,
        evidence: base.falsifiedBy.find,
        falsifiedBy: { ...base.falsifiedBy, find: "const somethingRenamedLongAgo = 1;" },
      }),
    ).toBe("anchor-missing");
    expect(
      falsifiabilityProblem(source, {
        ...base,
        evidence: base.falsifiedBy.find,
        falsifiedBy: { ...base.falsifiedBy, find: "averageLengthOfStayDays" },
      }),
    ).toBe("anchor-ambiguous");
    expect(
      falsifiabilityProblem(source, {
        ...base,
        evidence: base.falsifiedBy.find,
        falsifiedBy: { ...base.falsifiedBy, replaceWith: base.falsifiedBy.find },
      }),
      "an edit that changes nothing must be rejected, or the whole check passes by doing nothing",
    ).toBe("no-op");
  });

  it("records a falsifying edit substantial enough to be read and judged", () => {
    for (const claim of MODEL_CLAIMS) {
      expect(
        collapseWhitespace(claim.falsifiedBy.find).length,
        `${name(claim)}\n  its falsifying edit anchors on a fragment too short to identify one place in the file`,
      ).toBeGreaterThanOrEqual(12);
      expect(
        claim.falsifiedBy.change.trim().length,
        `${name(claim)}\n  its falsifying edit states no change in words. The find/replace pair is what the machine\n` +
          `  checks; \`change\` is what a READER checks, and it is the only defence against an edit that removes the\n` +
          `  cited bytes for a reason unrelated to the claim.`,
      ).toBeGreaterThan(40);
    }
  });

  /**
   * THE CHECK THE TWELVE FINDINGS PRODUCED. Reported in full rather than first-failure-only, for the
   * same reason the evidence sweep is: an unfalsifiable citation is usually one of a family.
   */
  it("makes every claim falsifiable — the evidence must go when the claim goes false", () => {
    const explanation: Record<FalsifiabilityProblem, string> = {
      "anchor-missing":
        "ITS FALSIFYING EDIT NO LONGER APPLIES. The fragment the edit anchors on is not in the source file any\n" +
        "  more, so the edit changes nothing and this check would pass by doing nothing. Re-read the file and\n" +
        "  re-anchor the edit — and while you are there, ask whether the claim survived whatever moved the anchor.",
      "anchor-ambiguous":
        "ITS FALSIFYING EDIT IS AMBIGUOUS. The fragment it anchors on now appears more than once, so the edit no\n" +
        "  longer describes one change to one place. Lengthen the anchor.",
      "no-op":
        "ITS FALSIFYING EDIT CHANGES NOTHING — `replaceWith` is `find`. A check that applies a no-op and then\n" +
        "  asserts the evidence is gone can only ever fail, and a check that cannot pass gets deleted rather than\n" +
        "  fixed. Write the edit that would make the claim false.",
      "evidence-survives":
        "ITS EVIDENCE SURVIVES ITS OWN FALSIFYING EDIT, so nothing here is guarding this claim. The claim can\n" +
        "  become false with every cited byte still in place, and the register would stay green beside a page\n" +
        "  sentence that had stopped being true — which is the defect this module exists to prevent, one level up.\n" +
        "  Either the CITATION is wrong (cite the bytes that move: the line that computes the figure, not its type\n" +
        "  declaration; the whole record, not a two-field slice; the code, not a comment describing it), or the\n" +
        "  claim rests on a convention with no mechanism behind it and belongs in UNEVIDENCED_CLAIMS with that\n" +
        "  reason. Do not weaken the edit to get past this — an edit chosen to break the citation for an unrelated\n" +
        "  reason is the one hole this mechanism cannot close by itself.",
    };

    const problems: string[] = [];
    for (const claim of MODEL_CLAIMS) {
      const problem = falsifiabilityProblem(readRepoFile(claim.sourceFile), claim);
      if (problem === null) continue;
      problems.push(
        `${name(claim)}\n` +
          `  ${explanation[problem]}\n` +
          `  the change it claims to stand for: ${claim.falsifiedBy.change}\n` +
          `  cited fragment: ${quote(claim.evidence)}\n` +
          `  edit: ${quote(claim.falsifiedBy.find)} -> ${quote(claim.falsifiedBy.replaceWith)}`,
      );
    }
    if (problems.length > 0) {
      expect.fail(
        `${problems.length} claim(s) are not falsifiable by their own recorded edit:\n\n${problems.join("\n\n")}`,
      );
    }
  });

  it("cites source files that exist on disk", () => {
    for (const claim of MODEL_CLAIMS) {
      expect(
        existsSync(join(REPO_ROOT, claim.sourceFile)),
        `${name(claim)}\n  its evidence is cited from ${claim.sourceFile}, which is not on disk. The file has been ` +
          `moved, renamed or deleted — the claim now stands on nothing.`,
      ).toBe(true);
    }
  });

  /**
   * THE CHECK THIS FILE EXISTS FOR. The evidence must still be in the file it was read from, and
   * must still identify one thing there.
   *
   * ⚠️ **EVERY BROKEN CITATION IS REPORTED, NOT JUST THE FIRST.** A model change usually falsifies
   * several claims at once — three screens state the same fact about `ReferralAddressing` — and a
   * red that names one of them invites a one-line fix and a second red tomorrow. The reader should
   * see the whole blast radius in one go.
   */
  it("finds every claim's evidence in its source file, exactly once", () => {
    const problems: string[] = [];
    for (const claim of MODEL_CLAIMS) {
      const source = readRepoFile(claim.sourceFile);
      const occurrences = countOccurrences(source, collapseWhitespace(claim.evidence));

      if (occurrences === 0) {
        problems.push(
          `${name(claim)}\n` +
            `  ITS EVIDENCE IS GONE. ${claim.sourceFile} no longer contains the source this claim was written\n` +
            `  from. Re-read that file and decide which happened: the claim is now FALSE and the sentence on the\n` +
            `  page must change, or the code simply moved and the citation must be re-pointed. Do not repoint it\n` +
            `  without reading — repointing a stale claim at a fresh line is how a false explanation survives.\n` +
            `  cited fragment: ${quote(claim.evidence)}`,
        );
      }

      if (occurrences > 1) {
        problems.push(
          `${name(claim)}\n` +
            `  ITS EVIDENCE IS AMBIGUOUS. ${claim.sourceFile} now contains this fragment ${occurrences} times, so it\n` +
            `  no longer identifies one fact — a reader following the citation lands on ${occurrences} places and has\n` +
            `  to guess. Lengthen the citation until it identifies the one declaration the claim is about.\n` +
            `  cited fragment: ${quote(claim.evidence)}`,
        );
      }
    }
    if (problems.length > 0) {
      expect.fail(`${problems.length} claim(s) no longer rest on the source they cite:\n\n${problems.join("\n\n")}`);
    }
  });

  /**
   * The other end. The register does not hold a second copy of the page's sentence — it holds a
   * locator into the page — so the locator has to be pinned too, or the register could go on
   * describing a paragraph that was deleted.
   */
  it("finds every claim's rendered locator on its own surface, exactly once", () => {
    const problems: string[] = [];
    for (const claim of MODEL_CLAIMS) {
      const surface = readRepoFile(claim.renderedIn);
      const occurrences = countOccurrences(surface, collapseWhitespace(claim.rendered));

      if (occurrences === 0) {
        problems.push(
          `${name(claim)}\n` +
            `  THE PLACE THIS CLAIM IS MADE HAS GONE. ${claim.renderedIn} no longer contains the locator recorded\n` +
            `  for it. If the paragraph was removed, remove the register entry with it; if it was reworded, move\n` +
            `  the locator and re-read the sentence while you are there.\n` +
            `  locator: ${quote(claim.rendered)}`,
        );
      }

      if (occurrences > 1) {
        problems.push(
          `${name(claim)}\n` +
            `  ITS LOCATOR IS AMBIGUOUS. ${claim.renderedIn} contains it ${occurrences} times, so the register can\n` +
            `  no longer say which paragraph makes this claim. Lengthen the locator.\n` +
            `  locator: ${quote(claim.rendered)}`,
        );
      }
    }
    if (problems.length > 0) {
      expect.fail(
        `${problems.length} claim(s) can no longer be located on the page that makes them:\n\n${problems.join("\n\n")}`,
      );
    }
  });

  /**
   * Two entries may legitimately share evidence — three screens state the same fact about
   * `ReferralAddressing`, and they should all go red together when it changes. What must NOT repeat
   * is the pair (surface, locator, claim), which would be the same claim recorded twice.
   */
  it("records no claim twice against the same paragraph", () => {
    const seen = new Map<string, string>();
    for (const claim of MODEL_CLAIMS) {
      const key = `${claim.renderedIn}::${collapseWhitespace(claim.rendered)}::${claim.claim}`;
      const first = seen.get(key);
      expect(
        first,
        `${name(claim)}\n  is the same claim, in the same place, as ${first} — one of the two is a restatement.`,
      ).toBeUndefined();
      seen.set(key, claim.id);
    }
  });
});

describe("the claims the register admits it cannot pin", () => {
  it("gives every unpinnable claim a distinct id, a real surface and a stated reason", () => {
    const ids = UNEVIDENCED_CLAIMS.map((claim) => claim.id);
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);

    for (const claim of UNEVIDENCED_CLAIMS) {
      expect(
        existsSync(join(REPO_ROOT, claim.renderedIn)),
        `unevidenced claim ${claim.id} is recorded against ${claim.renderedIn}, which is not on disk`,
      ).toBe(true);
      expect(
        claim.claim.trim().length,
        `unevidenced claim ${claim.id} has no claim written out, so nobody can judge the gap`,
      ).toBeGreaterThan(20);
      expect(
        claim.reason.trim().length,
        `unevidenced claim ${claim.id} states no reason. "Cannot be checked" without a reason reads as an ` +
          `oversight; the whole value of this list is that each gap is argued.`,
      ).toBeGreaterThan(40);
    }
  });
});
