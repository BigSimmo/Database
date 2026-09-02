// Mechanical tenancy scanner (audit finding D2 / M6, extended 2026-09-02 for the five
// blind spots recorded in docs/audit/tenancy-defense-in-depth-review.md §6 item 2).
//
// WHY THIS EXISTS
// ---------------
// Migration 20260719070000_align_existing_acls revokes every privilege on every public
// base table from `public`, `anon` and `authenticated` and re-grants only `service_role`
// (supabase/roles.sql makes that the default for future objects). That is deliberate and
// is pinned by tests/supabase-schema.test.ts. Its consequence is that the ~30 RLS policies
// written TO `authenticated` can never be evaluated: every read path uses the
// RLS-bypassing admin client (createAdminClient), so **application code is the only
// tenancy boundary**. One missing owner predicate has nothing behind it.
//
// This module is the mechanical half of that boundary. It is imported by BOTH
// scripts/check-owner-scope-api.mjs (npm run check:owner-scope → verify:cheap + CI) and
// tests/retrieval-owner-filter-guard.test.ts, so the two guards cannot drift apart.
//
// THE THREE TABLE TIERS (derived from src/lib/supabase/database.types.ts, never hand-listed)
//   direct      — the row itself carries `owner_id`
//   user-keyed  — the row carries `user_id` and no `owner_id` (account-scoped tables;
//                 withOwnerReadScope is unusable there because it filters `owner_id`)
//   derived     — the row carries `document_id` and neither owner column, so ownership
//                 runs document_id -> documents.owner_id. These join-through tables hold
//                 the actual document text and images and were invisible to both guards
//                 before this module existed.
// A queried table that lands in NONE of the three (a tenancy column under a fourth name, the way
// `clinical_quality_feedback_triage` carries `owner_user_id`) gets no per-chain rule at all, so it
// must be declared in UNTIERED_TABLE_DECLARATIONS with a reason or the scan fails. That fourth
// signal exists because such a table previously got zero coverage with zero signal.
//
// SCOPE IS ATTRIBUTED PER QUERY CHAIN, NOT PER FUNCTION. The older guards asked whether a
// sanctioned token appeared anywhere in the enclosing function, so a handler that scoped
// query 1 and forgot query 2 passed. Here the predicate must sit on the same fluent chain
// as the `.from("table")` call (or that chain must be handed to a sanctioned wrapper).
// Genuinely indirect scoping is a DECLARED exemption naming its proof — that is the point.
//
// FILE SET. Every `.ts` under `src/app/api` plus an explicit NAMED list of server-side read
// modules (SCANNED_LIB_MODULES). A named list, not a glob over `src/lib/**`, so the
// boundary is a deliberate decision and the scan never acquires authority over
// `src/lib/rag/**` (a protected ranking surface — see AGENTS.md "RAG ranking protection").
//
// OUT OF SCOPE BY DECISION, not by oversight:
//   worker/**   — the ingestion worker runs job-scoped as service_role against rows it
//                 claimed through claim_ingestion_jobs; its tenancy model is "the job row
//                 names the document", not "the request names the owner".
//   scripts/**  — operator tooling run by a human with the service key; it is deliberately
//                 cross-tenant (reindex, eval, governance sweeps).
//   supabase/functions/** — Deno edge functions, same job-scoped model as the worker.
// Adding any of those here would require a different ownership model, not a wider glob.

import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

import ts from "@typescript/typescript6";

/* ------------------------------------------------------------------ file set */

/**
 * Server-side read modules outside `src/app/api` that serve owner data to a page or a
 * route. Deliberately enumerated one by one; see the header note on why this is not a glob.
 */
export const SCANNED_LIB_MODULES = [
  // Serves the server component src/app/(search-app)/documents/[id]/page.tsx as well as
  // the /api/documents/[id] route.
  "src/lib/document-detail.ts",
  // Serves the five src/app/(search-app)/sources/** pages.
  "src/lib/sources/document-source-loader.ts",
  // Operator observability aggregates read by /api/health's deep probe.
  "src/lib/observability/answer-slo.ts",
  "src/lib/observability/spend-metrics.ts",
];

export const API_DIR_SEGMENTS = ["src", "app", "api"];

function toPosix(value) {
  return value.split(sep).join("/");
}

/** Every `.ts` file under `src/app/api` (not just `route.ts`), plus SCANNED_LIB_MODULES. */
export function scannedFiles(repoRoot) {
  const apiDir = join(repoRoot, ...API_DIR_SEGMENTS);
  const apiFiles = readdirSync(apiDir, { recursive: true })
    .map((entry) => String(entry))
    .filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".d.ts"))
    .map((name) => join(apiDir, name));
  const libFiles = SCANNED_LIB_MODULES.map((name) => join(repoRoot, ...name.split("/")));
  return [...apiFiles, ...libFiles].sort();
}

export function relativeToRepo(repoRoot, file) {
  return toPosix(relative(repoRoot, file));
}

/* -------------------------------------------------------------- table tiers */

/**
 * Classify every generated table in src/lib/supabase/database.types.ts into the three
 * tenancy tiers. Generalises the older `ownerIdTablesFromDatabaseTypes()`; the parse is
 * bounded to the `public.Tables` block so RPC (`Functions`) entries cannot be mistaken
 * for tables.
 */
