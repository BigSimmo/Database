import fs from "node:fs";
import path from "node:path";

import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";

/**
 * WHAT THIS FILE CHECKS: for every `WardFlowEvent` union member whose body declares an
 * `overrideReason` field (derived from the AST of `ward-flow-events.ts`, never a hand-written
 * list of names), every FILE in `src/` that builds at least one object literal
 * `{ type: "<EVENT>", ... }` of that event also builds an `overrideReason` property on at least
 * one of its own construction sites for that same event type — or is named in
 * `ALLOWED_SURFACES_WITHOUT_OVERRIDE_REASON` below with a stated reason. Grouped by (file, event
 * type) rather than checked per individual call, deliberately: `shortlist-panel.tsx` has two
 * `REFER_TO_UNITS` sites, an ordinary refer (no override needed, so it rightly builds no
 * `overrideReason`) and an override submit (which does) — flagging the first as a gap would be
 * wrong, because this file demonstrably already has the capability.
 *
 * WHAT THIS DOES NOT CHECK, AND MUST NOT BE READ AS CHECKING: whether a person using the screen
 * can actually reach a working control that records a reason. A file could pass this guard while
 * building `overrideReason` from dead code — behind a disabled flag, on an unmounted branch, in a
 * function nothing calls — and this scan would not know. Conversely a real, reachable "record a
 * reason" control that assembles the event object somewhere this scan cannot see (a shared
 * builder function called from the dispatch site, a spread from another object, a value merged in
 * by a wrapper) would fail this guard even though a user genuinely can record a reason. This is a
 * source-literal proxy for "can this surface record an override reason", not that property
 * itself.
 *
 * ⚠️ AND THE DERIVED SET IS ONE OF DECLARED INTENTIONS, NOT ENGINE CAPABILITIES. This derives the
 * events whose union member DECLARES `overrideReason`. That a member declares it does not mean the
 * reducer honours it — the two are joined by convention only, and THEY HAVE ALREADY DRIFTED: on the
 * master line today `ACCEPT_REFERRAL` declares the field and no reducer code reads it, because the
 * declaration was landed alone to unblock another chat while the engine half was held. So the
 * premise "declared means overridable" is falsified by a live tree, not by a hypothetical.
 *
 * The failure direction is safe — the guard would demand a control for a capability the engine
 * lacks, which generates work rather than risk. But nobody may quote the derived set as "what the
 * engine will let you override". Found by Ward Verifier. Making it mechanical (every derived member
 * must appear in a reducer call that reads `overrideReason`) is cheap and deliberately NOT built
 * yet: it would go red on master today, and that red would be a merge artefact rather than a defect.
 *
 * DO NOT CONCLUDE FROM GREEN: that the allowlisted screens are missing a control, or that the
 * non-allowlisted screens have a working one. Green only means: at the exact dispatch call site
 * this scan could see, the object literal either carries the field or the file is on the
 * accepted-gap list below.
 *
 * TWO SEPARATE GUARDS, NOT ONE: the compliance guard above answers "does every site the scan CAN
 * see meet the rule"; the coverage guard further down (`DISPATCH_CALLS_WITHOUT_A_LITERAL_TYPE`)
 * answers "can the scan see every site there is". A `dispatch({ type: cond ? "A" : "B" })` with a
 * computed type is invisible to the compliance guard's literal match by construction, not merely
 * unrecognised — so compliance alone can go green while a genuinely new override-gated dispatch
 * sits behind a ternary neither guard can read into. The coverage guard forces every non-literal
 * `dispatch(...)` call under `src/components/ward-management` into a named, human-read exception
 * list instead.
 *
 * THE CHEAPEST CHECK OF THE REAL PROPERTY, NOT BUILT HERE: a rendered-DOM/component test per
 * allowlisted surface asserting that no override-reason input exists anywhere in the tree — that
 * would need to run against the live rendered screen, not against source text, to prove the
 * "cannot yet record one" claim rather than merely record it.
 */

type AstNode = Record<string, unknown>;

const REPO_ROOT = process.cwd();
const EVENTS_FILE_REL = "src/components/ward-management/ward-flow-events.ts";
const REDUCER_FILE_REL = "src/components/ward-management/ward-flow-reducer.ts";
const EVENTS_FILE = path.join(REPO_ROOT, EVENTS_FILE_REL);
const REDUCER_FILE = path.join(REPO_ROOT, REDUCER_FILE_REL);
const SRC_DIR = path.join(REPO_ROOT, "src");

function asNode(value: unknown): AstNode | null {
  return value && typeof value === "object" && typeof (value as AstNode).type === "string" ? (value as AstNode) : null;
}

/** Generic depth-first walk over every node in a Babel AST. No `@babel/traverse` in this repo's
 *  dependencies (only `@babel/parser`, per `package.json`), so this mirrors the hand-rolled
 *  walker `tests/route-reachability.test.ts` already uses for the same reason. */
function walk(node: AstNode | null, visit: (n: AstNode) => void) {
  if (!node) return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const entry of value) walk(asNode(entry), visit);
    } else {
      walk(asNode(value), visit);
    }
  }
}

function findNode(root: AstNode | null, predicate: (n: AstNode) => boolean): AstNode | null {
  let found: AstNode | null = null;
  walk(root, (n) => {
    if (!found && predicate(n)) found = n;
  });
  return found;
}

type DerivedEventMember = { name: string; hasOverrideReason: boolean };

