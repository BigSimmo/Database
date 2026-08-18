import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";

import { appModeDefinitions } from "@/lib/app-modes";
import { isAlwaysStandaloneShellPath, isStandaloneModeHomePath } from "@/lib/search-route-ownership";

/**
 * The shared results band is what stops a search surface asserting "0 matches"
 * when the search actually failed. That guarantee is only worth anything if
 * every result list wears it, so this file is the gate that a *future* search
 * page cannot quietly skip.
 *
 * It pairs with the required `resultsSurface` field on `AppModeSearchConfig`:
 * that field makes a new mode fail `typecheck` until its author declares which
 * surface it is, and this test then holds them to the declaration.
 */

const REPO_ROOT = path.resolve(__dirname, "..");
const COMPONENTS_DIR = path.join(REPO_ROOT, "src", "components");
const APP_DIR = path.join(REPO_ROOT, "src", "app");
const BAND_IDENTIFIER = "SearchResultsHeaderBand";
/** A rendered element, not a bare mention. Matching the identifier alone counts
    an import, a comment, or a dead reference as adoption, so a production route
    could drop the band while this gate stayed green. */
const BAND_ELEMENT = `<${BAND_IDENTIFIER}`;
function rendersBand(source: string) {
  return source.includes(BAND_ELEMENT);
}

/** Mockups are design scratch and exempt from production wiring gates.
 * Absolute paths must first be scoped to the repository: a worktree parent can
 * legitimately contain "mockup" without making every production module one. */
function isMockupPath(candidatePath: string) {
  const relativePath = path.isAbsolute(candidatePath) ? path.relative(REPO_ROOT, candidatePath) : candidatePath;
  return /mockup/i.test(relativePath);
}

function walk(dir: string, extension = ".tsx"): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(abs, extension));
    } else if (entry.name.endsWith(extension)) {
      out.push(abs);
    }
  }
  return out;
}

/**
 * Collect every string literal appearing in each `modeId=` initializer on a
 * band element. Literals are gathered recursively rather than matched as a
 * single `modeId="x"` because at least one production call site computes the
 * mode: `document-search-results.tsx` writes
 * `modeId={showRecordMatches ? recordMode : "documents"}`, and a naive matcher
 * would report that page as having no mode at all.
 */
