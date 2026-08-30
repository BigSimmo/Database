import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * FD-23 AT THE SCREEN BOUNDARY — a ward-facing surface may reach referral data only through the
 * ward-scoped projection.
 *
 * **Owner ruling, 2026-08-30: a ward cannot see where else a patient has been referred. The
 * coordinator may see everything.** His reason: so a ward does not spend its time on a patient who
 * is being placed elsewhere. Spec Part 7 (`docs/ward-flow-referral-destination-spec.md`).
 *
 * `src/components/ward-management/ward-referral-visibility.ts` already holds that rule in the DATA:
 * `WardScopedReferral` has no `destinations` field, `CoordinatorScopedReferral` does, and
 * `tests/ward-referral-visibility.test.ts` guards both at every level. **Nothing stopped a
 * ward-facing component importing the full `Referral` and bypassing the projection entirely.** A
 * guard that holds at the model and not at the screen is the guard the next person building a ward
 * screen walks around in good faith, because the full type is right there and imports fine.
 *
 * This file closes that. Three decisions are made below, and each is written down rather than
 * implied, because every one of them is a place this guard could be quietly narrowed later.
 *
 * ---
 *
 * ## 1. WHICH COMPONENTS ARE WARD-FACING — `WARD_FACING`, enumerated, never a path pattern
 *
 * A pattern (`ward/**`, `*ward*`) silently acquires new files and silently misses renamed ones,
 * and a guard whose scope moves on its own is a guard nobody can reason about. So the list is
 * literal, its length is pinned, and every entry carries the sentence that put it there:
 *
 * - **`ward/ward-screen.tsx`** — route `/mockups/ward-flow/ward/[unitId]`. It says what it is on
 *   itself: "This is {unit.name}'s own view. Every figure and referral below belongs to this ward
 *   — never another one." That sentence IS the FD-23 rule, rendered.
 * - **`board/ward-board.tsx`** — route `/mockups/ward-flow/board/[unitId]`, "one ward's beds on a
 *   screen". Scoped to a single unit and read by that unit's staff.
 * - **`board/ward-daily-sheet.tsx`** — the printed sheet the ward board renders, "the page a charge
 *   nurse carries into the morning meeting". It has no route of its own and is reached only through
 *   the board, but it is listed as an entry point in its own right because it is the surface that
 *   goes on PAPER: a leak here leaves the building.
 *
 * **Considered and deliberately NOT ward-facing**, so the reasoning is recoverable rather than
 * inferred from an absence: `wards/ward-index.tsx` is the statewide index of every ward, not one
 * ward's own view; `handover/handover-page.tsx`, `morning/morning-page.tsx`,
 * `escalation/escalation-board.tsx`, `discharges/discharge-board.tsx`,
 * `out-of-area/out-of-area-board.tsx`, `search/patient-search.tsx` and `tracker/live-tracker.tsx`
 * are network-wide coordinator boards; `patients/[patientId]` renders `WardPatientWorkspace` from
 * the coordinator console. Every one of them appears in `SEES_EVERYTHING` below.
 *
 * ---
 *
 * ## 2. WHAT "REACHING REFERRAL DATA" MEANS — three vectors, two checks
 *
 * (a) **Naming the full record.** Importing `Referral`, `ReferralAddressing`, `referralState` or
 *     the coordinator projection — the vocabulary that carries, or derives a fact from, ALL of a
 *     referral's destinations. `FULL_REFERRAL_VOCABULARY` enumerates the spellings EXACTLY rather
 *     than using a `Referral\w*` wildcard, because `ReferralSource`, `ReferralDeclineReason` and
 *     `UrgencyLevel` are person/answer facts that `WardScopedReferral` itself carries and a ward is
 *     entitled to. A wildcard would forbid the projection's own field types.
 *
 * (b) **Reaching it through an intermediate module.** A ward component importing
 *     `./referral-cards` which itself imports `Referral` is the same leak with one more file in
 *     front of it, and a direct-import-only check passes forever against it. So the check runs over
 *     the TRANSITIVE local import graph, following `@/…` and `./…` specifiers, exactly as
 *     `tests/ward-referral-matching.test.ts` does for the D15 bed-release contract — the precedent
 *     in this repo, and the one whose own comments record what a weaker version of it missed.
 *     `collectModuleGraph`, `scanSource` and the two tests that pin the comment scanner are lifted
 *     from there deliberately: by that file's own account, its earlier extractor was found passing
 *     33 of 33 with a genuine bed-release import sitting in the graph, one level up.
 *
 * (c) **Receiving it through props or context.** No import graph can see this one:
 *     `useWardFlow()` hands every consumer the full `referrals: Referral[]`, because the
 *     coordinator screens legitimately need it. So a second, separate check reads the
 *     `useWardFlow()` destructuring of each ward-facing entry and fails if `referrals` is in it.
 *     Without this, the whole file would be a guard with its own front door open.
 *
 * **THE GRAPH IS THE WARD-ONLY SUBGRAPH, and this is the load-bearing scoping decision.** Following
 * every import from a React component reaches 53 files, including `ward-flow-provider.tsx` and
 * `ward-model.ts` — shared infrastructure that MUST name `Referral`, since the coordinator's own
 * screens are built from it. A guard asserting "nothing in that graph names a referral" is red on
 * day one and would be neutered into meaninglessness by whoever had to make it pass.
 *
 * So the guarded set is computed, never listed: **every module reachable from the ward-facing
 * entries that NO surface in `SEES_EVERYTHING` reaches.** A module both roles reach is shared
 * infrastructure by construction; a module only ward screens reach is the ward's own code, which is
 * exactly where a helpful person puts a referral helper. The set is six files today and the four
 * that matter are pinned by name below, so a refactor that moves a ward module under a coordinator
 * import — genuinely narrowing this guard — fails here rather than nowhere.
 *
 * **Named limit:** a leak placed in a module a coordinator screen also imports sits outside this
 * set. That is a real hole and it is stated rather than papered over — but it costs the leaker an
 * edit to a coordinator surface as well, which is no longer the good-faith mistake this file
 * exists to catch.
 *
 * ---
 *
 * ## 3. THE COORDINATOR IS EXPLICITLY OUT OF SCOPE — `SEES_EVERYTHING`
 *
 * "The coordinator may see everything" is half the owner's sentence, so the coordinator's surfaces
 * are named as ALLOWED rather than merely omitted, each with the reason beside it. The list is also
 * what the subtraction above runs on, so it is load-bearing twice: it documents the exemption AND
 * defines the boundary. The emergency-department and transport-officer screens sit in it too, on
 * the narrower ground that the ruling names the ward only — `ward-referral-visibility.ts`'s own doc
 * comment declines to decide the ED case, calling it a product decision rather than an
 * implementer's, and this file does not decide it either.
 */