/**
 * Parses `ward-flow-events.ts` and returns every `WardFlowEvent` union member as a
 * `{ name, hasOverrideReason }` pair, straight from the TypeScript AST — never a hardcoded name
 * list. Fails OPEN to an empty array (rather than throwing) whenever the declaration cannot be
 * found or the file cannot be parsed, so that failure is visible through the anti-vacuity
 * assertions below (an empty derived set makes every one of them fail) rather than as an opaque
 * suite-load crash with no single failing test name.
 */
function deriveWardFlowEventMembers(): DerivedEventMember[] {
  let source: string;
  try {
    source = fs.readFileSync(EVENTS_FILE, "utf8");
  } catch {
    return [];
  }

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(source, { sourceType: "unambiguous", plugins: ["typescript"] });
  } catch {
    return [];
  }

  const decl = findNode(
    asNode(ast.program),
    (n) => n.type === "TSTypeAliasDeclaration" && asNode(n.id)?.name === "WardFlowEvent",
  );
  const union = decl ? asNode((decl as AstNode).typeAnnotation) : null;
  if (!union || union.type !== "TSUnionType" || !Array.isArray(union.types)) return [];

  const members: DerivedEventMember[] = [];
  for (const rawMember of union.types as unknown[]) {
    const member = asNode(rawMember);
    if (!member || member.type !== "TSTypeLiteral" || !Array.isArray(member.members)) continue;

    let name: string | null = null;
    let hasOverrideReason = false;
    for (const rawProp of member.members as unknown[]) {
      const prop = asNode(rawProp);
      if (!prop || prop.type !== "TSPropertySignature") continue;
      const key = asNode(prop.key);
      if (!key || key.type !== "Identifier") continue;

      if (key.name === "type") {
        const annotation = asNode(prop.typeAnnotation);
        const literalType = annotation ? asNode(annotation.typeAnnotation) : null;
        const literal = literalType && literalType.type === "TSLiteralType" ? asNode(literalType.literal) : null;
        if (literal && literal.type === "StringLiteral" && typeof literal.value === "string") {
          name = literal.value;
        }
      } else if (key.name === "overrideReason") {
        hasOverrideReason = true;
      }
    }
    if (name) members.push({ name, hasOverrideReason });
  }
  return members;
}

type ConstructionSite = { file: string; line: number; eventType: string; hasOverrideReason: boolean };

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      listSourceFiles(full, out);
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.(test|spec)\.(ts|tsx)$/.test(entry.name) &&
      !entry.name.endsWith(".d.ts")
    ) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Finds every object-literal construction site `{ type: "<EVENT>", ... }` for the given event
 * type names across `src/`, via the AST rather than a brace-counting regex — this file's own
 * comments contain unbalanced-looking prose, and `ward-flow-events.ts` is nearly 900 lines of
 * doc comment around ~150 lines of type, so a text scanner would be trusting exactly the part of
 * the file least safe to trust. `ward-flow-events.ts` (the type declaration site, not a
 * construction site) and `ward-flow-reducer.ts` (whose `case "<EVENT>":` labels are not object
 * literals) are excluded by name, per the brief.
 */
function findConstructionSites(eventTypes: readonly string[]): ConstructionSite[] {
  if (eventTypes.length === 0) return [];
  const excluded = new Set([EVENTS_FILE, REDUCER_FILE]);
  const sites: ConstructionSite[] = [];

  for (const file of listSourceFiles(SRC_DIR)) {
    if (excluded.has(file)) continue;
    const source = fs.readFileSync(file, "utf8");
    // Cheap pre-filter before paying for a parse: skip files that cannot possibly contain a
    // construction site of any candidate event type.
    if (!eventTypes.some((t) => source.includes(`"${t}"`) || source.includes(`'${t}'`))) continue;

    let ast: ReturnType<typeof parse>;
    try {
      ast = parse(source, { sourceType: "unambiguous", plugins: ["jsx", "typescript"] });
    } catch (error) {
      throw new Error(`ward-override-surfaces: could not parse ${file}`, { cause: error });
    }

    const relFile = path.relative(REPO_ROOT, file).split(path.sep).join("/");
    walk(asNode(ast.program), (node) => {
      if (node.type !== "ObjectExpression" || !Array.isArray(node.properties)) return;
      const props = (node.properties as unknown[])
        .map((p) => asNode(p))
        .filter((p): p is AstNode => !!p && p.type === "ObjectProperty");

      const typeProp = props.find((p) => {
        const key = asNode(p.key);
        return !!key && key.type === "Identifier" && key.name === "type";
      });
      if (!typeProp) return;
      const valueNode = asNode(typeProp.value);
      if (!valueNode || valueNode.type !== "StringLiteral" || typeof valueNode.value !== "string") return;
      if (!eventTypes.includes(valueNode.value)) return;

      const hasOverrideReason = props.some((p) => {
        const key = asNode(p.key);
        return !!key && key.type === "Identifier" && key.name === "overrideReason";
      });
      const loc = node.loc as { start?: { line?: number } } | undefined;
      sites.push({
        file: relFile,
        line: loc?.start?.line ?? 0,
        eventType: valueNode.value,
        hasOverrideReason,
      });
    });
  }
  return sites;
}