function collectBandModeIds(source: string): Set<string> {
  const found = new Set<string>();
  let cursor = source.indexOf(`<${BAND_IDENTIFIER}`);
  while (cursor !== -1) {
    const modeIdAt = source.indexOf("modeId", cursor);
    if (modeIdAt === -1) break;
    // Bound the search to this element's opening tag so we never read props
    // belonging to the next component.
    const elementEnd = source.indexOf("\n    />", cursor);
    const window = source.slice(modeIdAt, elementEnd === -1 ? modeIdAt + 400 : Math.min(elementEnd, modeIdAt + 400));
    const attribute = window.slice(0, window.indexOf("\n", window.indexOf("\n") + 1) + 1 || window.length);
    for (const match of attribute.matchAll(/["']([a-z-]+)["']/g)) found.add(match[1]);
    cursor = source.indexOf(`<${BAND_IDENTIFIER}`, cursor + 1);
  }
  return found;
}

/**
 * Routes that legitimately render no band. Each entry must say why, so an
 * exemption is a reviewed decision rather than a silent hole — the same idiom
 * `tests/route-reachability.test.ts` uses for its allowlist.
 */
const BAND_ROUTE_ALLOWLIST = new Map<string, string>([
  [
    "src/app/(search-app)/documents/search/page.tsx",
    "Composer-driven landing stub with no result list of its own; the band is mounted by document-search-results.tsx inside the dashboard shell.",
  ],
  [
    "src/app/(search-app)/documents/page.tsx",
    "Documents mode home is a content slot; the band is mounted by document-search-results.tsx inside the dashboard shell.",
  ],
  [
    "src/app/(search-app)/medications/page.tsx",
    "Medication mode home is a content slot; the band is mounted by medication-prescribing-workspace.tsx inside the dashboard shell.",
  ],
  [
    "src/app/(search-app)/dsm/page.tsx",
    "DSM mode home is a catalogue landing; result lists (and the band) live on /dsm/search.",
  ],
  [
    "src/app/(search-app)/factsheets/page.tsx",
    "Factsheets mode home is a catalogue landing; result lists (and the band) live on /factsheets/search.",
  ],
  [
    "src/app/(search-app)/dictionary/page.tsx",
    "Dictionary mode home uses the shared in-flow composer; its mixed result list and band live on /dictionary/search.",
  ],
  [
    "src/app/(search-app)/therapy-compass/page.tsx",
    "Therapy home is the library landing; the search results band lives on /therapy-compass/search.",
  ],
]);

const ROOT_DASHBOARD_ROUTE = path.join(APP_DIR, "(search-app)", "page.tsx");

/**
 * Resolve a mode href to its App Router page file.
 *
 * Query-backed modes are the reason this is not a plain path join. `prescribing`
 * declares `href: "/?mode=prescribing"`, whose pathname is `/`, and the previous
 * implementation returned null for that — so it, and every href-less mode such
 * as Documents, stayed outside the inventory and the root dashboard page was
 * never checked at all.
 */
function modeHrefToPagePath(href: string | null): string | null {
  const pathOnly = (href ?? "/").split("?")[0]?.trim() || "/";
  if (!pathOnly.startsWith("/")) return null;
  const candidate =
    pathOnly === "/" ? ROOT_DASHBOARD_ROUTE : path.join(APP_DIR, "(search-app)", pathOnly.slice(1), "page.tsx");
  if (!existsSync(candidate)) return null;
  return path.relative(REPO_ROOT, candidate).replaceAll(path.sep, "/");
}

/** `src/app/(search-app)/services/page.tsx` -> `/services`; the group page -> `/`. */
function routePathname(routeAbs: string): string {
  const rel = path.relative(APP_DIR, routeAbs).replaceAll(path.sep, "/");
  const segments = rel
    .replace(/\/page\.tsx$/, "")
    .split("/")
    .filter((segment) => segment && !segment.startsWith("("));
  return `/${segments.join("/")}`;
}

/**
 * Layouts count toward reachability only for dashboard-owned routes.
 *
 * In App Router a page's output includes its layouts, and the root dashboard
 * route depends on that: `(search-app)/page.tsx` renders only a pass-through and
 * its band arrives through the group layout's shared shell.
 *
 * But that layout transitively imports `ClinicalDashboard`, so following it for
 * *every* route made the gate worthless — a namespaced page could be reduced to
 * `<div />` and still "reach" the band. Page-owned result surfaces must reach
 * the band through their own page:
 * - `isAlwaysStandaloneShellPath` — never mounts the dashboard (services, forms, …)
 * - `isStandaloneModeHomePath` — mode homes with their own results page, including
 *   `/tools`, whose default and submitted states both mount its route-owned
 *   `ToolsSearchResultsPage`
 */
function reachabilityRoots(routeAbs: string): string[] {
  const pathname = routePathname(routeAbs);
  if (isAlwaysStandaloneShellPath(pathname) || isStandaloneModeHomePath(pathname)) return [routeAbs];
  const layouts: string[] = [];
  let dir = path.dirname(routeAbs);
  while (dir.startsWith(APP_DIR)) {
    const candidate = path.join(dir, "layout.tsx");
    if (existsSync(candidate)) layouts.push(candidate);
    if (dir === APP_DIR) break;
    dir = path.dirname(dir);
  }
  return [routeAbs, ...layouts];
}

/**
 * A module reduced to what decides whether it can render the band.
 *
 * Presence is not reach. Five separate false greens on this gate were all the
 * same defect — the walk asked "does this file mention it?" when the question is
 * "does anything the route actually mounts reach it?". Every spelling that got
 * patched individually (an unrendered import, `export { X }`, `export { X } from`,
 * `export *`, a bare side-effect import, JSX inside an unmounted helper) is a
 * reachability question, so this models reachability once instead.
 */
type ModuleGraph = {
  /** exported name (including "default") -> the local declarations behind it */
  exportedLocals: Map<string, string[]>;
  /** local declaration -> identifiers its body references, JSX element names included */
  localRefs: Map<string, Set<string>>;
  /** locals whose own body renders the band */
  bandLocals: Set<string>;
  /** `import { imported as local } from source` */
  imports: Array<{ source: string; local: string; imported: string }>;
  /** `export { imported as exported } from source`; `exported: "*"` for `export *` */
  reexports: Array<{ source: string; exported: string; imported: string }>;
  /** `import(source)[.then(m => m.imported)]`, attributed to the local that owns it */
  lazyImports: Array<{ owner: string; source: string; imported: string }>;
};

/** Which exports of a module the importer actually mounts. `"*"` means any. */
type MountRoots = Set<string> | "*";

/**
 * AST keys whose subtrees are type-only, so identifiers inside them are erased at
 * runtime and must not count as component references.
 */
const TYPE_POSITION_KEYS = new Set([
  "typeAnnotation",
  "returnType",
  "typeParameters",
  "typeArguments",
  "superTypeParameters",
  "implements",
]);

/** `export default () => …` has no name to hang references off. */
const ANONYMOUS_DEFAULT = "__default__";

function declaredNames(node: Record<string, unknown> | undefined): string[] {
  if (!node) return [];
  if (node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") {
    const name = (node.id as { name?: string })?.name;
    return name ? [name] : [];
  }
  if (node.type === "VariableDeclaration") {
    return ((node.declarations ?? []) as Array<Record<string, unknown>>)
      .map((declarator) => (declarator.id as { name?: string })?.name)
      .filter((name): name is string => typeof name === "string");
  }
  return [];
}

/**
 * Which export a `.then(…)` selects out of a dynamic import.
 *
 * Two shapes, both live in this repo:
 * - `.then((m) => m.Foo)` -> "Foo" (every entry in clinical-dashboard-lazy.tsx)
 * - `.then((mod) => ({ default: mod.Foo }))` -> "Foo" — the Next.js wrapper for a
 *   named export, used by `global-search-shell.tsx` for `ClinicalDashboard`. Left
 *   unhandled this returned null and fell back to following *every* export of that
 *   module, which is precisely the over-approximation the walk is meant to avoid.
 */
function thenExportName(args: unknown): string | null {
  const first = ((args ?? []) as Array<Record<string, unknown>>)[0];
  const body = first?.body as Record<string, unknown> | undefined;
  if (body?.type === "MemberExpression") {
    const property = body.property as { name?: string } | undefined;
    return typeof property?.name === "string" ? property.name : null;
  }
  if (body?.type === "ObjectExpression") {
    for (const property of (body.properties ?? []) as Array<Record<string, unknown>>) {
      if ((property.key as { name?: string })?.name !== "default") continue;
      const value = property.value as Record<string, unknown> | undefined;
      if (value?.type === "MemberExpression") {
        const selected = value.property as { name?: string } | undefined;
        return typeof selected?.name === "string" ? selected.name : null;
      }
    }
  }
  return null;
}

/**
 * A dynamic import whose result is thrown away cannot mount anything.
 *
 * `void import("x")` in an effect, or a bare `import("x");` statement, is a
 * preload or a side effect. Scoped to discarded *results* rather than to "must be
 * lexically inside dynamic()", because this repo also writes the loader as a
 * separate binding — `const load = () => import("…").then(…)` passed to
 * `dynamic(load)` — and requiring lexical containment would report that as
 * unreachable.
 */
function discardsItsResult(node: Record<string, unknown>): boolean {
  if (node.type === "UnaryExpression" && node.operator === "void") return true;
  if (node.type !== "ExpressionStatement") return false;
  let expression = node.expression as Record<string, unknown> | undefined;
  // Unwrap a `.then(…)`/`.catch(…)` chain back to its root.
  while (expression?.type === "CallExpression") {
    const callee = expression.callee as Record<string, unknown> | undefined;
    if (callee?.type !== "MemberExpression") break;
    expression = callee.object as Record<string, unknown> | undefined;
  }
  return Boolean(expression && dynamicImportSource(expression));
}

function dynamicImportSource(node: Record<string, unknown> | undefined): string | null {
  if (!node) return null;
  const isImport =
    node.type === "ImportExpression" ||
    (node.type === "CallExpression" && (node.callee as { type?: string })?.type === "Import");
  if (!isImport) return null;
  const arg = (node.source ?? (node.arguments as unknown[])?.[0] ?? null) as Record<string, unknown> | null;
  return arg?.type === "StringLiteral" && typeof arg.value === "string" ? arg.value : null;
}

function buildModuleGraph(source: string, filename: string): ModuleGraph {
  let ast: ReturnType<typeof parse>;
  try {
    ast = parse(source, { sourceType: "unambiguous", plugins: ["jsx", "typescript"] });
  } catch {
    // An unparseable file must not silently drop out of the walk.
    throw new Error(`search-results-band-adoption: could not parse ${filename}`);
  }

  const graph: ModuleGraph = {
    exportedLocals: new Map(),
    localRefs: new Map(),
    bandLocals: new Set(),
    imports: [],
    reexports: [],
    lazyImports: [],
  };
  const addExport = (exported: string, local: string) => {
    graph.exportedLocals.set(exported, [...(graph.exportedLocals.get(exported) ?? []), local]);
  };

  /** Record everything one local declaration's body reaches. */
  const scan = (root: unknown, owner: string) => {
    const refs = graph.localRefs.get(owner) ?? new Set<string>();
    graph.localRefs.set(owner, refs);
    const visit = (value: unknown, discarded = false) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const item of value) visit(item, discarded);
        return;
      }
      const node = value as Record<string, unknown>;
      const type = node.type;
      const resultDropped = discarded || discardsItsResult(node);
      if (type === "JSXOpeningElement") {
        let name = node.name as Record<string, unknown> | undefined;
        while (name && name.type === "JSXMemberExpression") name = name.object as Record<string, unknown>;
        if (name && name.type === "JSXIdentifier" && typeof name.name === "string") {
          refs.add(name.name);
          if (name.name === BAND_IDENTIFIER) graph.bandLocals.add(owner);
        }
      }
      if (type === "Identifier" && typeof node.name === "string") refs.add(node.name);
      // `dynamic(() => import("x").then(m => m.Foo))` names the binding it mounts,
      // which is how every lazy workspace in clinical-dashboard-lazy.tsx is written.
      // Matched on the outer `.then(…)` so the inner bare-import branch below can
      // skip it and not also enqueue the module's default.
      if (type === "CallExpression" && !resultDropped) {
        const callee = node.callee as Record<string, unknown> | undefined;
        if (callee?.type === "MemberExpression" && (callee.property as { name?: string })?.name === "then") {
          const inner = dynamicImportSource(callee.object as Record<string, unknown> | undefined);
          if (inner) {
            graph.lazyImports.push({ owner, source: inner, imported: thenExportName(node.arguments) ?? "*" });
          }
        }
      }
      const bare = resultDropped ? null : dynamicImportSource(node);
      if (bare && !graph.lazyImports.some((entry) => entry.owner === owner && entry.source === bare)) {
        // A plain `import("x")` in `dynamic()` mounts the module's default export.
        graph.lazyImports.push({ owner, source: bare, imported: "default" });
      }
      for (const key of Object.keys(node)) {
        if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
        // Type positions are erased, so an identifier that appears only there is
        // not a runtime reference. `ComponentProps<typeof Banded>` needs the value
        // import but never mounts it, and this repo does not enforce
        // `consistent-type-imports`, so such an import is not necessarily written
        // as `import type`. Value subtrees never live under these keys.
        if (TYPE_POSITION_KEYS.has(key)) continue;
        visit(node[key], resultDropped);
      }
    };
    visit(root);
  };

  /** Attribute a declaration's references to each name it declares. */
  const scanDeclaration = (statement: Record<string, unknown>) => {
    if (statement.type === "VariableDeclaration") {
      for (const declarator of (statement.declarations ?? []) as Array<Record<string, unknown>>) {
        const name = (declarator.id as { name?: string })?.name;
        if (name) scan(declarator, name);
      }
      return;
    }
    for (const name of declaredNames(statement)) scan(statement, name);
  };

  for (const raw of (ast.program?.body ?? []) as unknown[] as Array<Record<string, unknown>>) {
    const type = raw.type;

    if (type === "ImportDeclaration") {
      const specifier = (raw.source as { value?: string })?.value;
      if (typeof specifier !== "string") continue;
      // `import type { X }` is erased at runtime and cannot mount anything, so it
      // is not an edge. Both spellings matter: the declaration-level `importKind`
      // and the per-specifier one from `import { type X }`.
      if (raw.importKind === "type") continue;
      // A bare `import "x"` executes the module but renders nothing, so it is not
      // a mount and is deliberately not followed.
      for (const spec of (raw.specifiers ?? []) as Array<Record<string, unknown>>) {
        if (spec.importKind === "type") continue;
        const local = (spec.local as { name?: string })?.name;
        if (!local) continue;
        const imported =
          spec.type === "ImportDefaultSpecifier"
            ? "default"
            : spec.type === "ImportNamespaceSpecifier"
              ? "*"
              : ((spec.imported as { name?: string })?.name ?? local);
        graph.imports.push({ source: specifier, local, imported });
      }
      continue;
    }

    if (type === "ExportAllDeclaration") {
      const specifier = (raw.source as { value?: string })?.value;
      if (typeof specifier === "string") graph.reexports.push({ source: specifier, exported: "*", imported: "*" });
      continue;
    }

    if (type === "ExportNamedDeclaration") {
      const specifier = (raw.source as { value?: string })?.value;
      if (typeof specifier === "string") {
        // `export type { X } from "…"` is erased too.
        if (raw.exportKind === "type") continue;
        for (const spec of (raw.specifiers ?? []) as Array<Record<string, unknown>>) {
          if (spec.exportKind === "type") continue;
          const exported = (spec.exported as { name?: string })?.name;
          const imported = (spec.local as { name?: string })?.name ?? exported;
          if (exported && imported) graph.reexports.push({ source: specifier, exported, imported });
        }
        continue;
      }
      const declaration = raw.declaration as Record<string, unknown> | undefined;
      if (declaration) {
        for (const name of declaredNames(declaration)) addExport(name, name);
        scanDeclaration(declaration);
        continue;
      }
      for (const spec of (raw.specifiers ?? []) as Array<Record<string, unknown>>) {
        const exported = (spec.exported as { name?: string })?.name;
        const local = (spec.local as { name?: string })?.name;
        if (exported && local) addExport(exported, local);
      }
      continue;
    }

    if (type === "ExportDefaultDeclaration") {
      const declaration = raw.declaration as Record<string, unknown> | undefined;
      if (declaration?.type === "Identifier" && typeof declaration.name === "string") {
        addExport("default", declaration.name);
        continue;
      }
      const owner = declaredNames(declaration)[0] ?? ANONYMOUS_DEFAULT;
      addExport("default", owner);
      if (declaration) scan(declaration, owner);
      continue;
    }

    scanDeclaration(raw);
  }

  return graph;
}