const SRC_ROOT = resolve(process.cwd(), "src");
const WARD_DIR = resolve(SRC_ROOT, "components/ward-management");

/** The three single-ward surfaces. See section 1 of this file's doc comment for why each. */
const WARD_FACING: readonly string[] = [
  "ward/ward-screen.tsx",
  "board/ward-board.tsx",
  "board/ward-daily-sheet.tsx",
].map((file) => resolve(WARD_DIR, file));

/**
 * Every surface FD-23 does NOT bind, with the reason it is allowed, and the subtraction set that
 * separates shared infrastructure from the ward's own code.
 */
const SEES_EVERYTHING: ReadonlyArray<{ file: string; reason: string }> = [
  {
    file: "coordinator/coordinator-screen.tsx",
    reason: "the coordinator's own screen — 'the coordinator may see everything'",
  },
  {
    file: "coordinator/shortlist-panel.tsx",
    reason: "coordinator panel: it chooses where to refer, so it must see every destination",
  },
  { file: "coordinator/exception-drawer.tsx", reason: "a panel of the coordinator screen" },
  { file: "coordinator/flow-diagram.tsx", reason: "a panel of the coordinator screen" },
  { file: "coordinator/pressure-strip.tsx", reason: "a panel of the coordinator screen" },
  { file: "coordinator/priority-queue.tsx", reason: "a panel of the coordinator screen" },
  {
    file: "referrals/referral-board.tsx",
    reason: "the referral queue — a coordinator's working list of every referral",
  },
  { file: "referrals/referral-intake.tsx", reason: "raising a referral: the referrer chooses the destinations" },
  {
    file: "referrals/referral-match.tsx",
    reason: "matching a referral to units — coordinator work over the whole record",
  },
  { file: "search/patient-search.tsx", reason: "network-wide search over the open caseload, not one ward's view" },
  { file: "morning/morning-page.tsx", reason: "the statewide morning bed state" },
  { file: "morning/morning-tour.tsx", reason: "the guided tour of that statewide page" },
  { file: "handover/handover-page.tsx", reason: "the network-wide shift handover" },
  {
    file: "escalation/escalation-board.tsx",
    reason: "every patient whose placement has gone wrong, across the network",
  },
  { file: "discharges/discharge-board.tsx", reason: "the discharge and egress board — a coordinator's chase list" },
  { file: "out-of-area/out-of-area-board.tsx", reason: "the statewide out-of-area ledger" },
  { file: "tracker/live-tracker.tsx", reason: "the network-wide live tracker" },
  {
    file: "wards/ward-index.tsx",
    reason: "the index of every ward — statewide navigation, not any one ward's own view",
  },
  {
    file: "ed/ed-screen.tsx",
    reason: "a different role; the ruling names the ward only and this file does not extend it",
  },
  { file: "officer/officer-screen.tsx", reason: "the transport officer's screen — a different role again" },
  {
    file: "ward-management-console.tsx",
    reason: "the coordinator console, including the patient movement workspace",
  },
  { file: "ward-management-network.tsx", reason: "the statewide network view" },
  { file: "ward-management-modes.tsx", reason: "the console's mode shell" },
].map((entry) => ({ ...entry, file: resolve(WARD_DIR, entry.file) }));