/**
 * Parses ONE file and returns the name of its first exported, function-valued, capitalized
 * (component-shaped) identifier — `export function Foo(...)` or `export const Foo = (...) => ...`
 * — straight from that file's own AST. Never a hand-typed name: a rename in the source file moves
 * with this function automatically, which is the entire point of deriving it — a hardcoded
 * `"MorningTour"` string would go on matching zero importers forever after a rename, silently
 * proving nothing about the file it used to name.
 *
 * Deliberately narrow, and that narrowness is checked against real files rather than assumed: only
 * a top-level `export function X` or `export const X = () => {}` / `export const X = function ()
 * {}` is recognised, and only the FIRST whose name starts with an uppercase letter. That is enough
 * for `morning-tour.tsx` today, which exports exactly one such name (`MorningTour`) alongside a
 * SCREAMING_SNAKE_CASE constant (`TOUR_BEAT_INTERVAL_MS` — not function-valued, so it is skipped on
 * the function-shape check, not the capitalization check, since `/^[A-Z]/` alone would not exclude
 * it) and a lowercase helper function (`tourBeatEvents` — skipped on capitalization). It would NOT
 * disambiguate two capitalized function exports from the same file; no "not live" allowlist entry
 * has that shape today, and this scan does not attempt to guess which one is "the" component if it
 * ever does. Returns `null` (never throws) on a missing or unparseable file, so a broken derivation
 * is visible through a failed anti-vacuity assertion rather than an opaque suite-load crash.
 */
function deriveExportedComponentName(fileRel: string): string | null {
  const filePath = path.join(REPO_ROOT, fileRel);
  let source: string;
  try {
    source = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }

  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(source, { sourceType: "unambiguous", plugins: ["jsx", "typescript"] });
  } catch {
    return null;
  }

  const program = asNode(ast.program);
  const body = program && Array.isArray(program.body) ? (program.body as unknown[]) : [];

  for (const rawStatement of body) {
    const statement = asNode(rawStatement);
    if (!statement || statement.type !== "ExportNamedDeclaration") continue;
    const declaration = asNode(statement.declaration);
    if (!declaration) continue;

    if (declaration.type === "FunctionDeclaration") {
      const id = asNode(declaration.id);
      if (id && id.type === "Identifier" && typeof id.name === "string" && /^[A-Z]/.test(id.name)) {
        return id.name;
      }
    }

    if (declaration.type === "VariableDeclaration" && Array.isArray(declaration.declarations)) {
      for (const rawDeclarator of declaration.declarations as unknown[]) {
        const declarator = asNode(rawDeclarator);
        if (!declarator || declarator.type !== "VariableDeclarator") continue;
        const id = asNode(declarator.id);
        const init = asNode(declarator.init);
        if (!id || id.type !== "Identifier" || typeof id.name !== "string" || !/^[A-Z]/.test(id.name)) continue;
        if (init && (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression")) {
          return id.name;
        }
      }
    }
  }
  return null;
}

/**
 * Every file under `src/` (never `tests/`) whose `import` statements name `componentName` as an
 * imported binding — `import { X }` or `import { X as Y }` — found via the AST's `ImportSpecifier`
 * nodes, never a JSX-tag (`<X`) text search. An import scan is the stronger check: nothing can put
 * a component on screen without importing it first, so this also catches `createElement(X, ...)`,
 * `React.lazy(...)`, a component map, or a route table nobody has written yet — a JSX-tag search
 * would only ever catch the first of those. `listSourceFiles` (used for the scan) already excludes
 * `*.test.ts(x)` / `*.spec.ts(x)` and `.d.ts`, and it is only ever called here with `SRC_DIR` — so a
 * genuine renderer under `tests/` (`tests/ward-morning-tour.dom.test.tsx`, which correctly imports
 * and renders `MorningTour` directly) is never visible to this scan at all, by construction, not by
 * a name-based exclusion that could accidentally also exclude a real `src/` importer.
 *
 * This answers "is `componentName` importABLE from `src/`", not "is it actually rendered on a live
 * screen" — a dead re-export would still count as an importer here, which is the conservative
 * direction for a guard whose failure mode must be "go and look", never a false "still safe".
 */
function findImportersUnderSrc(componentName: string): string[] {
  const importers: string[] = [];
  for (const file of listSourceFiles(SRC_DIR)) {
    const source = fs.readFileSync(file, "utf8");
    // Cheap pre-filter before paying for a parse, same pattern as findConstructionSites above.
    if (!source.includes(componentName)) continue;

    let ast: ReturnType<typeof parse>;
    try {
      ast = parse(source, { sourceType: "unambiguous", plugins: ["jsx", "typescript"] });
    } catch (error) {
      throw new Error(`ward-override-surfaces: could not parse ${file}`, { cause: error });
    }

    const relFile = path.relative(REPO_ROOT, file).split(path.sep).join("/");
    let matched = false;
    walk(asNode(ast.program), (node) => {
      if (matched || node.type !== "ImportSpecifier") return;
      const imported = asNode(node.imported);
      if (imported && imported.type === "Identifier" && imported.name === componentName) matched = true;
    });
    if (matched) importers.push(relFile);
  }
  return importers;
}

/**
 * Surfaces that dispatch an overridable event without ever building an `overrideReason` field,
 * confirmed today by reading the file, not assumed. Each entry states what this scan cannot see
 * happening on that screen, and what would remove the entry. A file that has a working override
 * control for the event ELSEWHERE in the same file (`shortlist-panel.tsx` does, for
 * `REFER_TO_UNITS`) must not be added here just because one of its several dispatch sites is the
 * ordinary no-override-needed path — that is expected, not a gap.
 */
