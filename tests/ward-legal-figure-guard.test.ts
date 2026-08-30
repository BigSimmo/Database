import { referralState } from "../src/components/ward-management/ward-referrals";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

import {
  BED_PREPARATION_NOTES,
  BED_RELEASE_BLOCKERS,
  CANCEL_TRANSPORT_REASONS,
  LEGAL_STATUS_CHANGE_REASONS,
  RELEASE_HOLD_REASONS,
  URGENCY_CHANGE_REASONS,
} from "../src/components/ward-management/ward-change-reasons";
import { EVENT_ROLE, type WardFlowEvent } from "../src/components/ward-management/ward-flow-events";
import {
  seedWardFlowState,
  wardFlowReducer,
  type WardFlowState,
} from "../src/components/ward-management/ward-flow-reducer";
import { SELECTABLE_LEGAL_FORMS } from "../src/components/ward-management/ward-legal-forms";
import {
  BED_RELEASE_WAITING_ON,
  DECLINE_REASONS,
  REFERRAL_DECLINE_REASONS,
  TRANSPORT_PROVIDERS,
  type LegalForm,
  type LegalStatus,
} from "../src/components/ward-management/ward-model";
import { wardMovements } from "../src/components/ward-management/ward-movements";
import { WARD_SCENARIOS } from "../src/components/ward-management/ward-scenarios";
import { allEmergencyDepartments, NOW_ANCHOR } from "../src/components/ward-management/ward-sites";
import { literalsIn } from "./helpers/ast-string-literals";

/**
 * Guard against a fourth fabrication of a Mental Health Act duration in this prototype.
 *
 * Three separate agents have now written three different invented statutory figures into
 * `src/components/ward-management/` and attributed them to the Act: a Form 3B post-examination
 * deadline (deleted in Task 6A), a four-hour figure bolted onto `legalForm.dueAt` (ruling F23),
 * and a Form 1A examination window (deleted 2026-08-23, the correction this file was added
 * alongside). Each was removed only after it had already reached the screen. The product owner's
 * standing instruction is narrower than "get the number right": "please can you leave the legal
 * part and just start a clock once the patient arrives to ED. Keep it simple for now."
 *
 * The guard has three parts, built on different evidence so a reintroduction has to defeat more
 * than one. Every claim below is demonstrated by an assertion in this file; where a part has a
 * limit, the limit is stated rather than glossed.
 *
 *   Part 1 reads REAL RUNTIME VALUES — every `LegalForm` the fixture authors, every one the
 *   reducer authors, and every one reachable by driving the reducer through EVERY event type in
 *   its union — and requires that NO form of ANY code carries a `dueAt` unless its code is on
 *   `DEADLINE_BEARING_FORM_PROVENANCE` below. It is fail-closed on the code, not a check of two
 *   named codes: every consumer is code-agnostic (`ward-priority.ts` scores any code carrying a
 *   `dueAt` and renders `Form ${code} passed its deadline …`), so a fabrication on an invented
 *   code would otherwise render as a legal countdown with nothing in its way.
 *
 *   Because it inspects values rather than text, it is unaffected by how the value got there: a
 *   helper in another file, an intermediate local, a spread, a computed property name, a
 *   post-construction mutation of an existing form, or a constant imported from anywhere at all.
 *   Its limit is REACHABILITY. The traversal drives every event type against a movement carrying
 *   EACH examination-timeline code and asserts acceptance per code, so a branch keyed on one code
 *   cannot go unentered — that exact hole let `code === "1A" ? { …, dueAt } : legalForm` pass the
 *   whole suite. What acceptance-per-code still does not give is every guard condition inside
 *   each case; a branch the sweep cannot reach at all is not inspected.
 *
 *   Part 2 is a fail-closed ALLOWLIST over `ward-model.ts`. Every exported declaration there that
 *   WRITES A NUMBER DOWN ANYWHERE in its initializer — a constant, an object property, a function
 *   body, an enum member — must appear in `MODEL_CONSTANT_PROVENANCE` below with a one-line record
 *   of who supplied the figure and when. The trigger is the shape of the declaration, never its
 *   name, so a constant nobody thought to predict is caught because it was never declared. Its
 *   limits are SCOPE (it governs `ward-model.ts` and nothing else) and EXPORT (a module-private
 *   declaration is not inspected).
 *
 *   Part 3 is a token denylist over the whole ward directory, kept as a WIDER BUT INCOMPLETE
 *   second net for the files Part 2 does not govern. It scans identifiers via the TypeScript AST
 *   (never a regular expression, never a hand-rolled string scanner) across every `.ts`/`.tsx`
 *   file under the ward directory, recursively, so a file added in `coordinator/`, `ed/`,
 *   `officer/`, `tracker/` or `ward/` is covered exactly as a top-level one is. It is NOT
 *   complete and a green Part 3 proves nothing on its own.
 *
 * WHY PART 2 IS SHAPE-BASED AND NOT NAME-BASED. Two earlier versions of this guard tried to
 * recognise a fabricated figure by its NAME, and both were defeated by a reviewer:
 *
 *     FORM_1A_REFERRAL_EXPIRY_MINUTES   caught by the token denylist
 *     ASSESSMENT_WINDOW_MINUTES         defeated the denylist  (caught by v2's unit-token rule)
 *     INVOLUNTARY_ORDER_HOURS           defeated the denylist  (caught by v2's unit-token rule)
 *     SECTION_REVIEW_DAYS               defeated the denylist  (caught by v2's unit-token rule)
 *     FORM_1A_REFERRAL_CLOCK            defeated BOTH — no unit token, and it carried the
 *                                       deleted fabrication's exact value, 7 * 24 * 60
 *
 * Each round added vocabulary and each round missed the next name nobody had thought of. Keying
 * on the shape of the declaration instead ends that: an exported number in `ward-model.ts` is
 * caught whatever it is called. All of the names above are pinned as test cases below.
 *
 * WHAT THIS GUARD CANNOT SEE — stated plainly, because a guard that overstates its reach is the
 * failure mode this repository has hit most often:
 *
 *   - Part 2 governs `ward-model.ts` only. A duration constant declared in another ward file
 *     falls through to Part 3's incomplete denylist, and one declared outside the ward directory
 *     entirely is seen by neither.
 *   - Part 3 is incomplete BY CONSTRUCTION, as the table above demonstrates. It is a safety net,
 *     not a proof of absence, and a green Part 3 means nothing on its own.
 *   - Part 2 sees only EXPORTED declarations — `export const`, `export enum`, `export function`.
 *     A module-private `const` in `ward-model.ts`, or a number written inline at its use site, is
 *     not a declaration it inspects. Within an exported declaration it looks for a numeric literal
 *     anywhere, so the object / arrow-function / enum shapes that defeated the narrower rule are
 *     covered; a number arriving by import or computed at runtime is not.
 *   - Part 3 sees only SCREAMING_SNAKE_CASE identifiers. That filter is deliberate: every
 *     fabrication so far was a named constant, whereas the camelCase names in this directory are
 *     locals that merely READ a value (`legalDueAt`, `minutesLegalClock` — both honest readers of
 *     the 4A/4C deadlines that legitimately exist). Flagging those would make the guard cry wolf
 *     and get it disabled.
 *   - Anything that is not an identifier at all. A duration written only inside a string literal,
 *     a template literal, a comment, JSX text, or a CSS module is invisible to Part 3.
 *   - Part 1's limit is reachability. It inspects the states its traversal reaches; a branch the
 *     traversal cannot get an event accepted into is not inspected. The traversal asserts every
 *     event type was accepted against a movement carrying EACH examination-timeline code, so a
 *     code-keyed branch is entered rather than assumed — but "accepted per code" is still not
 *     "every guard condition inside that case exercised".
 *   - The `STRUCTURALLY_IMPOSSIBLE_FOR_CODE` exclusion list gets only a partial check; its exact
 *     limit, and the measurement that established it, are recorded at its declaration.
 *   - A fabricated number parked in a variable nothing reads reaches no user and is caught by
 *     nothing here until something uses it.
 *   - Non-`.ts`/`.tsx` files, including the `.module.css` files in this directory.
 *   - Forms 4A ("Transport order") and 4C ("Transfer between authorised hospitals"), which carry
 *     real `dueAt` figures about moving a person rather than about the examination timeline and
 *     are deliberately out of scope for every part.
 *
 * This file must never be relaxed to make a change green. If a real statutory figure is ever
 * supplied, it arrives with a named source and date from the clinician or the product owner, and
 * this guard is amended in the same change that records that provenance — never before it.
 */

const WARD_DIR = "src/components/ward-management";

/**
 * THE DEADLINE ALLOWLIST (Part 1's rule). A legal form of ANY code may carry a `dueAt` only if its
 * code appears here with a line recording why that form legitimately bears an operational
 * deadline. Every other code — including one nobody has invented yet — fails.
 *
 * This is the same fail-closed inversion Part 2 uses, and for the same reason. The previous rule
 * named the two codes to CHECK (`1A`, `3B`), which meant a fabrication on any third code was
 * checked by nothing — while every consumer is code-agnostic: `ward-priority.ts` scores points
 * for any code carrying a `dueAt` and renders `Form ${code} passed its deadline …`, and
 * `shortlist-panel.tsx` and `ward-derivations.ts` do the same. A new code would have rendered as
 * a legal countdown with no guard in its way.
 *
 * Never add an entry for a form on the examination timeline (1A, 3B), and never add one whose
 * justification traces to an assistant's recollection of the Mental Health Act.
 */
const DEADLINE_BEARING_FORM_PROVENANCE: Record<string, string> = {
  // "Transport order" — a deadline about MOVING A PERSON (when transport must occur by), not
  // about the examination timeline. Pre-dates the 2026-08-23 correction, which the product owner
  // scoped to the examination clock and explicitly left these alone.
  "4A": "Transport order — operational deadline for moving a person, out of scope for the 2026-08-23 correction",

  // "Transfer between authorised hospitals" — same category as 4A: an operational deadline about
  // a move between sites, unrelated to the examination timeline.
  "4C": "Transfer between authorised hospitals — operational deadline for a move between sites, same category as 4A",
};