/**
 * The vocabulary that carries, or derives a fact from, EVERY destination on a referral.
 *
 * Enumerated exactly. `\bReferral\b` matches the full record type and does NOT match
 * `WardScopedReferral`, `ReferralSource` or `ReferralDeclineReason` — the first because there is no
 * word boundary inside `ScopedReferral`, the last two because the boundary is on the far side.
 * That is the point: `WardScopedReferral` is the projection a ward SHOULD import, and its own
 * fields are typed with the small referral vocabulary, so a wildcard here would forbid the fix.
 *
 * `referralState` is included because it is a fact about all the destinations together — a referral
 * reads "accepted" only because somebody accepted it, so a ward reading it would be reading
 * somebody else's decision. `ward-referral-visibility.ts` makes exactly that argument in prose;
 * this is it as a check.
 */
const FULL_REFERRAL_VOCABULARY =
  /\bReferral\b|\bReferralAddressing\b|\bWardAddressing\b|\breferralState\b|\bCoordinatorScopedReferral\b|\bcoordinatorScopedReferral\b|\bcoordinatorScopedReferrals\b/;

/**
 * `ward-board-derivations.ts` is ward-only AND names `Referral`, so this guard was RED on its first
 * run — which is what a guard is for.
 *
 * It is exempt, on a bounded reason rather than on being inconvenient: it **builds** a `Referral`
 * and never **receives** one. `bedAcceptsSex` constructs a synthetic single-destination probe —
 * "does this bed accept a person of this sex" — hands it to `referralEligibility`, reads one gate
 * and discards it. Nothing about a real patient enters that function and no other destination
 * exists on the value, so there is nothing for it to leak.
 *
 * The probe cannot be a `WardScopedReferral`: `referralEligibility` takes the full record plus the
 * ward destination, deliberately, and adding a convenience overload for this one caller is
 * forbidden. So the honest move is to exempt it and PIN THE REASON — which the companion test
 * "keeps the one exemption bounded" does, by failing the moment this module grows a parameter typed
 * `Referral`. An exemption whose reason nothing checks is how a guard rots.
 */