const ALLOWED_SURFACES_WITHOUT_OVERRIDE_REASON: Record<string, string> = {
  "src/components/ward-management/morning/morning-tour.tsx":
    "The scripted morning-tour demo dispatches REFER_TO_UNITS and ACCEPT_IN_PRINCIPLE from fixed, " +
    "hardcoded tour-step data; there is no form or control on this surface for a person to type a " +
    "reason into at all. PAUSED by owner instruction 2026-08-30, and that is the only thing making " +
    "this entry safe. Would be removed when the tour is un-paused, because un-pausing makes this a " +
    "LIVE surface that can receive a refusal it cannot answer. NOT a feature decision: the tour " +
    "dispatches for a hardcoded movement/unit pair, so if that pair ever fails a suitability gate " +
    "the scripted step is refused and the tour breaks, whether or not the script ever wanted to " +
    "demonstrate an override. The pair passes today (checked 2026-09-02) — but it passes because " +
    "age and legal_status are never asked on the movement path, which is protection by OMISSION, " +
    "and age is already in the overridable set. An earlier version of this reason named the wrong " +
    "exit condition; it was incomplete when written rather than decayed, on the one entry whose " +
    "risk is scheduled rather than present.",
};

const derivedMembers = deriveWardFlowEventMembers();
const overridableEventTypes = Array.from(new Set(derivedMembers.filter((m) => m.hasOverrideReason).map((m) => m.name)));
const constructionSites = findConstructionSites(overridableEventTypes);

type SurfaceGroup = { file: string; eventType: string; lines: number[]; hasOverrideReason: boolean };

/** Groups construction sites by (file, event type) — see the file-level doc comment for why a
 *  surface, not each individual call, is the unit this guard judges. */
function groupConstructionSites(sites: ConstructionSite[]): SurfaceGroup[] {
  const groups = new Map<string, SurfaceGroup>();
  for (const site of sites) {
    const key = `${site.file}::${site.eventType}`;
    let group = groups.get(key);
    if (!group) {
      group = { file: site.file, eventType: site.eventType, lines: [], hasOverrideReason: false };
      groups.set(key, group);
    }
    group.lines.push(site.line);
    if (site.hasOverrideReason) group.hasOverrideReason = true;
  }
  return Array.from(groups.values());
}

const WARD_MANAGEMENT_DIR = path.join(REPO_ROOT, "src/components/ward-management");

type DispatchCallSite = { file: string; line: number; literalType: string | null };

/**
 * COVERAGE, not compliance. Everything above answers "of the dispatch sites this scan can see,
 * does each one meet the rule" — it says nothing about whether the scan can see everything. A
 * `dispatch({ type: someExpression, ... })` with a COMPUTED `type` (e.g. a ternary) is invisible
 * to `findConstructionSites` above by construction, not merely unrecognised: that function only
 * ever matches a `StringLiteral` value. If a future edit made a computed dispatch choose between
 * an overridable event and a non-overridable one, the compliance guard above would simply never
 * see that call site, and would keep reporting green.
 *
 * This function enumerates EVERY `dispatch(...)` call under `src/components/ward-management` (the
 * only place in `src/` that references `WardFlowEvent`/`wardFlowReducer` at all — confirmed by a
 * repo-wide search) and classifies whether its `type` field is a plain string literal. Every call
 * that is NOT must be named, with a reason, in `DISPATCH_CALLS_WITHOUT_A_LITERAL_TYPE` below — so
 * a new computed or indirected dispatch call is forced into view for a human to read, rather than
 * silently passing through a hole the literal scan cannot see.
 */
function findWardManagementDispatchCalls(): DispatchCallSite[] {
  const calls: DispatchCallSite[] = [];
  for (const file of listSourceFiles(WARD_MANAGEMENT_DIR)) {
    const source = fs.readFileSync(file, "utf8");
    if (!source.includes("dispatch(")) continue;

    let ast: ReturnType<typeof parse>;
    try {
      ast = parse(source, { sourceType: "unambiguous", plugins: ["jsx", "typescript"] });
    } catch (error) {
      throw new Error(`ward-override-surfaces: could not parse ${file}`, { cause: error });
    }

    const relFile = path.relative(REPO_ROOT, file).split(path.sep).join("/");
    walk(asNode(ast.program), (node) => {
      if (node.type !== "CallExpression") return;
      const callee = asNode(node.callee);
      if (!callee || callee.type !== "Identifier" || callee.name !== "dispatch") return;

      const args = Array.isArray(node.arguments) ? (node.arguments as unknown[]) : [];
      const arg0 = asNode(args[0]);
      const loc = node.loc as { start?: { line?: number } } | undefined;
      const line = loc?.start?.line ?? 0;

      let literalType: string | null = null;
      if (arg0 && arg0.type === "ObjectExpression" && Array.isArray(arg0.properties)) {
        const props = (arg0.properties as unknown[])
          .map((p) => asNode(p))
          .filter((p): p is AstNode => !!p && p.type === "ObjectProperty");
        const typeProp = props.find((p) => {
          const key = asNode(p.key);
          return !!key && key.type === "Identifier" && key.name === "type";
        });
        const valueNode = typeProp ? asNode(typeProp.value) : null;
        if (valueNode && valueNode.type === "StringLiteral" && typeof valueNode.value === "string") {
          literalType = valueNode.value;
        }
      }
      calls.push({ file: relFile, line, literalType });
    });
  }
  return calls;
}

/**
 * Every `dispatch(...)` call under `src/components/ward-management` whose `type` is NOT a plain
 * string literal, confirmed by reading each one on 2026-09-02 — not assumed, not estimated. A new
 * entry appearing in the scan without a matching key here means an unclassifiable dispatch call
 * has been added and a human must read it before this guard can go green again.
 */
