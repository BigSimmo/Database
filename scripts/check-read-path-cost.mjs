#!/usr/bin/env node
/**
 * check-read-path-cost — refuse whole-corpus verification on a per-request read path.
 *
 * WHY THIS EXISTS (the incident it is built from)
 * ----------------------------------------------
 * Between 2026-09-09 and 2026-09-16 the live clinical site served every public
 * catalogue request from the database for the first time, and each one spent seconds
 * inside one function instead of milliseconds. The cause was one expression:
 * `read_site_content_public_records()` — the function behind every catalogue and
 * search read — re-derived `site_content_bootstrap_digest(r.id)`, a SHA-256 over the
 * ENTIRE release corpus, on every single call, purely to re-confirm that an immutable,
 * already-verified release still hashed to the value stored beside it.
 *
 * On the cost: what is MEASURED is a handful of browser probes against production on
 * 2026-09-16 — roughly 4.2 s for a catalogue read, 4.5–6.5 s across repeats, a 6.4 s
 * `?kind=service` list and a 4.6 s detail read whose body was about 8 KB. Treat that as
 * a range from a few probes, not a distribution. What is ESTABLISHED by reconstruction
 * and hash is the SHAPE and SIZE of the work: 843 rows, 9,522,923 canonical bytes,
 * 164,820 JSON nodes, canonicalised through a recursive plpgsql function twice per
 * call. What is INFERRED, and still unprofiled, is the step from node counts to
 * seconds: no `EXPLAIN (ANALYZE)` has been run against this function.
 * Full accounting: docs/audit/2026-09-16-catalogue-read-latency.md.
 *
 * Nothing caught it. The kind-filter regression on the same function was found
 * structurally only after a seven-day outage; this one was found by a human with a
 * browser, a week in. No test, no gate and no CI job measured what a read path costs.
 *
 * THE RULE THIS ENFORCES
 * ----------------------
 *   A read path may never re-verify the whole corpus.
 *   Verification of immutable data belongs at WRITE time, at MIGRATION time, or in
 *   the HEALTH CHECK — never on the request that a clinician is waiting for.
 *
 * Write time and migration time each pay the cost once, for data that cannot then
 * change. The health check pays it on a schedule nobody is blocked on. A read path
 * pays it per request, per user, forever, and gets the same answer every time.
 *
 * WHAT IT CHECKS
 * --------------
 * Statically, offline, with no database. It parses every `create function` body and
 * every `create [materialized] view` body in the SQL sources, builds the call graph
 * between them, works out which of them the application actually invokes, drops the
 * ones that write, and then refuses any remaining (read-path) object that can reach a
 * whole-corpus sink:
 *
 *   R1  a named whole-corpus digest helper (site_content_bootstrap_digest)
 *   R2  a hash call (site_content_json_sha256, site_content_canonical_json, digest,
 *       hmac, md5, crypt) fed a corpus-derived expression, anywhere in its closure
 *   R3  an aggregate over a corpus table that scans every row of it: no LIMIT bounds
 *       the scan and no equality predicate binds it to a specific row or key
 *
 * Reachability is TRANSITIVE on purpose: wrapping the digest in one more helper is
 * the obvious way this regression comes back, and a direct-call-only check would
 * wave it through.
 *
 * TWO SOURCES, CHECKED INDEPENDENTLY
 * ----------------------------------
 * `supabase/schema.sql` (the canonical mirror) and the `supabase/migrations/**` chain
 * are each reduced to a last-definition-wins index and checked separately, so neither
 * ordering assumption can hide a violation the other would have caught.
 *
 * WHAT IT DOES NOT CHECK
 * ----------------------
 * This gate is a tripwire on one shape, not a cost model. Read this list before
 * treating a green run as proof that a read path is cheap. Every item below is a
 * confirmed hole, not a hypothetical one.
 *
 *  - LATENCY. It does not measure anything. A static gate cannot. It refuses the SHAPE
 *    of work that made the request slow, which is the part reachable at review time on
 *    every PR. A measured budget needs a seeded corpus and a live Postgres; see
 *    docs/process-hardening.md § "Read paths never re-verify the whole corpus".
 *  - A READ PATH THAT ALSO WRITES IS DROPPED ENTIRELY. `writesData()` tests the
 *    object's own body for DML, and `findViolations()` skips any name whose every
 *    surviving definition writes. Adding one audit-log `insert` to a read RPC removes
 *    it from this gate permanently, and nothing reports that it has gone. The rule was
 *    chosen because transitive DML would mask genuine read paths, and the cost of that
 *    choice is this hole.
 *  - `CORPUS_TABLES` IS A HARDCODED LIST OF THREE. Nothing keeps it complete. A fourth
 *    corpus-sized table added next year is invisible to R2 and R3 until someone edits
 *    the list, and no test fails to remind them.
 *  - SQL THAT IS NOT A FUNCTION OR VIEW BODY IS NOT PARSED. An RLS `select` policy
 *    whose `using` clause calls a corpus-hashing function, a `generated always as (…)
 *    stored` column expression, a trigger's `when` clause, and a bare `do $$ … $$`
 *    block are all invisible. The RLS case is the dangerous one: it runs on every read
 *    of the table, for every role, and never appears in a function body.
 *  - A ROW SWEEP WITH NO AGGREGATE IS INVISIBLE. R3 keys off an aggregate call, so
 *    `not exists (select 1 from <corpus> where … <expensive per-row comparison>)` —
 *    root cause 4 of the audit, a third full pass over the same 9.5 MB — is not caught
 *    by anything here.
 *  - R3 IS DELIBERATELY BIASED TOWARDS PRECISION. Any equality predicate in the scan
 *    region counts as evidence that the scan is narrowed, whether or not the column is
 *    a key and whether or not an index exists; `min(col)`/`max(col)` of a bare column
 *    is never flagged. A gate that fires on a single-row `count(*)` gets allowlisted
 *    into uselessness, so recall was traded away on purpose. R1 and R2 are what stand
 *    between that trade and the incident shape.
 *  - DISCOVERY DEPENDS ON THE RPC NAME APPEARING AS A LITERAL. A name assembled at
 *    runtime — `` `read_${table}_records` ``, or a name concatenated inside dynamic SQL
 *    (`execute 'select ' || v_fn || '(...)'`) — is not discovered, so the function it
 *    names is classified as uninvoked and never checked. A dynamic-SQL call whose
 *    function name is written whole inside the string IS caught, because the literal
 *    is still there to match.
 *  - THE EXEMPTION LIST IS AN OFF SWITCH. One entry in `REVIEWED_EXEMPTIONS` disables
 *    every rule for that name. The pinned/exempt collision below is a hard failure for
 *    exactly that reason, and `tests/read-path-cost.test.ts` pins the exact set so any
 *    change to it is a deliberate, visible diff.
 *
 * Run: `npm run check:read-path-cost`. Self-test: `npm run check:read-path-cost -- --self-test`.
 * Blocking — runs in `verify:cheap:internal` and in CI (`.github/workflows/ci.yml`,
 * the "Read-path cost contract" step in `static-pr`).
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// Contract constants. Everything a reviewer needs to argue with lives here.
// ---------------------------------------------------------------------------

/**
 * Named helpers whose OWN PURPOSE is a digest of the whole corpus. Reaching one of
 * these from a read path is the September 2026 incident exactly.
 *
 * Only genuinely whole-corpus names belong here. `site_content_json_sha256` and
 * `site_content_canonical_json` deliberately do NOT: they hash whatever jsonb you
 * hand them, and a read path may legitimately hash three small scalars to derive an
 * id. They become a violation the moment they are fed a corpus aggregate, which the
 * derived classification below catches at the aggregation step instead of banning an
 * O(1) hash and training everyone to ignore this gate.
 */