/** Locals reachable from the exports the importer mounts. */
function reachableLocals(graph: ModuleGraph, roots: MountRoots): Set<string> {
  const queue: string[] =
    roots === "*"
      ? [...graph.exportedLocals.values()].flat()
      : [...roots].flatMap((name) => graph.exportedLocals.get(name) ?? []);
  const reached = new Set<string>();
  while (queue.length > 0) {
    const local = queue.pop() as string;
    if (reached.has(local)) continue;
    reached.add(local);
    for (const ref of graph.localRefs.get(local) ?? []) if (!reached.has(ref)) queue.push(ref);
  }
  return reached;
}

/**
 * Modules the mounted code actually reaches, and which of their exports it wants.
 *
 * Re-exports are followed by their own semantics rather than by a special case:
 * `export { X as default } from "…"` supplies a default and is followed when the
 * importer wants the default; `export { X } from "…"` only when it wants `X`; and
 * `export * from "…"` never supplies a default, so a page whose importer wants
 * only the default gets no hop from it.
 */
function nextHops(graph: ModuleGraph, reached: Set<string>, roots: MountRoots) {
  const hops = new Map<string, MountRoots>();
  const want = (source: string, imported: string | string[]) => {
    const existing = hops.get(source);
    if (existing === "*") return;
    if (imported === "*") {
      hops.set(source, "*");
      return;
    }
    const names = Array.isArray(imported) ? imported : [imported];
    hops.set(source, new Set([...(existing ?? []), ...names]));
  };

  for (const { source, local, imported } of graph.imports) if (reached.has(local)) want(source, imported);
  for (const { owner, source, imported } of graph.lazyImports) if (reached.has(owner)) want(source, imported);
  for (const { source, exported, imported } of graph.reexports) {
    if (exported === "*") {
      // `export *` re-exports named exports only, never the default.
      if (roots === "*") want(source, "*");
      else {
        const named = [...roots].filter((name) => name !== "default");
        if (named.length > 0) want(source, named);
      }
      continue;
    }
    if (roots === "*" || roots.has(exported)) want(source, imported);
  }
  return [...hops.entries()].map(([source, wanted]) => ({ source, roots: wanted }));
}

