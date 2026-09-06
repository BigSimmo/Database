import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * EVERY EVENT THE REDUCER HANDLES MUST BE REACHABLE FROM A SCREEN, OR BE LISTED HERE WITH A REASON.
 *
 * A reducer case with no dispatcher is a feature that is complete, tested, documented — and that
 * nobody can use. It is invisible to every other guard in this repository: it typechecks, its own
 * reducer tests pass, and no screen looks wrong, because the screen simply does not offer it.
 *
 * ⚠️ **THE CLINICAL SHAPE THIS EXISTS FOR, IN THE OWNER'S OWN WORDS, RULING R-B-08:** _"Half-built,
 * 'override is possible but always recorded' had become 'override is impossible', which is a
 * different clinical policy."_ That was found by hand. So was the urgent flag, on 2026-09-01 —
 * `ward-management-console.tsx` records that it "was complete and unreachable" until somebody
 * noticed. **Both were found by a person reading; nothing failed either time.** This file is the
 * check that would have.
 *
 * ⚠️ **THE ALLOWLIST IS A REGISTER OF KNOWN GAPS, NEVER A WAY TO PASS.** It must be EXACT: an entry
 * for an event that HAS a dispatcher fails just as loudly as an unreachable event with no entry, so
 * building the missing screen forces the entry out and the register cannot rot into a list of
 * things that were once true.
 */

const WARD_ROOT = "src/components/ward-management";
const REDUCER = `${WARD_ROOT}/ward-flow-reducer.ts`;

/**
 * These two DEFINE the vocabulary rather than using it — the reducer's `case` labels are the source
 * set, and the event union names every type in a non-comment position — so a scan that included
 * them would find every event "dispatched" and this file could never fail.
 */
const DEFINITION_FILES = new Set([REDUCER, `${WARD_ROOT}/ward-flow-events.ts`]);

/**
 * Reducer events no screen can dispatch today, each with the reason it is outstanding rather than
 * wrong. **Adding a name here is recording a gap, not closing one.**
 */
const KNOWN_UNREACHABLE: Readonly<Record<string, string>> = {
  STEP_BACK_STAGE:
    "Task 5 (2026-09-04) built the model, event and reducer halves; the DOM control was deferred " +
    "by Ward Lead because another session held ward-management-console.tsx for review. That " +
    "reason has expired. Until it is built, a coordinator cannot correct a movement's stage.",
  WITHDRAW_ACCEPTANCE:
    "The other half of the same deferral. Until it is built, a coordinator cannot undo a ward's " +
    "acceptance, so a bed stays held against a decision reversed in reality — the R-B-08 shape.",
  RECORD_NO_REFERRAL: "No screen records that a movement has no referral behind it.",
  RECORD_TRANSPORT_NEED: "No screen records a transport need separately from booking one.",
};

/** A walk that reaches too few files would make every assertion below pass over nothing. */
const MINIMUM_WARD_FILES = 20;
const MINIMUM_REDUCER_CASES = 40;

function wardSourceFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry).replaceAll("\\", "/");
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.tsx?$/.test(path) && !DEFINITION_FILES.has(path)) found.push(path);
    }
  };
  walk(WARD_ROOT);
  return found;
}

/**
 * Comments become spaces. ⚠️ **This is the load-bearing half.** Every one of these event names also
 * appears in prose — `ward-model.ts` explains `WITHDRAW_ACCEPTANCE` in four doc comments, and
 * `ward-management-console.tsx` names `FLAG_MOVEMENT_URGENT` in a comment ABOVE the control that
 * dispatches it. A scan that counted those would call an unreachable event reachable, which is the
 * one direction this file must never fail in.
 */