export const WHOLE_CORPUS_HELPERS = new Set(["site_content_bootstrap_digest"]);

/** Hashers to watch: harmless on a scalar, whole-corpus work when fed a corpus expression. */
export const DIGEST_HELPERS = [
  "site_content_json_sha256",
  "site_content_canonical_json",
  "digest",
  "hmac",
  "md5",
  "crypt",
];

/** Tables that hold the corpus. An unbounded aggregate over one of these is a whole-corpus scan. */
export const CORPUS_TABLES = [
  "site_content_release_records",
  "site_content_publications",
  "site_content_public_records",
];

/**
 * Application trees whose string literals name the RPCs the request path can reach.
 * `supabase/functions` is in the list because the Deno edge functions are callers too:
 * `read_site_content_sync_event_plan` is invoked only from
 * supabase/functions/site-content-sync/index.ts, and without this root it was
 * classified as uninvoked and never checked.
 */
export const APP_SOURCE_ROOTS = ["src/app/api", "src/lib", "supabase/functions"];

/**
 * Read-path functions that are ALLOWED to verify the whole corpus, with the reason.
 * This is the reviewed escape hatch, and it is deliberately awkward: an entry must
 * name a function that still exists, or the gate fails on the lost anchor rather than
 * passing on an exemption that no longer means anything.
 *
 * An entry here is an OFF SWITCH, not a softening: `findViolations()` skips the name
 * before any rule runs. `tests/read-path-cost.test.ts` asserts this map's exact
 * contents, so adding or removing one cannot happen without a failing test and a
 * deliberate diff, and `pinnedExemptionFailures()` below refuses outright to let an
 * entry here cover a function in `PINNED_READ_PATHS`.
 */
export const REVIEWED_EXEMPTIONS = new Map([
  [
    "read_site_content_health",
    {
      reviewed: "2026-09-16",
      reason:
        "This IS the health check — the sanctioned third place for whole-corpus verification. It is never on a " +
        "user request path: src/lib/health-response.ts keeps it off readiness, and it is called with an " +
        "AbortSignal precisely because it is expected to be expensive.",
    },
  ],
]);

/**
 * Functions whose cleanliness is pinned by name. If one of these stops being a
 * discoverable read path, the gate reports the lost anchor instead of quietly
 * checking nothing — the failure mode every count/anchor guard in this repo fails
 * closed on.
 */
export const PINNED_READ_PATHS = ["read_site_content_public_records"];

/**
 * The largest `limit` that is evidence a corpus scan is bounded. A LIMIT only bounds
 * anything when it is a real numeric literal small enough to bound it: `limit all` is
 * a Postgres no-op, `limit p_count` is whatever the caller passes, and `limit 1000000`
 * is the whole corpus with extra steps. Before this check the rule tested for the WORD
 * `limit`, and all three of those silenced it.
 */
export const BOUNDED_LIMIT_MAX = 1000;

const AGGREGATE_CALL =
  /(?<![A-Za-z0-9_])(count|sum|avg|min|max|array_agg|jsonb_agg|json_agg|string_agg|bool_and|bool_or|jsonb_object_agg|every)\s*\(/gi;
const LIMIT_CLAUSE = /(?<![A-Za-z0-9_])limit\s+([A-Za-z0-9_]+)/gi;
/**
 * `<column> = <something>`, the shape that binds a scan to a specific row or key. The
 * identifier must sit immediately before the `=`, which is what keeps `>=`, `<=`, `<>`,
 * `!=` and plpgsql's `:=` out: in every one of those the character before the `=` is a
 * sigil, not an identifier character or whitespace following one.
 */
const BINDING_EQUALITY = /(?<![A-Za-z0-9_])(?:[a-z_][a-z0-9_]*\s*\.\s*)?[a-z_][a-z0-9_]*\s*=(?!=)\s*\S/i;
/** A bare (optionally qualified) column reference and nothing else. */
const BARE_COLUMN = /^\s*(?:[a-z_][a-z0-9_]*\s*\.\s*)?[a-z_][a-z0-9_]*\s*$/i;
const SELECT_KEYWORD = /(?<![A-Za-z0-9_])select(?![A-Za-z0-9_])/i;
const DML =
  /(?<![A-Za-z0-9_])(insert\s+into|update\s+[a-z_."]+\s+set|delete\s+from|merge\s+into|truncate\s+|refresh\s+materialized\s+view)/i;
const CORPUS_TABLE_REFERENCE = new RegExp(`(?<![A-Za-z0-9_])(${CORPUS_TABLES.join("|")})(?![A-Za-z0-9_])`, "i");

// ---------------------------------------------------------------------------
// SQL parsing
// ---------------------------------------------------------------------------

/** Strip `--` line comments and block comments so they cannot fake or hide a call. */
export function stripSqlComments(sql) {
  return String(sql)
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ");
}

/** Arity of a `create function` argument list: top-level commas + 1, or 0 when empty. */
function argumentArity(argText) {
  let depth = 0;
  let count = 0;
  let seen = false;
  for (const ch of argText) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === "," && depth === 0) count += 1;
    else if (!/\s/.test(ch)) seen = true;
  }
  return seen ? count + 1 : 0;
}

/** Read from `open` (index of "(") to its matching ")". Returns [inner, indexAfterClose]. */
function readBalanced(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")") {
      depth -= 1;
      if (depth === 0) return [text.slice(open + 1, i), i + 1];
    }
  }
  return [text.slice(open + 1), text.length];
}

/** Index of the closing `'` of the single-quoted string opening at `open` (`''` escapes). */
function skipSingleQuoted(sql, open) {
  for (let i = open + 1; i < sql.length; i++) {
    if (sql[i] !== "'") continue;
    if (sql[i + 1] === "'") {
      i += 1;
      continue;
    }
    return i;
  }
  return sql.length;
}