/**
 * Every code the sweep drives, taken from `SELECTABLE_LEGAL_FORMS` rather than hand-listed.
 *
 * **INVERTED on 2026-08-24, and this is the whole point of the change.** This was
 * `EXAMINATION_TIMELINE_CODES = new Set(["1A", "3B"])` — a remembered pair. The intake picker
 * then made 3D, 4A and 4C runtime-authorable, and the sweep still drove only 1A and 3B, so a
 * branch keyed on any other code was invisible. Measured, not theorised: a
 * `movement.legalForm?.code === "3D" ? { ...movement.legalForm, dueAt: event.now + 10080 }` put
 * inside `TRANSPORT_ACCEPTED` left the entire ward suite green at 20 files / 252 passed, with a
 * seven-day fabricated deadline live on a Form 3D that the console would render as "due …" and
 * the shortlist as "due in N min".
 *
 * Deriving it from the picker's own list means **a code added later is checked by default rather
 * than by being remembered**. The rule the sweep applies is still `offendingFormsIn`'s — no form
 * of ANY code may carry a `dueAt` unless its code has a recorded provenance line in
 * `DEADLINE_BEARING_FORM_PROVENANCE` — so widening the codes widens coverage without widening
 * what is permitted.
 */
const SWEEP_CODES: readonly string[] = SELECTABLE_LEGAL_FORMS.map((form) => form.code);

/**
 * Word-level token sets. Matching is on exact tokens, never substrings: substring matching would
 * flag `formattedMinutes` (FORM inside FORMATTED) and other innocent names, and a guard that
 * cries wolf gets disabled. Tokenisation splits on `_` and on camelCase boundaries, so both
 * `FORM_1A_EXPIRY_MINUTES` and `form1AExpiryMinutes` decompose the same way.
 */
const LEGAL_TOKENS = new Set([
  "FORM",
  "FORMS",
  "1A",
  "3B",
  "STATUTORY",
  "LEGAL",
  "MHA",
  "ACT",
  "DETENTION",
  "DETAINED",
  "EXAMINATION",
  "REFERRAL",
]);

const DURATION_TOKENS = new Set([
  "MINUTES",
  "MINS",
  "HOURS",
  "DAYS",
  "EXPIRY",
  "EXPIRES",
  "DEADLINE",
  "WINDOW",
  "LIMIT",
  "TIMEOUT",
  "DUE",
]);

/**
 * THE ALLOWLIST (Part 2). Every exported SCREAMING_SNAKE_CASE constant in `ward-model.ts` whose
 * name carries a duration token must appear here, with a one-line record of who supplied the
 * figure and when. Adding an entry is the deliberate act of recording provenance; a figure whose
 * provenance cannot be written down does not belong in this model at all.
 *
 * Never add an entry whose provenance is an assistant's recollection of the Mental Health Act.
 * That is precisely what produced the three deleted fabrications. Provenance means a named human
 * — the clinician or the product owner — and a date.
 */
const MODEL_CONSTANT_PROVENANCE: Record<string, string> = {
  // Product owner (the spec's own author), 2026-08-22: superseded the spec's original four-hour
  // figure and set the emergency department access target to 24 hours for this prototype, in
  // response to a direct clinical question. Counted UP from `openedAt`; never a deadline, never
  // attached to a `LegalForm`. See the constant's own doc comment in ward-model.ts.
  ED_ACCESS_TARGET_MINUTES: "product owner, 2026-08-22 — ED access target, counted up from openedAt",

  // Product owner's own spec, `docs/ward-flow-context.md` (line 205 states the constant; line 287
  // states the rule: "Parallel referrals are supported, capped at three"). An operational
  // courtesy limit between services — explicitly NOT a clinical or statutory quantity, and it
  // measures a count of units, not a duration.
  PARALLEL_REFERRAL_CAP: "product owner's spec, docs/ward-flow-context.md — count of units, not a duration",

  // The runtime mirror of the `urgency: 1 | 2 | 3` union that already existed on both `Movement`
  // and `Referral` before this constant was written; fix round C points both fields at
  // `UrgencyLevel` so widening the array widens the fields. The three tiers are the product
  // owner's own, and `operationalScore`'s doc comment (`ward-priority.ts`) records his
  // 2026-08-24 instruction that priority is urgency and waiting time alone. These are TIER
  // LABELS — three ordered categories a clinician picks between — and neither a duration nor a
  // quantity of anything: nothing in this codebase does arithmetic on them beyond comparing two
  // tiers to order a queue, and no minute, hour, day or bed count is derived from them.
  URGENCY_LEVELS: "product owner's own tiers, recorded at ward-priority.ts 2026-08-24 — tier labels, not a duration",
};

/**
 * True when a subtree contains a numeric literal ANYWHERE. Read structurally from the AST, so the
 * trigger does not depend on the declaration's NAME at all, and not on its shape either.
 *
 * Both narrower rules this replaced were defeated by a reviewer. Keying on the name was defeated
 * by `FORM_1A_REFERRAL_CLOCK = 7 * 24 * 60` — the deleted fabrication's exact value, carrying no
 * duration-unit token. Keying on "the initializer IS a number" was then defeated by three shapes
 * that merely CONTAIN one: an object (`{ minutes: 7 * 24 * 60 }`), an arrow function
 * (`(): number => 7 * 24 * 60`), and an enum member (`Window = 10080`). Containment is the widest
 * honest rule available here, and it is the one in force.
 */
function containsNumericLiteral(node: ts.Node): boolean {
  if (ts.isNumericLiteral(node)) return true;
  let found = false;
  ts.forEachChild(node, (child) => {
    if (!found && containsNumericLiteral(child)) found = true;
  });
  return found;
}

/**
 * Exported constant names declared in one file, read from the AST — never from a regular
 * expression, and never from a substring search that a quote or a comment could fool. Only
 * `export const NAME = …` declarations are collected, which is exactly the shape a written-down
 * figure takes. `numericOnly` narrows to declarations whose initializer is a number written into
 * the source, which is the allowlist's trigger.
 */