export function tableTiersFromDatabaseTypes(text) {
  const lines = text.split(/\r?\n/);
  const direct = new Set();
  const userKeyed = new Set();
  const derived = new Set();
  const all = new Set();

  let inPublic = false;
  let inTables = false;
  let table = null;
  let inRow = false;
  let columns = null;

  const flush = () => {
    if (!table || !columns) return;
    all.add(table);
    if (columns.has("owner_id")) direct.add(table);
    else if (columns.has("user_id")) userKeyed.add(table);
    else if (columns.has("document_id")) derived.add(table);
    table = null;
    columns = null;
  };

  for (const line of lines) {
    if (/^  public: \{$/.test(line)) {
      inPublic = true;
      continue;
    }
    if (!inPublic) continue;
    if (/^    Tables: \{$/.test(line)) {
      inTables = true;
      continue;
    }
    if (/^    (Views|Functions|Enums|CompositeTypes): /.test(line)) {
      flush();
      inTables = false;
      inPublic = false;
      continue;
    }
    if (!inTables) continue;

    const tableMatch = line.match(/^      ([a-z0-9_]+): \{$/);
    if (tableMatch) {
      flush();
      table = tableMatch[1];
      columns = new Set();
      inRow = false;
      continue;
    }
    if (!table) continue;
    if (/^        Row: \{$/.test(line)) {
      inRow = true;
      continue;
    }
    if (/^        (Insert|Update|Relationships): /.test(line)) {
      inRow = false;
      continue;
    }
    if (!inRow) continue;
    const column = line.match(/^          ([a-z0-9_]+)\??:/);
    if (column) columns.add(column[1]);
  }
  flush();

  // NOTE: a tenancy column under a FOURTH name (the way `clinical_quality_feedback_triage`
  // carries `owner_user_id`) puts its table in `all` and in no tier — which is exactly what
  // the untiered-table declaration list exists to surface. Renaming `owner_id`,`user_id` or
  // `document_id` on an existing table would likewise drop it out of its tier silently, and
  // the untiered list would then be the only thing that notices.
  return { direct, userKeyed, derived, all };
}

/* ------------------------------------------------------------- AST helpers */

const OWNER_COLUMNS = new Set(["owner_id", "documents.owner_id"]);
const USER_COLUMNS = new Set(["user_id"]);

function isStringLiteral(node) {
  return Boolean(node) && ts.isStringLiteralLike(node);
}

/* --------------------------------------------- PostgREST `or=` disjunctions (P1-2) */

/**
 * Split a PostgREST filter string on its TOP-LEVEL commas, keeping `and(...)` / `or(...)`
 * groups intact. The one real producer of this shape, `withOwnerReadScope`
 * (src/lib/public-api-access.ts), emits exactly such a nested filter:
 *   `owner_id.eq.<uuid>,and(owner_id.is.null,metadata->>public_corpus.eq.true)`
 */
function splitTopLevelTerms(filter) {
  const terms = [];
  let depth = 0;
  let current = "";
  for (const character of filter) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      terms.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  terms.push(current);
  return terms.map((term) => term.trim()).filter((term) => term.length > 0);
}

/** Does one term of a PostgREST filter restrict `column`? */
function termConstrainsColumn(term, column) {
  const group = term.match(/^(and|or)\(([\s\S]*)\)$/);
  if (group) {
    const inner = splitTopLevelTerms(group[2]);
    if (inner.length === 0) return false;
    // A conjunction is restricted as soon as ONE of its terms restricts the column; a
    // nested disjunction only when EVERY one of its terms does. Anything else — a `not.`
    // prefix in particular — falls through to the literal test below and fails closed.
    return group[1] === "and"
      ? inner.some((part) => termConstrainsColumn(part, column))
      : inner.every((part) => termConstrainsColumn(part, column));
  }
  return new RegExp(`^${column}\\.(eq|is)\\.`).test(term);
}

/**
 * PostgREST `or=` is a DISJUNCTION, so a single owner term restricts nothing unless every
 * alternative restricts. Before 2026-09-02 any literal merely CONTAINING `owner_id.eq.` or
 * `owner_id.is.` counted as an owner proof, which accepted
 * `.or("owner_id.is.null,status.eq.indexed")` and `.or("owner_id.eq.<uuid>,id.eq.abc")` —
 * both of which return other tenants' rows (security review P1-2).
 */
export function orFilterConstrainsColumn(filter, column) {
  const terms = splitTopLevelTerms(filter);
  return terms.length > 0 && terms.every((term) => termConstrainsColumn(term, column));
}

/* ------------------------------- sanctioned wrappers / owning helpers (P2-4) */

/**
 * Helpers whose call proves the caller owns the document id it was handed, mapped to the
 * module an import of that name must come from — or `null` when the name has no sanctioned
 * module and must therefore be a FILE-LOCAL definition that itself carries an owner
 * predicate. All four are file-local in this repo today (`loadOwnedDocument` is a local
 * function in src/app/api/documents/[id]/table-facts/route.ts), so the idiom is normalised
 * and matching on identifier TEXT alone would let a local no-op of the same name vouch for
 * a query it never scoped.
 */
export const OWNING_DOCUMENT_HELPERS = new Map([
  ["requireOwnedDocument", null],
  ["loadOwnedDocument", null],
  ["ownedDocumentId", null],
  ["ownedDocumentExists", null],
]);

/** Wrappers that apply the owner predicate to a query builder passed as their first argument. */
export const SANCTIONED_QUERY_WRAPPERS = new Map([["withOwnerReadScope", /(?:^|\/)public-api-access$/]]);

/** The parameter or property name that carries the document id in an owning-helper call. */
const DOCUMENT_ID_PARAMETER = /^document_?id$/i;

/** Strip wrappers that do not change the value an expression denotes. */
function unwrapExpression(node) {
  let current = node;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isNonNullExpression(current) ||
      (typeof ts.isSatisfiesExpression === "function" && ts.isSatisfiesExpression(current)))
  ) {
    current = current.expression;
  }
  return current;
}

/** Local name -> module specifier for every import in this file. */
function importedNames(sourceFile) {
  const imports = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !isStringLiteral(statement.moduleSpecifier)) continue;
    const specifier = statement.moduleSpecifier.text;
    if (statement.importClause?.name) imports.set(statement.importClause.name.text, specifier);
    const bindings = statement.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) imports.set(element.name.text, specifier);
    }
    if (bindings && ts.isNamespaceImport(bindings)) imports.set(bindings.name.text, specifier);
  }
  return imports;
}

/** Every function-like declaration of `name` in this file. */
function localFunctionDeclarations(sourceFile, name) {
  const declarations = [];
  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name && node.body) declarations.push(node);
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
    ) {
      declarations.push(node.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return declarations;
}

/** Does this subtree apply an owner predicate to a query builder? */
function containsOwnerPredicate(node) {
  let found = false;
  const visit = (current) => {
    if (found || !current) return;
    if (ts.isCallExpression(current) && ts.isPropertyAccessExpression(current.expression)) {
      const method = current.expression.name.text;
      const [first] = current.arguments;
      if (
        (method === "eq" || method === "in" || method === "is") &&
        isStringLiteral(first) &&
        OWNER_COLUMNS.has(first.text)
      ) {
        found = true;
        return;
      }
      if (method === "or" && isStringLiteral(first) && orFilterConstrainsColumn(first.text, "owner_id")) {
        found = true;
        return;
      }
    }
    ts.forEachChild(current, visit);
  };
  visit(node);
  return found;
}

/**
 * Resolve the sanctioned wrapper and owning-helper names available in ONE source file. A
 * name counts only when it is imported from its sanctioned module, or defined in this file
 * by a declaration that itself carries an owner predicate. Identifier text is never enough.
 */
export function resolveSanctionedNames(sourceFile) {
  const imports = importedNames(sourceFile);
  const wrappers = new Set();
  const helpers = new Map();

  const owningLocalDeclarations = (name) => {
    const declarations = localFunctionDeclarations(sourceFile, name);
    if (declarations.length === 0) return null;
    return declarations.every((declaration) => containsOwnerPredicate(declaration)) ? declarations : null;
  };
  const importSatisfies = (specifier, modulePattern) =>
    Boolean(modulePattern) && modulePattern.test(specifier.replace(/\.[cm]?[tj]sx?$/, ""));

  for (const [name, modulePattern] of SANCTIONED_QUERY_WRAPPERS) {
    const specifier = imports.get(name);
    if (specifier !== undefined) {
      if (importSatisfies(specifier, modulePattern)) wrappers.add(name);
      continue;
    }
    if (owningLocalDeclarations(name)) wrappers.add(name);
  }

  for (const [name, modulePattern] of OWNING_DOCUMENT_HELPERS) {
    const specifier = imports.get(name);
    if (specifier !== undefined) {
      // An imported helper's parameter names are not visible here, so only a
      // `documentId:`-keyed object argument can register an owning-document argument.
      if (importSatisfies(specifier, modulePattern)) helpers.set(name, { parameters: [] });
      continue;
    }
    const declarations = owningLocalDeclarations(name);
    if (!declarations) continue;
    helpers.set(name, {
      parameters: declarations[0].parameters.map((parameter) =>
        ts.isIdentifier(parameter.name) ? parameter.name.text : null,
      ),
    });
  }

  return { wrappers, helpers };
}

/** Walk OUTWARD from `.from(...)` to the top of the fluent chain that contains it. */
function chainTop(node) {
  let current = node;
  while (current.parent) {
    const parent = current.parent;
    if (
      (ts.isPropertyAccessExpression(parent) ||
        ts.isCallExpression(parent) ||
        ts.isNonNullExpression(parent) ||
        ts.isParenthesizedExpression(parent)) &&
      parent.expression === current
    ) {
      current = parent;
      continue;
    }
    break;
  }
  return current;
}

/** Walk INWARD over the chain's method calls, newest first. */
function chainMethodCalls(top) {
  const calls = [];
  let current = top;
  while (current) {
    if (ts.isCallExpression(current)) {
      if (ts.isPropertyAccessExpression(current.expression)) {
        calls.push({ name: current.expression.name.text, args: current.arguments, node: current });
        current = current.expression.expression;
        continue;
      }
      current = current.expression;
      continue;
    }
    if (
      ts.isPropertyAccessExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isParenthesizedExpression(current)
    ) {
      current = current.expression;
      continue;
    }
    break;
  }
  return calls;
}

/** The nearest enclosing function-like node that has a derivable name; else the source file. */
function enclosingNamedScope(node) {
  let current = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
    if (ts.isMethodDeclaration(current) && current.name && ts.isIdentifier(current.name)) return current.name.text;
    if (
      (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) &&
      current.parent &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current.parent.name.text;
    }
    current = current.parent;
  }
  return "<module>";
}