/** The dollar-quote tag opening at `at`, if one does. */
const dollarTagAt = (sql, at) => /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(at))?.[0] ?? null;

/**
 * Index just past the next top-level `keyword`, starting at `from`, skipping balanced
 * parens, single-quoted strings and dollar-quoted blocks. Returns -1 at the statement
 * terminator or the end of the text.
 *
 * This is how a body is located, rather than "the first `$` after the arguments":
 * `create function … as 'select …'` is legal SQL with no dollar quote at all, and the
 * old scan ran past it and took the NEXT function's `$$` as this one's body.
 */
function findTopLevelKeyword(sql, from, keyword) {
  let depth = 0;
  for (let i = from; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "(") {
      depth += 1;
    } else if (ch === ")") {
      depth -= 1;
    } else if (ch === "'") {
      i = skipSingleQuoted(sql, i);
    } else if (ch === "$") {
      const tag = dollarTagAt(sql, i);
      if (!tag) continue;
      const close = sql.indexOf(tag, i + tag.length);
      i = close < 0 ? sql.length : close + tag.length - 1;
    } else if (ch === ";" && depth === 0) {
      return -1;
    } else if (depth === 0 && /[A-Za-z_]/.test(ch)) {
      const word = /^[A-Za-z_][A-Za-z0-9_]*/.exec(sql.slice(i))[0];
      if (word.toLowerCase() === keyword) return i + word.length;
      i += word.length - 1;
    }
  }
  return -1;
}

/** The body that follows a routine's `as`: dollar-quoted, or a plain single-quoted string. */
function readBodyAfterAs(sql, from) {
  const start = from + /^\s*/.exec(sql.slice(from))[0].length;
  const tag = dollarTagAt(sql, start);
  if (tag) {
    const bodyStart = start + tag.length;
    const bodyEnd = sql.indexOf(tag, bodyStart);
    return bodyEnd < 0 ? null : sql.slice(bodyStart, bodyEnd);
  }
  if (sql[start] !== "'") return null;
  return sql.slice(start + 1, skipSingleQuoted(sql, start)).replace(/''/g, "'");
}

/** Index of the `;` that ends the statement beginning at `from` (a view has no quoted body). */
function findStatementEnd(sql, from) {
  let depth = 0;
  for (let i = from; i < sql.length; i++) {
    const ch = sql[i];
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
    else if (ch === "'") i = skipSingleQuoted(sql, i);
    else if (ch === ";" && depth === 0) return i;
  }
  return sql.length;
}

/**
 * Every `create [or replace] function` and every `create [materialized] view` in a SQL
 * text, in file order, plus their drops.
 *
 * Views are parsed into the SAME index as functions, and for the same reason
 * reachability is transitive: `create view corpus_integrity_v as select
 * site_content_json_sha256(jsonb_agg(rr.record)) … group by r.id`, joined into a read
 * function, is the incident wearing a different hat. Before views were parsed it was
 * invisible — and this schema already contains a view, so the shape is a real one here.
 *
 * Function bodies are dollar-quoted or single-quoted; a dollar-quoted close tag is
 * found by tag, so a nested `$guard$…$guard$` inside a `$$…$$` body is not mistaken for
 * the end. A view body runs from its `as` to the statement's `;`.
 */