export function stripComments(source: string): string {
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

function reducerCases(): string[] {
  const code = stripComments(readFileSync(REDUCER, "utf8"));
  const found = new Set<string>();
  for (const match of code.matchAll(/case\s+"([A-Z][A-Z0-9_]*)"\s*:/g)) found.add(match[1]);
  return [...found].sort();
}

/**
 * Every event name appearing in non-comment code anywhere outside the two definition files.
 *
 * ⚠️ **Deliberately a NAME search and not `type: "X"`.** The urgent flag is dispatched as
 * `type: movement.flaggedUrgent ? "CLEAR_MOVEMENT_URGENT_FLAG" : "FLAG_MOVEMENT_URGENT"`, which no
 * `type: "…"` pattern matches — a narrower search reports both as unreachable, and I know because a
 * narrower search did exactly that before this file existed.
 */
function dispatchedNames(files: string[]): Set<string> {
  const found = new Set<string>();
  for (const file of files) {
    const code = stripComments(readFileSync(file, "utf8"));
    for (const match of code.matchAll(/"([A-Z][A-Z0-9_]*)"/g)) found.add(match[1]);
  }
  return found;
}

describe("every reducer event is reachable from a screen, or recorded as a known gap", () => {
  it("walks the reducer and the ward source tree", () => {
    expect(
      reducerCases().length,
      "the reducer's case labels could not be parsed — every assertion below would pass over nothing",
    ).toBeGreaterThan(MINIMUM_REDUCER_CASES);
    expect(wardSourceFiles().length, "the ward source walk reached too few files to mean anything").toBeGreaterThan(
      MINIMUM_WARD_FILES,
    );
  });

  it("counts a ternary dispatch as reachable and a comment as not", () => {
    /*
     * Both directions, on the two mistakes this scan can actually make, run on every pass rather
     * than in a scratch script. The first is the one that produces a FALSE FINDING — reporting a
     * built control as missing — and it is the mistake that was made before this file existed.
     */
    const ternary = `dispatch({ type: x ? "AAA_EVENT" : "BBB_EVENT", now });`;
    const namesInTernary = [...stripComments(ternary).matchAll(/"([A-Z][A-Z0-9_]*)"/g)].map((m) => m[1]);
    expect(namesInTernary, "a ternary dispatch is no longer seen, so built controls would read as missing").toEqual([
      "AAA_EVENT",
      "BBB_EVENT",
    ]);

    /*
     * ⚠️ THE QUOTES INSIDE THESE COMMENTS ARE THE POINT, AND AN EARLIER VERSION OF THIS CONTROL
     * OMITTED THEM. `dispatchedNames` matches a name only when it is DOUBLE-QUOTED, and today's
     * ward comments write event names in backticks — so a control using unquoted prose exercised a
     * different predicate from the scan and would have passed while the scan was broken. A control
     * must run the same test the scan runs.
     */
    const commentOnly = ['/* "CCC_EVENT" is explained here and dispatched nowhere. */', '// "DDD_EVENT" too.'].join(
      "\n",
    );
    const namesInComments = [...stripComments(commentOnly).matchAll(/"([A-Z][A-Z0-9_]*)"/g)].map((m) => m[1]);
    expect(
      namesInComments,
      "comment text survived stripping, so prose about an event would count as a dispatcher",
    ).toEqual([]);
  });

  it("has no unreachable event that is not recorded, and no record for an event that is reachable", () => {
    const cases = reducerCases();
    const dispatched = dispatchedNames(wardSourceFiles());
    const unreachable = cases.filter((name) => !dispatched.has(name));
    const recorded = Object.keys(KNOWN_UNREACHABLE).sort();

    expect(
      unreachable.filter((name) => !(name in KNOWN_UNREACHABLE)),
      "the reducer handles these events and no ward screen dispatches them, so they are complete, " +
        "tested and unusable. Build the control, or add the name to KNOWN_UNREACHABLE with the " +
        "reason it is outstanding — never without one.",
    ).toEqual([]);

    expect(
      recorded.filter((name) => !unreachable.includes(name)),
      "these are recorded as unreachable but a screen now dispatches them. Remove the entry: a " +
        "register of gaps that keeps closed ones is a list of things that used to be true.",
    ).toEqual([]);

    expect(
      recorded.filter((name) => !cases.includes(name)),
      "these are recorded as unreachable but the reducer no longer handles them at all",
    ).toEqual([]);
  });
});