function exportedDeclarationNames(source: ts.SourceFile, numericOnly = false): string[] {
  const names: string[] = [];
  const isExported = (node: ts.Node): boolean =>
    ts.canHaveModifiers(node) &&
    (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false);

  const visit = (node: ts.Node): void => {
    if (ts.isVariableStatement(node) && isExported(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        if (numericOnly && !(declaration.initializer && containsNumericLiteral(declaration.initializer))) continue;
        names.push(declaration.name.text);
      }
    }
    // An exported enum is a declaration of numbers by another name, and was one of the three
    // shapes that defeated the previous rule.
    if (ts.isEnumDeclaration(node) && isExported(node)) {
      if (!numericOnly || containsNumericLiteral(node)) names.push(node.name.text);
    }
    // An exported function whose body writes a number down is the same thing wearing a hat.
    if (ts.isFunctionDeclaration(node) && isExported(node) && node.name) {
      if (!numericOnly || containsNumericLiteral(node)) names.push(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return names;
}

function exportedNamesInFile(path: string, numericOnly = false): string[] {
  return exportedDeclarationNames(
    ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
    numericOnly,
  );
}

/**
 * SCREAMING_SNAKE_CASE — the shape a written-down figure takes in this codebase. See the header
 * for why camelCase readers are deliberately excluded and what that costs.
 */
function isConstantName(identifier: string): boolean {
  return /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/.test(identifier);
}

function tokenise(identifier: string): string[] {
  return identifier
    .split("_")
    .flatMap((part) => part.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(" "))
    .filter((token) => token.length > 0)
    .map((token) => token.toUpperCase());
}

/**
 * True when an identifier names a legal concept AND a duration — the shape every one of the
 * three fabrications took (`FORM_1A_REFERRAL_EXPIRY_MINUTES` and its predecessors).
 */
function namesALegalDuration(identifier: string): boolean {
  const tokens = tokenise(identifier);
  return tokens.some((token) => LEGAL_TOKENS.has(token)) && tokens.some((token) => DURATION_TOKENS.has(token));
}

/**
 * The unconditional shapes the brief names for `ward-model.ts`: any `*_EXPIRY_MINUTES` or
 * `*_DEADLINE_*` identifier is banned there whether or not it also names a legal concept,
 * because that file is the model's own vocabulary and a bare `EXPIRY_MINUTES` there would be
 * read as statutory by the next author regardless of what it is called.
 */
function namesABannedModelShape(identifier: string): boolean {
  const upper = identifier.toUpperCase();
  return upper.endsWith("_EXPIRY_MINUTES") || upper.includes("_DEADLINE_") || upper.endsWith("_DEADLINE");
}

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

type ScannedFile = { path: string; identifiers: string[] };

/**
 * Every identifier the TypeScript parser sees in a file — declarations, references and imports
 * alike, so importing a banned name from elsewhere is caught as well as declaring one here.
 * Identifiers are collected into an array of the matched names themselves; nothing in this file
 * counts loop iterations and calls that a result.
 */
function scanWardFiles(): ScannedFile[] {
  return walk(WARD_DIR)
    .filter((path) => path.endsWith(".ts") || path.endsWith(".tsx"))
    .map((path) => {
      const source = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      const identifiers: string[] = [];
      const visit = (node: ts.Node): void => {
        if (ts.isIdentifier(node)) identifiers.push(node.text);
        ts.forEachChild(node, visit);
      };
      visit(source);
      return { path, identifiers };
    });
}

/** Every event type in the union, taken from the role table so a new variant cannot be forgotten. */
const ALL_EVENT_TYPES = Object.keys(EVENT_ROLE) as WardFlowEvent["type"][];

/** Every `LegalStatus` value, hand-listed — `ward-model.ts` exports the type but no runtime list
 *  of its members, the same reason `ed-screen.tsx` keeps its own `LEGAL_STATUS_OPTIONS`. */
const LEGAL_STATUS_OPTIONS: LegalStatus[] = [
  "Voluntary",
  "Referred for psychiatric examination",
  "Detained awaiting examination",
  "Involuntary inpatient",
];

/**
 * Task 3 (Phase 7, "The front door"): one always-valid candidate is enough to prove the branch is
 * reached — one candidate list, named so it can be emptied by a single mutation for Step 4's own
 * "traversal assertion names the event that stopped being reached" proof.
 *
 * Fix round B (review finding I2): `RECEIVE_REFERRAL` used to guard on role alone; it now also
 * membership-checks `ageBand`, `source` and `homeRegion`, validates `urgency`, and resolves
 * `originSiteCode` against the real site list (`ward-flow-reducer.ts`). Every field below must
 * stay valid against those checks for this candidate to keep being accepted — `homeRegion` was
 * added here for exactly that reason when the field was added to `Referral`. The three ward-arm
 * fields now sit under `destinations[0]` and are validated through it; the event takes a LIST
 * since FD-21, so this candidate addresses exactly one destination.
 */
const RECEIVE_REFERRAL_CANDIDATE = {
  ageBand: "Adult" as const,
  // 2026-08-30, destination union: `sex`, `secureBedNeeded` and `involuntaryBedNeeded` sat flat
  // here until they moved onto the ward arm of `ReferralDestination`. A STRUCTURAL change only —
  // the same three values, the same always-valid candidate, and no figure, timeframe or threshold
  // anywhere near it. This file is touched as little as possible on purpose; the edit was forced
  // by the event type it constructs, not chosen.
  destinations: [
    {
      kind: "psychiatric_ward" as const,
      sex: "Female" as const,
      secureBedNeeded: false,
      involuntaryBedNeeded: false,
    },
  ],
  homeRegion: "Perth Metropolitan" as const,
  // A real suburb from the catchment table, because the front door resolves it rather than
  // measuring its length. No figure, timeframe or threshold — this file stays touched as
  // little as possible and the edit is forced by the event type, not chosen.
  suburb: { kind: "named", name: "Armadale" } as const,
  source: "community" as const,
  urgency: 2 as const,
  originSiteCode: "SCGH",
  transportNeeded: false,
};

/**
 * Candidate events of one type, generated against the CURRENT state rather than hard-coded, so a
 * fixture change cannot silently make the traversal untestable. Every candidate carries the role
 * the role table requires — a wrong role is refused before the reducer body runs, and a refused
 * event proves nothing about what the reducer body does.
 */
function candidateEvents(type: WardFlowEvent["type"], state: WardFlowState, now: number): WardFlowEvent[] {
  // `EVENT_ROLE[type]` is a non-empty list of permitted roles (widened this task, spec D2); any
  // one of them is refused by the role check identically to any other, so the first is enough to
  // get past the gate and exercise the reducer body — the coverage this sweep is checking never
  // depends on which of two permitted roles raised the event.
  const role = EVENT_ROLE[type][0];
  const movementIds = state.movements.map((movement) => movement.id);
  const unitIds = state.units.map((unit) => unit.id);
  const pairs = movementIds.flatMap((movementId) => unitIds.map((unitId) => ({ movementId, unitId })));

  switch (type) {
    case "RAISE_REFERRAL":
      // Since 2026-08-24 the form is CHOSEN on the draft rather than derived from the status, so
      // the candidates now cross every selectable code (and "no form") with both
      // awaiting-examination statuses. RAISE_REFERRAL is the only remaining place a form is
      // authored at runtime, which makes this the one generator that can put a fabricated
      // `dueAt` on a live movement — it must therefore reach every code, not just the two the
      // deleted derivation used to produce.
      return allEmergencyDepartments().flatMap((ed) =>
        (["Referred for psychiatric examination", "Detained awaiting examination"] as LegalStatus[]).flatMap(
          (legalStatus) =>
            [...SELECTABLE_LEGAL_FORMS.map((form) => form.code), null].map((legalFormCode) => ({
              type,
              role,
              now,
              edId: ed.id,
              draft: {
                cohort: "Adult" as const,
                security: "Open" as const,
                sex: "Female" as const,
                specialling: false,
                legalStatus,
                urgency: 2 as const,
                legalFormCode,
              },
            })),
        ),
      );
    case "RECORD_EXAMINATION":
      return movementIds.flatMap((movementId) =>
        (["inpatient_order", "community_order", "revoked"] as const).map((outcome) => ({
          type,
          role,
          now,
          movementId,
          outcome,
        })),
      );
    case "REFER_TO_UNITS":
      return pairs.map(({ movementId, unitId }) => ({ type, role, now, movementId, unitIds: [unitId] }));
    case "ACCEPT_IN_PRINCIPLE":
    case "HOLD_BED":
      return pairs.map(({ movementId, unitId }) => ({ type, role, now, movementId, unitId }));
    case "DECLINE":
      return pairs.map(({ movementId, unitId }) => ({
        type,
        role,
        now,
        movementId,
        unitId,
        reason: DECLINE_REASONS[0],
      }));
    case "HANDOVER_READY":
    case "TRANSPORT_ACCEPTED":
    case "TRANSPORT_EN_ROUTE":
    case "PATIENT_COLLECTED":
    case "PATIENT_ARRIVED":
      return movementIds.map((movementId) => ({ type, role, now, movementId }));
    case "CONFIRM_CAPACITY":
      // `actingUnitId` mirrors `unitId`: the reducer refuses a mismatched pair outright, so a
      // generated mismatch would exercise the rejection path rather than this guard's subject.
      return unitIds.flatMap((unitId) =>
        [0, 1, 2].map((value) => ({ type, role, now, unitId, actingUnitId: unitId, value })),
      );
    case "RECORD_ESCALATION":
      return movementIds.map((movementId) => ({
        type,
        role,
        now,
        movementId,
        triedUnitIds: unitIds.slice(0, 1),
        contact: "State-wide bed coordination line",
      }));
    case "CHANGE_URGENCY":
      // One candidate per urgency tier — the same precedent SET_SCENARIO sets below — so the
      // sweep cannot silently leave two of the three tiers untested.
      return movementIds.flatMap((movementId) =>
        ([1, 2, 3] as const).map((urgency) => ({
          type,
          role,
          now,
          movementId,
          urgency,
          reason: URGENCY_CHANGE_REASONS[0],
        })),
      );
    case "CHANGE_LEGAL_STATUS":
      // One candidate per legal status, for the same reason.
      return movementIds.flatMap((movementId) =>
        LEGAL_STATUS_OPTIONS.map((legalStatus) => ({
          type,
          role,
          now,
          movementId,
          legalStatus,
          reason: LEGAL_STATUS_CHANGE_REASONS[0],
        })),
      );
    case "ADVANCE_CLOCK":
      return [{ type, role, now, minutes: 30 }];
    case "RESET_SCENARIO":
      return [{ type, role, now }];
    case "SET_SCENARIO":
      // Both scenarios, like RAISE_REFERRAL's real domain values above — not one hard-coded
      // choice that would leave the other half of `WARD_SCENARIOS` untested.
      return WARD_SCENARIOS.map((scenario) => ({ type, role, now, scenario }));
    case "RELEASE_HOLD":
      // One candidate per reason, same precedent as CHANGE_URGENCY/CHANGE_LEGAL_STATUS above —
      // `role` is the first permitted role (coordinator), so `actingUnitId` is never needed here.
      return movementIds.flatMap((movementId) =>
        RELEASE_HOLD_REASONS.map((reason) => ({ type, role, now, movementId, reason })),
      );
    case "BOOK_TRANSPORT":
      // One candidate per provider crossed with BOTH escort answers, the same "one candidate per
      // real domain value" precedent the reason-keyed events below set. Both booleans, because
      // `escortRequired` is the field this event exists to make somebody answer and a sweep that
      // only ever sent `true` would leave the other branch unentered.
      return movementIds.flatMap((movementId) =>
        TRANSPORT_PROVIDERS.flatMap((provider) =>
          [true, false].map((escortRequired) => ({ type, role, now, movementId, provider, escortRequired })),
        ),
      );
    case "CANCEL_TRANSPORT":
      return movementIds.flatMap((movementId) =>
        CANCEL_TRANSPORT_REASONS.map((reason) => ({ type, role, now, movementId, reason })),
      );
    case "FLAG_BED_RELEASE":
      // `actingUnitId` mirrors `unitId`, same reasoning as CONFIRM_CAPACITY above. One candidate
      // per waiting-on value crossed with every blocker — the same "one candidate per real
      // domain value" precedent CHANGE_URGENCY/CHANGE_LEGAL_STATUS/SET_SCENARIO set, so a branch
      // keyed on either dimension is entered rather than assumed reachable. The Q1 axis change
      // (2026-08-28) widened this dimension from two confidence levels to five waiting-on values,
      // so the sweep now covers strictly more of the vocabulary that reaches a screen.
      return unitIds.flatMap((unitId) =>
        BED_RELEASE_WAITING_ON.flatMap((waitingOn) =>
          BED_RELEASE_BLOCKERS.map((blocker) => ({
            type,
            role,
            now,
            unitId,
            actingUnitId: unitId,
            waitingOn,
            expectedAt: now + 60,
            blocker,
          })),
        ),
      );
    case "CONFIRM_BED_RELEASE":
    case "CLEAR_BED_RELEASE_BLOCK":
      // `actingUnitId` must mirror the RELEASE's own unit, not merely any unit id — the reducer
      // compares against `release.unitId`, same claim-not-proof discipline FLAG_BED_RELEASE's own
      // doc comment sets out. One candidate per release already in `state.bedReleases`, generated
      // against the current state rather than hard-coded, so a fixture change cannot silently
      // make this untestable.
      return state.bedReleases.map((release) => ({
        type,
        role,
        now,
        releaseId: release.id,
        actingUnitId: release.unitId,
      }));
    case "REVERT_BED_RELEASE":
      // Bed-model rework (2026-08-28). One candidate per release crossed with every waiting-on
      // value — the same "one candidate per real domain value" precedent every list-valued event
      // above follows, so a branch keyed on the chosen value cannot go unentered.
      return state.bedReleases.flatMap((release) =>
        BED_RELEASE_WAITING_ON.map((waitingOn) => ({
          type,
          role,
          now,
          releaseId: release.id,
          actingUnitId: release.unitId,
          waitingOn,
        })),
      );
    case "SET_BED_PREPARATION":
      // One candidate per release crossed with BOTH `preparing` values AND every permitted note
      // (plus `undefined`, which is "being made ready, reason not stated"). The note dimension is
      // new: `BED_PREPARATION_NOTES` was empty pending the product owner's list, so there was no
      // permitted value to sweep, and the comment here said this case would gain the cross-product
      // the day the array was filled. It was filled on 2026-08-28 and this is that cross-product.
      return state.bedReleases.flatMap((release) =>
        [true, false].flatMap((preparing) =>
          [undefined, ...BED_PREPARATION_NOTES].map((note) => ({
            type,
            role,
            now,
            releaseId: release.id,
            actingUnitId: release.unitId,
            preparing,
            note,
          })),
        ),
      );
    case "BLOCK_BED_RELEASE":
      // One candidate per release crossed with every blocker — the same "one candidate per real
      // domain value" precedent CHANGE_URGENCY/CHANGE_LEGAL_STATUS/SET_SCENARIO/FLAG_BED_RELEASE
      // set, so a branch keyed on the chosen blocker cannot go unentered.
      return state.bedReleases.flatMap((release) =>
        BED_RELEASE_BLOCKERS.map((blocker) => ({
          type,
          role,
          now,
          releaseId: release.id,
          actingUnitId: release.unitId,
          blocker,
        })),
      );
    case "RELEASE_BED":
      return state.bedReleases.map((release) => ({
        type,
        role,
        now,
        releaseId: release.id,
        actingUnitId: release.unitId,
      }));
    case "RECORD_LEAVE_BED":
      // One candidate per unit crossed with BOTH `usable` values — the ward's usable/not-usable
      // statement is a real domain value the reducer stores verbatim, same precedent as above, so
      // neither branch goes untested.
      return unitIds.flatMap((unitId) =>
        [true, false].map((usable) => ({
          type,
          role,
          now,
          unitId,
          actingUnitId: unitId,
          usable,
          expectedReturn: now,
        })),
      );
    case "END_LEAVE_BED":
      // `actingUnitId` must mirror the found leave bed's own unit, same discipline as
      // CONFIRM_BED_RELEASE above. One candidate per leave bed already in `state.leaveBeds`.
      return state.leaveBeds.map((leaveBed) => ({
        type,
        role,
        now,
        leaveBedId: leaveBed.id,
        actingUnitId: leaveBed.unitId,
      }));
    case "REQUEST_CAPACITY_REFRESH":
      // Coordinator-scoped (spec D12): one candidate per unit, no `actingUnitId` field exists on
      // this event at all.
      return unitIds.map((unitId) => ({ type, role, now, unitId }));
    case "RECEIVE_REFERRAL":
      return [{ type, role, now, ...RECEIVE_REFERRAL_CANDIDATE }];
    case "ADD_PATIENT":
      // Adding a patient links to nothing — no movement, no referral, no unit — which is exactly
      // why this candidate is a bare literal rather than a crossing of existing state. A patient
      // exists before any of those, and a candidate that needed one of them would be testing a
      // different event from the one the owner's flow describes.
      return [
        {
          type,
          role,
          now,
          umrn: "UM900001",
          givenName: "Sweep",
          familyName: "Candidate",
          dateOfBirth: "1980-01-01",
        },
      ];
    case "ACCEPT_REFERRAL":
      // Every QUEUED referral crossed with every unit — the reducer's own `referralEligibility`
      // gate decides which pairing is actually accepted, so this offers every legitimate
      // candidate rather than guessing which one currently matches (allocatable counts and sex
      // mix shift as the sweep runs other event types).
      return state.referrals
        .filter((referral) => referralState(referral) === "queued")
        .flatMap((referral) =>
          unitIds.map((unitId) => ({
            type,
            role,
            now,
            referralId: referral.id,
            destinationKind: "psychiatric_ward" as const,
            unitId,
          })),
        );
    case "DECLINE_REFERRAL":
      // Every queued referral crossed with every real decline reason, same "offer every
      // legitimate candidate" reasoning as ACCEPT_REFERRAL above.
      return state.referrals
        .filter((referral) => referralState(referral) === "queued")
        .flatMap((referral) =>
          REFERRAL_DECLINE_REASONS.map((reason) => ({
            type,
            role,
            now,
            referralId: referral.id,
            destinationKind: "psychiatric_ward" as const,
            reason,
          })),
        );
    // Phase 8 Task 2. Generated against the CURRENT state for the same reason every list above
    // is: the sweep applies other event types as it goes, so which referrals are still queued
    // shifts underneath this. It offers every legitimate candidate and lets the reducer's own
    // guards decide, exactly as ACCEPT_REFERRAL and DECLINE_REFERRAL do — and it is a single
    // named list, so emptying it is the one-line mutation that proves the traversal assertion
    // names the unreached event. (Task 2R removed `REFERRAL_ARRIVED`, which had the same shape.)
    case "RECORD_LOCAL_BED_SOUGHT":
      return state.referrals
        .filter((referral) => referralState(referral) === "queued" && referral.localBedSought === undefined)
        .map((referral) => ({ type, role, now, referralId: referral.id }));
  }
}

/** Event types that act on one named movement. The rest act on a unit, or on the whole scenario. */
const MOVEMENT_TARGETED_EVENTS: ReadonlySet<WardFlowEvent["type"]> = new Set([
  "RECORD_EXAMINATION",
  "REFER_TO_UNITS",
  "ACCEPT_IN_PRINCIPLE",
  "HOLD_BED",
  "DECLINE",
  "HANDOVER_READY",
  "TRANSPORT_ACCEPTED",
  "TRANSPORT_EN_ROUTE",
  "PATIENT_COLLECTED",
  "PATIENT_ARRIVED",
  "RECORD_ESCALATION",
  "CHANGE_URGENCY",
  "CHANGE_LEGAL_STATUS",
  "RELEASE_HOLD",
  "CANCEL_TRANSPORT",
]);

/**
 * Event types that CANNOT apply to a movement already carrying a given code, because the reducer
 * structurally refuses them — not because the traversal failed to reach them.
 *
 * This is an exclusion from the coverage assertion, so it is exactly the shape that could be
 * abused to hide a real gap. Only structural impossibility belongs here — never "the sweep did
 * not happen to get there".
 *
 * THE CHECK ON THIS LIST IS WEAKER THAN IT LOOKS, and the limit is stated here rather than
 * discovered later. The test below confirms the reducer refuses each entry against ONE fixture
 * movement carrying that code, in the seeded state. That catches an entry the reducer plainly
 * accepts, but it does NOT establish structural impossibility: an event refused for that
 * movement's STAGE rather than its form code passes the check too. Measured directly — adding a
 * bogus `1A: HOLD_BED` entry left the guard green at 7 passed, because WF-001 sits at
 * `placement_requested` and HOLD_BED requires `accepted_awaiting_bed`.
 *
 * So the single entry below is justified by READING the reducer, not by this check:
 * `RECORD_EXAMINATION` opens with `if (movement.legalForm?.code !== "1A") return reject(...)`,
 * which is a guard on the code itself. Any future entry needs the same treatment — quote the
 * code-keyed guard that makes it impossible — and must not lean on the check alone.
 */
const STRUCTURALLY_IMPOSSIBLE_FOR_CODE: Record<string, { type: WardFlowEvent["type"]; reason: string }[]> = {
  // EMPTY since 2026-08-24, and the emptiness is the point. The only entry this list ever held
  // was `3B: RECORD_EXAMINATION`, justified by the reducer's `if (movement.legalForm?.code !==
  // "1A") return reject(...)`. That guard is deleted — an examination may now be recorded for
  // any patient, on any form or on none — so the exclusion is no longer true and has been
  // removed rather than kept as a comfortable blind spot. Every movement-targeted event must now
  // be ACCEPTED against a movement carrying each code, with nothing excused.
  //
  // STATED LIMIT: with the list empty, the partial check further down iterates nothing and so
  // proves nothing. The coverage assertion is carrying the whole load. A future entry must quote
  // the code-keyed reducer guard that makes it impossible, exactly as the deleted one did.
};

/** The movement an event acts on, or `undefined` for the unit- and scenario-scoped events. */
function targetMovementId(event: WardFlowEvent): string | undefined {
  return "movementId" in event ? event.movementId : undefined;
}

/**
 * Fix round 1 (2026-08-25). `RELEASE_HOLD` only ever succeeds at stage `bed_held`, and once the
 * round-robin sweep above lets `HANDOVER_READY` (or a transport-progression event) fire first, a
 * movement is past `bed_held` for good — the only way back is `RELEASE_HOLD` itself, the very
 * event under test. That is a limitation of the SWEEP's fixed cyclic ordering, not of the domain:
 * a movement of any legal-form code can genuinely sit at `bed_held` with a live transport job, the
 * same as a Form 1A can (see `WF-016`/`WF-005`, the pre-seeded fixture movements that let 1A pass
 * without needing this helper at all). Excusing the gap via `STRUCTURALLY_IMPOSSIBLE_FOR_CODE`
 * would therefore be a FALSE claim about the domain — exactly what that list's own doc comment
 * forbids ("never 'the sweep did not happen to get there'"). So this builds the precondition
 * explicitly instead, the same way `RESET_SCENARIO`/`SET_SCENARIO` are exercised on their own
 * below, and every step asserts it was NOT refused — a genuinely impossible step fails loudly with
 * the reducer's own reason quoted, rather than the construction silently stopping early and
 * reporting nothing.
 */
function buildHeldMovementFor(code: string, now: number): { state: WardFlowState; movementId: string } {
  const seeded = seedWardFlowState();
  const ed = allEmergencyDepartments()[0];
  const raised = wardFlowReducer(seeded, {
    type: "RAISE_REFERRAL",
    role: EVENT_ROLE.RAISE_REFERRAL[0],
    now,
    edId: ed.id,
    draft: {
      cohort: "Adult",
      security: "Open",
      sex: "Female",
      specialling: false,
      legalStatus: "Referred for psychiatric examination",
      urgency: 2,
      legalFormCode: code,
    },
  });
  expect(raised.rejections, `RAISE_REFERRAL for Form ${code} was refused: ${raised.rejections.at(-1)?.reason}`).toEqual(
    [],
  );
  const movement = raised.movements.at(-1)!;

  // Neither REFER_TO_UNITS, ACCEPT_IN_PRINCIPLE nor HOLD_BED gate on cohort, security or sex —
  // that eligibility scoring lives in the protected `ward-eligibility.ts`, a UI-facing concern the
  // reducer itself never consults — so any unit with spare allocatable capacity is a genuine,
  // reachable destination for this construction, not a fabricated shortcut.
  const unit = raised.units.find((candidate) => candidate.allocatable.value > 0);
  expect(unit, `no unit with allocatable capacity was found to hold a bed for Form ${code}`).toBeDefined();

  const referred = wardFlowReducer(raised, {
    type: "REFER_TO_UNITS",
    role: EVENT_ROLE.REFER_TO_UNITS[0],
    now,
    movementId: movement.id,
    unitIds: [unit!.id],
  });
  expect(
    referred.rejections,
    `REFER_TO_UNITS for Form ${code} was refused: ${referred.rejections.at(-1)?.reason}`,
  ).toEqual([]);

  const acceptedInPrinciple = wardFlowReducer(referred, {
    type: "ACCEPT_IN_PRINCIPLE",
    role: EVENT_ROLE.ACCEPT_IN_PRINCIPLE[0],
    now,
    movementId: movement.id,
    unitId: unit!.id,
  });
  expect(
    acceptedInPrinciple.rejections,
    `ACCEPT_IN_PRINCIPLE for Form ${code} was refused: ${acceptedInPrinciple.rejections.at(-1)?.reason}`,
  ).toEqual([]);

  const held = wardFlowReducer(acceptedInPrinciple, {
    type: "HOLD_BED",
    role: EVENT_ROLE.HOLD_BED[0],
    now,
    movementId: movement.id,
    unitId: unit!.id,
  });
  expect(held.rejections, `HOLD_BED for Form ${code} was refused: ${held.rejections.at(-1)?.reason}`).toEqual([]);

  return { state: held, movementId: movement.id };
}

/**
 * Applies the first candidate of this type that the reducer ACCEPTS, optionally restricted to
 * candidates acting on a movement whose legal form carries `code`.
 *
 * Acceptance is measured by `state.rejections` not growing — the reducer records every refusal
 * there, so this cannot mistake a silently-refused event for an applied one.
 *
 * The `code` restriction is the whole point of fix wave 3. Without it this took whichever
 * movement the reducer happened to accept first — a fixture Form 3B — so a branch keyed on
 * `movement.legalForm?.code === "1A"` was never entered, and a seven-day fabrication written
 * there passed the entire suite.
 */
function applyFirstAccepted(
  type: WardFlowEvent["type"],
  state: WardFlowState,
  now: number,
  code?: string,
): { applied: WardFlowState; event: WardFlowEvent } | undefined {
  for (const event of candidateEvents(type, state, now)) {
    if (code !== undefined && MOVEMENT_TARGETED_EVENTS.has(type)) {
      const target = state.movements.find((movement) => movement.id === targetMovementId(event));
      if (target?.legalForm?.code !== code) continue;
    }
    // RAISE_REFERRAL is not movement-targeted, but since 2026-08-24 it is the ONLY reducer path
    // that authors a form, so the sweep for a code has to raise referrals carrying that code.
    // Without this the sweep would only ever create movements of whichever code sorts first,
    // and — worse — could never hold a FRESH, un-examined movement of the other code to drive
    // RECORD_EXAMINATION against, since every fixture 3B already carries an examination.
    if (code !== undefined && event.type === "RAISE_REFERRAL" && event.draft.legalFormCode !== code) continue;
    const next = wardFlowReducer(state, event);
    if (next.rejections.length === state.rejections.length) return { applied: next, event };
  }
  return undefined;
}

/**
 * Drives the reducer repeatedly against movements carrying `code`. Sweeping rather than following
 * a hand-written script means the clinical pathway's ordering (HOLD_BED must precede
 * HANDOVER_READY, which must precede TRANSPORT_ACCEPTED) is discovered rather than assumed, so a
 * reordering of the pathway cannot silently drop a branch from coverage.
 *
 * Each round ROTATES the order the event types are tried in. A fixed order is itself an
 * assumption, and a wrong one: with the role table's natural order, ACCEPT_IN_PRINCIPLE always
 * ran before DECLINE and consumed the only live referral, so DECLINE was never once accepted
 * against a Form 1A — the coverage assertion below caught that while this fix was being written.
 * Rotating over at least as many rounds as there are event types tries every relative ordering.
 */
function driveEveryEventAgainst(
  code: string,
  rounds = ALL_EVENT_TYPES.length + 2,
): {
  accepted: Set<WardFlowEvent["type"]>;
  offenders: string[];
  finalState: WardFlowState;
} {
  let state = seedWardFlowState();
  const accepted = new Set<WardFlowEvent["type"]>();
  const offenders: string[] = [];

  for (let round = 0; round < rounds; round += 1) {
    const now = NOW_ANCHOR + round;
    const pivot = round % ALL_EVENT_TYPES.length;
    const order = [...ALL_EVENT_TYPES.slice(pivot), ...ALL_EVENT_TYPES.slice(0, pivot)];
    for (const type of order) {
      // RESET_SCENARIO and SET_SCENARIO would both discard the movement the sweep is building —
      // seedWardFlowState() replaces `state.movements` wholesale either way. Both are exercised on
      // their own below, where the invariant is checked against the resulting state directly.
      if (type === "RESET_SCENARIO" || type === "SET_SCENARIO") continue;
      const result = applyFirstAccepted(type, state, now, code);
      if (!result) continue;
      accepted.add(type);
      state = result.applied;
      offenders.push(...offendingFormsIn(state, `${code} / ${type}`));
    }
  }

  return { accepted, offenders, finalState: state };
}

/**
 * Every form in a state carrying a `dueAt` whose code is NOT on the deadline allowlist — of any
 * code, invented or otherwise. This is the rule; the code list is not.
 */
function offendingFormsIn(state: WardFlowState, label: string): string[] {
  return state.movements
    .filter(
      (movement) =>
        movement.legalForm !== undefined &&
        movement.legalForm.dueAt !== undefined &&
        !(movement.legalForm.code in DEADLINE_BEARING_FORM_PROVENANCE),
    )
    .map(
      (movement) => `${label}: ${movement.id} (Form ${movement.legalForm!.code}, dueAt ${movement.legalForm!.dueAt})`,
    );
}

/** Every `LegalForm` reachable at runtime, tagged with where it came from. */
function collectLegalForms(): { source: string; movementId: string; form: LegalForm }[] {
  const collected: { source: string; movementId: string; form: LegalForm }[] = [];

  for (const movement of wardMovements) {
    if (movement.legalForm) collected.push({ source: "fixture", movementId: movement.id, form: movement.legalForm });
  }

  const seeded = seedWardFlowState();
  for (const movement of seeded.movements) {
    if (movement.legalForm)
      collected.push({ source: "seeded state", movementId: movement.id, form: movement.legalForm });
  }

  // RAISE_REFERRAL is now the ONLY reducer path that authors a legal form, and it authors
  // whichever code the clinician chose — so every selectable code is driven through it here,
  // not just the two the deleted status derivation used to produce. A fabricated `dueAt` would
  // have to be applied either in the list itself or in this branch.
  const legalStatus: LegalStatus = "Referred for psychiatric examination";
  for (const selectable of SELECTABLE_LEGAL_FORMS) {
    const referred = wardFlowReducer(seeded, {
      type: "RAISE_REFERRAL",
      role: "ed",
      now: NOW_ANCHOR,
      edId: "jhc-ed",
      draft: {
        cohort: "Adult",
        security: "Open",
        sex: "Female",
        specialling: false,
        legalStatus,
        urgency: 2,
        legalFormCode: selectable.code,
      },
    });
    const raised = referred.movements.at(-1)!;
    if (raised.legalForm) collected.push({ source: "RAISE_REFERRAL", movementId: raised.id, form: raised.legalForm });

    // RECORD_EXAMINATION no longer AUTHORS a form — since 2026-08-24 it leaves the form exactly
    // as the clinician set it, in every outcome. So this is no longer a fourth authoring site;
    // it is collected as the form a movement still carries AFTER being examined, which is the
    // surface a post-examination `dueAt` would now have to appear on. `after RECORD_EXAMINATION`
    // is named that way rather than left as `RECORD_EXAMINATION` so no later reader mistakes it
    // for an authoring path.
    const examined = wardFlowReducer(referred, {
      type: "RECORD_EXAMINATION",
      role: "ed",
      now: NOW_ANCHOR + 1,
      movementId: raised.id,
      outcome: "inpatient_order",
    });
    const afterExamination = examined.movements.find((movement) => movement.id === raised.id);
    if (afterExamination?.legalForm)
      collected.push({
        source: "after RECORD_EXAMINATION",
        movementId: raised.id,
        form: afterExamination.legalForm,
      });
  }

  return collected;
}

describe("Mental Health Act figures cannot return to the ward model", () => {
  it("gives no Form 1A and no Form 3B a dueAt, in the fixture or from any reducer path", () => {
    const collected = collectLegalForms();

    // Non-vacuity, per source and per code: this test must fail if it ever inspects nothing,
    // or if one of the four sources silently stopped producing a form. Asserting only a total
    // would let a reducer path that returned `undefined` forever pass unnoticed.
    expect(collected.length).toBeGreaterThan(0);
    for (const source of ["fixture", "seeded state", "RAISE_REFERRAL", "after RECORD_EXAMINATION"]) {
      expect(
        collected.filter((entry) => entry.source === source).length,
        `no legal form was collected from ${source}`,
      ).toBeGreaterThan(0);
    }
    for (const code of SWEEP_CODES) {
      expect(
        collected.filter((entry) => entry.form.code === code).length,
        `no Form ${code} was inspected — this guard would pass vacuously`,
      ).toBeGreaterThan(0);
    }

    // The rule is the allowlist, not a remembered pair of codes: a form of ANY code carrying a
    // `dueAt` is an offender unless that code has a recorded provenance line. 4A and 4C have
    // one; 1A, 3B, 3D and anything added later do not, and are therefore checked by default.
    const offenders = collected
      .filter((entry) => entry.form.dueAt !== undefined && !(entry.form.code in DEADLINE_BEARING_FORM_PROVENANCE))
      .map((entry) => `${entry.source}:${entry.movementId} (Form ${entry.form.code}, dueAt ${entry.form.dueAt})`);
    expect(offenders).toEqual([]);
  });

  /**
   * Fix wave 3, finding 1 — the traversal, now driven PER FORM CODE.
   *
   * Wave 2's version applied whichever candidate the reducer accepted first. That was a fixture
   * Form 3B, so a branch keyed on the other code was never entered, and this variant of the
   * TRANSPORT_ACCEPTED bypass passed the whole suite at 227:
   *
   *     legalForm: movement.legalForm?.code === "1A"
   *       ? { ...movement.legalForm, dueAt: event.now + 10080 }
   *       : movement.legalForm,
   *
   * It is genuinely reachable — raise referral, refer, accept in principle, hold bed, handover
   * ready, transport accepted puts a seven-day `dueAt` on a real Form 1A. So every event type is
   * now driven against a movement carrying EACH code, and acceptance is asserted per code so the
   * traversal cannot pass by quietly failing to reach one of them.
   */
  it("puts no dueAt on a form of any code, through any event, against a movement carrying each code", () => {
    // Non-vacuity 1: the union is non-trivial and drawn from the role table, not hand-listed.
    expect(ALL_EVENT_TYPES.length, "the event union looks empty").toBeGreaterThan(10);

    const offenders: string[] = [];
    const coverage = new Map<string, Set<WardFlowEvent["type"]>>();

    for (const code of SWEEP_CODES) {
      const { accepted, offenders: found, finalState } = driveEveryEventAgainst(code);
      coverage.set(code, accepted);
      offenders.push(...found);

      // Non-vacuity 2: the sweep really held a movement of this code to act on. Without this, a
      // code that vanished from the model would make its whole pass silently vacuous.
      const carrying = finalState.movements.filter((movement) => movement.legalForm?.code === code);
      expect(carrying.length, `the sweep never held a Form ${code}`).toBeGreaterThan(0);
    }

    // RELEASE_HOLD / CANCEL_TRANSPORT, exercised explicitly per code (fix round 1, 2026-08-25) —
    // see `buildHeldMovementFor`'s own doc comment for why the round-robin sweep above can never
    // reach these two for a code without a pre-seeded fixture movement, and why that is a
    // traversal limitation rather than grounds for a `STRUCTURALLY_IMPOSSIBLE_FOR_CODE` entry.
    // Mutates the SAME `Set` instances already stored in `coverage` above, so this genuinely
    // satisfies the "Non-vacuity 3" check below rather than sidestepping it.
    for (const code of SWEEP_CODES) {
      const accepted = coverage.get(code)!;

      const forRelease = buildHeldMovementFor(code, NOW_ANCHOR);
      const released = wardFlowReducer(forRelease.state, {
        type: "RELEASE_HOLD",
        role: EVENT_ROLE.RELEASE_HOLD[0],
        now: NOW_ANCHOR,
        movementId: forRelease.movementId,
        reason: "hold_made_in_error",
      });
      expect(
        released.rejections,
        `RELEASE_HOLD for Form ${code} was refused: ${released.rejections.at(-1)?.reason}`,
      ).toEqual([]);
      accepted.add("RELEASE_HOLD");
      offenders.push(...offendingFormsIn(released, `RELEASE_HOLD(${code})`));

      const forCancel = buildHeldMovementFor(code, NOW_ANCHOR);
      // Booking is its own step since 2026-08-31: HANDOVER_READY no longer fabricates a transport
      // job, nor answers the escort question by deriving it from legal status. This file is touched
      // as little as possible, and the edit is forced by the event sequence rather than chosen — no
      // figure, timeframe or threshold is involved.
      const booked = wardFlowReducer(forCancel.state, {
        type: "BOOK_TRANSPORT",
        role: EVENT_ROLE.BOOK_TRANSPORT[0],
        now: NOW_ANCHOR,
        movementId: forCancel.movementId,
        provider: TRANSPORT_PROVIDERS[0],
        escortRequired: true,
      });
      expect(
        booked.rejections,
        `BOOK_TRANSPORT for Form ${code} was refused: ${booked.rejections.at(-1)?.reason}`,
      ).toEqual([]);
      const readyForHandover = wardFlowReducer(booked, {
        type: "HANDOVER_READY",
        role: EVENT_ROLE.HANDOVER_READY[0],
        now: NOW_ANCHOR,
        movementId: forCancel.movementId,
      });
      expect(
        readyForHandover.rejections,
        `HANDOVER_READY for Form ${code} was refused: ${readyForHandover.rejections.at(-1)?.reason}`,
      ).toEqual([]);
      // HANDOVER_READY joined RELEASE_HOLD and CANCEL_TRANSPORT in this block on 2026-08-31, when it
      // stopped fabricating a transport job and began REQUIRING one. It now needs a movement already
      // carrying a booking, which the round-robin sweep above cannot reliably produce — the same
      // traversal limitation those two have, not grounds for a STRUCTURALLY_IMPOSSIBLE entry, and
      // the reason it must be recorded here or "Non-vacuity 3" reports it as never accepted.
      accepted.add("HANDOVER_READY");
      accepted.add("BOOK_TRANSPORT");
      const cancelled = wardFlowReducer(readyForHandover, {
        type: "CANCEL_TRANSPORT",
        role: EVENT_ROLE.CANCEL_TRANSPORT[0],
        now: NOW_ANCHOR,
        movementId: forCancel.movementId,
        reason: "provider_unavailable",
      });
      expect(
        cancelled.rejections,
        `CANCEL_TRANSPORT for Form ${code} was refused: ${cancelled.rejections.at(-1)?.reason}`,
      ).toEqual([]);
      accepted.add("CANCEL_TRANSPORT");
      offenders.push(...offendingFormsIn(cancelled, `CANCEL_TRANSPORT(${code})`));
    }

    // Non-vacuity 3: every movement-targeted event type was ACCEPTED against a movement carrying
    // each code. This is the assertion wave 2 lacked. Reported by name, never counted — and it is
    // what proves the `code === "1A"` branch above is actually entered rather than merely
    // believed to be reachable.
    for (const [code, accepted] of coverage) {
      const excluded = new Set((STRUCTURALLY_IMPOSSIBLE_FOR_CODE[code] ?? []).map((entry) => entry.type));
      const missing = [...MOVEMENT_TARGETED_EVENTS].filter((type) => !accepted.has(type) && !excluded.has(type));
      expect(missing, `never accepted against a Form ${code}`).toEqual([]);
    }

    // The exclusions above get a PARTIAL check, whose limit is documented at the declaration: for
    // each entry, confirm the reducer refuses the event against a fixture movement carrying that
    // code. This catches an entry the reducer plainly accepts. It does NOT prove structural
    // impossibility — an event refused for that movement's stage passes too — so the entry itself
    // must be justified by a code-keyed guard read out of the reducer.
    const seededForExclusions = seedWardFlowState();
    for (const [code, entries] of Object.entries(STRUCTURALLY_IMPOSSIBLE_FOR_CODE)) {
      for (const entry of entries) {
        const carrier = seededForExclusions.movements.find((movement) => movement.legalForm?.code === code);
        expect(carrier, `no fixture movement carries a Form ${code} to test the exclusion against`).toBeDefined();
        const refusedEvents = candidateEvents(entry.type, seededForExclusions, NOW_ANCHOR).filter(
          (event) => targetMovementId(event) === carrier!.id,
        );
        expect(refusedEvents.length, `no ${entry.type} candidate targets ${carrier!.id}`).toBeGreaterThan(0);
        for (const event of refusedEvents) {
          const next = wardFlowReducer(seededForExclusions, event);
          expect(
            next.rejections.length,
            `${entry.type} was NOT refused against Form ${code} — the exclusion is wrong: ${entry.reason}`,
          ).toBeGreaterThan(seededForExclusions.rejections.length);
        }
      }
    }

    // The non-movement-scoped events (RAISE_REFERRAL, CONFIRM_CAPACITY, ADVANCE_CLOCK) are not
    // code-targetable, but must still be exercised and must still leave the invariant intact.
    for (const [code, accepted] of coverage) {
      const unscoped = ALL_EVENT_TYPES.filter(
        (type) => !MOVEMENT_TARGETED_EVENTS.has(type) && type !== "RESET_SCENARIO" && type !== "SET_SCENARIO",
      );
      expect(
        unscoped.filter((type) => !accepted.has(type)),
        `unscoped events never accepted during the Form ${code} sweep`,
      ).toEqual([]);
    }

    // RESET_SCENARIO on its own: it discards the sweep's movements, so it is exercised here and
    // the invariant checked against the state it restores.
    const reset = applyFirstAccepted("RESET_SCENARIO", seedWardFlowState(), NOW_ANCHOR);
    expect(reset, "RESET_SCENARIO was never accepted").toBeDefined();
    offenders.push(...offendingFormsIn(reset!.applied, "RESET_SCENARIO"));

    // SET_SCENARIO on its own, same reason as RESET_SCENARIO above — and against BOTH scenarios,
    // since `candidateEvents` offers one candidate per entry in `WARD_SCENARIOS` and this loop must
    // not silently exercise only the first one it is handed.
    for (const scenario of WARD_SCENARIOS) {
      const setScenario = wardFlowReducer(seedWardFlowState(), {
        type: "SET_SCENARIO",
        role: EVENT_ROLE.SET_SCENARIO[0],
        now: NOW_ANCHOR,
        scenario,
      });
      expect(setScenario.rejections, `SET_SCENARIO to ${scenario} was refused`).toEqual([]);
      offenders.push(...offendingFormsIn(setScenario, `SET_SCENARIO(${scenario})`));
    }

    expect(offenders).toEqual([]);
  });

  // Fix wave 3, finding 2 — the deadline allowlist is a real gate in both directions, and it is
  // what makes the traversal above code-agnostic. Without these, `offendingFormsIn` could be
  // silently inert (allowlisting everything) or absurd (allowlisting nothing).
  it("permits a dueAt only on a form code with recorded provenance", () => {
    // The two allowlisted codes are permitted; the examination-timeline codes are not; and a code
    // nobody has invented yet is not — which is the case the old two-code rule could not make.
    for (const code of ["4A", "4C"]) {
      expect(code in DEADLINE_BEARING_FORM_PROVENANCE, `Form ${code} should be permitted`).toBe(true);
    }
    for (const code of ["1A", "3B", "3D", "2B", "6A", "MHA-99", ""]) {
      expect(code in DEADLINE_BEARING_FORM_PROVENANCE, `Form ${code} must not be permitted`).toBe(false);
    }

    // Every entry records WHY, so a code cannot be admitted as a bare key.
    for (const [code, provenance] of Object.entries(DEADLINE_BEARING_FORM_PROVENANCE)) {
      expect(provenance.length, `Form ${code}'s provenance line is too short to be a real record`).toBeGreaterThan(20);
    }

    // `offendingFormsIn` actually applies the allowlist, in both directions — proven against a
    // synthetic state rather than trusted. The 4A passes; the invented code does not.
    const seeded = seedWardFlowState();
    const withForms: WardFlowState = {
      ...seeded,
      movements: [
        {
          ...seeded.movements[0],
          id: "PROBE-4A",
          legalForm: { code: "4A", kind: "transport", dueAt: NOW_ANCHOR - 10 },
        },
        {
          ...seeded.movements[0],
          id: "PROBE-9Z",
          legalForm: { code: "9Z", kind: "transport", dueAt: NOW_ANCHOR - 10 },
        },
      ],
    };
    const flagged = offendingFormsIn(withForms, "probe");
    expect(flagged).toHaveLength(1);
    expect(flagged[0]).toContain("PROBE-9Z");
  });

  it("records provenance for every exported declaration in the model files that writes a number down", () => {
    const modelPath = `${WARD_DIR}/ward-model.ts`;
    const formsPath = `${WARD_DIR}/ward-legal-forms.ts`;
    const registerPath = "src/lib/form-register.ts";

    /**
     * Every module that may hold Mental Health Act content reachable from the ward surfaces. The
     * rule follows the DECLARATIONS, not a filename, and it has had to move twice:
     *
     *  - `ward-legal-forms.ts` was added when the selectable-form list left `ward-model.ts` (the
     *    ED-access-target quarantine in tests/ward-flow-single-source.test.ts fired, correctly);
     *  - `src/lib/form-register.ts` was added when the official-title register was split out of
     *    `form-catalog.ts` so a client bundle could read a title without its JSON. That split put
     *    a ward-reachable module holding Act content OUTSIDE `WARD_DIR`, where nothing scanned
     *    it: `export const FORM_1A_REFERRAL_EXPIRY_MINUTES = 7 * 24 * 60;` appended there left
     *    this file and ward-flow-single-source green at 18 passed.
     *
     * Titles are what the register legitimately holds. A numeric duration constant is not, and
     * this is the check that says so. A new module of this kind belongs on this list on the day
     * it is created.
     */
    const PROVENANCE_SCANNED_FILES = [modelPath, formsPath, registerPath];

    const numericExported = PROVENANCE_SCANNED_FILES.flatMap((path) => exportedNamesInFile(path, true));

    // Non-vacuity per file: each one is really being read, not silently skipped — a mistyped path
    // would otherwise contribute nothing and this whole scan would narrow without failing.
    for (const [path, sentinel] of [
      [modelPath, "MOVEMENT_STAGES"],
      [formsPath, "SELECTABLE_LEGAL_FORMS"],
      [registerPath, "formTitleForCode"],
    ] as const) {
      expect(exportedNamesInFile(path), `exportedNamesInFile read nothing from ${path}`).toContain(sentinel);
    }

    // …and neither of the two non-numeric sentinels is itself flagged, so they are not merely
    // allowlisted into silence.
    expect(exportedNamesInFile(formsPath, true), "SELECTABLE_LEGAL_FORMS writes a number down").not.toContain(
      "SELECTABLE_LEGAL_FORMS",
    );
    expect(exportedNamesInFile(registerPath, true), "formTitleForCode writes a number down").not.toContain(
      "formTitleForCode",
    );

    // Non-vacuity 1: the AST really read the file, and really distinguishes declarations that
    // write a number from those that do not. `MOVEMENT_STAGES` and `DECLINE_REASONS` are exported
    // string arrays and must be excluded; the two numeric constants must be included. If the
    // containment rule ever matched nothing, the offender list below would be empty for the wrong
    // reason, and these assertions are what catch that.
    expect(numericExported, "MOVEMENT_STAGES is an array of strings").not.toContain("MOVEMENT_STAGES");
    expect(numericExported, "DECLINE_REASONS is an array of strings").not.toContain("DECLINE_REASONS");
    expect(numericExported).toContain("ED_ACCESS_TARGET_MINUTES");
    expect(numericExported).toContain("PARALLEL_REFERRAL_CAP");

    /** Names the rule would demand provenance for, in a snippet of source. */
    const flaggedIn = (source: string): string[] =>
      exportedDeclarationNames(ts.createSourceFile("probe.ts", source, ts.ScriptTarget.Latest, true), true);

    // Non-vacuity 2: every shape that has defeated a previous version of this rule is caught.
    // The first five defeated the NAME-based rules; the last three defeated the "initializer IS a
    // number" rule by merely CONTAINING one. All eight are real reviewer bypasses, not inventions.
    for (const [label, snippet] of [
      ["denylist bypass: expiry-minutes", "export const FORM_1A_REFERRAL_EXPIRY_MINUTES = 7 * 24 * 60;"],
      ["denylist bypass: assessment window", "export const ASSESSMENT_WINDOW_MINUTES = 24 * 60;"],
      ["denylist bypass: involuntary order", "export const INVOLUNTARY_ORDER_HOURS = 72;"],
      ["denylist bypass: section review", "export const SECTION_REVIEW_DAYS = 7;"],
      ["name-rule bypass: no unit token", "export const FORM_1A_REFERRAL_CLOCK = 7 * 24 * 60;"],
      ["shape bypass: object", "export const REFERRAL_CLOCK_SPEC = { minutes: 7 * 24 * 60 };"],
      ["shape bypass: arrow function", "export const referralClockMinutes = (): number => 7 * 24 * 60;"],
      ["shape bypass: enum", "export enum ReferralClock { Window = 10080 }"],
    ] as const) {
      expect(flaggedIn(snippet), `${label} would not be flagged`).toHaveLength(1);
    }

    // Non-vacuity 3: the rule is not simply "flag every export". A declaration that writes no
    // number down is not flagged, in each of the same shapes — otherwise the rule would be
    // useless noise and would be disabled on its first false positive.
    expect(flaggedIn('export const DECLINE_REASONS = ["no_bed"] as const;')).toEqual([]);
    expect(flaggedIn('export const SHAPE = { label: "text" };')).toEqual([]);
    expect(flaggedIn("export const describeForm = (code: string): string => `Form ${code}`;")).toEqual([]);
    expect(flaggedIn('export enum Kind { Examination = "examination" }')).toEqual([]);
    // A non-exported declaration is out of scope, and the limits section says so.
    expect(flaggedIn("const PRIVATE_CLOCK = 7 * 24 * 60;")).toEqual([]);

    // Every allowlist entry carries a non-trivial provenance line, so an entry cannot be added as
    // a bare name to silence the guard.
    for (const [name, provenance] of Object.entries(MODEL_CONSTANT_PROVENANCE)) {
      expect(provenance.length, `${name}'s provenance line is too short to be a real record`).toBeGreaterThan(20);
    }

    // The allowlist must not rot: an entry for a declaration that no longer exists is dead weight
    // that would silently re-admit the name later.
    for (const name of Object.keys(MODEL_CONSTANT_PROVENANCE)) {
      expect(numericExported, `${name} is allowlisted but no longer writes a number down`).toContain(name);
    }

    const offenders = numericExported.filter((name) => !(name in MODEL_CONSTANT_PROVENANCE));
    expect(offenders).toEqual([]);
  });

  // Fix wave 1, finding 5, re-pointed 2026-08-24. Part 1 is complete only while it exercises
  // every place a legal form is authored. That set MOVED: the reducer used to build a 1A in
  // RAISE_REFERRAL and a 3B in RECORD_EXAMINATION, and now builds neither — it attaches whatever
  // the clinician chose from `SELECTABLE_LEGAL_FORMS`. So this pins two things at once, and the
  // first is strictly stronger than what it replaced:
  //
  //   1. the reducer authors NO legal-form literal of its own any more, so it cannot stamp a
  //      fabricated code or `dueAt` on a movement at all; and
  //   2. the declared list Part 1 drives is exactly these codes, in this order, so adding a code
  //      to the picker fails here until Part 1 is driving it too.
  it("pins where legal forms are authored, so Part 1 cannot silently miss one", () => {
    const reducerPath = `${WARD_DIR}/ward-flow-reducer.ts`;
    const source = ts.createSourceFile(
      reducerPath,
      readFileSync(reducerPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    // An authored legal form is an object literal carrying a `code:` string. Read from the AST,
    // so a `code` mentioned in a comment or a string cannot inflate or hide the count.
    const authoredCodesIn = (file: ts.SourceFile): string[] => {
      const codes: string[] = [];
      const visit = (node: ts.Node): void => {
        if (ts.isObjectLiteralExpression(node)) {
          for (const property of node.properties) {
            if (
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name) &&
              property.name.text === "code" &&
              ts.isStringLiteral(property.initializer)
            ) {
              codes.push(property.initializer.text);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(file);
      return codes;
    };

    const formsPath = `${WARD_DIR}/ward-legal-forms.ts`;
    const formsSource = ts.createSourceFile(
      formsPath,
      readFileSync(formsPath, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );

    // Non-vacuity: the walk really reads `code:` literals rather than returning an empty list for
    // any file handed to it. Proven on the file that HAS them, so the reducer's empty result
    // below is a fact about the reducer and not a broken walk.
    expect(
      authoredCodesIn(formsSource).length,
      "no legal-form literal was found in ward-legal-forms.ts",
    ).toBeGreaterThan(0);

    // 1. The reducer authors none. A single `code:` literal reappearing here means a branch has
    //    started deciding a patient's form again, which is the whole thing 2026-08-24 removed.
    expect(authoredCodesIn(source), "the reducer authors a legal form again").toEqual([]);

    // 2. The declared list, in source order. Adding a code fails here until Part 1 drives it.
    expect(authoredCodesIn(formsSource)).toEqual(["1A", "3B", "3D", "4A", "4C"]);
    expect(SELECTABLE_LEGAL_FORMS.map((form) => form.code)).toEqual(["1A", "3B", "3D", "4A", "4C"]);

    // 3. NO entry carries a title. Since 2026-08-24 titles come from the Chief Psychiatrist's
    //    register at render time, and a stored one is exactly how "Inpatient treatment order" —
    //    the title of a Form 6A — came to be printed on every Form 3B. `label` is gone from the
    //    type, so this reads the runtime object: any key beyond `code`/`kind`/`dueAt` fails.
    for (const form of SELECTABLE_LEGAL_FORMS) {
      expect(
        Object.keys(form).filter((key) => !["code", "kind", "dueAt"].includes(key)),
        `Form ${form.code} carries a field this model may not hold`,
      ).toEqual([]);
    }

    // 4. Form 3D carries no classification. This model holds none for a 3D, and the register's
    //    categories were explicitly not adopted, so inventing one here is barred.
    const form3D = SELECTABLE_LEGAL_FORMS.find((form) => form.code === "3D");
    expect(form3D, "Form 3D is no longer offered").toBeDefined();
    expect(form3D!.kind, "a classification was invented for Form 3D").toBeUndefined();

    // 5. Non-vacuity for 4: the absence above is a property of 3D, not of every entry.
    expect(SELECTABLE_LEGAL_FORMS.filter((form) => form.kind !== undefined).map((form) => form.code)).toEqual([
      "1A",
      "3B",
      "4A",
      "4C",
    ]);

    // 5. No offered form carries a deadline. Forms record that they exist, never when they lapse.
    expect(SELECTABLE_LEGAL_FORMS.filter((form) => form.dueAt !== undefined)).toEqual([]);
  });

  /**
   * Fix wave 1, findings 6 and 7 — the rendered legal wording.
   *
   * Both renderers are `"use client"` components whose helpers are not exported, so a unit test
   * cannot call them; the only behavioural coverage is Playwright, which this task may not run.
   * This reads the STRING LITERALS from the AST instead — which is strictly better than a text
   * search for this job, because comments are not string literals, so the paragraphs in those two
   * files that *discuss* the rejected wording cannot satisfy or trip the check.
   *
   * WHAT THIS CANNOT SEE: it proves the literal exists in the module, not that any code path
   * reaches it or that a user sees it. It would not catch the branch being made unreachable. That
   * is a real limit and Playwright remains the only thing that closes it.
   */
  it("renders absence as 'no deadline recorded', never as a claim about the Act", () => {
    const renderers = [`${WARD_DIR}/ward-management-console.tsx`, `${WARD_DIR}/coordinator/shortlist-panel.tsx`];

    for (const path of renderers) {
      const literals = literalsIn(path);

      // Non-vacuity: the parse really produced literals for this file.
      expect(literals.length, `no string literal was read from ${path}`).toBeGreaterThan(0);

      // The wording states what the record holds, not what the legislation requires. Asserting an
      // absence in the Act is the same overreach as asserting the deleted seven-day figure.
      expect(
        literals.some((literal) => literal.includes("no deadline recorded")),
        `${path} no longer renders "no deadline recorded"`,
      ).toBe(true);
      expect(
        literals.filter((literal) => literal.includes("no statutory deadline")),
        `${path} renders a claim about what the Mental Health Act requires`,
      ).toEqual([]);
    }

    // Fix wave 1, item 2 — the same overreach in a second place, and this one was on the DEFAULT
    // path once the picker started defaulting to no form: renderers printed "No legal form
    // required", which asserts what the Mental Health Act REQUIRES of this patient. "Recorded"
    // reports what the record holds, which is all this prototype can verify. Scanned across every
    // ward file, not just the renderers above, because the wording was duplicated across several.
    //
    // **BROADENED 2026-08-24, and the narrowness was itself the defect.** This matched the exact
    // string `legal form required`: case-sensitive, and requiring the word "legal". Two surfaces
    // stood while it read green — `ward-management-console.tsx`'s "No Mental Health Act transport
    // form required" (28 lines below a line this same change had already fixed, on the production
    // patient route, and the DEFAULT rendering for every referral raised with the picker left
    // alone) and `officer-screen.tsx`'s `<dt>Legal form required</dt>`, whose value had been
    // corrected to "No transport form recorded" while its own label still said "required".
    // Lower-casing and dropping the "legal" requirement is what sees both.
    //
    // STATED LIMIT: unlike the two literal checks above, this is a RAW TEXT scan, so a comment
    // that quotes the rejected wording trips it exactly as a live string would. That is the
    // fail-safe direction — a false positive costs a rewording, a false negative shipped the
    // claim — and it is why the comments at both fixed sites describe the old wording rather
    // than quoting it. Do not "fix" this by matching AST string literals only: a JSX text node
    // and a `<dt>` label are both claims, and the sibling deadline check above already shows how
    // easily a literal-only scan misses one.
    const wardFilesScanned = scanWardFiles();
    expect(wardFilesScanned.length, "no ward file was scanned").toBeGreaterThan(0);
    const requiredOffenders = wardFilesScanned
      .filter((file) => readFileSync(file.path, "utf8").toLowerCase().includes("form required"))
      .map((file) => file.path);
    expect(requiredOffenders, "a ward surface claims a form is or is not REQUIRED").toEqual([]);

    // Non-vacuity: the replacement wording really is present, so the check above cannot pass by
    // the whole phrase having been deleted rather than corrected.
    const recordedCarriers = wardFilesScanned
      .filter((file) => readFileSync(file.path, "utf8").includes("No legal form recorded"))
      .map((file) => file.path.replaceAll("\\", "/"));
    for (const expected of [
      `${WARD_DIR}/ward-management-console.tsx`,
      `${WARD_DIR}/ward-management-modes.tsx`,
      `${WARD_DIR}/ward-management-network.tsx`,
      `${WARD_DIR}/coordinator/shortlist-panel.tsx`,
      `${WARD_DIR}/ed/ed-screen.tsx`,
    ]) {
      expect(recordedCarriers, `${expected} no longer says "No legal form recorded"`).toContain(expected);
    }

    // Finding 7: the breach line must still exist in the shortlist renderer. Before this, the only
    // test mentioning the string was a whole-page ABSENCE assertion, which deleting the string
    // makes MORE likely to pass. (Its counterpart in ward-priority.ts is pinned behaviourally in
    // tests/ward-priority.test.ts, which is the stronger proof of the two.)
    expect(
      literalsIn(`${WARD_DIR}/coordinator/shortlist-panel.tsx`).some((literal) =>
        literal.includes("passed its deadline"),
      ),
      "the shortlist breach line was deleted or renamed",
    ).toBe(true);
  });

  // PART 3 — the wider but INCOMPLETE token denylist. Green here proves nothing on its own; see
  // the file header's bypass table. Part 2 above is the fail-closed check.
  it("trips the wider token denylist on no identifier under the ward directory (incomplete net)", () => {
    const files = scanWardFiles();

    // Non-vacuity 1 — the walk is recursive and really reached the subdirectories. Naming the
    // files rather than counting them is what stops a walk that silently stopped at the top
    // level from passing: a guard that "walked only one directory" is a defect this repository
    // has already shipped once.
    const scannedPaths = files.map((file) => file.path.replaceAll("\\", "/"));
    for (const expected of [
      `${WARD_DIR}/ward-model.ts`,
      `${WARD_DIR}/ward-movements.ts`,
      `${WARD_DIR}/ward-flow-reducer.ts`,
      `${WARD_DIR}/coordinator/priority-queue.tsx`,
      `${WARD_DIR}/coordinator/shortlist-panel.tsx`,
      `${WARD_DIR}/ed/ed-screen.tsx`,
      `${WARD_DIR}/officer/officer-screen.tsx`,
      `${WARD_DIR}/tracker/live-tracker.tsx`,
      `${WARD_DIR}/ward/ward-screen.tsx`,
    ]) {
      expect(scannedPaths, `${expected} was never scanned`).toContain(expected);
    }

    // Non-vacuity 2 — parsing actually produced identifiers. If `ts.createSourceFile` ever
    // returned an empty tree (a changed API, a parse failure swallowed, a wrong ScriptKind),
    // every rule below would pass on nothing. These two sentinels are real constants in this
    // directory, so their absence means the scan itself is broken, not that the code is clean.
    const allIdentifiers = new Set(files.flatMap((file) => file.identifiers));
    expect(allIdentifiers, "the AST scan produced no identifiers").toContain("ED_ACCESS_TARGET_MINUTES");
    expect(allIdentifiers, "the AST scan produced no identifiers").toContain("PARALLEL_REFERRAL_CAP");

    // Non-vacuity 3 — the predicates themselves discriminate. A rule that can never match is
    // the "check that cannot fail" shape; a rule that matches everything would be disabled on
    // its first false positive. Both directions are pinned here against real names.
    expect(namesALegalDuration("FORM_1A_REFERRAL_EXPIRY_MINUTES")).toBe(true);
    expect(namesALegalDuration("FORM_1A_SOMETHING_MINUTES")).toBe(true);
    expect(namesALegalDuration("STATUTORY_EXAMINATION_WINDOW_HOURS")).toBe(true);
    expect(namesALegalDuration("ED_ACCESS_TARGET_MINUTES")).toBe(false);
    expect(namesALegalDuration("PARALLEL_REFERRAL_CAP")).toBe(false);
    expect(namesALegalDuration("MINUTES_PER_DAY")).toBe(false);
    // Tokenisation is word-level, not substring: FORM inside FORMATTED must not match.
    expect(namesALegalDuration("formattedMinutes")).toBe(false);
    // The header calls this net INCOMPLETE. That is not a hedge, it is a measured fact, and this
    // is the assertion that keeps it honest: `FORM_1A_REFERRAL_CLOCK` names a form and a clock,
    // carried the deleted fabrication's exact value, and this predicate does not flag it. Part 2
    // is what catches it — in `ward-model.ts`, which is where it was declared. If someone ever
    // "fixes" this by adding CLOCK to the token list, this assertion fails and the header's claim
    // must be re-measured rather than quietly outgrown.
    expect(namesALegalDuration("FORM_1A_REFERRAL_CLOCK")).toBe(false);
    // The constant-name filter is what excludes the honest camelCase readers of the 4A/4C
    // deadlines; if it ever started matching them the guard would be disabled on its first
    // false positive, and if it stopped matching real constants the guard would be inert.
    expect(isConstantName("FORM_1A_REFERRAL_EXPIRY_MINUTES")).toBe(true);
    expect(isConstantName("ED_ACCESS_TARGET_MINUTES")).toBe(true);
    expect(isConstantName("legalDueAt")).toBe(false);
    expect(isConstantName("minutesLegalClock")).toBe(false);
    expect(namesABannedModelShape("SOME_EXPIRY_MINUTES")).toBe(true);
    expect(namesABannedModelShape("A_DEADLINE_B")).toBe(true);
    expect(namesABannedModelShape("ED_ACCESS_TARGET_MINUTES")).toBe(false);

    const offenders = files.flatMap((file) =>
      [...new Set(file.identifiers)]
        .filter(isConstantName)
        .filter(
          (identifier) =>
            namesALegalDuration(identifier) ||
            (file.path.replaceAll("\\", "/") === `${WARD_DIR}/ward-model.ts` && namesABannedModelShape(identifier)),
        )
        .map((identifier) => `${file.path.replaceAll("\\", "/")}: ${identifier}`),
    );
    expect(offenders).toEqual([]);
  });
});