/** Every enclosing named scope, innermost first — a `.rpc()` inside a nested arrow still
 * belongs to the exported function that contains it. */
function enclosingNamedScopeChain(node) {
  const scopes = [];
  let current = node.parent;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) scopes.push(current.name.text);
    else if (ts.isMethodDeclaration(current) && current.name && ts.isIdentifier(current.name))
      scopes.push(current.name.text);
    else if (
      (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) &&
      current.parent &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      scopes.push(current.parent.name.text);
    }
    current = current.parent;
  }
  return scopes;
}

/** The nearest enclosing function-like NODE (named or not) — used for same-scope fact lookup. */
function enclosingNamedScopeNode(node) {
  let current = node.parent;
  let fallback = null;
  while (current) {
    if (ts.isSourceFile(current)) return fallback ?? current;
    if (ts.isFunctionDeclaration(current) && current.name) return current;
    if (ts.isMethodDeclaration(current) && current.name && ts.isIdentifier(current.name)) return current;
    if (
      (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) &&
      current.parent &&
      ts.isVariableDeclaration(current.parent) &&
      ts.isIdentifier(current.parent.name)
    ) {
      return current;
    }
    if (!fallback && ts.isFunctionLike(current)) fallback = current;
    current = current.parent;
  }
  return fallback;
}

/**
 * The identifier a filter value is rooted at, with trailing method applications stripped:
 * `ownedIds.slice(i, i + 100)` -> `ownedIds`, `args.documentId` -> `args.documentId`,
 * `documents.map((d) => d.id)` -> `documents`. This is what lets an inventory entry name
 * the SAME identifier the ownership proof pinned and have that identity checked in the AST
 * rather than trusted from a reason string.
 */
function valueExpressionText(node) {
  if (!node) return null;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isStringLiteralLike(node)) return JSON.stringify(node.text);
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    return valueExpressionText(node.expression.expression);
  }
  if (ts.isPropertyAccessExpression(node)) return node.getText();
  if (ts.isNonNullExpression(node) || ts.isParenthesizedExpression(node)) return valueExpressionText(node.expression);
  return null;
}

/**
 * Does this expression stamp `owner_id:` / `user_id:` as a TOP-LEVEL property of the row(s)
 * it writes? Deliberately bounded: the previous implementation recursed the entire argument
 * subtree, so an `owner_id` key buried inside a JSON `metadata` column counted as a stamp
 * (security review P1-1). An array must stamp EVERY element; a `.map()`/`.flatMap()` must
 * stamp every row its callback returns.
 */
function expressionStampsColumn(node, columns) {
  const expression = unwrapExpression(node);
  if (!expression) return false;
  if (ts.isObjectLiteralExpression(expression)) {
    return expression.properties.some((property) => {
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) return false;
      const name = property.name;
      const text = ts.isIdentifier(name) ? name.text : ts.isStringLiteralLike(name) ? name.text : null;
      return Boolean(text && columns.has(text));
    });
  }
  if (ts.isArrayLiteralExpression(expression)) {
    return (
      expression.elements.length > 0 && expression.elements.every((element) => expressionStampsColumn(element, columns))
    );
  }
  if (ts.isCallExpression(expression) && ts.isPropertyAccessExpression(expression.expression)) {
    const method = expression.expression.name.text;
    if (method === "map" || method === "flatMap") {
      const callback = expression.arguments.find(
        (argument) => ts.isArrowFunction(argument) || ts.isFunctionExpression(argument),
      );
      if (callback) return callbackReturnsStampedRow(callback, columns);
    }
  }
  return false;
}

/** Every row a `.map()` callback can return must carry the stamp. */
function callbackReturnsStampedRow(callback, columns) {
  if (!callback.body) return false;
  if (!ts.isBlock(callback.body)) return expressionStampsColumn(callback.body, columns);
  let sawReturn = false;
  let allStamped = true;
  const visit = (node) => {
    if (ts.isFunctionLike(node)) return;
    if (ts.isReturnStatement(node)) {
      sawReturn = true;
      if (!node.expression || !expressionStampsColumn(node.expression, columns)) allStamped = false;
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(callback.body, visit);
  return sawReturn && allStamped;
}

/**
 * The initializer of `identifier`, resolved LEXICALLY: the nearest enclosing function scope
 * first (without descending into nested functions), then a top-level `const` at module
 * scope. The previous implementation walked the whole file for any variable of that name,
 * so two handlers sharing a common identifier (`rows`, `payload`, `record`) collided and an
 * owner-stamped variable in helper A vouched for `rows = body.rows` in handler B
 * (security review P2-3).
 */
function lexicalInitializer(sourceFile, identifier) {
  const name = identifier.text;
  const inScope = (scopeNode) => {
    let found = null;
    const visit = (node) => {
      if (found) return;
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name && node.initializer) {
        found = node.initializer;
        return;
      }
      if (ts.isFunctionLike(node) || ts.isClassLike(node)) return;
      ts.forEachChild(node, visit);
    };
    ts.forEachChild(scopeNode, visit);
    return found;
  };

  let current = identifier.parent;
  while (current && !ts.isSourceFile(current)) {
    if (ts.isFunctionLike(current)) {
      const found = inScope(current);
      if (found) return found;
    }
    current = current.parent;
  }
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.name.text === name && declaration.initializer) {
        return declaration.initializer;
      }
    }
  }
  return null;
}

/**
 * Resolve a write-payload argument. A literal object (or array/`map` of them) is read
 * directly; a plain identifier is resolved through `lexicalInitializer` so the very common
 * "build the rows above, then `.upsert(rows)`" idiom is still recognised as stamping the
 * owner column rather than forced into an exemption it does not need.
 */
function payloadStampsColumn(sourceFile, argument, columns) {
  if (!argument) return false;
  if (expressionStampsColumn(argument, columns)) return true;
  const identifier = unwrapExpression(argument);
  if (!identifier || !ts.isIdentifier(identifier)) return false;
  const initializer = lexicalInitializer(sourceFile, identifier);
  return Boolean(initializer) && expressionStampsColumn(initializer, columns);
}

/* ---------------------------------------------------------- chain analysis */

/**
 * Inspect one `.from("table")` chain and report which tenancy predicates ride on it.
 * Recognised in-chain forms, all of which exist in this codebase:
 *   .eq("owner_id", x) / .eq("user_id", x) / .eq("documents.owner_id", x)
 *   .is("owner_id", null)
 *   .or("…") where EVERY top-level disjunct constrains the column
 *   an owner_id:/user_id: key at the top level of an .insert()/.upsert() payload
 * plus the chain being handed to a sanctioned wrapper: withOwnerReadScope(chain, ownerId).
 */