const DISPATCH_CALLS_WITHOUT_A_LITERAL_TYPE: Record<string, string> = {
  "src/components/ward-management/ward-management-console.tsx:475":
    'type: patient.flaggedUrgent ? "CLEAR_MOVEMENT_URGENT_FLAG" : "FLAG_MOVEMENT_URGENT" — a computed ' +
    "ternary between two literal event names. Harmless today only because NEITHER branch is " +
    "override-gated (neither event's WardFlowEvent member declares overrideReason) — if either ever " +
    "becomes overridable, this stated reason is false and the entry must be re-examined, not carried " +
    "forward unread.",
  "src/components/ward-management/morning/morning-tour.tsx:284":
    "dispatch(pending.event) — the event object was already built as a literal inside this same " +
    "file's tourBeatEvents() (the REFER_TO_UNITS/ACCEPT_IN_PRINCIPLE literals the compliance guard " +
    "above already finds at its own construction sites); this call only forwards a reference to it, " +
    "so the literal scan is not blind here, only indirected.",
  "src/components/ward-management/morning/morning-tour.tsx:319":
    "dispatch(events[0]) — same tourBeatEvents() indirection as line 284, same reasoning.",
  "src/components/ward-management/morning/morning-tour.tsx:324":
    "dispatch(event) inside a for-of loop over tourBeatEvents()'s result — same indirection as line " +
    "284, same reasoning.",
};

const wardManagementDispatchCalls = findWardManagementDispatchCalls();
const nonLiteralDispatchCalls = wardManagementDispatchCalls.filter((c) => c.literalType === null);