export function parseSqlFunctions(sqlText) {
  const sql = stripSqlComments(sqlText);
  const events = [];
  const header = /\bcreate\s+(?:or\s+replace\s+)?function\s+(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)\s*\(/gi;
  for (const match of sql.matchAll(header)) {
    const open = match.index + match[0].length - 1;
    const [args, afterArgs] = readBalanced(sql, open);
    const afterAs = findTopLevelKeyword(sql, afterArgs, "as");
    if (afterAs < 0) continue;
    const body = readBodyAfterAs(sql, afterAs);
    if (body === null) continue;
    const between = sql.slice(afterArgs, afterAs);
    events.push({
      kind: "create",
      objectKind: "function",
      schema: match[1] ?? "public",
      name: match[2],
      arity: argumentArity(args),
      body,
      language: /\blanguage\s+([a-z]+)/i.exec(between)?.[1]?.toLowerCase() ?? "sql",
      volatility:
        /(?<![A-Za-z0-9_])(immutable|stable|volatile)(?![A-Za-z0-9_])/i.exec(between)?.[1]?.toLowerCase() ?? "volatile",
      securityDefiner: /\bsecurity\s+definer\b/i.test(between),
      offset: match.index,
    });
  }

  const viewHeader =
    /\bcreate\s+(?:or\s+replace\s+)?(?:temp(?:orary)?\s+)?(?:materialized\s+)?view\s+(?:if\s+not\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)(?![A-Za-z0-9_])/gi;
  for (const match of sql.matchAll(viewHeader)) {
    const afterAs = findTopLevelKeyword(sql, match.index + match[0].length, "as");
    if (afterAs < 0) continue;
    events.push({
      kind: "create",
      objectKind: "view",
      schema: match[1] ?? "public",
      name: match[2],
      arity: 0,
      body: sql.slice(afterAs, findStatementEnd(sql, afterAs)),
      language: "sql",
      volatility: "stable",
      securityDefiner: false,
      offset: match.index,
    });
  }

  const dropped = /\bdrop\s+function\s+(?:if\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)\s*\(/gi;
  for (const match of sql.matchAll(dropped)) {
    const [args] = readBalanced(sql, match.index + match[0].length - 1);
    events.push({
      kind: "drop",
      objectKind: "function",
      schema: match[1] ?? "public",
      name: match[2],
      arity: argumentArity(args),
      offset: match.index,
    });
  }
  const droppedView =
    /\bdrop\s+(?:materialized\s+)?view\s+(?:if\s+exists\s+)?(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)(?![A-Za-z0-9_])/gi;
  for (const match of sql.matchAll(droppedView)) {
    events.push({
      kind: "drop",
      objectKind: "view",
      schema: match[1] ?? "public",
      name: match[2],
      arity: 0,
      offset: match.index,
    });
  }
  return events.sort((a, b) => a.offset - b.offset);
}

/**
 * Key a definition by name + arity: `create or replace` replaces, an overload does not.
 * A view shares the namespace but has no arity, so it keys separately from any 0-arity
 * function of the same name.
 */
const definitionKey = (event) => `${event.schema}.${event.name}/${event.objectKind === "view" ? "view" : event.arity}`;

/**
 * Reduce ordered SQL sources to the definitions that survive. Last write wins per
 * key; a `drop function` removes it. Returns Map(name -> definitions[]) because the
 * sinks below are checked against EVERY surviving overload of a name, not just one.
 */
export function buildFunctionIndex(sources) {
  const live = new Map();
  for (const { label, sql } of sources) {
    for (const event of parseSqlFunctions(sql)) {
      const key = definitionKey(event);
      if (event.kind === "drop") live.delete(key);
      else live.set(key, { ...event, source: label });
    }
  }
  const byName = new Map();
  for (const definition of live.values()) {
    if (!byName.has(definition.name)) byName.set(definition.name, []);
    byName.get(definition.name).push(definition);
  }
  return byName;
}

/**
 * Names a definition's body reaches, restricted to objects we know about: functions by
 * their call syntax, and views by a bare mention, because a view is selected FROM
 * rather than called and would otherwise never appear in the call graph.
 */
export function calleesOf(definition, byName) {
  const called = new Set();
  for (const match of definition.body.matchAll(/(?<![A-Za-z0-9_])(?:([a-z_][a-z0-9_]*)\.)?([a-z_][a-z0-9_]*)\s*\(/g)) {
    const name = match[2];
    if (name !== definition.name && byName.has(name)) called.add(name);
  }
  for (const [name, definitions] of byName) {
    if (name === definition.name || called.has(name)) continue;
    if (!definitions.some((candidate) => candidate.objectKind === "view")) continue;
    if (new RegExp(`(?<![A-Za-z0-9_])${name}(?![A-Za-z0-9_])`, "i").test(definition.body)) called.add(name);
  }
  return called;
}

/** Every function reachable from `roots`, including the roots themselves. */
export function transitiveClosure(roots, byName) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length > 0) {
    const name = queue.pop();
    if (seen.has(name) || !byName.has(name)) continue;
    seen.add(name);
    for (const definition of byName.get(name)) {
      for (const callee of calleesOf(definition, byName)) if (!seen.has(callee)) queue.push(callee);
    }
  }
  return seen;
}

// ---------------------------------------------------------------------------
// Application-side discovery
// ---------------------------------------------------------------------------

function sourceFilesUnder(relativeDir) {
  const absolute = path.join(repoRoot, relativeDir);
  let entries;
  try {
    entries = readdirSync(absolute, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    const next = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) files.push(...sourceFilesUnder(next));
    else if (/\.(ts|tsx|mts|cts)$/.test(entry.name)) files.push(next);
  }
  return files;
}

/**
 * Function names the application names as string literals. Deliberately broader than
 * `.rpc("x")`: this repo already calls the incident function through a `callRpc`
 * wrapper, so anchoring on one call syntax would have missed the very function the
 * gate exists for. Any quoted literal that is also a known SQL function counts.
 */
export function discoverAppInvoked(byName, files) {
  const found = new Map();
  for (const { file, text } of files) {
    for (const match of text.matchAll(/["'`]([a-z][a-z0-9_]{3,})["'`]/g)) {
      const name = match[1];
      if (!byName.has(name)) continue;
      if (!found.has(name)) found.set(name, new Set());
      found.get(name).add(file);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// The rules
// ---------------------------------------------------------------------------

/** True when a definition itself writes. Own body only: transitive DML would MASK read paths. */
export function writesData(definition) {
  return DML.test(definition.body);
}

/**
 * Parenthesised groups enclosing `position`, innermost first, then the whole body.
 * Scoping the LIMIT test to the group that actually scans the corpus is what stops an
 * unrelated `limit 1` elsewhere in a long body from silencing the rule.
 */
function enclosingGroups(body, position) {
  const opens = [];
  const groups = [];
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "(") opens.push(i);
    else if (body[i] === ")") {
      const open = opens.pop();
      if (open === undefined) continue;
      if (open < position && i > position) groups.push({ open, text: body.slice(open + 1, i) });
    }
  }
  return [...groups.sort((a, b) => b.open - a.open), { open: -1, text: body }];
}

/**
 * `text` with every nested SUBQUERY blanked out, so a clause belonging to a different
 * query cannot be read as belonging to this one. Parenthesised groups that are not
 * subqueries — `(a = 1 or b = 2)`, `(*)`, a cast, an argument list — are kept, because
 * a predicate written inside them really does constrain this scan.
 */
function withoutSubqueries(text) {
  let out = "";
  let i = 0;
  while (i < text.length) {
    if (text[i] !== "(") {
      out += text[i];
      i += 1;
      continue;
    }
    const [inner, after] = readBalanced(text, i);
    out += SELECT_KEYWORD.test(inner) ? " " : `(${withoutSubqueries(inner)})`;
    i = after;
  }
  return out;
}

/** True when this scan's own query carries a real, small numeric `limit`. */
export function boundsScan(scanText) {
  for (const match of withoutSubqueries(scanText).matchAll(LIMIT_CLAUSE)) {
    if (!/^\d+$/.test(match[1])) continue; // `limit all`, `limit p_count`: bounds nothing.
    if (Number(match[1]) <= BOUNDED_LIMIT_MAX) return true;
  }
  return false;
}

/** True when this scan's own query carries an equality predicate binding it to a row or key. */
export function bindsScan(scanText) {
  return BINDING_EQUALITY.test(withoutSubqueries(scanText));
}

/**
 * The query an aggregate at `position` belongs to: the innermost enclosing group that
 * is itself a query, or the whole body.
 *
 * Attributing the aggregate to the innermost enclosing group that merely MENTIONS a
 * corpus table anywhere is wrong, and was wrong here: in `match_governed_candidate_chunks_v3`
 * a `jsonb_agg` over `document_labels` climbed past its own subquery to the whole body,
 * where a sibling CTE happens to read `site_content_public_records`, and was reported as
 * a whole-corpus scan of a table it never touches.
 */
function aggregateQuery(body, position) {
  return enclosingGroups(body, position).find((group) => group.open === -1 || SELECT_KEYWORD.test(group.text));
}

/**
 * For each corpus table named in `scopeText`, the query that actually scans it: the
 * innermost parenthesised group containing the reference, or the scope itself.
 *
 * Getting this from the TABLE rather than from the aggregate is what lets
 * `count(*) from (select 1 from <corpus> limit 50) t` be recognised as bounded — the
 * `limit` is in the subquery, which does not enclose the `count(`.
 */
function corpusScans(scopeText) {
  const scans = [];
  for (const match of scopeText.matchAll(new RegExp(CORPUS_TABLE_REFERENCE.source, "gi"))) {
    scans.push({ table: match[1], text: enclosingGroups(scopeText, match.index)[0].text });
  }
  return scans;
}

/** The balanced argument text of the call whose "(" is at `open`. */
function argumentAt(body, open) {
  let depth = 0;
  for (let i = open; i < body.length; i++) {
    if (body[i] === "(") depth += 1;
    else if (body[i] === ")") {
      depth -= 1;
      if (depth === 0) return body.slice(open + 1, i);
    }
  }
  return body.slice(open + 1);
}

/**
 * Why this definition's OWN body is whole-corpus work, if it is. Empty means it is not.
 *
 *   R1  it is a named whole-corpus digest helper
 *   R2  it hashes a corpus-derived expression (an aggregate, or a corpus table scan)
 *   R3  it aggregates over a corpus table in a query that scans every row of it
 *
 * R2 and R3 are derived from the SQL, not from a name list, so a brand-new helper
 * written next year is classified the same way without anyone remembering to list it.
 *
 * R3 requires the scan to be genuinely unfiltered, because the earlier "any aggregate
 * with no `limit` in scope" form was wrong in both directions. It flagged
 * `count(*) … where rr.id = p_id`, a single-row lookup by primary key; it flagged the
 * index-only `count(*)` against a stored expected count that
 * docs/site-content-sync-runbook.md explicitly permits on a read path; and it was
 * silenced by `limit 1000000`, by `limit all`, and by an unrelated `limit 1` in a
 * subquery that happened to sit in the same enclosing scope. See "WHAT IT DOES NOT
 * CHECK" above for what this precision costs in recall.
 */
export function wholeCorpusReasons(definition) {
  const reasons = [];
  if (WHOLE_CORPUS_HELPERS.has(definition.name)) {
    reasons.push({ rule: "R1", detail: `is ${definition.name}(), a digest of the entire corpus` });
  }
  const body = definition.body;

  for (const helper of DIGEST_HELPERS) {
    const call = new RegExp(`(?<![A-Za-z0-9_])(?:[a-z_]+\\.)?${helper}\\s*\\(`, "gi");
    for (const match of body.matchAll(call)) {
      const argument = argumentAt(body, match.index + match[0].length - 1);
      const aggregate = new RegExp(AGGREGATE_CALL.source, "i").exec(argument);
      const scansCorpus = CORPUS_TABLE_REFERENCE.test(argument);
      if (aggregate || scansCorpus) {
        reasons.push({
          rule: "R2",
          detail: `hashes a corpus-derived expression: ${helper}(${
            aggregate ? `… ${aggregate[1]}(…) …` : "… select from the corpus …"
          })`,
        });
        break;
      }
    }
  }

  for (const match of body.matchAll(AGGREGATE_CALL)) {
    const aggregate = match[1].toLowerCase();
    // min(col)/max(col) of a bare column returns one scalar and never materialises
    // corpus content; Postgres reads it from an index where one exists. Flagging it
    // would be noise, and R1/R2 still cover any hash built on top of one.
    if (
      (aggregate === "min" || aggregate === "max") &&
      BARE_COLUMN.test(argumentAt(body, match.index + match[0].length - 1))
    ) {
      continue;
    }
    const query = aggregateQuery(body, match.index);
    if (!query || !CORPUS_TABLE_REFERENCE.test(query.text)) continue;
    const unbounded = corpusScans(query.text).find((scan) => !boundsScan(scan.text) && !bindsScan(scan.text));
    if (!unbounded) continue;
    reasons.push({
      rule: "R3",
      detail:
        `aggregates ${aggregate}(…) over every row of ${unbounded.table} — no LIMIT of ` +
        `${BOUNDED_LIMIT_MAX} or less bounds the scan, and no equality predicate binds it to a row or key`,
    });
    break;
  }

  // One line per rule, whatever the body repeats.
  const unique = new Map();
  for (const reason of reasons) unique.set(reason.rule, reason);
  return [...unique.values()];
}

/**
 * The one-line disarm, refused unconditionally.
 *
 * An exemption is checked in `findViolations()` BEFORE any rule runs, and the pinned
 * anchor only asserts that its function is defined and discoverable — which an exempted
 * function still is. So a single entry naming `read_site_content_public_records` would
 * have left this gate reporting zero violations against the real pre-incident schema,
 * with every anchor satisfied and nothing to see in the output. Confirmed by review.
 *
 * The two lists therefore may never intersect. This is not a rule that can be suspended
 * for a source or waived by scope: if a pinned read path genuinely needs to verify the
 * whole corpus, it has stopped being the thing this gate pins, and PINNED_READ_PATHS is
 * what has to change — visibly, in the same diff, with the reason written down.
 */
export function pinnedExemptionFailures(pinned = PINNED_READ_PATHS, exemptions = REVIEWED_EXEMPTIONS) {
  return pinned
    .filter((name) => exemptions.has(name))
    .map(
      (name) =>
        `${name}() is in BOTH PINNED_READ_PATHS and REVIEWED_EXEMPTIONS in ` +
        `scripts/check-read-path-cost.mjs. An exemption short-circuits every rule for that name, and the ` +
        `pinned anchor is satisfied by a function that merely exists and is discoverable — so this pair turns ` +
        `the gate off for exactly the read path it was built to protect, while it still reports success. ` +
        `Remove the exemption. If that read path really must verify the whole corpus, remove it from ` +
        `PINNED_READ_PATHS instead, in the same change, and say why.`,
    );
}

/**
 * Violations for one SQL source. A violation is: an application-invoked, non-writing
 * function whose transitive closure contains whole-corpus work, and which is not a
 * reviewed exemption.
 */
export function findViolations({ byName, appInvoked, label, exemptions = REVIEWED_EXEMPTIONS }) {
  const violations = new Map();
  for (const [name, callers] of [...appInvoked].sort()) {
    if (exemptions.has(name)) continue;
    const definitions = byName.get(name) ?? [];
    const readable = definitions.filter((definition) => !writesData(definition));
    if (readable.length === 0) continue;
    for (const reached of [...transitiveClosure([name], byName)].sort()) {
      for (const reachedDefinition of byName.get(reached) ?? []) {
        for (const reason of wholeCorpusReasons(reachedDefinition)) {
          violations.set(`${label}|${name}|${reason.rule}|${reached}`, {
            source: label,
            readPath: name,
            via: reached === name ? null : reached,
            rule: reason.rule,
            detail: reason.detail,
            calledFrom: [...callers].sort().slice(0, 3),
          });
        }
      }
    }
  }
  return [...violations.values()];
}

function formatViolation(violation) {
  const hop = violation.via ? ` -> ${violation.via}()` : "";
  return [
    `  ${violation.source}: ${violation.readPath}()${hop} ${violation.detail}  [${violation.rule}]`,
    `    reached from ${violation.calledFrom.join(", ")}`,
  ].join("\n");
}

const FAILURE_EXPLANATION = [
  "",
  "A read path may never re-verify the whole corpus.",
  "",
  "Every listed function is called on a request a clinician is waiting for, and every one of",
  "them can reach a hash or an unbounded scan over the entire corpus. That is the defect that",
  "took psychiatry.tools from instant to seconds per catalogue request between 2026-09-09 and",
  "2026-09-16 — a handful of browser probes measured 4.5-6.5 s — and it went unnoticed for the",
  "week it lasted, because nothing measured what a read path costs.",
  "",
  "Verification of immutable data has three correct homes, and this is none of them:",
  "  - WRITE time     — verify once, when the data is created, inside the writing function.",
  "  - MIGRATION time — verify once, in a guard migration, when the shape changes.",
  "  - the HEALTH CHECK — read_site_content_health(), which nobody's request is blocked on.",
  "",
  "Fix it by moving the check to one of those three, or by storing the verified result so the",
  "read path compares two stored values instead of recomputing one. Do NOT add an exemption",
  "unless the function genuinely is one of those three homes; REVIEWED_EXEMPTIONS in",
  "scripts/check-read-path-cost.mjs is for that case and records why.",
  "",
  "Background: docs/process-hardening.md § 'Read paths never re-verify the whole corpus'.",
].join("\n");

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

function migrationSources() {
  const dir = path.join(repoRoot, "supabase/migrations");
  let names;
  try {
    names = readdirSync(dir).filter((name) => name.endsWith(".sql"));
  } catch {
    return [];
  }
  return names.sort().map((name) => ({ label: "migrations", sql: readFileSync(path.join(dir, name), "utf8") }));
}

export function runGate({ schemaSql, migrations, appFiles } = {}) {
  const schema = schemaSql ?? readFileSync(path.join(repoRoot, "supabase/schema.sql"), "utf8");
  const chain = migrations ?? migrationSources();
  const files =
    appFiles ??
    APP_SOURCE_ROOTS.flatMap((root) => sourceFilesUnder(root)).map((file) => ({
      file,
      text: readFileSync(path.join(repoRoot, file), "utf8"),
    }));

  // Unconditional, and first: it is the one defect that makes every result below a lie.
  const failures = [...pinnedExemptionFailures()];
  const violations = [];
  const checked = [];

  for (const [label, sources] of [
    ["supabase/schema.sql", [{ label: "supabase/schema.sql", sql: schema }]],
    ["supabase/migrations", chain],
  ]) {
    if (sources.length === 0) continue;
    const byName = buildFunctionIndex(sources);
    const appInvoked = discoverAppInvoked(byName, files);
    checked.push({ label, functions: byName.size, readPaths: appInvoked.size });

    // Fail closed on a lost anchor before trusting a clean result.
    for (const pinned of PINNED_READ_PATHS) {
      if (!byName.has(pinned)) {
        failures.push(
          `${label}: pinned read path ${pinned}() is no longer defined. The gate lost its anchor — restore the ` +
            `function, or update PINNED_READ_PATHS in scripts/check-read-path-cost.mjs to name its replacement.`,
        );
      } else if (!appInvoked.has(pinned)) {
        failures.push(
          `${label}: pinned read path ${pinned}() is defined but no longer reachable from ${APP_SOURCE_ROOTS.join(
            " or ",
          )}. Either the application stopped calling it, or the discovery in discoverAppInvoked() no longer sees ` +
            `how it is called — in which case this gate is checking nothing and must be repaired.`,
        );
      }
    }
    for (const [name] of REVIEWED_EXEMPTIONS) {
      if (!byName.has(name)) {
        failures.push(
          `${label}: REVIEWED_EXEMPTIONS names ${name}(), which no longer exists. Remove the stale exemption.`,
        );
      }
    }
    violations.push(...findViolations({ byName, appInvoked, label }));
  }

  return { ok: failures.length === 0 && violations.length === 0, failures, violations, checked };
}

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------

// A miniature, deliberately CLEAN corpus. Every case below appends its own offender,
// so a fixture can never quietly satisfy another case's expectation.
const SELF_TEST_BASE = `
create or replace function public.site_content_canonical_json(p_value jsonb) returns text language sql immutable as $$
  select p_value::text;
$$;
create or replace function public.site_content_json_sha256(p_value jsonb) returns text language sql immutable as $$
  select encode(extensions.digest(convert_to(public.site_content_canonical_json(p_value), 'UTF8'), 'sha256'), 'hex');
$$;
create or replace function public.site_content_bootstrap_digest(p_release_id uuid) returns text language sql stable as $$
  select public.site_content_json_sha256(jsonb_agg(rr.record order by rr.logical_id))
  from public.site_content_release_records rr where rr.release_id = p_release_id;
$$;
create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
  select rr.record from public.site_content_release_records rr where rr.kind = p_kind;
$$;
create or replace function public.read_bounded(p_kind text) returns bigint language sql stable as $$
  select count(*) from (select 1 from public.site_content_release_records limit 50) t;
$$;
create or replace function public.read_quoted_body(p_kind text) returns setof jsonb language sql stable
  as 'select rr.record from public.site_content_release_records rr where rr.kind = p_kind';
create or replace function public.write_catalogue(p_record jsonb) returns void language plpgsql as $$
begin
  insert into public.site_content_release_records(record) values (p_record);
end;
$$;
create or replace function public.read_site_content_public_records(p_kind text, p_slug text) returns setof jsonb
language sql stable as $$ select rr.record from public.site_content_release_records rr where rr.kind = p_kind; $$;
create or replace function public.read_site_content_health() returns jsonb language sql stable as $$
  select to_jsonb(count(*)) from public.site_content_release_records;
$$;
`;

const SELF_TEST_APP_FILES = [
  {
    file: "src/lib/fake/read.ts",
    text: `await callRpc(client, "read_catalogue", a); await client.rpc("write_catalogue", a);
           await client.rpc("read_bounded", a); await client.rpc("read_site_content_health", {});
           await client.rpc("read_site_content_public_records", a);
           await client.rpc("read_quoted_body", a); await client.from("corpus_integrity_v").select("*");`,
  },
];

/** Each case asserts one rule the gate must hold. Returns {name, pass, detail}[]. */
export function selfTestCases() {
  const cases = [];
  const check = (name, extraSql, expectation) => {
    const sql = SELF_TEST_BASE + (extraSql ?? "");
    const byName = buildFunctionIndex([{ label: "self-test", sql }]);
    const appInvoked = discoverAppInvoked(byName, SELF_TEST_APP_FILES);
    const violations = findViolations({ byName, appInvoked, label: "self-test" });
    const result = expectation(violations, byName);
    cases.push({ name, pass: result === true, detail: result === true ? "" : String(result) });
  };
  const flagged = (violations, readPath, rule) =>
    violations.some((v) => v.readPath === readPath && (rule === undefined || v.rule === rule));
  const show = (violations) => JSON.stringify(violations);

  check("the clean fixture corpus produces no violations", "", (violations) =>
    violations.length === 0 ? true : `clean corpus flagged: ${show(violations)}`,
  );

  check(
    "PLANTED: the September 2026 incident itself — a whole-corpus digest on the read path",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select rr.record from public.site_content_release_records rr
       join public.site_content_releases r on r.id = rr.release_id
       where r.release_digest = public.site_content_bootstrap_digest(r.id);
     $$;`,
    (violations) =>
      violations.some((v) => v.readPath === "read_catalogue" && v.via === "site_content_bootstrap_digest") ||
      `the incident shape was not caught: ${show(violations)}`,
  );

  check(
    "PLANTED: the same digest hidden one hop away in an innocent-looking helper",
    `create or replace function public.release_is_intact(p_id uuid, p_digest text) returns boolean language sql stable as $$
       select p_digest = public.site_content_bootstrap_digest(p_id);
     $$;
     create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select rr.record from public.site_content_release_records rr
       join public.site_content_releases r on r.id = rr.release_id
       where public.release_is_intact(r.id, r.release_digest);
     $$;`,
    (violations) =>
      violations.some((v) => v.readPath === "read_catalogue" && v.via === "site_content_bootstrap_digest") ||
      `a digest one hop away escaped: ${show(violations)}`,
  );

  check(
    "PLANTED: hashing an aggregate inline, without any named helper",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select public.site_content_json_sha256(jsonb_agg(rr.record))::jsonb
       from public.site_content_release_records rr;
     $$;`,
    (violations) =>
      flagged(violations, "read_catalogue", "R2") || `inline hash of an aggregate escaped: ${show(violations)}`,
  );

  check(
    "PLANTED: raw crypto over a corpus scan, with no repository helper at all",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select encode(extensions.digest(
         (select string_agg(rr.record::text, ',') from public.site_content_release_records rr), 'sha256'), 'hex')::jsonb;
     $$;`,
    (violations) => flagged(violations, "read_catalogue") || `raw digest over the corpus escaped: ${show(violations)}`,
  );

  check(
    "PRECISION: an O(1) hash of a few scalars on a read path is NOT a violation",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select rr.record from public.site_content_release_records rr
       where rr.release_id = public.site_content_json_sha256(
         jsonb_build_object('kind', p_kind, 'version', 'v1'))::uuid;
     $$;`,
    (violations) =>
      flagged(violations, "read_catalogue")
        ? `a constant-cost hash was wrongly flagged — this gate would be noise: ${show(violations)}`
        : true,
  );

  check(
    "write paths may verify the whole corpus — that is one of the three correct homes",
    `create or replace function public.write_catalogue(p_record jsonb) returns void language plpgsql as $$
     begin
       insert into public.site_content_release_records(record) values (p_record);
       perform public.site_content_bootstrap_digest(gen_random_uuid());
     end;
     $$;`,
    (violations) => (flagged(violations, "write_catalogue") ? `write path wrongly flagged: ${show(violations)}` : true),
  );

  check(
    "the health check may verify the whole corpus — the reviewed exemption holds",
    `create or replace function public.read_site_content_health() returns jsonb language sql stable as $$
       select to_jsonb(public.site_content_bootstrap_digest(gen_random_uuid()));
     $$;`,
    (violations) =>
      flagged(violations, "read_site_content_health") ? `exempt health check flagged: ${show(violations)}` : true,
  );

  check(
    "PLANTED: an unbounded aggregate over every row of a corpus table on a read path",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select to_jsonb((select count(*) from public.site_content_release_records rr));
     $$;`,
    (violations) => flagged(violations, "read_catalogue", "R3") || `unbounded aggregate escaped: ${show(violations)}`,
  );

  check(
    "PRECISION: an unrelated LIMIT in a sibling subquery does not silence the rule",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select to_jsonb((select count(*) from public.site_content_release_records rr))
       from (select 1 limit 1) unrelated;
     $$;`,
    (violations) =>
      flagged(violations, "read_catalogue", "R3") || `an unrelated LIMIT silenced the rule: ${show(violations)}`,
  );

  check(
    "BYPASS REFUSED: a LIMIT inside a subquery of the scanning query does not bound the scan",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select to_jsonb((select count(*) from public.site_content_release_records rr
         cross join (select 1 limit 1) unrelated));
     $$;`,
    (violations) =>
      flagged(violations, "read_catalogue", "R3") || `a subquery LIMIT bounded the wrong scan: ${show(violations)}`,
  );

  check(
    "BYPASS REFUSED: `limit 1000000` is the whole corpus with extra steps",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select to_jsonb((select count(*) from (select 1 from public.site_content_release_records limit 1000000) t));
     $$;`,
    (violations) =>
      flagged(violations, "read_catalogue", "R3") || `an enormous LIMIT counted as a bound: ${show(violations)}`,
  );

  check(
    "BYPASS REFUSED: `limit all` is a Postgres no-op, not a bound",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select to_jsonb((select count(*) from (select 1 from public.site_content_release_records limit all) t));
     $$;`,
    (violations) =>
      flagged(violations, "read_catalogue", "R3") || `\`limit all\` counted as a bound: ${show(violations)}`,
  );

  check(
    "BYPASS REFUSED: a caller-supplied LIMIT bounds nothing the gate can see",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select to_jsonb((select count(*) from (select 1 from public.site_content_release_records limit p_kind::int) t));
     $$;`,
    (violations) =>
      flagged(violations, "read_catalogue", "R3") || `a parameterised LIMIT counted as a bound: ${show(violations)}`,
  );

  check("read_bounded's LIMIT-bounded aggregate stays allowed", "", (violations) =>
    flagged(violations, "read_bounded") ? `bounded aggregate wrongly flagged: ${show(violations)}` : true,
  );

  // R3's five confirmed false positives, one case each. Every one of these is a shape a
  // read path is allowed to have, and the old rule refused all five.
  const precise = (name, sql) =>
    check(`PRECISION: ${name} is not whole-corpus work`, sql, (violations) =>
      flagged(violations, "read_catalogue", "R3") ? `wrongly flagged: ${show(violations)}` : true,
    );

  precise(
    "a count(*) of one row by primary key",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select to_jsonb((select count(*) from public.site_content_release_records rr where rr.id = p_kind::uuid));
     $$;`,
  );
  precise(
    "a max() of a bare scalar column",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select to_jsonb((select max(head_change_epoch) from public.site_content_public_records));
     $$;`,
  );
  precise(
    "a single-document detail read collecting one logical id",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select jsonb_agg(rr.record) from public.site_content_release_records rr where rr.logical_id = p_kind;
     $$;`,
  );
  precise(
    "a count(*) narrowed by kind",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select to_jsonb((select count(*) from public.site_content_publications where kind = p_kind));
     $$;`,
  );
  precise(
    "the index-only count(*) against a stored expected count that the runbook permits",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select to_jsonb((select r.expected_record_count = (
         select count(*) from public.site_content_release_records rr where rr.release_id = r.id)
         from public.site_content_releases r where r.id = p_kind::uuid));
     $$;`,
  );
  precise(
    "a bool_and() over one release's rows",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select to_jsonb((select bool_and(rr.public_visible) from public.site_content_release_records rr
         where rr.release_id = p_kind::uuid));
     $$;`,
  );

  check(
    "a later create-or-replace supersedes an earlier offending definition",
    `create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select to_jsonb(public.site_content_bootstrap_digest(gen_random_uuid()));
     $$;
     create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select rr.record from public.site_content_release_records rr where rr.kind = p_kind;
     $$;`,
    (violations) =>
      flagged(violations, "read_catalogue") ? `superseded definition still flagged: ${show(violations)}` : true,
  );

  check(
    "a function the application never calls is not a read path",
    `create or replace function public.offline_audit() returns text language sql stable as $$
       select public.site_content_bootstrap_digest(gen_random_uuid());
     $$;`,
    (violations) => (flagged(violations, "offline_audit") ? "an uninvoked function was treated as a read path" : true),
  );

  check(
    "PLANTED: the digest hidden in a VIEW the read path joins",
    `create view public.corpus_integrity_v as
       select r.id, public.site_content_json_sha256(jsonb_agg(rr.record)) digest
       from public.site_content_releases r
       join public.site_content_release_records rr on rr.release_id = r.id
       group by r.id;
     create or replace function public.read_catalogue(p_kind text) returns setof jsonb language sql stable as $$
       select rr.record from public.site_content_release_records rr
       join public.corpus_integrity_v v on v.id = rr.release_id;
     $$;`,
    (violations) =>
      violations.some((v) => v.readPath === "read_catalogue" && v.via === "corpus_integrity_v") ||
      `a view in the call graph was invisible: ${show(violations)}`,
  );

  check(
    "PLANTED: a whole-corpus digest inside a SINGLE-QUOTED function body",
    `create or replace function public.read_quoted_body(p_kind text) returns setof jsonb language sql stable
       as 'select to_jsonb(public.site_content_bootstrap_digest(gen_random_uuid()))';`,
    (violations) =>
      violations.some((v) => v.readPath === "read_quoted_body" && v.via === "site_content_bootstrap_digest") ||
      `a single-quoted body was not parsed: ${show(violations)}`,
  );

  cases.push({
    name: "a pinned read path can never be exempted — the one-line disarm is refused",
    ...(() => {
      const failures = pinnedExemptionFailures(
        ["read_site_content_public_records"],
        new Map([["read_site_content_public_records", { reviewed: "never", reason: "disarm attempt" }]]),
      );
      const pass = failures.length === 1 && failures[0].includes("turns the gate off");
      return { pass, detail: pass ? "" : `expected a pinned/exempt refusal, got: ${JSON.stringify(failures)}` };
    })(),
  });

  cases.push({
    name: "the shipped PINNED_READ_PATHS and REVIEWED_EXEMPTIONS do not intersect",
    ...(() => {
      const failures = pinnedExemptionFailures();
      return { pass: failures.length === 0, detail: failures.join(" | ") };
    })(),
  });

  // The anchor guards run in runGate(), not findViolations(), so they are exercised there.
  const anchorRun = (schemaSql, appFiles) => runGate({ schemaSql, migrations: [], appFiles }).failures.join(" | ");

  cases.push({
    name: "fails closed when the pinned read path disappears from the schema",
    ...(() => {
      const failures = anchorRun(
        SELF_TEST_BASE.replace(/read_site_content_public_records/g, "gone"),
        SELF_TEST_APP_FILES,
      );
      const pass = failures.includes("lost its anchor");
      return { pass, detail: pass ? "" : `expected a lost-anchor failure, got: ${failures || "(none)"}` };
    })(),
  });

  cases.push({
    name: "fails closed when the application stops naming the pinned read path",
    ...(() => {
      const failures = anchorRun(SELF_TEST_BASE, [{ file: "src/lib/fake/read.ts", text: `"read_catalogue"` }]);
      const pass = failures.includes("no longer reachable");
      return { pass, detail: pass ? "" : `expected an unreachable-anchor failure, got: ${failures || "(none)"}` };
    })(),
  });

  cases.push({
    name: "fails closed when a reviewed exemption names a function that no longer exists",
    ...(() => {
      const failures = anchorRun(
        SELF_TEST_BASE.replace(/read_site_content_health/g, "retired_health"),
        SELF_TEST_APP_FILES,
      );
      const pass = failures.includes("stale exemption");
      return { pass, detail: pass ? "" : `expected a stale-exemption failure, got: ${failures || "(none)"}` };
    })(),
  });

  return cases;
}

function runSelfTest() {
  const cases = selfTestCases();
  for (const testCase of cases) {
    console.log(
      `  ${testCase.pass ? "ok  " : "FAIL"} ${testCase.name}${testCase.pass ? "" : `\n       ${testCase.detail}`}`,
    );
  }
  const failed = cases.filter((testCase) => !testCase.pass);
  if (failed.length > 0) {
    console.error(`read-path-cost self-test: ${failed.length} of ${cases.length} cases FAILED.`);
    return 1;
  }
  console.log(`read-path-cost self-test OK: ${cases.length}/${cases.length} cases pass.`);
  return 0;
}

export function main(argv = process.argv.slice(2)) {
  if (argv.includes("--self-test")) return runSelfTest();

  const { ok, failures, violations, checked } = runGate();
  for (const { label, functions, readPaths } of checked) {
    console.log(
      `read-path-cost: ${label} — ${functions} functions and views, ${readPaths} reachable from the application.`,
    );
  }
  if (failures.length > 0) {
    console.error("read-path-cost: the gate could not verify what it claims to verify:");
    for (const failure of failures) console.error(`  - ${failure}`);
  }
  if (violations.length > 0) {
    console.error("read-path-cost: WHOLE-CORPUS WORK ON A PER-REQUEST READ PATH");
    for (const violation of violations) console.error(formatViolation(violation));
    console.error(FAILURE_EXPLANATION);
  }
  if (!ok) return 1;
  console.log(
    `read-path-cost OK: no application read path can reach a whole-corpus digest or an unbounded corpus aggregate ` +
      `(${REVIEWED_EXEMPTIONS.size} reviewed exemption(s)).`,
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