function analyzeChain(sourceFile, fromCall, context) {
  const top = chainTop(fromCall);
  const calls = chainMethodCalls(top);
  const proofs = [];
  let documentFilter = null;
  let idFilter = null;
  let innerJoinsDocuments = false;

  for (const call of calls) {
    const [first, second] = call.args;
    if ((call.name === "eq" || call.name === "in") && isStringLiteral(first)) {
      const column = first.text;
      if (OWNER_COLUMNS.has(column)) proofs.push(`${call.name}:${column}`);
      if (USER_COLUMNS.has(column)) proofs.push(`${call.name}:${column}`);
      if (column === "document_id") documentFilter = { method: call.name, argument: valueExpressionText(second) };
      if (column === "id") idFilter = { method: call.name, argument: valueExpressionText(second) };
    }
    if (call.name === "is" && isStringLiteral(first) && OWNER_COLUMNS.has(first.text)) {
      proofs.push(`is:${first.text}`);
    }
    if (call.name === "or" && isStringLiteral(first)) {
      if (orFilterConstrainsColumn(first.text, "owner_id")) proofs.push("or:owner_id");
      if (orFilterConstrainsColumn(first.text, "user_id")) proofs.push("or:user_id");
    }
    if (call.name === "select" && isStringLiteral(first) && /documents!inner/.test(first.text)) {
      innerJoinsDocuments = true;
    }
    // `insert`/`upsert` create the row already owned, so an `owner_id:` key in the payload
    // IS the tenancy fact. `update` is deliberately ABSENT: there the key is the value
    // WRITTEN, and says nothing about which rows are matched —
    // `.update({ owner_id: user.id, title })` with no filter reassigns every tenant's rows
    // to the caller, and was reported as ownerScoped before 2026-09-02 (security review
    // P1-1). An update is scoped by its `.eq(...)` filters or not at all.
    if (call.name === "insert" || call.name === "upsert") {
      if (payloadStampsColumn(sourceFile, first, new Set(["owner_id"]))) proofs.push(`${call.name}:owner_id`);
      if (payloadStampsColumn(sourceFile, first, new Set(["user_id"]))) proofs.push(`${call.name}:user_id`);
    }
  }

  // The chain handed straight to withOwnerReadScope(chain, ownerId).
  const parent = top.parent;
  if (
    parent &&
    ts.isCallExpression(parent) &&
    parent.arguments[0] === top &&
    ts.isIdentifier(parent.expression) &&
    context.wrappers.has(parent.expression.text)
  ) {
    proofs.push(`wrapper:${parent.expression.text}`);
  }

  return { proofs, documentFilter, idFilter, innerJoinsDocuments };
}

const OWNER_PROOF = /^(eq|in|is):(owner_id|documents\.owner_id)$|^(insert|upsert):owner_id$|^or:owner_id$|^wrapper:/;
const USER_PROOF = /^(eq|in):user_id$|^(insert|upsert):user_id$|^or:user_id$/;

/* --------------------------------------------------------- scope-level facts */

/**
 * Facts about one enclosing scope that a derived-tier query may lean on for its ownership
 * proof: which identifiers were pinned by an owner-scoped `documents` query, which were
 * handed to an owning-document helper, and which are locally declared.
 */
function scopeFacts(sourceFile, scopeNode, context) {
  const ownerScopedDocumentIds = new Set();
  const owningHelperArguments = new Set();
  const localDeclarations = new Set();
  let hasOwnerScopedDocumentsQuery = false;

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "from" &&
      node.arguments.length === 1 &&
      isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === "documents"
    ) {
      const chain = analyzeChain(sourceFile, node, context);
      if (chain.proofs.some((proof) => OWNER_PROOF.test(proof))) {
        hasOwnerScopedDocumentsQuery = true;
        if (chain.idFilter?.argument) ownerScopedDocumentIds.add(chain.idFilter.argument);
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && context.helpers.has(node.expression.text)) {
      // Only the DOCUMENT-ID-shaped argument registers. Collecting every identifier and
      // shorthand argument meant `loadOwnedDocument({ supabase, documentId: id })`
      // registered `supabase` as an owning-document argument too (security review P2-4).
      const helper = context.helpers.get(node.expression.text);
      node.arguments.forEach((argument, index) => {
        const value = unwrapExpression(argument);
        if (!value) return;
        if (ts.isObjectLiteralExpression(value)) {
          for (const property of value.properties) {
            if (ts.isShorthandPropertyAssignment(property) && DOCUMENT_ID_PARAMETER.test(property.name.text)) {
              owningHelperArguments.add(property.name.text);
            } else if (
              ts.isPropertyAssignment(property) &&
              ts.isIdentifier(property.name) &&
              DOCUMENT_ID_PARAMETER.test(property.name.text) &&
              ts.isIdentifier(property.initializer)
            ) {
              owningHelperArguments.add(property.initializer.text);
            }
          }
          return;
        }
        // A positional call is resolved against the helper's own parameter names, which is
        // possible only because the helper resolved to a file-local definition.
        if (ts.isIdentifier(value) && DOCUMENT_ID_PARAMETER.test(helper.parameters[index] ?? "")) {
          owningHelperArguments.add(value.text);
        }
      });
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) localDeclarations.add(node.name.text);
    ts.forEachChild(node, visit);
  };
  if (scopeNode) visit(scopeNode);

  return { ownerScopedDocumentIds, owningHelperArguments, localDeclarations, hasOwnerScopedDocumentsQuery };
}

/* ------------------------------------------------------------------- scan */

/**
 * Scan one source file and return every table query site with its per-chain tenancy
 * verdict. `tiers` comes from tableTiersFromDatabaseTypes.
 */
export function analyzeSource({ relativePath, source, tiers }) {
  const sourceFile = ts.createSourceFile(
    relativePath,
    source,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS,
  );
  const sites = [];
  const factsCache = new Map();
  const context = resolveSanctionedNames(sourceFile);
  // Every table the generated types declare. A table that lands in NO tenancy tier gets no
  // coverage at all from the three tiers, so it must be declared rather than pass silently
  // (security review P2-5).
  const allTables = tiers.all ?? new Set([...tiers.direct, ...tiers.userKeyed, ...tiers.derived]);

  const factsFor = (node) => {
    const scopeNode = enclosingNamedScopeNode(node) ?? sourceFile;
    if (!factsCache.has(scopeNode)) factsCache.set(scopeNode, scopeFacts(sourceFile, scopeNode, context));
    return factsCache.get(scopeNode);
  };

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "from" &&
      node.arguments.length === 1 &&
      isStringLiteral(node.arguments[0])
    ) {
      const table = node.arguments[0].text;
      const tier = tiers.direct.has(table)
        ? "direct"
        : tiers.userKeyed.has(table)
          ? "user-keyed"
          : tiers.derived.has(table)
            ? "derived"
            : allTables.has(table)
              ? "untiered"
              : null;
      if (tier) {
        const chain = analyzeChain(sourceFile, node, context);
        sites.push({
          file: relativePath,
          table,
          tier,
          scope: enclosingNamedScope(node),
          line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
          proofs: chain.proofs,
          ownerScopedChain: chain.proofs.some((proof) => OWNER_PROOF.test(proof)),
          userScopedChain: chain.proofs.some((proof) => USER_PROOF.test(proof)),
          documentFilter: chain.documentFilter,
          innerJoinsDocuments: chain.innerJoinsDocuments,
          facts: factsFor(node),
        });
      }
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return sites;
}

/* --------------------------------------------------- dynamic RPC dispatch */

export const DYNAMIC_RPC_DISPATCHER = {
  file: "src/lib/rag/rag-candidate-sources.ts",
  fn: "callVersionedRetrievalRpc",
};

/**
 * The primary retrieval RPCs never appear as `.rpc("literal")` — they go through
 * `callVersionedRetrievalRpc(supabase, versionedName, legacyName, args, signal)`, which
 * also rewrites `owner_filter` to PUBLIC_OWNER_FILTER_SENTINEL on the public-merge
 * fallback path. Tenancy for the whole retrieval layer therefore sits in that ONE
 * function, and a second dynamic dispatch site would move it somewhere unreviewed.
 *
 * Returns every `.rpc()` whose first argument is not a string literal, and every
 * `callVersionedRetrievalRpc` call site whose two RPC-name arguments are not literals.
 */