function rootsKey(roots: MountRoots): string {
  return roots === "*" ? "*" : [...roots].sort().join(",");
}

function resolveSpecifier(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(REPO_ROOT, "src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;
  const candidates = [`${base}.tsx`, `${base}.ts`, path.join(base, "index.tsx"), path.join(base, "index.ts")];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/**
 * Breadth-first search from a route (and its layouts) to a rendered band.
 *
 * The previous implementation hard-coded two hops into `@/components/**`. The
 * real chain on the root dashboard route is four —
 * `layout → shared-search-app-shell → global-search-shell → ClinicalDashboard →
 * document-search-results` — so a fixed hop count silently under-reported
 * reachability rather than failing loudly. The lazy indirection through
 * `clinical-dashboard-lazy` adds a hop, so the cap has headroom over the longest
 * real chain rather than sitting on it.
 */
const MAX_IMPORT_DEPTH = 10;

/**
 * Breadth-first from what a route actually mounts to a band it actually renders.
 *
 * Each hop carries the exports the importer wants, so the same module can be
 * visited twice for different bindings — that is the point. `clinical-dashboard-lazy`
 * lazily exports every mode workspace, and reaching it for `FavouritesHub` must
 * not also reach `document-search-results`.
 */
function routeReachesBand(routeAbs: string): boolean {
  // Next renders a route's (and a layout's) default export.
  let frontier = reachabilityRoots(routeAbs).map((file) => ({
    file,
    depth: 0,
    roots: new Set(["default"]) as MountRoots,
  }));
  const seen = new Set(frontier.map(({ file, roots }) => `${file}::${rootsKey(roots)}`));
  while (frontier.length > 0) {
    const next: typeof frontier = [];
    for (const { file, depth, roots } of frontier) {
      let source: string;
      try {
        source = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      const graph = buildModuleGraph(source, file);
      const reached = reachableLocals(graph, roots);
      for (const local of graph.bandLocals) if (reached.has(local)) return true;
      if (depth >= MAX_IMPORT_DEPTH) continue;
      for (const hop of nextHops(graph, reached, roots)) {
        const target = resolveSpecifier(hop.source, file);
        if (!target || isMockupPath(target)) continue;
        const key = `${target}::${rootsKey(hop.roots)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ file: target, depth: depth + 1, roots: hop.roots });
      }
    }
    frontier = next;
  }
  return false;
}

describe("search results band adoption", () => {
  const productionComponents = walk(COMPONENTS_DIR)
    .map((abs) => ({ abs, rel: path.relative(REPO_ROOT, abs) }))
    .filter(({ rel }) => !isMockupPath(rel));

  it("scopes mockup detection to the repository-relative path", () => {
    expect(isMockupPath(path.join(REPO_ROOT, "src", "components", "production-result.tsx"))).toBe(false);
    expect(isMockupPath(path.join(REPO_ROOT, "src", "app", "mockups", "study", "page.tsx"))).toBe(true);
  });

  it("mounts the shared band on every mode that presents a result list", () => {
    const mounted = new Set<string>();
    for (const { abs } of productionComponents) {
      const source = readFileSync(abs, "utf8");
      if (!rendersBand(source)) continue;
      for (const modeId of collectBandModeIds(source)) mounted.add(modeId);
    }

    const expected = appModeDefinitions
      .filter((mode) => mode.search.resultsSurface === "results-band")
      .map((mode) => mode.id);
    const missing = expected.filter((modeId) => !mounted.has(modeId));

    expect(
      missing,
      `These modes declare resultsSurface: "results-band" but no production component renders ` +
        `<${BAND_IDENTIFIER} modeId="…"> for them. A result list without the band can report ` +
        `"0 matches" for a search that failed. Mount the band, or change the mode's resultsSurface.`,
    ).toEqual([]);
  });

  it("reaches the band from every production search route", () => {
    const nestedSearchRoutes = walk(APP_DIR)
      .map((abs) => ({ abs, rel: path.relative(REPO_ROOT, abs).replaceAll(path.sep, "/") }))
      .filter(({ rel }) => !isMockupPath(rel))
      .filter(({ rel }) => rel.includes("/search/") && rel.endsWith("page.tsx"));

    // Top-level mode homes such as /services and /favourites also present result
    // lists. Restricting the inventory to `/search/` left those pages unchecked.
    // An href-less mode (Documents) is served by the root dashboard route, so it
    // resolves to the same page as the query-backed hrefs rather than dropping out.
    const modeHomeRoutes = appModeDefinitions
      .filter((mode) => mode.search.resultsSurface === "results-band")
      .map((mode) => modeHrefToPagePath("href" in mode && typeof mode.href === "string" ? mode.href : null))
      .filter((rel): rel is string => Boolean(rel))
      .map((rel) => ({ abs: path.join(REPO_ROOT, rel), rel }));

    // The root dashboard route still renders submitted results for the modes it
    // owns (`/?mode=prescribing&q=…&run=1`, and answer), so it belongs in the
    // inventory on its own account. It used to arrive only via the Documents and
    // prescribing hrefs; both now point at real mode homes, and relying on that
    // coincidence is how this gate could quietly stop checking the root page.
    const rootDashboardRoute = {
      abs: ROOT_DASHBOARD_ROUTE,
      rel: path.relative(REPO_ROOT, ROOT_DASHBOARD_ROUTE).replaceAll(path.sep, "/"),
    };

    const routeKeys = new Map<string, { abs: string; rel: string }>();
    for (const route of [...nestedSearchRoutes, ...modeHomeRoutes, rootDashboardRoute]) {
      routeKeys.set(route.rel, route);
    }
    const searchRoutes = [...routeKeys.values()];

    // If this ever hits zero the assertion below passes vacuously, which would
    // make the gate silently useless.
    expect(searchRoutes.length).toBeGreaterThan(0);
    expect(
      searchRoutes.some((route) => route.rel === "src/app/(search-app)/services/page.tsx"),
      "Mode-href discovery must include top-level results pages such as /services.",
    ).toBe(true);
    // Query-backed and href-less modes (`/?mode=prescribing`, Documents) are all
    // served by the root dashboard route. Leaving it out is how the gate could
    // report "every production search route" while never checking that page.
    expect(
      searchRoutes.some((route) => route.rel === "src/app/(search-app)/page.tsx"),
      "Mode-href discovery must include the root dashboard route that serves query-backed modes.",
    ).toBe(true);

    const orphans: string[] = [];
    for (const { abs, rel } of searchRoutes) {
      if (BAND_ROUTE_ALLOWLIST.has(rel)) continue;
      if (!routeReachesBand(abs)) orphans.push(rel);
    }

    expect(
      orphans,
      `These search routes never reach <${BAND_IDENTIFIER}>. Mount the band, or add a documented ` +
        `entry to BAND_ROUTE_ALLOWLIST in this file explaining why the route has no result list.`,
    ).toEqual([]);
  });

  it("keeps the band's forced-colors rules inside the final forced-colors block", () => {
    // At equal specificity a later rule wins, so a forced-colors block placed
    // before another one is silently overridden while still reading correctly.
    const globals = readFileSync(path.join(REPO_ROOT, "src", "app", "globals.css"), "utf8");
    const forcedColorsOpeners = [...globals.matchAll(/@media \(forced-colors: active\)/g)].map(
      (match) => match.index ?? -1,
    );
    expect(forcedColorsOpeners.length).toBeGreaterThan(0);

    const lastOpener = forcedColorsOpeners[forcedColorsOpeners.length - 1];
    let depth = 0;
    let lastCloser = -1;
    for (let index = lastOpener; index < globals.length; index += 1) {
      const char = globals[index];
      if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          lastCloser = index;
          break;
        }
      }
    }
    expect(lastCloser).toBeGreaterThan(lastOpener);

    const bandRule = globals.indexOf(".search-band", lastOpener);
    expect(
      bandRule,
      "The band's forced-colors rules must exist inside the last @media (forced-colors: active) " +
        "block, or an earlier block at equal specificity will override them.",
    ).toBeGreaterThan(lastOpener);
    expect(bandRule).toBeLessThan(lastCloser);
  });
});