const BUILDS_BUT_NEVER_RECEIVES = resolve(WARD_DIR, "ward-board-derivations.ts");

// ---------------------------------------------------------------------------------------------
// Module-graph machinery, lifted from `tests/ward-referral-matching.test.ts`'s D15 contract along
// with the two tests that pin it. That contract's own history is the argument for copying it whole
// rather than writing a simpler one: a naive `import\s+[\s\S]*?;` extractor stops at the first
// semicolon, so a semicolon inside a comment truncates the statement before the specifier — which
// both hides an import from the check AND stops the traversal following it, narrowing the graph
// while the suite stays green.
// ---------------------------------------------------------------------------------------------

const REGEX_MAY_FOLLOW =
  /(^|[([{,;:=!&|?+\-*%~^<>])\s*$|\b(return|typeof|case|in|of|delete|void|instanceof|new|do|else|yield|await)\s+$/;

/** Removes line and block comments while tracking strings, templates and regex literals, so a
 *  module specifier or a message that merely contains a comment marker is never mistaken for one.
 *  `balanced` is false when the scan ended out of step — a guard that has lost its place must say
 *  so rather than report clean over a partial read. */
function scanSource(source: string): { text: string; balanced: boolean } {
  let out = "";
  let index = 0;
  let inCharacterClass = false;
  let mode: "code" | "line" | "block" | "'" | '"' | "`" | "regex" = "code";
  while (index < source.length) {
    const character = source[index];
    const pair = source.slice(index, index + 2);
    if (mode === "code") {
      if (pair === "//") {
        mode = "line";
        index += 2;
        continue;
      }
      if (pair === "/*") {
        mode = "block";
        index += 2;
        continue;
      }
      if (character === "/" && REGEX_MAY_FOLLOW.test(out.slice(-12))) {
        mode = "regex";
        inCharacterClass = false;
        out += character;
        index += 1;
        continue;
      }
      if (character === "'" || character === '"' || character === "`") mode = character;
      out += character;
      index += 1;
      continue;
    }
    if (mode === "regex") {
      if (character === "\\") {
        out += source.slice(index, index + 2);
        index += 2;
        continue;
      }
      if (character === "\n") {
        mode = "code";
        out += "\n";
        index += 1;
        continue;
      }
      if (character === "[") inCharacterClass = true;
      else if (character === "]") inCharacterClass = false;
      else if (character === "/" && !inCharacterClass) mode = "code";
      out += character;
      index += 1;
      continue;
    }
    if (mode === "line") {
      if (character === "\n") {
        mode = "code";
        out += "\n";
      }
      index += 1;
      continue;
    }
    if (mode === "block") {
      if (pair === "*/") {
        mode = "code";
        index += 2;
      } else {
        index += 1;
      }
      continue;
    }
    if (character === "\\") {
      out += source.slice(index, index + 2);
      index += 2;
      continue;
    }
    // A single- or double-quoted literal cannot contain a raw newline, so meeting one means the
    // scanner opened a string that was never there and has lost its place. Templates legitimately
    // span newlines and are covered by the balance flag instead.
    if (character === "\n" && mode !== "`") {
      mode = "code";
      out += "\n";
      index += 1;
      continue;
    }
    if (character === mode) mode = "code";
    out += character;
    index += 1;
  }
  return { text: out, balanced: mode === "code" || mode === "line" };
}

function withoutComments(source: string): string {
  return scanSource(source).text;
}

function importStatementsOf(source: string): string[] {
  return withoutComments(source).match(/import\s+[\s\S]*?;/g) ?? [];
}

function importsMention(source: string, needle: RegExp): boolean {
  return importStatementsOf(source).some((statement) => needle.test(statement));
}

function specifierOf(statement: string): string | null {
  const match = statement.match(/from\s+["']([^"']+)["']/);
  return match ? match[1] : null;
}

/** Resolves a `@/…` or relative specifier to a real file, trying each extension TypeScript's own
 *  resolution would. Null for a bare package specifier — not part of this project's module graph. */
function resolveLocalImport(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = resolve(SRC_ROOT, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    return null;
  }
  const candidates = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/** Every file transitively reachable from `entryFiles` via local imports, mapped to its source. */
function collectModuleGraph(entryFiles: readonly string[]): Map<string, string> {
  const visited = new Map<string, string>();
  const queue = [...entryFiles];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    const source = readFileSync(file, "utf8");
    visited.set(file, source);
    for (const statement of importStatementsOf(source)) {
      const specifier = specifierOf(statement);
      if (!specifier) continue;
      const resolved = resolveLocalImport(specifier, file);
      if (resolved && !visited.has(resolved)) queue.push(resolved);
    }
  }
  return visited;
}

/** The ward's OWN code: reachable from a ward-facing entry and from no surface allowed to see
 *  everything. See section 2 of this file's doc comment for why the set is computed, not listed. */
function wardOnlyModules(): Map<string, string> {
  const wardGraph = collectModuleGraph(WARD_FACING);
  const sharedGraph = collectModuleGraph(SEES_EVERYTHING.map((entry) => entry.file));
  return new Map([...wardGraph].filter(([file]) => !sharedGraph.has(file)));
}

/** The binding lists of every `const { … } = useWardFlow()` in a source file. Comments are stripped
 *  first, so the JSX comment on `ward-screen.tsx` that merely NAMES `useWardFlow()` is not read as
 *  a destructuring, and the prose "Incoming referrals" on the same screen is never mistaken for a
 *  context read. */
function contextBindingsOf(source: string): string[][] {
  return [...withoutComments(source).matchAll(/const\s*\{([^}]*)\}\s*=\s*useWardFlow\(\)/g)].map((match) =>
    match[1]
      .split(",")
      .map((binding) => binding.split(":")[0].trim())
      .filter((binding) => binding.length > 0),
  );
}

const shortPath = (file: string) => relative(process.cwd(), file).replace(/\\/g, "/");

describe("FD-23 at the screen boundary", () => {
  it("guards a ward-facing list that is exactly the three single-ward surfaces", () => {
    // NON-VACUITY, and the first thing to fail if this guard is ever emptied. An import-graph
    // check over an empty entry list passes forever and reads as coverage — which is the failure
    // mode this whole file was written to avoid, so it is asserted before anything else.
    expect(WARD_FACING.length, "the ward-facing list changed size — re-read section 1 above").toBe(3);
    for (const file of WARD_FACING) {
      expect(existsSync(file), `${shortPath(file)} is named ward-facing but does not exist`).toBe(true);
    }
    // The named list, not just its length: a swap that kept the count would otherwise pass.
    expect(WARD_FACING.map((file) => basename(file)).sort()).toEqual([
      "ward-board.tsx",
      "ward-daily-sheet.tsx",
      "ward-screen.tsx",
    ]);
  });

  it("keeps every surface allowed to see everything pointing at a file that exists", () => {
    // A stale entry is an exemption for nothing, and — because this list is also the subtraction
    // set — a stale entry silently WIDENS the guarded set rather than narrowing it. Either way it
    // must not sit here unnoticed.
    expect(SEES_EVERYTHING.length, "the allowed-surface list changed size — re-read section 3 above").toBe(23);
    for (const { file, reason } of SEES_EVERYTHING) {
      expect(existsSync(file), `${shortPath(file)} is allow-listed but does not exist`).toBe(true);
      expect(reason.length, `${shortPath(file)} is allow-listed with no reason beside it`).toBeGreaterThan(10);
    }
  });

  it("resolves the ward graph transitively rather than following direct imports only", () => {
    // THE ASSERTION THAT MAKES THE GUARD BELOW MEAN ANYTHING. A direct-import check is defeated by
    // one level of indirection, so the traversal must be shown to reach past the entry files.
    // `ward-board-derivations.ts` and `ward-model.ts` are named because NEITHER is an entry: the
    // first is reached through `ward-board.tsx`, the second only through an import chain, so a
    // resolver that stopped following imports could not produce either.
    const graph = collectModuleGraph(WARD_FACING);
    const beyondTheEntries = [...graph.keys()].filter((file) => !WARD_FACING.includes(file));
    expect(beyondTheEntries.map((file) => basename(file))).toContain("ward-board-derivations.ts");
    expect(beyondTheEntries.map((file) => basename(file))).toContain("ward-model.ts");
    expect(graph.size, "the ward module graph collapsed — this guard would prove nothing").toBeGreaterThanOrEqual(40);

    // And the scan must have read every one of those files to the end. A scanner that finished a
    // file still believing it was inside a string read only part of it, and would report clean
    // over whatever it never reached — silently, and while green.
    const desynchronised = [...graph.entries()].filter(([, source]) => !scanSource(source).balanced);
    expect(
      desynchronised.map(([file]) => basename(file)),
      "the comment scanner lost its place",
    ).toEqual([]);
  });

  it("sees an import that a comment would otherwise hide from this guard", () => {
    const hiddenByLineComment = [
      "import {",
      "  // note; hidden from a naive matcher",
      "  Referral,",
      '} from "./ward-model";',
    ].join("\n");
    const hiddenByBlockComment = 'import { /* note; hidden */ Referral } from "./ward-model";';

    // The naive extractor is non-greedy and stops at the semicolon INSIDE the comment, so it never
    // reaches the imported name. Pinned here so the reason the scanner exists cannot be lost.
    for (const sample of [hiddenByLineComment, hiddenByBlockComment]) {
      expect(sample.match(/import\s+[\s\S]*?;/)?.[0]).not.toMatch(FULL_REFERRAL_VOCABULARY);
    }
    expect(importsMention(hiddenByLineComment, FULL_REFERRAL_VOCABULARY)).toBe(true);
    expect(importsMention(hiddenByBlockComment, FULL_REFERRAL_VOCABULARY)).toBe(true);

    // A stripper that deleted everything would satisfy the lines above by finding nothing to
    // disagree with, so both directions are pinned on plain, comment-free imports — and the
    // NEGATIVE cases are what keep the vocabulary from forbidding the projection itself.
    expect(importsMention('import type { Referral } from "./ward-model";', FULL_REFERRAL_VOCABULARY)).toBe(true);
    expect(
      importsMention('import type { WardScopedReferral } from "./ward-referral-visibility";', FULL_REFERRAL_VOCABULARY),
      "the vocabulary forbids the ward-scoped projection — it would forbid the fix as well as the leak",
    ).toBe(false);
    expect(
      importsMention(
        'import type { ReferralSource, ReferralDeclineReason } from "./ward-model";',
        FULL_REFERRAL_VOCABULARY,
      ),
      "the vocabulary is too broad — these are fields the ward-scoped projection itself carries",
    ).toBe(false);

    // A string that merely LOOKS like a comment must survive, or the stripper would corrupt module
    // specifiers rather than clean them, dropping files from the traversal in silence.
    expect(withoutComments('const url = "https://example.test/a"; // trailing')).toBe(
      'const url = "https://example.test/a"; ',
    );
    // And the balance flag must be able to report false, or the sweep applying it proves nothing.
    expect(scanSource("const a = `unterminated").balanced).toBe(false);
  });

  it("computes a ward-only set that still contains the ward's own modules", () => {
    // The subtraction is the scoping decision this guard rests on, so its OUTPUT is pinned rather
    // than trusted. If a coordinator surface later imports one of these, that module leaves the
    // guarded set — a real narrowing — and it fails here, where the reason is written down.
    const wardOnly = [...wardOnlyModules().keys()].map((file) => basename(file));
    expect(wardOnly.length, "the ward-only set is empty — the guard below would pass over nothing").toBeGreaterThan(0);
    expect(wardOnly).toContain("ward-screen.tsx");
    expect(wardOnly).toContain("ward-board.tsx");
    expect(wardOnly).toContain("ward-daily-sheet.tsx");
    expect(wardOnly).toContain("ward-board-derivations.ts");
    // Shared infrastructure must be OUT of it, or the guard is red on day one and gets neutered.
    expect(wardOnly).not.toContain("ward-model.ts");
    expect(wardOnly).not.toContain("ward-flow-provider.tsx");
  });

  it("lets no ward-only module reach a referral's other destinations", () => {
    const offenders = [...wardOnlyModules().entries()]
      .filter(([file]) => file !== BUILDS_BUT_NEVER_RECEIVES)
      .filter(([, source]) => importsMention(source, FULL_REFERRAL_VOCABULARY))
      .map(([file]) => shortPath(file));
    expect(
      offenders,
      "a ward-facing surface reaches the full referral record — route it through wardScopedReferral()",
    ).toEqual([]);
  });

  it("keeps the one exemption bounded: that module builds a referral and never receives one", () => {
    const source = withoutComments(readFileSync(BUILDS_BUT_NEVER_RECEIVES, "utf8"));
    // The exemption's whole reason. A parameter typed `Referral` means real referral data now
    // ENTERS this ward-only module from outside, and the reason written beside the exemption stops
    // being true — so the exemption fails here rather than continuing to hold silently.
    expect(source, "a ward-only module now RECEIVES a referral — the exemption's reason no longer holds").not.toMatch(
      /:\s*Referral(\[\])?\s*[,)]/,
    );
    // And it must still be the local probe the exemption was granted for, not something else.
    expect(source, "the exempted module no longer builds the local probe the exemption names").toMatch(
      /const\s+probe:\s*Referral\s*=/,
    );
  });

  it("lets no ward-facing component take referral data from the shared provider", () => {
    // The vector no import graph can see. `useWardFlow()` hands every consumer the full
    // `referrals: Referral[]`, because the coordinator screens need it — so the ward screens must
    // decline it here, by name.
    const reads = WARD_FACING.map((file) => ({ file, bindings: contextBindingsOf(readFileSync(file, "utf8")) }));
    // Non-vacuity: at least one ward-facing surface really does read the provider, so this is a
    // check over something rather than a loop over nothing.
    expect(
      reads.filter(({ bindings }) => bindings.length > 0).length,
      "no ward-facing surface reads useWardFlow() at all — this check scans nothing",
    ).toBeGreaterThan(0);
    const offenders = reads
      .filter(({ bindings }) => bindings.some((list) => list.includes("referrals")))
      .map(({ file }) => shortPath(file));
    expect(
      offenders,
      "a ward-facing surface destructures the full referrals array — use wardScopedReferrals() instead",
    ).toEqual([]);
  });

  it("reads a useWardFlow destructuring accurately enough for the check above to mean something", () => {
    // The extractor pinned in both directions on synthetic sources, because the real ward screens
    // are all clean today: without this, a broken extractor returning nothing would make the check
    // above unfalsifiable.
    expect(contextBindingsOf("const { movements, units, now } = useWardFlow();")).toEqual([
      ["movements", "units", "now"],
    ]);
    expect(contextBindingsOf("const { referrals, now } = useWardFlow();")[0]).toContain("referrals");
    expect(contextBindingsOf("const { referrals: all } = useWardFlow();")[0]).toContain("referrals");
    // Prose and comments naming the hook or the word must NOT be read as a context read.
    expect(contextBindingsOf("{/* reads `useWardFlow()`, never a frozen fixture */}")).toEqual([]);
    expect(contextBindingsOf("<h2>Incoming referrals awaiting an answer</h2>")).toEqual([]);
  });
});