export function analyzeRpcDispatch({ relativePath, source }) {
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const dynamicRpcCalls = [];
  const dispatcherCallSites = [];

  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "rpc" &&
      node.arguments.length > 0 &&
      !isStringLiteral(node.arguments[0])
    ) {
      dynamicRpcCalls.push({
        file: relativePath,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        scope: enclosingNamedScope(node),
        scopes: enclosingNamedScopeChain(node),
        argument: node.arguments[0].getText(sourceFile),
      });
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === DYNAMIC_RPC_DISPATCHER.fn
    ) {
      const [, versioned, legacy] = node.arguments;
      dispatcherCallSites.push({
        file: relativePath,
        line: sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1,
        literalNames: isStringLiteral(versioned) && isStringLiteral(legacy),
        names: [versioned?.getText(sourceFile) ?? "<missing>", legacy?.getText(sourceFile) ?? "<missing>"],
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return { dynamicRpcCalls, dispatcherCallSites };
}

/** Every `.ts`/`.tsx` file under `src`, excluding declaration and generated type files. */
export function allSourceFiles(repoRoot) {
  const srcDir = join(repoRoot, "src");
  return readdirSync(srcDir, { recursive: true })
    .map((entry) => String(entry))
    .filter((name) => /\.tsx?$/.test(name) && !name.endsWith(".d.ts") && !name.includes("database.types"))
    .map((name) => join(srcDir, name))
    .sort();
}

export function readFile(file) {
  return readFileSync(file, "utf8");
}

/* ------------------------------------------------- declared tenancy proofs */

// How an entry proves ownership. The first FIVE are VERIFIED IN THE AST — the entry names an
// identifier and the scanner checks that the very same identifier carries the proof — so the
// reason string cannot drift away from the code. `reviewed-indirect` is the escape hatch for links
// no AST check can express; it carries a written reason and nothing else, which is why it is used
// as sparingly as possible. `untiered-table` is declaration-only by construction: a table carrying
// no tenancy column has no ownership relation for a proof to check.
//
// All five mechanical proofs are ORDER-INSENSITIVE: scopeFacts scans the whole enclosing scope, so
// a proof is satisfied by an ownership query that runs AFTER the protected read or whose result is
// discarded. The "a 404 is returned before this query" clauses below are prose, not checked —
// recorded as a residual gap in docs/audit/tenancy-defense-in-depth-review.md §6.
export const PROOF_KINDS = {
  // The query's own chain joins `documents!inner` and filters `documents.owner_id`.
  DOCUMENTS_INNER_JOIN: "documents-inner-join",
  // `identifier` is filtered as document_id here AND was the id an owner-scoped
  // `documents` query pinned (`.eq("id", identifier)`) in the same scope.
  OWNER_PINNED_DOCUMENT_ID: "owner-pinned-document-id",
  // `identifier` is filtered as document_id here AND was handed to an owning-document
  // helper (requireOwnedDocument / loadOwnedDocument / ownedDocumentId / ownedDocumentExists).
  OWNED_DOCUMENT_HELPER: "owned-document-helper",
  // `identifier` is filtered as document_id here, is declared in this scope, and this
  // scope runs an owner-scoped `documents` query the list is derived from.
  OWNER_SCOPED_ID_LIST: "owner-scoped-id-list",
  // The row is read first and its parent document is verified afterwards by an
  // owner-scoped `documents` query in the same scope; nothing is returned until it passes.
  PARENT_DOCUMENT_VERIFIED: "parent-document-verified",
  // No mechanical link is expressible. Written reason only.
  REVIEWED_INDIRECT: "reviewed-indirect",
  // The table carries none of the three tenancy columns, so no tier covers it at all and no
  // mechanical proof is even definable. Declaration-only, and the declaration is the signal.
  UNTIERED_TABLE: "untiered-table",
};

const CLINICAL_QUALITY_REASON =
  "Administrator-gated cross-tenant governance aggregate. GET and PATCH call authorizeAndLimit before these helpers run and the response carries governance metadata only — never raw question, answer, excerpt, or patient text. Per-owner filtering would defeat the oversight purpose (tenancy review §6).";
const SETUP_STATUS_REASON =
  "Local-origin-gated setup/health existence probe. It returns status booleans and counts only, never owner rows, so a fresh deployment can diagnose missing setup before any corpus exists (tenancy review §3 / TEN-N1).";

/**
 * Direct-tier (`owner_id`) and user-keyed (`user_id`) queries whose predicate is NOT on the
 * query chain. Every entry names its proof; the mechanical kinds are re-checked in the AST.
 */
export const SCOPE_EXEMPTIONS = [
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "rag_answer_feedback",
    fn: "loadClinicalQualitySnapshot",
    queries: 2,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: CLINICAL_QUALITY_REASON,
  },
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "clinical_registry_record_sources",
    fn: "loadClinicalQualitySnapshot",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: CLINICAL_QUALITY_REASON,
  },
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "clinical_registry_records",
    fn: "loadClinicalQualitySnapshot",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: CLINICAL_QUALITY_REASON,
  },
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "rag_retrieval_logs",
    fn: "loadClinicalQualitySnapshot",
    queries: 2,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: CLINICAL_QUALITY_REASON,
  },
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "rag_answer_feedback",
    fn: "verifyQualitySignal",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: CLINICAL_QUALITY_REASON,
  },
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "rag_retrieval_logs",
    fn: "verifyQualitySignal",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: CLINICAL_QUALITY_REASON,
  },
  {
    file: "src/app/api/documents/[id]/labels/route.ts",
    table: "document_labels",
    fn: "selectLabels",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason:
      "In-file read helper that never runs before requireOwnedDocument has resolved for the same document id; it consumes an owner-authorized capability id rather than entering from a request. Moving it to another module or route drops this entry and forces a fresh tenancy review.",
  },
  {
    file: "src/app/api/documents/[id]/route.ts",
    table: "storage_cleanup_jobs",
    fn: "updateStorageCleanupJob",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason:
      "Closes out a cleanup ledger row by the cleanupJobId the same DELETE handler created moments earlier for an owner-verified document; the id is never request-supplied. Moving it out of this file drops this entry.",
  },
  {
    file: "src/app/api/documents/[id]/table-facts/route.ts",
    table: "document_table_facts",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.OWNER_PINNED_DOCUMENT_ID,
    identifier: "id",
    reason:
      "Facts are listed for the document id that withOwnerReadScope already resolved in this handler; a 404 is returned before this query when the caller does not own (or publicly share) that document.",
  },
  {
    file: "src/app/api/documents/route.ts",
    table: "document_labels",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.OWNER_SCOPED_ID_LIST,
    identifier: "ownedIds",
    reason:
      "Labels are batched over ownedIds, the subset of the withOwnerReadScope document page the caller actually owns (callerOwnsDocumentRow). No id reaches this query that the owner-scoped list query did not return.",
  },
  {
    file: "src/app/api/documents/route.ts",
    table: "document_labels",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.OWNER_SCOPED_ID_LIST,
    identifier: "publicDocumentIds",
    reason:
      "Labels are batched over publicDocumentIds — the null-owner rows of the same withOwnerReadScope page, which are the deliberately shared public corpus — and read through the redacted PUBLIC_LABEL_LIST_COLUMNS projection.",
  },
  {
    file: "src/app/api/documents/route.ts",
    table: "document_summaries",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.OWNER_SCOPED_ID_LIST,
    identifier: "ownedIds",
    reason:
      "Summaries are batched over ownedIds, the subset of the withOwnerReadScope document page the caller actually owns (callerOwnsDocumentRow).",
  },
  {
    file: "src/app/api/documents/route.ts",
    table: "document_summaries",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.OWNER_SCOPED_ID_LIST,
    identifier: "publicDocumentIds",
    reason:
      "Summaries are batched over publicDocumentIds — the null-owner rows of the same withOwnerReadScope page — through the redacted PUBLIC_SUMMARY_LIST_COLUMNS projection.",
  },
  {
    file: "src/app/api/ingestion/quality/route.ts",
    table: "document_index_quality",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.OWNER_SCOPED_ID_LIST,
    identifier: "documentIds",
    reason:
      'Quality rows are read by `.in("document_id", documentIds)` where documentIds comes from the `.eq("owner_id", user.id)` documents query at the top of the same handler, and the handler returns early when that list is empty. This is the canonical per-function-attribution case the chain-level rule exposed: it is safe, but it was previously passing by accident rather than by review.',
  },
  {
    file: "src/app/api/setup-status/route.ts",
    table: "documents",
    fn: "readSchemaStatus",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: SETUP_STATUS_REASON,
  },
  {
    file: "src/app/api/setup-status/route.ts",
    table: "import_batches",
    fn: "readSchemaStatus",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: SETUP_STATUS_REASON,
  },
  {
    file: "src/app/api/setup-status/route.ts",
    table: "storage_cleanup_jobs",
    fn: "readSchemaStatus",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: SETUP_STATUS_REASON,
  },
  {
    file: "src/lib/document-detail.ts",
    table: "document_table_facts",
    fn: "loadAuthorizedDocumentDetail",
    queries: 1,
    proof: PROOF_KINDS.OWNER_PINNED_DOCUMENT_ID,
    identifier: "id",
    reason:
      "Child tables are read for the document id withOwnerReadScope already resolved at the top of this loader; it throws a 404 PublicApiError before any child query when the row is not visible to the caller.",
  },
  {
    file: "src/lib/document-detail.ts",
    table: "document_labels",
    fn: "loadAuthorizedDocumentDetail",
    queries: 1,
    proof: PROOF_KINDS.OWNER_PINNED_DOCUMENT_ID,
    identifier: "id",
    reason: "Same owner-resolved document id as the loader's other child reads; 404 is thrown before any child query.",
  },
  {
    file: "src/lib/document-detail.ts",
    table: "document_summaries",
    fn: "loadAuthorizedDocumentDetail",
    queries: 1,
    proof: PROOF_KINDS.OWNER_PINNED_DOCUMENT_ID,
    identifier: "id",
    reason: "Same owner-resolved document id as the loader's other child reads; 404 is thrown before any child query.",
  },
  {
    file: "src/lib/observability/answer-slo.ts",
    table: "rag_queries",
    fn: "base",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason:
      "Deliberate cross-tenant operator aggregate: a head-only `count` of answered queries in the trailing window, reached only from /api/health's deep probe behind HEALTH_DEEP_PROBE_SECRET. It returns counts, never rows. Owner filtering would make the answer SLO blind to every tenant but the prober.",
  },
  {
    file: "src/lib/observability/answer-slo.ts",
    table: "rag_queries",
    fn: "answerSloSnapshot",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason:
      "Deliberate cross-tenant operator aggregate: reads only `metadata` for rows carrying a hybrid_rpc_errors map, to name which retrieval RPC degraded. Same HEALTH_DEEP_PROBE_SECRET gate; no query text, answer text, or owner identity leaves the probe.",
  },
  {
    file: "src/lib/observability/spend-metrics.ts",
    table: "rag_retrieval_logs",
    fn: "spendSnapshot",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason:
      "Deliberate cross-tenant operator aggregate: reads `query_class` and token counters from answer-path metadata to price the trailing window, behind the same HEALTH_DEEP_PROBE_SECRET gate. Per-owner spend is not the question being asked and no row content is returned.",
  },
  {
    file: "src/lib/sources/document-source-loader.ts",
    table: "documents",
    fn: "createDocumentSourceQuery",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason:
      "Factory that returns an UNEXECUTED PostgREST builder. Its only consumer, loadVisibleDocumentSourceReferences, wraps it in withOwnerReadScope(query, viewerId) before awaiting it, so no caller can execute the unscoped builder. The indirection is a dependency-injection seam for tests; if a second consumer ever executes the builder directly this entry must be revisited.",
  },
];