describe("band adoption detection", () => {
  // Negative fixture: importing or mentioning the identifier is not adoption.
  // Without this, the gate above passes on a route that never mounts the band.
  it("does not count an import, comment, or dead reference as a mount", () => {
    const imported =
      'import { SearchResultsHeaderBand } from "@/components/clinical-dashboard/search-results-header-band";';
    const mentioned = "// SearchResultsHeaderBand is rendered by the shell, not here.";
    const referenced = "const Band = SearchResultsHeaderBand;";
    const mounted = '<SearchResultsHeaderBand modeId="services" query={q} matchCount={0} />';

    for (const source of [imported, mentioned, referenced]) {
      expect(source.includes("<SearchResultsHeaderBand"), source.slice(0, 40)).toBe(false);
    }
    expect(mounted.includes("<SearchResultsHeaderBand")).toBe(true);
  });

  it("counts layouts only for dashboard-owned routes", () => {
    // The group layout transitively imports ClinicalDashboard, so following it
    // for every route would let any page under (search-app) pass while rendering
    // nothing. Verified by gutting services/page.tsx to `<div />`: with layouts
    // followed unconditionally the gate still passed; scoped to dashboard-owned
    // routes it reports that page as an orphan.
    const standalone = path.join(APP_DIR, "(search-app)", "services", "page.tsx");
    expect(reachabilityRoots(standalone)).toEqual([standalone]);

    // `/tools` is a standalone mode home but not always-standalone (Suspense
    // boundary differs). It must still be page-only — otherwise gutting
    // tools/page.tsx stays green via the layout → dashboard import chain.
    const tools = path.join(APP_DIR, "(search-app)", "tools", "page.tsx");
    expect(reachabilityRoots(tools)).toEqual([tools]);

    // The root dashboard route is the case that genuinely needs its layout: the
    // page renders only a pass-through and the band arrives via the shared shell.
    const rootRoute = path.join(APP_DIR, "(search-app)", "page.tsx");
    const rootRoots = reachabilityRoots(rootRoute);
    expect(rootRoots[0]).toBe(rootRoute);
    expect(rootRoots.length).toBeGreaterThan(1);
    expect(rootRoots.some((file) => file.endsWith(`(search-app)${path.sep}layout.tsx`))).toBe(true);
  });

  it("resolves a route to the band through imports, and reports one that never gets there", () => {
    // Real files on disk, because the walker resolves specifiers rather than
    // consulting a map. Both directions are asserted: a fixture that only ever
    // returns false would pass against a walker that is broken outright.
    const dir = mkdtempSync(path.join(tmpdir(), "band-adoption-"));
    try {
      writeFileSync(
        path.join(dir, "child.tsx"),
        "export function Child() { return <div data-testid='child' />; }\n",
        "utf8",
      );
      writeFileSync(
        path.join(dir, "orphan-route.tsx"),
        'import { Child } from "./child";\nexport default Child;\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "orphan-route.tsx"))).toBe(false);

      // Same shape, but the child mounts the band — and via a lazy import, in the
      // exact form the dashboard code-splits its mode workspaces with:
      // `dynamic(() => import("…").then((m) => m.Named))`.
      writeFileSync(
        path.join(dir, "banded-child.tsx"),
        `export function Banded() { return <${BAND_IDENTIFIER} modeId="documents" />; }\n`,
        "utf8",
      );
      writeFileSync(
        path.join(dir, "wired-route.tsx"),
        'const Lazy = dynamic(() => import("./banded-child").then((m) => m.Banded));\nexport default Lazy;\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "wired-route.tsx"))).toBe(true);

      // A bare `dynamic(() => import("…"))` mounts the module's default, so this
      // one reaches the band and the named-export module above would not have.
      writeFileSync(
        path.join(dir, "default-banded-child.tsx"),
        `export default function Banded() { return <${BAND_IDENTIFIER} modeId="documents" />; }\n`,
        "utf8",
      );
      writeFileSync(
        path.join(dir, "lazy-default-route.tsx"),
        'const Lazy = dynamic(() => import("./default-banded-child"));\nexport default Lazy;\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "lazy-default-route.tsx"))).toBe(true);

      // The gap this redesign closes: one lazy module exporting several
      // workspaces. Mounting the non-band one must not reach the band one.
      writeFileSync(
        path.join(dir, "lazy-barrel.tsx"),
        'export const Plain = dynamic(() => import("./plain-child").then((m) => m.Plain));\n' +
          'export const Banded = dynamic(() => import("./banded-child").then((m) => m.Banded));\n',
        "utf8",
      );
      writeFileSync(path.join(dir, "plain-child.tsx"), "export function Plain() { return <div />; }\n", "utf8");
      writeFileSync(
        path.join(dir, "mounts-plain-only-route.tsx"),
        'import { Plain } from "./lazy-barrel";\nexport default function Page() {\n  return <Plain />;\n}\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "mounts-plain-only-route.tsx"))).toBe(false);

      // ...and mounting the band one still does reach it.
      writeFileSync(
        path.join(dir, "mounts-banded-route.tsx"),
        'import { Banded } from "./lazy-barrel";\nexport default function Page() {\n  return <Banded />;\n}\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "mounts-banded-route.tsx"))).toBe(true);

      // The band rendered directly inside an exported helper of a module the route
      // *does* reach, but never mounts. This is the case the reachability-scoped
      // band check owns: hop filtering cannot catch it, because the module is
      // legitimately reached for its other export.
      writeFileSync(
        path.join(dir, "mixed-exports.tsx"),
        "export function Plain() {\n  return <div />;\n}\n" +
          `export function Helper() {\n  return <${BAND_IDENTIFIER} modeId="documents" />;\n}\n`,
        "utf8",
      );
      writeFileSync(
        path.join(dir, "mounts-plain-export-route.tsx"),
        'import { Plain } from "./mixed-exports";\nexport default function Page() {\n  return <Plain />;\n}\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "mounts-plain-export-route.tsx"))).toBe(false);

      // Same module, mounting the export that does render it.
      writeFileSync(
        path.join(dir, "mounts-helper-export-route.tsx"),
        'import { Helper } from "./mixed-exports";\nexport default function Page() {\n  return <Helper />;\n}\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "mounts-helper-export-route.tsx"))).toBe(true);

      // JSX inside an exported helper the route never renders is not a mount.
      writeFileSync(
        path.join(dir, "unmounted-helper-route.tsx"),
        'import { Banded } from "./banded-child";\n' +
          "export function Helper() {\n  return <Banded />;\n}\n" +
          "export default function Page() {\n  return <div />;\n}\n",
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "unmounted-helper-route.tsx"))).toBe(false);

      // A bare side-effect import executes the module but renders nothing.
      writeFileSync(
        path.join(dir, "side-effect-route.tsx"),
        'import "./banded-child";\nexport default function Page() {\n  return <div />;\n}\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "side-effect-route.tsx"))).toBe(false);

      // The Next.js object-wrapper shape, which global-search-shell.tsx uses for
      // ClinicalDashboard. Selecting the plain export must not drag in the sibling
      // that renders the band; before this was handled the wrapper returned no name
      // and the walk fell back to following every export.
      writeFileSync(
        path.join(dir, "wrapper-plain-route.tsx"),
        'const Lazy = dynamic(() => import("./lazy-barrel").then((mod) => ({ default: mod.Plain })));\n' +
          "export default Lazy;\n",
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "wrapper-plain-route.tsx"))).toBe(false);

      // Same wrapper selecting the banded export does reach it.
      writeFileSync(
        path.join(dir, "wrapper-banded-route.tsx"),
        'const Lazy = dynamic(() => import("./mixed-exports").then((mod) => ({ default: mod.Helper })));\n' +
          "export default Lazy;\n",
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "wrapper-banded-route.tsx"))).toBe(true);

      // A dynamic import whose result is discarded is a preload, not a mount.
      writeFileSync(
        path.join(dir, "preload-route.tsx"),
        "export default function Page() {\n" +
          '  useEffect(() => {\n    void import("./default-banded-child");\n  }, []);\n' +
          "  return <div />;\n}\n",
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "preload-route.tsx"))).toBe(false);

      // A type-only import is erased at runtime, so it cannot mount the band even
      // though the identifier appears in the mounted component's annotations.
      writeFileSync(
        path.join(dir, "type-only-route.tsx"),
        'import type { Banded } from "./banded-child";\n' +
          "export default function Page({ render }: { render?: typeof Banded }) {\n" +
          "  void render;\n  return <div />;\n}\n",
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "type-only-route.tsx"))).toBe(false);

      // A *value* import used only in a type position is erased too. This repo does
      // not enforce `consistent-type-imports`, so this is not necessarily spelled
      // `import type` — and `ComponentProps<typeof X>` genuinely needs the value
      // import while never mounting it.
      // The annotation must be inline on the scanned declaration: a top-level
      // `type Props = …` alias is never scanned at all, so it would pass for the
      // wrong reason and prove nothing.
      writeFileSync(
        path.join(dir, "type-position-route.tsx"),
        'import { Banded } from "./banded-child";\n' +
          "export default function Page(props: { render?: typeof Banded }) {\n" +
          "  void props;\n  return <div />;\n}\n",
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "type-position-route.tsx"))).toBe(false);

      // A non-exported local the mounted component does render is reachable.
      writeFileSync(
        path.join(dir, "indirect-route.tsx"),
        'import { Banded } from "./banded-child";\n' +
          "function Inner() {\n  return <Banded />;\n}\n" +
          "export default function Page() {\n  return <Inner />;\n}\n",
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "indirect-route.tsx"))).toBe(true);

      // The regression this gate exists to catch: the results component is still
      // imported, but nothing renders it. A walk that follows every specifier
      // reports adoption here, which is how gutting a real page to `<div />` with
      // its imports intact stayed green.
      writeFileSync(
        path.join(dir, "imported-only-route.tsx"),
        'import { Banded } from "./banded-child";\nexport default function Page() {\n  return <div />;\n}\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "imported-only-route.tsx"))).toBe(false);

      // A wrapper page mounts with no JSX of its own, so a default re-export of
      // an imported binding has to count.
      writeFileSync(
        path.join(dir, "reexport-route.tsx"),
        'import { Banded } from "./banded-child";\nexport default Banded;\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "reexport-route.tsx"))).toBe(true);

      // A *named* re-export is not a mount. Re-exporting `Banded` renders
      // nothing, so a page whose own default renders `<div />` must still be
      // reported as an orphan — the false green Codex found on #1400.
      writeFileSync(
        path.join(dir, "named-reexport-route.tsx"),
        'import { Banded } from "./banded-child";\n' +
          "export { Banded };\n" +
          "export default function Page() {\n  return <div />;\n}\n",
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "named-reexport-route.tsx"))).toBe(false);

      // Same hole in one statement rather than two. `export { Banded } from "…"`
      // took the re-export path and was followed unconditionally.
      writeFileSync(
        path.join(dir, "direct-named-reexport-route.tsx"),
        'export { Banded } from "./banded-child";\nexport default function Page() {\n  return <div />;\n}\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "direct-named-reexport-route.tsx"))).toBe(false);

      // And `export * from "…"`, which re-exports the band component by name
      // without mounting it either.
      writeFileSync(
        path.join(dir, "star-reexport-route.tsx"),
        'export * from "./banded-child";\nexport default function Page() {\n  return <div />;\n}\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "star-reexport-route.tsx"))).toBe(false);

      // But a default re-export still is a mount: this page's default component
      // *is* the banded one.
      writeFileSync(
        path.join(dir, "default-reexport-route.tsx"),
        'export { Banded as default } from "./banded-child";\n',
        "utf8",
      );
      expect(routeReachesBand(path.join(dir, "default-reexport-route.tsx"))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    }
  });
});