describe("ward override-surface guard", () => {
  // --- Anti-vacuity guards. Without these, a broken parse silently returning [] would make every
  //     assertion below pass trivially, and the guard would prove nothing while looking green. ---

  it("derives a non-empty set of overridable event types from the WardFlowEvent union", () => {
    expect(overridableEventTypes.length).toBeGreaterThan(0);
  });

  it("derives at least 3 overridable event types from the WardFlowEvent union", () => {
    expect(overridableEventTypes.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * A count alone is not enough: a parse that stops early can still return 3-or-more members and
   * pass the guard above with the WRONG three, silently dropping whichever member sits later in
   * the union. `ACCEPT_REFERRAL` is currently the last-declared overridable member (~line 613 of
   * 1051), so it is the one a premature stop would drop first — this is a single named regression
   * pin, not a rebuilt hand-written list of all four, and it must not be widened into one.
   */
  /**
   * ⚠️ TWO ASSERTIONS THAT ANSWER DIFFERENT QUESTIONS, AND THE SECOND EXISTS TO DIAGNOSE THE FIRST.
   *
   * The count guards above are the WEAKEST possible statement — the search is not empty. Proven,
   * not asserted: terminating the `WardFlowEvent` union early leaves three overridable members and
   * the "at least 3" guard passes while the parse has silently stopped following the union.
   *
   * `EXPECTED_OVERRIDABLE_EVENTS` is a snapshot, and it is deliberately NOT the hand-maintained
   * list this file exists to replace. The thing that made those lists dangerous was that they FAIL
   * SILENTLY WHEN THEY SHOULD GROW. A set equality cannot: adding a member reddens it, removing one
   * reddens it, and in BOTH directions the red is the decision point — is this event's gate a
   * judgement someone may override, or a fact they may not? Ward Lead's proposal, taken over my
   * single named pin, which protected against a fifth member and not against the existing four.
   */
  const EXPECTED_OVERRIDABLE_EVENTS = ["REFER_TO_UNITS", "ACCEPT_IN_PRINCIPLE", "PULL_PATIENT", "ACCEPT_REFERRAL"];

  it("the derived overridable set equals its snapshot, so any change is a decision somebody takes", () => {
    expect([...overridableEventTypes].sort()).toEqual([...EXPECTED_OVERRIDABLE_EVENTS].sort());
  });

  /**
   * ⚠️ AND THIS ONE SAYS *WHY* THE ASSERTION ABOVE WENT RED, which the equality cannot.
   *
   * A red equality has two very different causes — the parse broke, or somebody changed the code —
   * and sending a reader to the wrong one wastes the hour the guard was meant to save. Counting the
   * declaration form independently discriminates them: parse broke and the counts DISAGREE; code
   * changed and they AGREE while both differ from the snapshot. Ward Verifier's cross-check.
   *
   * ⚠️ COUNT THE DECLARATION FORM, NEVER THE BARE NAME. Measured in this file today: `overrideReason`
   * appears 5 times and `overrideReason?: OverrideReason` 4 — the fifth is a COMMENT explaining why
   * the field is on all three placement events. A cross-check counting the bare name is red for
   * ever, and the repair somebody reaches for at 2am is loosening the guard. A mention is not a
   * declaration, inside the very file whose job is to declare it.
   */
  it("sees every overrideReason the events file declares, so a broken parse is told apart from a real change", () => {
    // Counted by scanning, never by splitting on an escape sequence: writing "backslash-n" through
    // a shell heredoc into this file silently became a REAL newline and broke the whole test file
    // into "no tests" — a doubled backslash is halved in every context, quoted or not. Avoiding the
    // escape entirely is cheaper than getting the quoting right.
    // ⚠️ A LINE THAT *STARTS* WITH THE DECLARATION, NOT A LINE THAT CONTAINS IT. The first version
    // counted occurrences anywhere, and went red the moment a doc comment in that file QUOTED the
    // declaration while explaining this very trap — six matches, four declarations, two prose.
    // "Count the declaration form, never the bare name" was not enough: a comment can contain the
    // declaration form too. A declaration is a line whose own content begins with it; a mention is
    // a line that begins with something else. That distinction is cheap and it is the real one.
    const source = fs.readFileSync(EVENTS_FILE, "utf8");
    const needle = "overrideReason?: OverrideReason";
    const declarations = source
      // Split on a COMPUTED newline. Writing the escape sequence through a shell heredoc turned
      // it into REAL control characters inside the regex literal, which broke this file into
      // "no tests" — the third time tonight. A doubled backslash is halved in every context,
      // quoted or not, so the fix is to stop writing escapes rather than to quote them better.
      .split(String.fromCharCode(10))
      .filter((line) => line.trim().startsWith(needle)).length;

    expect(overridableEventTypes.length).toBe(declarations);
    // Anti-vacuity: 0 === 0 would satisfy the equality above if the file moved or the read failed.
    expect(declarations).toBeGreaterThan(2);
  });

  it("the derived overridable set includes ACCEPT_REFERRAL", () => {
    expect(overridableEventTypes).toContain("ACCEPT_REFERRAL");
  });

  it("finds more than 3 construction sites of an overridable event across src/", () => {
    expect(constructionSites.length).toBeGreaterThan(3);
  });

  it("at least one construction site supplies an overrideReason field", () => {
    // Proves the detector can actually see the field at all (shortlist-panel.tsx's override
    // dialog supplies one today for REFER_TO_UNITS) — if this is ever false, the scan itself is
    // broken, not the code.
    expect(constructionSites.some((s) => s.hasOverrideReason)).toBe(true);
  });

  /**
   * ⚠️ THE ALLOWLIST ROTS SILENTLY, AND THE COMPLIANCE GUARD BELOW CANNOT NOTICE.
   *
   * It filters compliant groups out FIRST and consults the allowlist SECOND, so a file that GAINS
   * an overrideReason never reaches the allowlist at all. Its entry then sits there describing a
   * gap that has been closed, and nothing goes red — an accepted-gap note that has quietly become
   * a false statement about the code.
   *
   * ⚠️ THIS IS NOT HYPOTHETICAL AND IT IS HOURS AWAY: the moment `ward-screen.tsx` builds an
   * overrideReason, its entry is false. Found by Ward Verifier before the change that triggers it.
   *
   * A weak reason is visibly weak; a stale entry reads as current. That is reason 3 all over again
   * — an option offered for a situation that no longer exists — and this file already carries the
   * lesson in the entries themselves.
   *
   * ⚠️ FAIL-CLOSED IN THE ONLY SAFE DIRECTION: it can tell you to DELETE an accepted gap, never to
   * add one. It cannot be used to wave a real violation through.
   *
   * A file is "still in violation" if ANY of its event groups lacks the field — so a surface that
   * fixes one of its two events keeps its entry, correctly, until it fixes both.
   */
  it("no allowlist entry describes a gap that has already been closed", () => {
    const groups = groupConstructionSites(constructionSites);
    const stillInViolation = new Set(groups.filter((g) => !g.hasOverrideReason).map((g) => g.file));
    const stale = Object.keys(ALLOWED_SURFACES_WITHOUT_OVERRIDE_REASON).filter((file) => !stillInViolation.has(file));

    expect(
      stale,
      stale.length === 0
        ? ""
        : "These surfaces are allowlisted as unable to record an override reason, and they now " +
            "build one. The entry is no longer true. DELETE IT — do not update its wording, and do " +
            "not assume the surface is finished on this evidence alone: this guard sees a source " +
            "literal, not a working control. Entries to remove: " +
            stale.join(", "),
    ).toEqual([]);

    // Anti-vacuity, both directions: an empty allowlist or an empty violation set would satisfy
    // the assertion above while proving nothing about either.
    expect(Object.keys(ALLOWED_SURFACES_WITHOUT_OVERRIDE_REASON).length).toBeGreaterThan(0);
    expect(stillInViolation.size).toBeGreaterThan(0);
  });

  // --- The compliance guard: every site the scan CAN see meets the rule. ---

  it("every surface constructing an overridable event builds an overrideReason on at least one of its own sites for that event, or is allowlisted", () => {
    const groups = groupConstructionSites(constructionSites);
    const violations = groups
      .filter((g) => !g.hasOverrideReason)
      .filter((g) => !(g.file in ALLOWED_SURFACES_WITHOUT_OVERRIDE_REASON))
      .map(
        (g) =>
          `${g.file} dispatches ${g.eventType} at line(s) ${g.lines.join(", ")} and never builds an overrideReason field for it`,
      );
    expect(violations, violations.join("\n")).toEqual([]);
  });

  // --- The coverage guard: the scan CAN see (almost) everything, and every place it cannot is
  //     named. Without this, a computed `type:` on a dispatch call is invisible to every guard
  //     above by construction, and none of them would ever report it missing. ---

  it("finds a non-trivial number of dispatch(...) call sites under ward-management", () => {
    // Anti-vacuity: today's true count is 56. A near-zero result means the walker or the
    // `dispatch(` pre-filter is broken, not that ward-management stopped dispatching events.
    expect(wardManagementDispatchCalls.length).toBeGreaterThan(10);
  });

  it("exactly 4 dispatch(...) calls under ward-management have a non-literal type", () => {
    expect(nonLiteralDispatchCalls.length).toBe(4);
  });

  /**
   * ⚠️ THE COVERAGE GUARD ABOVE ONLY LOOKS INSIDE `src/components/ward-management`. A surface that
   * dispatched an overridable event from anywhere else would be invisible to it — not allowlisted,
   * not flagged, simply never looked at. That was the honest weak point of this file when it
   * landed, and it was true by luck rather than by enforcement.
   *
   * Measured when this was written: 62 `dispatch(` sites exist outside that directory and NONE of
   * them names an overridable event, against 125 mentions inside it. So the scope was correct —
   * and nothing was stopping it from silently ceasing to be.
   *
   * This asserts the scope is still honest. If an overridable event ever appears outside
   * ward-management, this goes red and somebody must either widen the scan or say why the new
   * surface is exempt. It fails toward "go and look", which is the only safe direction for a guard
   * whose whole job is knowing what it has not seen.
   */
  /**
   * ⚠️ THIS IS WHAT LETS ANYONE SAY "THE ALLOWLIST ENTRY CAME OFF, SO THAT SURFACE IS DONE."
   *
   * The compliance guard judges a SURFACE, passing if ANY site in a file carries the field for that
   * event. That is deliberate and correct: `shortlist-panel.tsx` has two `REFER_TO_UNITS` sites, a
   * plain refer that legitimately needs no reason and an override submit that supplies one, and a
   * per-site rule would flag the one surface already doing this properly.
   *
   * But "any" is weaker than "all" WHEREVER A FILE HAS SEVERAL SITES FOR ONE EVENT. Today no
   * override-gated surface does except `shortlist-panel.tsx`, so for every other file the two
   * statements are identical and removing its entry really does prove it finished. ⚠️ THAT IS A
   * FACT ABOUT TODAY'S CODE, NOT A PROPERTY OF THE GUARD — add a second Pull button to
   * `ward-screen.tsx` and one of them carrying a reason would let the entry come off while the
   * other could not record one, with everything green.
   *
   * So the counts are pinned. A new site for an already-overridable event on an already-known
   * surface turns this red, and the red is the question: does the claim "this surface is done"
   * still hold now there are two ways in?
   *
   * ⚠️ Two chats independently reported ten `PULL_PATIENT` sites in `ward-screen.tsx` and moved to
   * weaken the fold gate over it. There is ONE. The other nine are a doc comment, a label map, four
   * prose comments, a comparison and a testid — the bare NAME, counted as though it were the thing.
   * This pin counts construction sites from the AST, so it cannot make that mistake.
   */
  it("pins how many construction sites each surface has, so 'any site' and 'all sites' cannot quietly diverge", () => {
    const counts = Object.fromEntries(
      groupConstructionSites(constructionSites)
        .map((group) => [`${group.file}::${group.eventType}`, group.lines.length])
        .sort(([a], [b]) => String(a).localeCompare(String(b))),
    );

    expect(counts).toEqual({
      "src/components/ward-management/coordinator/shortlist-panel.tsx::REFER_TO_UNITS": 2,
      "src/components/ward-management/morning/morning-tour.tsx::ACCEPT_IN_PRINCIPLE": 1,
      "src/components/ward-management/morning/morning-tour.tsx::REFER_TO_UNITS": 1,
      "src/components/ward-management/referrals/referral-match.tsx::ACCEPT_REFERRAL": 1,
      // ⚠️ TWO EACH SINCE THE OVERRIDE CONTROL LANDED, and the divergence this pin exists to
      // surface is now REAL on this surface — deliberately. The first dispatch is the ordinary
      // press and carries no reason, because at that moment nobody has been refused anything. The
      // second is the override re-dispatch and carries one. Exactly the shape shortlist-panel.tsx
      // already had, which is why the (file, eventType) grouping is right: demanding a reason on
      // the first press would be demanding a justification before there is anything to justify.
      "src/components/ward-management/ward/ward-screen.tsx::ACCEPT_IN_PRINCIPLE": 2,
      "src/components/ward-management/ward/ward-screen.tsx::PULL_PATIENT": 2,
    });
  });

  it("no overridable event is constructed outside the directory this guard actually scans", () => {
    const outside: string[] = [];
    for (const file of listSourceFiles(SRC_DIR)) {
      if (file.startsWith(WARD_MANAGEMENT_DIR)) continue;
      const source = fs.readFileSync(file, "utf8");
      for (const eventType of overridableEventTypes) {
        if (source.includes(eventType)) {
          outside.push(`${path.relative(REPO_ROOT, file)} names ${eventType}`);
        }
      }
    }
    // ⚠️ THIS MATCHES THE NAME, NOT A CONSTRUCTION, AND THAT IS DELIBERATE — SO THE MESSAGE HAS TO
    // SAY SO. Matching `type: "X"` would be tidier and would go GREEN on a computed-type dispatch
    // outside this scan, which is the one thing this assertion exists to prevent. So it is
    // fail-safe and therefore noisy: a doc comment elsewhere mentioning an event name reddens it.
    // A guard people switch off is worse than none, so the failure must not read as an accusation —
    // it must say what to go and read, and name both possible causes, the way the model-claims
    // register does. That is the difference between a gate and a colleague.
    expect(
      outside,
      outside.length === 0
        ? ""
        : "An overridable event name appears outside src/components/ward-management, which this " +
            "guard does not scan. READ EACH ONE BEFORE CHANGING ANYTHING — two very different things " +
            "look identical here. If it is a real dispatch, the surface is unprotected and the scan " +
            "must widen. If it is only a mention (a doc comment, a string in prose), record it here " +
            'with a reason. Do NOT narrow this match to `type: "X"` to make it pass: that would go ' +
            "green on a computed-type dispatch, which is precisely what it exists to catch.",
    ).toEqual([]);

    // Anti-vacuity: an empty or failed file walk would satisfy the assertion above while proving
    // nothing. The same walk must be seeing a substantial tree.
    expect(listSourceFiles(SRC_DIR).length).toBeGreaterThan(100);
  });

  it("every dispatch(...) call with a non-literal type is named in DISPATCH_CALLS_WITHOUT_A_LITERAL_TYPE", () => {
    const found = Array.from(new Set(nonLiteralDispatchCalls.map((c) => `${c.file}:${c.line}`))).sort();
    const named = Object.keys(DISPATCH_CALLS_WITHOUT_A_LITERAL_TYPE).sort();
    expect(found).toEqual(named);
  });
});

/**
 * A SEPARATE GUARD FROM EVERYTHING ABOVE, and it checks a different property. Everything above
 * asks "does every override-gated construction site this scan can see meet the rule". This asks a
 * prior question about ONE specific allowlist entry: is the stated reason it is exempt from that
 * rule still true?
 *
 * `morning-tour.tsx`'s entry in `ALLOWED_SURFACES_WITHOUT_OVERRIDE_REASON` is safe only because the
 * tour is PAUSED by owner instruction — nothing under `src/` can currently reach it. The entry says
 * so itself: "Would be removed when the tour is un-paused, because un-pausing makes this a LIVE
 * surface that can receive a refusal it cannot answer." Nothing else in this file checks that
 * condition, and the condition does not even live in `morning-tour.tsx` — the pause switch lives in
 * `morning-page.tsx` (~line 126) — so a signature or hash over `morning-tour.tsx` would never move
 * when the tour is un-paused. This checks the one thing that DOES move: whether anything under
 * `src/` imports the tour's own exported component at all.
 *
 * WHAT THIS DOES NOT CHECK: whether `morning-page.tsx`'s pause flag is currently on or off, or
 * whether some future code path could reach the tour through something other than an ES import
 * (`require`, a dynamically-constructed specifier, non-`src/` code). It checks "is the tour
 * importable from `src/` today", which is the narrowest thing that can go red the moment un-pausing
 * makes the tour reachable through an ordinary import — the only way this codebase renders
 * anything.
 *
 * SCOPED TO ONE ALLOWLIST ENTRY, ON PURPOSE, NOT SWEEPING EVERY ENTRY'S PROSE FOR A "NOT LIVE"
 * SHAPE: `ALLOWED_SURFACES_WITHOUT_OVERRIDE_REASON` has two entries today and they are different
 * claims. `morning-tour.tsx`'s claim is "this surface cannot be reached at all" (a liveness claim,
 * checkable by an import scan). `referral-match.tsx`'s claim is "this surface IS reachable and
 * simply has no override control on it yet" (a missing-feature claim — the surface is live on
 * purpose, so an importer count of zero would be false, not reassuring). Driving a "zero importers"
 * check off every entry's English prose would need parsing that prose to tell those two claims
 * apart, which is exactly the kind of fragile text-matching this whole file replaces with an AST
 * read elsewhere. One named entry, read here, is the cheaper and more honest option.
 */
describe("ward override-surface guard: the paused morning-tour entry stays unreachable from src/", () => {
  // Anti-drift for the scoping decision above: if this path is ever renamed or dropped from the
  // allowlist without this constant changing too, that mismatch must be visible, not silent.
  const NOT_LIVE_SURFACE_FILE = "src/components/ward-management/morning/morning-tour.tsx";

  it("the not-live surface constant still names a real allowlist entry", () => {
    expect(Object.keys(ALLOWED_SURFACES_WITHOUT_OVERRIDE_REASON)).toContain(NOT_LIVE_SURFACE_FILE);
  });

  const derivedComponentName = deriveExportedComponentName(NOT_LIVE_SURFACE_FILE);

  it("derives a component name from the not-live surface's own AST", () => {
    // Anti-vacuity for the "zero importers" assertion below: a null/empty derived name would make
    // that assertion trivially true by matching nothing under src/, proving nothing about liveness.
    expect(derivedComponentName).toMatch(/^[A-Z]/);
  });

  it("zero files under src/ import the not-live surface's exported component", () => {
    const importers = derivedComponentName ? findImportersUnderSrc(derivedComponentName) : ["<derivation failed>"];
    expect(
      importers,
      importers.length === 0
        ? ""
        : `${NOT_LIVE_SURFACE_FILE}'s allowlist entry is safe only while nothing under src/ can reach ` +
            `it, but ${String(derivedComponentName)} is now imported under src/ by: ${importers.join(", ")}. ` +
            "That is the tour's stated exit condition: read its allowlist entry before deciding what to " +
            "do next — this guard only detects the change, it does not decide the response.",
    ).toEqual([]);
  });

  it("anti-vacuity: the same import probe DOES find a known-rendered component (ExceptionDrawer, imported by coordinator-screen.tsx)", () => {
    // Without this, a broken walker, a broken parser step, or an empty/misdirected file list would
    // report zero importers for EVERYTHING — including the not-live check above — and that false
    // "zero importers" would read as proof of safety instead of as a broken probe.
    const importers = findImportersUnderSrc("ExceptionDrawer");
    expect(
      importers.length,
      "findImportersUnderSrc found zero importers of ExceptionDrawer, which " +
        "coordinator-screen.tsx genuinely imports today — the probe itself is broken.",
    ).toBeGreaterThan(0);
    expect(importers).toContain("src/components/ward-management/coordinator/coordinator-screen.tsx");
  });
});