/**
 * Every query against a join-through (derived-tier) table. These tables carry the document
 * text and images and have no owner column at all, so nothing about them is self-evident:
 * each site must be listed here with the proof that ownership was established.
 */
export const DERIVED_QUERY_INVENTORY = [
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "source_review_events",
    fn: "loadClinicalQualitySnapshot",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: CLINICAL_QUALITY_REASON,
  },
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "rag_visual_eval_runs",
    fn: "loadClinicalQualitySnapshot",
    queries: 2,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: CLINICAL_QUALITY_REASON,
  },
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "document_chunks",
    fn: "loadClinicalQualitySnapshot",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason:
      "Administrator-gated governance aggregate. Reads only `id,document_id` for chunk ids already named by feedback rows, to map a signal back to its document. No chunk content is selected.",
  },
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "rag_visual_eval_runs",
    fn: "verifyQualitySignal",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: CLINICAL_QUALITY_REASON,
  },
  {
    file: "src/app/api/documents/[id]/cover/route.ts",
    table: "document_images",
    fn: "GET",
    queries: 2,
    proof: PROOF_KINDS.OWNER_PINNED_DOCUMENT_ID,
    identifier: "id",
    reason:
      'Both cover lookups filter `.eq("document_id", id)` for the id withOwnerReadScope resolved earlier in the handler; a 404 is returned before either query when that document is not visible to the caller.',
  },
  {
    file: "src/app/api/documents/[id]/reindex/route.ts",
    table: "ingestion_jobs",
    fn: "POST",
    queries: 1,
    proof: PROOF_KINDS.OWNER_PINNED_DOCUMENT_ID,
    identifier: "id",
    reason:
      'Competing-job diagnostic read for the document id the handler already loaded with `.eq("owner_id", user.id)`; a 404 is returned before this point when the caller does not own it.',
  },
  {
    file: "src/app/api/documents/[id]/search/route.ts",
    table: "document_chunks",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.OWNER_PINNED_DOCUMENT_ID,
    identifier: "id",
    reason:
      "ILIKE fallback used only when the owner-filtering search_document_chunks RPC is unavailable. It reads chunks for the id withOwnerReadScope resolved above, and the handler has already returned early for a document that is not indexed.",
  },
  {
    file: "src/app/api/documents/[id]/table-facts/route.ts",
    table: "document_images",
    fn: "PATCH",
    queries: 1,
    proof: PROOF_KINDS.OWNED_DOCUMENT_HELPER,
    identifier: "id",
    reason:
      'Reads the fact\'s source image constrained to `.eq("document_id", id)` where loadOwnedDocument already proved that document belongs to the administrator making the request.',
  },
  {
    file: "src/app/api/documents/[id]/table-facts/route.ts",
    table: "document_images",
    fn: "PATCH",
    queries: 1,
    proof: PROOF_KINDS.OWNED_DOCUMENT_HELPER,
    identifier: "id",
    reason:
      'Writes review metadata back to `fact.source_image_id`, constrained by `.eq("document_id", id)` on the write chain itself, where `loadOwnedDocument` already proved that document belongs to the administrator making the request. Until 2026-09-02 this write filtered by image id alone and was declared `reviewed-indirect`; restating the document constraint turned the repo\'s narrowest derived-tier write into a mechanically checked proof.',
  },
  {
    file: "src/app/api/eval-cases/route.ts",
    table: "document_chunks",
    fn: "ownedChunkReference",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason:
      "Read-then-verify: selects only `id,document_id` for a caller-supplied chunk id, then calls ownedDocumentId on the returned document_id and returns null unless it belongs to the requester. No chunk content is selected and nothing is returned for a chunk the caller does not own.",
  },
  {
    file: "src/app/api/images/[id]/signed-url/route.ts",
    table: "document_images",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.PARENT_DOCUMENT_VERIFIED,
    reason:
      "Images carry no owner column, so the row is fetched by id first and its parent document is then resolved through withOwnerReadScope; the route returns 404 and signs nothing unless that parent is visible to the caller.",
  },
  {
    file: "src/app/api/images/signed-urls/route.ts",
    table: "document_images",
    fn: "POST",
    queries: 1,
    proof: PROOF_KINDS.PARENT_DOCUMENT_VERIFIED,
    reason:
      "Batch form of the single-image route (and the module /api/documents/images/batch re-exports): images are fetched by id, their distinct document ids are resolved through withOwnerReadScope, and only images whose parent survived that filter are signed.",
  },
  {
    file: "src/app/api/ingestion/jobs/route.ts",
    table: "ingestion_jobs",
    fn: "GET",
    queries: 2,
    proof: PROOF_KINDS.DOCUMENTS_INNER_JOIN,
    reason:
      'Both the page query and the active-count query join `documents!inner` and filter `.eq("documents.owner_id", user.id)`, so ownership rides on the query chain itself.',
  },
  {
    file: "src/app/api/ingestion/quality/route.ts",
    table: "ingestion_jobs",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.OWNER_SCOPED_ID_LIST,
    identifier: "documentIds",
    reason:
      'Read by `.in("document_id", documentIds)`, the ids returned by the `.eq("owner_id", user.id)` documents query at the top of the handler; the handler returns early when that list is empty.',
  },
  {
    file: "src/app/api/ingestion/quality/route.ts",
    table: "ingestion_job_stages",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.OWNER_SCOPED_ID_LIST,
    identifier: "documentIds",
    reason: "Same owner-scoped documentIds list as the handler's other child reads.",
  },
  {
    file: "src/app/api/ingestion/quality/route.ts",
    table: "document_pages",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.OWNER_SCOPED_ID_LIST,
    identifier: "documentIds",
    reason:
      "Same owner-scoped documentIds list. This one reads page `text`, so it is the highest-value derived read in the handler and the reason it is inventoried rather than assumed.",
  },
  {
    file: "src/app/api/ingestion/quality/route.ts",
    table: "document_images",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.OWNER_SCOPED_ID_LIST,
    identifier: "documentIds",
    reason: "Same owner-scoped documentIds list; reads image counters and metadata for the quality review.",
  },
  {
    file: "src/app/api/jobs/route.ts",
    table: "ingestion_jobs",
    fn: "GET",
    queries: 1,
    proof: PROOF_KINDS.DOCUMENTS_INNER_JOIN,
    reason: 'Joins `documents!inner` and filters `.eq("documents.owner_id", user.id)` on the query chain itself.',
  },
  {
    file: "src/app/api/search/interaction/route.ts",
    table: "document_chunks",
    fn: "ownedChunkExists",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason:
      "Existence probe selecting only `id`, constrained to the document id the caller passed. The POST handler calls ownedDocumentExists first and only calls this helper when that returned true, so the document constraint is already an ownership constraint. The link crosses a function boundary and is therefore declared rather than checked.",
  },
  {
    file: "src/app/api/setup-status/route.ts",
    table: "ingestion_jobs",
    fn: "readSchemaStatus",
    queries: 1,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason: SETUP_STATUS_REASON,
  },
  {
    file: "src/app/api/setup-status/route.ts",
    table: "ingestion_jobs",
    fn: "readWorkerStatus",
    queries: 2,
    proof: PROOF_KINDS.REVIEWED_INDIRECT,
    reason:
      "Local-origin-gated worker-liveness probe: the newest job's status/updated_at and a head-only count of pending or processing jobs. It returns a worker health verdict, never job rows or document identity (tenancy review §3 / TEN-N1).",
  },
  {
    file: "src/lib/document-detail.ts",
    table: "document_chunks",
    fn: "loadAuthorizedDocumentDetail",
    queries: 2,
    proof: PROOF_KINDS.OWNER_PINNED_DOCUMENT_ID,
    identifier: "id",
    reason:
      'The selected-chunk lookup and the chunk window both filter `.eq("document_id", id)` for the id withOwnerReadScope resolved at the top of the loader, which throws a 404 before any child query runs. This is the read that serves the document viewer\'s text, so it is the single highest-value derived query in the codebase.',
  },
  {
    file: "src/lib/document-detail.ts",
    table: "document_pages",
    fn: "loadAuthorizedDocumentDetail",
    queries: 1,
    proof: PROOF_KINDS.OWNER_PINNED_DOCUMENT_ID,
    identifier: "id",
    reason: "Page-window read for the same owner-resolved document id; 404 is thrown before any child query.",
  },
  {
    file: "src/lib/document-detail.ts",
    table: "document_images",
    fn: "loadAuthorizedDocumentDetail",
    queries: 1,
    proof: PROOF_KINDS.OWNER_PINNED_DOCUMENT_ID,
    identifier: "id",
    reason: "Image read for the same owner-resolved document id; 404 is thrown before any child query.",
  },
];

/**
 * Tables the scanned files query that carry NONE of the three tenancy columns, and so land
 * in no tier. Before 2026-09-02 such a table got zero coverage with zero signal: it was
 * simply skipped. `clinical_quality_feedback_triage` is exactly that case — its tenancy
 * columns are `owner_role`/`owner_user_id`, a fourth naming convention — and it was read by
 * a route with no entry in any list (security review P2-5). Any new one fails the scan
 * until it is declared here with a reason.
 */
export const UNTIERED_TABLE_DECLARATIONS = [
  {
    file: "src/app/api/clinical-quality/route.ts",
    table: "clinical_quality_feedback_triage",
    fn: "loadClinicalQualitySnapshot",
    queries: 1,
    proof: PROOF_KINDS.UNTIERED_TABLE,
    reason:
      "Tenancy columns are named `owner_role`/`owner_user_id`, so no tier claims this table. Administrator-gated cross-tenant governance triage queue: GET and PATCH call authorizeAndLimit before this helper runs, the projection is triage disposition metadata (signal type/id, status, resolution code, reviewer id and timestamps) and never question, answer, excerpt or patient text, and per-owner filtering would defeat the oversight purpose (tenancy review §6).",
  },
];

/* -------------------------------------------------------- proof verification */

/** Does `site` satisfy the mechanical proof `entry` declares? Returns null, or the reason it does not. */
export function proofFailure(entry, site) {
  const filterArgument = site.documentFilter?.argument ?? null;
  switch (entry.proof) {
    case PROOF_KINDS.DOCUMENTS_INNER_JOIN:
      if (!site.innerJoinsDocuments) return "the chain does not select `documents!inner`";
      if (!site.proofs.includes("eq:documents.owner_id")) return "the chain does not filter `documents.owner_id`";
      return null;
    case PROOF_KINDS.OWNER_PINNED_DOCUMENT_ID:
      if (filterArgument !== entry.identifier)
        return `document_id is filtered by ${filterArgument ?? "no identifier"}, not the declared ${entry.identifier}`;
      if (!site.facts.ownerScopedDocumentIds.has(entry.identifier))
        return `no owner-scoped documents query in this scope pins \`${entry.identifier}\` as its id`;
      return null;
    case PROOF_KINDS.OWNED_DOCUMENT_HELPER:
      if (filterArgument !== entry.identifier)
        return `document_id is filtered by ${filterArgument ?? "no identifier"}, not the declared ${entry.identifier}`;
      if (!site.facts.owningHelperArguments.has(entry.identifier))
        return `no owning-document helper in this scope was handed \`${entry.identifier}\``;
      return null;
    case PROOF_KINDS.OWNER_SCOPED_ID_LIST:
      if (filterArgument !== entry.identifier)
        return `document_id is filtered by ${filterArgument ?? "no identifier"}, not the declared ${entry.identifier}`;
      if (!site.facts.localDeclarations.has(entry.identifier))
        return `\`${entry.identifier}\` is not declared in this scope, so it may not be derived from the owner-scoped query`;
      if (!site.facts.hasOwnerScopedDocumentsQuery)
        return "this scope runs no owner-scoped documents query for the id list to come from";
      return null;
    case PROOF_KINDS.PARENT_DOCUMENT_VERIFIED:
      if (!site.facts.hasOwnerScopedDocumentsQuery)
        return "this scope runs no owner-scoped documents query, so the parent document is never verified";
      return null;
    case PROOF_KINDS.REVIEWED_INDIRECT:
      return null;
    case PROOF_KINDS.UNTIERED_TABLE:
      if (site.tier !== "untiered") return `\`${site.table}\` is in the ${site.tier} tier, not outside every tier`;
      return null;
    default:
      return `unknown proof kind \`${entry.proof}\``;
  }
}

function entryKey(entry) {
  return `${entry.file}|${entry.table}|${entry.fn}`;
}

function describe(site) {
  return `${site.file}:${site.line} ${site.table} (${site.tier}, in ${site.scope})`;
}

/**
 * Match declared entries against the sites actually found, and report every mismatch:
 * an undeclared query, a declared entry that matches nothing, a wrong query count, or a
 * mechanical proof that no longer holds.
 */
function reconcile(entries, sites, label, remedy = "Scope it on the chain, or add") {
  const violations = [];
  const grouped = new Map();
  for (const site of sites) {
    const key = `${site.file}|${site.table}|${site.scope}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(site);
  }
  const declared = new Map();
  for (const entry of entries) {
    const key = entryKey(entry);
    if (!declared.has(key)) declared.set(key, []);
    declared.get(key).push(entry);
  }

  for (const [key, group] of declared) {
    // Mechanical proofs are matched first so `reviewed-indirect` cannot absorb a site that
    // a stricter entry in the same group was written for.
    const ordered = [...group].sort(
      (left, right) =>
        Number(left.proof === PROOF_KINDS.REVIEWED_INDIRECT) - Number(right.proof === PROOF_KINDS.REVIEWED_INDIRECT),
    );
    let remaining = grouped.get(key) ?? [];
    for (const entry of ordered) {
      const matched = [];
      const unmatched = [];
      for (const site of remaining) {
        if (matched.length < entry.queries && !proofFailure(entry, site)) matched.push(site);
        else unmatched.push(site);
      }
      if (matched.length !== entry.queries) {
        const why = remaining.map((site) => `${describe(site)} — ${proofFailure(entry, site) ?? "already matched"}`);
        violations.push(
          `${label} entry ${key} (proof ${entry.proof}) declares ${entry.queries} query(ies) but matched ${matched.length}.` +
            (why.length
              ? `\n      candidates: ${why.join("; ")}`
              : " No query site matched it at all — remove the stale entry."),
        );
      }
      remaining = unmatched;
    }
    grouped.set(key, remaining);
  }

  for (const [key, remaining] of grouped) {
    for (const site of remaining) {
      violations.push(
        `${describe(site)} — undeclared ${label} query. ${remedy} a reviewed ${label} entry (key ${key}) naming its ownership proof in scripts/lib/tenancy-scan.mjs.`,
      );
    }
  }
  return violations;
}

/**
 * Full mechanical tenancy scan. Returns the sites it inspected plus every violation.
 * `repoRoot` defaults to the current working directory (npm scripts run at the repo root).
 */
export function scanTenancy(repoRoot = process.cwd()) {
  const tiers = tableTiersFromDatabaseTypes(readFile(join(repoRoot, "src", "lib", "supabase", "database.types.ts")));
  const sites = [];
  for (const file of scannedFiles(repoRoot)) {
    const relativePath = relativeToRepo(repoRoot, file);
    sites.push(...analyzeSource({ relativePath, source: readFile(file), tiers }));
  }

  return { tiers, sites, ...evaluateSites({ sites }) };
}

/**
 * Apply the declared exemptions and derived inventory to a set of scanned sites. Exported
 * so the guard test can drive it with synthetic fixtures and prove each rule actually
 * fails on the thing it claims to catch.
 */
export function evaluateSites({
  sites,
  exemptions = SCOPE_EXEMPTIONS,
  inventory = DERIVED_QUERY_INVENTORY,
  untiered = UNTIERED_TABLE_DECLARATIONS,
}) {
  const unscopedDirect = sites.filter((site) => site.tier === "direct" && !site.ownerScopedChain);
  const unscopedUserKeyed = sites.filter((site) => site.tier === "user-keyed" && !site.userScopedChain);
  const derivedSites = sites.filter((site) => site.tier === "derived");
  const untieredSites = sites.filter((site) => site.tier === "untiered");

  const violations = [
    ...reconcile(exemptions, [...unscopedDirect, ...unscopedUserKeyed], "scope-exemption"),
    ...reconcile(inventory, derivedSites, "derived-inventory"),
    ...reconcile(
      untiered,
      untieredSites,
      "untiered-table",
      "This table carries no owner_id, user_id or document_id column, so no tier covers it. Give it a tenancy column, or add",
    ),
  ];

  return {
    violations,
    counts: {
      direct: sites.filter((site) => site.tier === "direct").length,
      userKeyed: sites.filter((site) => site.tier === "user-keyed").length,
      derived: derivedSites.length,
      untiered: untieredSites.length,
      unscopedDirect: unscopedDirect.length,
      unscopedUserKeyed: unscopedUserKeyed.length,
    },
  };
}

/**
 * The tiers that found NOTHING. A scan that finds nothing is a broken scan, never a clean
 * repo: the tier derivation parses src/lib/supabase/database.types.ts with patterns anchored
 * to that generated file's exact indentation, so a reformat empties every tier and the whole
 * gate silently becomes a no-op that exits 0 (security review P2-5). Both the shipped command
 * and the guard test assert this is empty.
 */
export function emptyTierNames(counts) {
  return ["direct", "userKeyed", "derived"].filter((tier) => (counts?.[tier] ?? 0) === 0);
}

/**
 * Which tables each tier actually sees in the scanned file set. Used to assert the
 * configured tier sets exactly equal what the code queries, so a new table cannot enter
 * the codebase unclassified.
 */
export function queriedTablesByTier(repoRoot = process.cwd()) {
  const { sites, tiers } = scanTenancy(repoRoot);
  const bucket = (tier) => [...new Set(sites.filter((site) => site.tier === tier).map((site) => site.table))].sort();
  return {
    tiers,
    direct: bucket("direct"),
    userKeyed: bucket("user-keyed"),
    derived: bucket("derived"),
    untiered: bucket("untiered"),
  };
}

/** Scan all of `src/` for dynamic `.rpc()` dispatch (blind spot E). */
export function scanRpcDispatch(repoRoot = process.cwd()) {
  const dynamicRpcCalls = [];
  const dispatcherCallSites = [];
  for (const file of allSourceFiles(repoRoot)) {
    const relativePath = relativeToRepo(repoRoot, file);
    const result = analyzeRpcDispatch({ relativePath, source: readFile(file) });
    dynamicRpcCalls.push(...result.dynamicRpcCalls);
    dispatcherCallSites.push(...result.dispatcherCallSites);
  }
  const violations = [];
  for (const call of dynamicRpcCalls) {
    if (call.file === DYNAMIC_RPC_DISPATCHER.file && call.scopes.includes(DYNAMIC_RPC_DISPATCHER.fn)) continue;
    violations.push(
      `${call.file}:${call.line} — dynamic .rpc(${call.argument}) outside ${DYNAMIC_RPC_DISPATCHER.fn}. ` +
        "Tenancy for the retrieval layer lives in that one wrapper (it rewrites owner_filter to the public sentinel on the legacy merge path); a second dispatch site moves it somewhere unreviewed.",
    );
  }
  for (const site of dispatcherCallSites) {
    if (!site.literalNames) {
      violations.push(
        `${site.file}:${site.line} — ${DYNAMIC_RPC_DISPATCHER.fn} called with non-literal RPC names (${site.names.join(", ")}). ` +
          "Both RPC-name arguments must be string literals so the retrieval RPC surface stays enumerable.",
      );
    }
  }
  return { dynamicRpcCalls, dispatcherCallSites, violations };
}
