import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  hasUseClientDirective,
  parseModuleSource,
  relative,
  resolveModule,
  runtimeGraph,
} from "./helpers/module-graph";

// React Server Component boundary guard.
//
// Two ways of crossing the RSC boundary wrongly are invisible to every gate this
// repository already runs:
//
//   Class A - an event handler on the server side. A component that renders
//   `<button onClick={...}>` without a `"use client"` directive, mounted inside
//   a Server Component, makes React try to serialise the handler into the flight
//   stream and the route throws "Event handlers cannot be passed to Client
//   Component props" on every request. `tsc` does not model the boundary; jsdom
//   has no boundary at all (an `onClick` is perfectly legal in a client tree);
//   and `next build` compiles a Dynamic route without ever rendering it.
//
//   Class B - a Server Component reading *data* exported from a client module.
//   Next replaces such an export with a client-reference proxy rather than the
//   real value, so `someArray.flatMap(...)` fails with "flatMap is not a
//   function" and the build dies with "Failed to collect configuration for
//   /route". Importing a client *component* and rendering it is completely
//   legitimate; importing its data and operating on it is not.
//
// Both analysers below are pure source/graph functions, unit-tested against
// synthetic fixtures in both directions (the bug must be reported; the
// legitimate neighbour must not be), and then run across the real tree. The
// fixtures carry the proof: this branch is cut from `main`, where neither bug
// exists, so a green real-tree run alone would prove nothing.

type AnyNode = Record<string, unknown>;

// Keys that only ever hold TypeScript type positions or bookkeeping. A binding
// referenced from a type annotation vanishes at runtime and cannot fail, so
// descending into these would manufacture false positives in Check B.
const NON_RUNTIME_KEYS = new Set([
  "loc",
  "comments",
  "leadingComments",
  "trailingComments",
  "innerComments",
  "typeAnnotation",
  "typeParameters",
  "returnType",
  "typeArguments",
  "superTypeArguments",
  "superTypeParameters",
  "implements",
]);

// TS nodes that still wrap a real runtime expression (`x as T`, `x satisfies T`,
// `x!`, `<T>x`, `f<T>`): descend into the expression only. Every other `TS*`
// node is a pure type position.
const TS_EXPRESSION_WRAPPERS = new Set([
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSNonNullExpression",
  "TSTypeAssertion",
  "TSInstantiationExpression",
]);

// TS nodes that carry ordinary runtime code in their bodies.
const TS_RUNTIME_CONTAINERS = new Set([
  "TSModuleDeclaration",
  "TSModuleBlock",
  "TSEnumDeclaration",
  "TSEnumMember",
  "TSExportAssignment",
]);

function walkAst(root: unknown, visit: (node: AnyNode, parent: AnyNode | null) => void) {
  const step = (node: unknown, parent: AnyNode | null) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) step(child, parent);
      return;
    }
    const current = node as AnyNode;
    if (typeof current.type !== "string") return;

    visit(current, parent);

    if (current.type.startsWith("TS") && !TS_RUNTIME_CONTAINERS.has(current.type)) {
      if (TS_EXPRESSION_WRAPPERS.has(current.type)) step(current.expression, current);
      return;
    }

    for (const [key, value] of Object.entries(current)) {
      if (NON_RUNTIME_KEYS.has(key)) continue;
      step(value, current);
    }
  };
  step(root, null);
}

function lineOf(node: AnyNode) {
  const loc = node.loc as { start?: { line?: number } } | null | undefined;
  return loc?.start?.line ?? 0;
}

function readSource(filePath: string) {
  return fs.readFileSync(filePath, "utf8");
}

/* ------------------------------------------------------------------ *
 * Check A - event handlers on the server side of the boundary         *
 * ------------------------------------------------------------------ */

/** A JSX element name: `<Card />` is `{ root: "Card" }`, `<Tabs.List />` is `{ root: "Tabs", member: "List" }`. */
export type RenderedElement = { root: string; member: string | null };

/**
 * An `on*` JSX attribute whose value is provably a function. `target` is the
 * element it sits on: `null` for an intrinsic host element (`<button>`), or the
 * component's JSX name, which the render walk resolves to decide whether the
 * prop crosses the boundary.
 */
export type EventHandlerFinding = {
  attribute: string;
  line: number;
  target: RenderedElement | null;
};

export type ComponentDeclaration = {
  handlers: EventHandlerFinding[];
  renders: RenderedElement[];
};

export type ModuleComponents = {
  isClient: boolean;
  /** Top-level declarations by exported/local name. `"default"` is the default export. */
  declarations: Map<string, ComponentDeclaration>;
  /** Local binding name -> the module it came from and the name it was exported under. */
  imports: Map<string, { specifier: string; imported: string }>;
  /** `export { local as exported } from "spec"`. */
  reExports: { specifier: string; exported: string; local: string }[];
  /** `export * from "spec"`. */
  starReExports: string[];
  /** `export default Foo` - the default export aliases a local declaration. */
  defaultAlias: string | null;
};

/** Statements with no top-level name of their own are attributed here. */
const MODULE_SCOPE = "*module*";

function jsxRootName(nameNode: unknown): RenderedElement | null {
  if (!nameNode || typeof nameNode !== "object") return null;
  const current = nameNode as AnyNode;
  if (current.type === "JSXIdentifier" && typeof current.name === "string") {
    // Lowercase names are intrinsic host elements (`div`, `button`), never components.
    return /^[a-z]/.test(current.name) ? null : { root: current.name, member: null };
  }
  if (current.type === "JSXMemberExpression") {
    const object = current.object as AnyNode | undefined;
    const property = current.property as AnyNode | undefined;
    if (object?.type === "JSXIdentifier" && typeof object.name === "string") {
      return {
        root: object.name,
        member: typeof property?.name === "string" ? property.name : null,
      };
    }
    return jsxRootName(object);
  }
  return null;
}

function isHostElement(nameNode: unknown) {
  const current = nameNode as AnyNode | undefined;
  return current?.type === "JSXIdentifier" && typeof current.name === "string" && /^[a-z]/.test(current.name);
}

/** Names bound to a function literal anywhere in the module. */
function functionValuedNames(root: unknown) {
  const names = new Set<string>();
  walkAst(root, (current) => {
    if (current.type === "FunctionDeclaration") {
      const id = current.id as AnyNode | undefined;
      if (id?.type === "Identifier" && typeof id.name === "string") names.add(id.name);
      return;
    }
    if (current.type === "VariableDeclarator") {
      const id = current.id as AnyNode | undefined;
      const init = current.init as AnyNode | undefined;
      if (
        id?.type === "Identifier" &&
        typeof id.name === "string" &&
        (init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression")
      ) {
        names.add(id.name);
      }
    }
  });
  return names;
}

/**
 * Whether a JSX attribute value is *certainly* a function at render time.
 *
 * This is the difference between a defect and noise. `onClick={() => reset()}`
 * and `onClick={handleReset}` (a local function) always serialise and always
 * throw. `onClick={action.onClick}` inside a generic template does not: the
 * value comes from data, and `<ModeHomeTemplate actions={[]} />` never renders
 * that branch at all. Only the certain shapes are reported.
 */
function provablyFunctionValue(value: unknown, functionNames: Set<string>): boolean {
  const current = value as AnyNode | undefined;
  if (!current || current.type !== "JSXExpressionContainer") return false;

  const unwrap = (node: unknown): AnyNode | undefined => {
    const expression = node as AnyNode | undefined;
    if (!expression) return undefined;
    if (TS_EXPRESSION_WRAPPERS.has(expression.type as string)) return unwrap(expression.expression);
    return expression;
  };

  const expression = unwrap(current.expression);
  if (!expression) return false;
  if (expression.type === "ArrowFunctionExpression" || expression.type === "FunctionExpression") return true;
  if (expression.type === "Identifier" && typeof expression.name === "string") {
    return functionNames.has(expression.name);
  }
  if (expression.type === "CallExpression") {
    const callee = expression.callee as AnyNode | undefined;
    const property = callee?.property as AnyNode | undefined;
    return callee?.type === "MemberExpression" && property?.name === "bind";
  }
  return false;
}

function collectDeclaration(node: unknown, functionNames: Set<string>): ComponentDeclaration {
  const handlers: EventHandlerFinding[] = [];
  const renders: RenderedElement[] = [];
  walkAst(node, (current) => {
    if (current.type !== "JSXOpeningElement") return;
    const rendered = jsxRootName(current.name);
    if (rendered) renders.push(rendered);
    const host = isHostElement(current.name);
    if (!rendered && !host) return;

    for (const attribute of (current.attributes as AnyNode[] | undefined) ?? []) {
      if (attribute.type !== "JSXAttribute") continue;
      const name = attribute.name as AnyNode | undefined;
      if (!name || name.type !== "JSXIdentifier" || typeof name.name !== "string") continue;
      if (!/^on[A-Z]/.test(name.name)) continue;
      if (!provablyFunctionValue(attribute.value, functionNames)) continue;
      handlers.push({ attribute: name.name, line: lineOf(attribute), target: rendered });
    }
  });
  return { handlers, renders };
}

/**
 * Decompose a module into the top-level declarations a render walk can step
 * through: what each one renders, and what event handlers it carries.
 */
export function moduleComponents(sourceText: string): ModuleComponents {
  const source = parseModuleSource(sourceText);
  const isClient = hasUseClientDirective(source);

  const declarationNodes: { name: string; node: unknown }[] = [];
  const looseStatements: unknown[] = [];
  const imports = new Map<string, { specifier: string; imported: string }>();
  const reExports: { specifier: string; exported: string; local: string }[] = [];
  const starReExports: string[] = [];
  let defaultAlias: string | null = null;

  const addVariableDeclaration = (declaration: AnyNode) => {
    let matched = false;
    for (const declarator of (declaration.declarations as AnyNode[] | undefined) ?? []) {
      const id = declarator.id as AnyNode | undefined;
      if (id?.type === "Identifier" && typeof id.name === "string") {
        declarationNodes.push({ name: id.name, node: declarator });
        matched = true;
      }
    }
    return matched;
  };

  for (const statement of source.program.body as unknown as AnyNode[]) {
    switch (statement.type) {
      case "ImportDeclaration": {
        if (statement.importKind === "type") break;
        const specifier = (statement.source as AnyNode).value as string;
        for (const importSpecifier of (statement.specifiers as AnyNode[]) ?? []) {
          const local = (importSpecifier.local as AnyNode).name as string;
          if (importSpecifier.type === "ImportDefaultSpecifier") {
            imports.set(local, { specifier, imported: "default" });
          } else if (importSpecifier.type === "ImportNamespaceSpecifier") {
            imports.set(local, { specifier, imported: "*" });
          } else if (importSpecifier.type === "ImportSpecifier" && importSpecifier.importKind !== "type") {
            const imported = importSpecifier.imported as AnyNode;
            const name = (imported.name ?? imported.value) as string | undefined;
            if (name) imports.set(local, { specifier, imported: name });
          }
        }
        break;
      }
      case "ExportDefaultDeclaration": {
        const declaration = statement.declaration as AnyNode;
        if (declaration.type === "Identifier" && typeof declaration.name === "string") {
          defaultAlias = declaration.name;
        } else {
          declarationNodes.push({ name: "default", node: declaration });
          const id = declaration.id as AnyNode | undefined;
          if (id?.type === "Identifier" && typeof id.name === "string") {
            declarationNodes.push({ name: id.name, node: declaration });
          }
        }
        break;
      }
      case "ExportNamedDeclaration": {
        const sourceNode = statement.source as AnyNode | null | undefined;
        if (sourceNode) {
          const specifier = sourceNode.value as string;
          for (const exportSpecifier of (statement.specifiers as AnyNode[]) ?? []) {
            if (exportSpecifier.type !== "ExportSpecifier") continue;
            const local = (exportSpecifier.local as AnyNode).name as string;
            const exported = exportSpecifier.exported as AnyNode;
            reExports.push({
              specifier,
              exported: (exported.name ?? exported.value) as string,
              local,
            });
          }
          break;
        }
        const declaration = statement.declaration as AnyNode | null | undefined;
        if (!declaration) break;
        if (declaration.type === "VariableDeclaration") {
          if (!addVariableDeclaration(declaration)) looseStatements.push(statement);
          break;
        }
        const id = declaration.id as AnyNode | undefined;
        if (id?.type === "Identifier" && typeof id.name === "string") {
          declarationNodes.push({ name: id.name, node: declaration });
        } else {
          looseStatements.push(statement);
        }
        break;
      }
      case "ExportAllDeclaration": {
        starReExports.push((statement.source as AnyNode).value as string);
        break;
      }
      case "FunctionDeclaration":
      case "ClassDeclaration": {
        const id = statement.id as AnyNode | undefined;
        if (id?.type === "Identifier" && typeof id.name === "string") {
          declarationNodes.push({ name: id.name, node: statement });
        } else {
          looseStatements.push(statement);
        }
        break;
      }
      case "VariableDeclaration": {
        if (!addVariableDeclaration(statement)) looseStatements.push(statement);
        break;
      }
      default:
        looseStatements.push(statement);
        break;
    }
  }

  const functionNames = functionValuedNames(source);
  const declarations = new Map<string, ComponentDeclaration>();
  for (const { name, node } of declarationNodes) {
    declarations.set(name, collectDeclaration(node, functionNames));
  }
  const loose = collectDeclaration(looseStatements, functionNames);
  if (loose.handlers.length > 0 || loose.renders.length > 0) declarations.set(MODULE_SCOPE, loose);

  return { isClient, declarations, imports, reExports, starReExports, defaultAlias };
}

export type HandlerViolation = {
  file: string;
  component: string;
  attribute: string;
  target: string;
  line: number;
  via: string[];
};

/**
 * Walk the *render* graph from every Server Component entry point and report
 * event handlers found on the server side of the boundary.
 *
 * Anchoring on rendering rather than on imports is deliberate, and it is what
 * makes this check safe to leave switched on. This repository has shared UI
 * modules with no `"use client"` directive that export both a server-safe helper
 * (`cn`, `eyebrowText`, `EmptyState`) and an interactive component (`IconButton`,
 * a toggle switch, a filter `<select>`). A server page importing the helper does
 * not render the interactive component, and Next compiles that component into
 * the client graph for whichever client module actually uses it. An
 * import-reachability version of this check reported six such modules on a clean
 * `main` - none of them a live defect. A guard that cries wolf gets disabled,
 * so the walk steps only where React would actually step: from a component into
 * the components it names in its own JSX.
 *
 * Stops at any module carrying `"use client"` - that is the boundary, and
 * everything below it is legitimately client code.
 *
 * Two further narrowings, each of which removed a false positive measured on a
 * clean `main`:
 *
 *   1. The attribute value must be *provably* a function (see
 *      `provablyFunctionValue`). `onClick={action.onClick}` in a generic
 *      template is data-dependent - `<ModeHomeTemplate actions={[]} />` never
 *      renders it - and is not reported.
 *   2. The attribute must sit on an intrinsic host element (`<button>`) or on a
 *      component imported from a `"use client"` module. Handing a function to
 *      *another Server Component's* prop is legal and stays unreported; if that
 *      component then puts it on a host element, the check catches it there.
 *
 * Known fail-open gaps (misses, never false alarms): a handler arriving through
 * props rather than defined locally; a component handed over as a value rather
 * than named in JSX (`<Shell render={Toolbar} />`); a component reached through
 * `next/dynamic`; a default export wrapped in a higher-order call
 * (`export default withThing(Page)`); spread props (`{...handlers}`), which
 * carry no statically visible attribute name; and an `on*` prop on a component
 * imported from a bare package specifier (`next/link`), which this resolver
 * does not follow into `node_modules`.
 */
export function serverRenderedHandlerViolations(
  entries: string[],
  load: (file: string) => ModuleComponents,
  resolve: (fromFile: string, specifier: string) => string | null,
): HandlerViolation[] {
  const violations: HandlerViolation[] = [];
  const visited = new Set<string>();
  const queue: { file: string; name: string; via: string[] }[] = [];

  for (const entry of entries) {
    if (load(entry).isClient) continue;
    queue.push({ file: entry, name: "default", via: [entry] });
    queue.push({ file: entry, name: MODULE_SCOPE, via: [entry] });
  }

  const enqueueExternal = (fromFile: string, specifier: string, exported: string, via: string[], label: string) => {
    const target = resolve(fromFile, specifier);
    if (!target) return;
    if (load(target).isClient) return;
    queue.push({ file: target, name: exported, via: [...via, label] });
  };

  while (queue.length > 0) {
    const { file, name, via } = queue.pop()!;
    const key = `${file}::${name}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const module = load(file);
    let declaration = module.declarations.get(name);
    if (!declaration && name === "default" && module.defaultAlias) {
      declaration = module.declarations.get(module.defaultAlias);
    }

    if (!declaration) {
      // The name is not declared here: follow it through re-export barrels.
      const imported = module.imports.get(name);
      if (imported) {
        enqueueExternal(file, imported.specifier, imported.imported, via, `${name} (re-export)`);
      }
      for (const reExport of module.reExports) {
        if (reExport.exported === name) {
          enqueueExternal(file, reExport.specifier, reExport.local, via, `${name} (re-export)`);
        }
      }
      for (const specifier of module.starReExports) {
        enqueueExternal(file, specifier, name, via, `${name} (star re-export)`);
      }
      continue;
    }

    for (const handler of declaration.handlers) {
      const report = (target: string) =>
        violations.push({ file, component: name, attribute: handler.attribute, target, line: handler.line, via });

      if (handler.target === null) {
        // An intrinsic host element rendered on the server: always a throw.
        report("host element");
        continue;
      }
      const imported = module.imports.get(handler.target.root);
      // A locally declared component is another Server Component; a function
      // prop between two Server Components never crosses the boundary.
      if (!imported) continue;
      const targetFile = resolve(file, imported.specifier);
      // A bare package specifier is not resolvable here - do not guess.
      if (!targetFile) continue;
      if (load(targetFile).isClient) report(`<${handler.target.root}>`);
    }

    for (const rendered of declaration.renders) {
      const imported = module.imports.get(rendered.root);
      if (imported) {
        const exported = imported.imported === "*" ? (rendered.member ?? "default") : imported.imported;
        enqueueExternal(file, imported.specifier, exported, via, `<${rendered.root}>`);
        continue;
      }
      if (module.declarations.has(rendered.root)) {
        queue.push({ file, name: rendered.root, via: [...via, `<${rendered.root}>`] });
      }
    }
  }

  return violations;
}

/* ------------------------------------------------------------------ *
 * Check B - a server module reading data out of a client module        *
 * ------------------------------------------------------------------ */

export type ClientDataFinding = {
  binding: string;
  specifier: string;
  usage: "member" | "call";
  line: number;
};

function patternNames(node: unknown, into: Set<string>) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) patternNames(child, into);
    return;
  }
  const current = node as AnyNode;
  if (typeof current.type !== "string") return;
  if (current.type === "Identifier" && typeof current.name === "string") {
    into.add(current.name);
    return;
  }
  if (current.type === "ObjectProperty") {
    patternNames(current.value, into);
    return;
  }
  for (const key of ["elements", "properties", "argument", "left", "id", "params"]) {
    if (key in current) patternNames(current[key], into);
  }
}

/**
 * Bindings imported from a `"use client"` module and then *read* - member
 * access (`binding.something`) or a call (`binding()`).
 *
 * Deliberately NOT flagged, because all of these are correct and common:
 *   - a client component used as a JSX element name (`<ClientCard />`), which
 *     Babel models as `JSXIdentifier`, never `Identifier`;
 *   - a compound client component (`<Tabs.List />`), likewise a JSX name;
 *   - a binding passed along as a value (`<Slot render={ClientCard} />`,
 *     `export { ClientCard }`, `register(ClientCard)`);
 *   - anything imported with `import type` or a `{ type X }` specifier, which
 *     does not exist at runtime;
 *   - a reference from a TypeScript type position.
 *
 * Fails open on shadowing: if the module declares its own binding anywhere with
 * the same name, that name is dropped entirely rather than risk attributing an
 * inner-scope variable's member access to the import.
 *
 * Module granularity is deliberate here, unlike Check A. A server-side module
 * that imports client data holds a client-reference proxy no matter which
 * function reads it, and the read is a hard throw wherever it runs.
 */
export function clientDataUsages(
  sourceText: string,
  isClientSpecifier: (specifier: string) => boolean,
): ClientDataFinding[] {
  const source = parseModuleSource(sourceText);
  if (hasUseClientDirective(source)) return [];

  const bindings = new Map<string, string>();
  for (const statement of source.program.body) {
    if (statement.type !== "ImportDeclaration") continue;
    if (statement.importKind === "type") continue;
    if (!isClientSpecifier(statement.source.value)) continue;
    for (const specifier of statement.specifiers) {
      if (specifier.type === "ImportSpecifier" && specifier.importKind === "type") continue;
      bindings.set(specifier.local.name, statement.source.value);
    }
  }
  if (bindings.size === 0) return [];

  const shadowed = new Set<string>();
  walkAst(source, (node) => {
    const collect = (value: unknown) => patternNames(value, shadowed);
    switch (node.type) {
      case "VariableDeclarator":
      case "ClassDeclaration":
      case "ClassExpression":
        collect(node.id);
        break;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ArrowFunctionExpression":
      case "ObjectMethod":
      case "ClassMethod":
        collect(node.id);
        collect(node.params);
        break;
      case "CatchClause":
        collect(node.param);
        break;
      default:
        break;
    }
  });
  for (const name of shadowed) bindings.delete(name);
  if (bindings.size === 0) return [];

  const findings: ClientDataFinding[] = [];
  walkAst(source, (node, parent) => {
    if (node.type !== "Identifier" || typeof node.name !== "string") return;
    const specifier = bindings.get(node.name);
    if (!specifier || !parent) return;
    const parentType = typeof parent.type === "string" ? parent.type : "";

    // The import declaration itself, and re-exports, are not reads.
    if (parentType.startsWith("Import") || parentType === "ExportSpecifier") return;
    // `something.name` - a property key that merely shares the binding's name.
    if (
      (parentType === "MemberExpression" || parentType === "OptionalMemberExpression") &&
      parent.property === node &&
      parent.computed !== true
    ) {
      return;
    }
    // `{ name: value }` - an object/class key sharing the binding's name.
    if (
      ["ObjectProperty", "ObjectMethod", "ClassProperty", "ClassMethod"].includes(parentType) &&
      parent.key === node &&
      parent.computed !== true
    ) {
      return;
    }

    if ((parentType === "MemberExpression" || parentType === "OptionalMemberExpression") && parent.object === node) {
      findings.push({ binding: node.name, specifier, usage: "member", line: lineOf(node) });
      return;
    }
    if (
      (parentType === "CallExpression" || parentType === "OptionalCallExpression" || parentType === "NewExpression") &&
      parent.callee === node
    ) {
      findings.push({ binding: node.name, specifier, usage: "call", line: lineOf(node) });
    }
  });
  return findings;
}

/* ------------------------------------------------------------------ *
 * Check B's boundary walk (import reachability)                       *
 * ------------------------------------------------------------------ */

/**
 * Every module reachable from a Server Component entry point *without crossing
 * a `"use client"` module*, mapped to the entry points that reach it. The
 * directive is the boundary: everything below it is legitimately client code.
 *
 * The reaching entry point is carried because "this file reads client data" is
 * not actionable on its own - the point is which server route drags it in.
 */
export function serverReachableModules(
  entries: string[],
  graph: Map<string, string[]>,
  isClient: (file: string) => boolean,
): Map<string, string[]> {
  const reachedBy = new Map<string, string[]>();
  const record = (file: string, entry: string) => {
    const existing = reachedBy.get(file);
    if (existing) {
      if (!existing.includes(entry)) existing.push(entry);
    } else {
      reachedBy.set(file, [entry]);
    }
  };

  for (const entry of entries) {
    if (isClient(entry)) continue;
    const seen = new Set<string>([entry]);
    const pending = [entry];
    while (pending.length > 0) {
      const file = pending.pop()!;
      record(file, entry);
      for (const dependency of graph.get(file) ?? []) {
        if (seen.has(dependency) || isClient(dependency)) continue;
        seen.add(dependency);
        pending.push(dependency);
      }
    }
  }
  return reachedBy;
}

/* ------------------------------------------------------------------ *
 * The real tree                                                       *
 * ------------------------------------------------------------------ */

const SERVER_ENTRY_PATTERN = /^src\/app\/(?:.*\/)?(?:page|layout)\.tsx$/;

// Scope decision: mockups are IN. `src/app/mockups/**` is exempt from the
// button-wiring and route-reachability gates because those routes 404 in
// production - but two subtrees do not 404. `DEVELOPER_GATED_PATH_PREFIXES`
// (`/mockups/development`, `/mockups/caring-contacts`) are proxied through to a
// signed-in-administrator gate in `src/app/mockups/layout.tsx` and render for
// real. A boundary violation there is a live 500, not scratch. For the rest, the
// failure mode is a hard runtime throw that breaks the page for the design
// review audience the mockups exist to serve, so a static check that costs
// nothing is worth keeping on.
let boundaryStateCache: ReturnType<typeof computeBoundaryState> | undefined;

function computeBoundaryState() {
  const { files, fileSet, graph, parsed } = runtimeGraph();
  const clientFiles = new Set(files.filter((file) => hasUseClientDirective(parsed.get(file)!.source)));
  const isClient = (file: string) => clientFiles.has(file);
  const entries = files.filter((file) => SERVER_ENTRY_PATTERN.test(relative(file)) && !isClient(file));

  const componentCache = new Map<string, ModuleComponents>();
  const load = (file: string) => {
    let components = componentCache.get(file);
    if (!components) {
      components = moduleComponents(readSource(file));
      componentCache.set(file, components);
    }
    return components;
  };
  const resolve = (fromFile: string, specifier: string) => resolveModule(fromFile, specifier, fileSet);

  return {
    fileSet,
    isClient,
    entries,
    load,
    resolve,
    serverModules: serverReachableModules(entries, graph, isClient),
  };
}

function boundaryState() {
  boundaryStateCache ??= computeBoundaryState();
  return boundaryStateCache;
}

/* ------------------------------------------------------------------ *
 * Fixtures - the bug must be reported, the neighbour must not         *
 * ------------------------------------------------------------------ */

function fixtureProject(modules: Record<string, string>) {
  const parsedModules = new Map<string, ModuleComponents>();
  const load = (file: string) => {
    let components = parsedModules.get(file);
    if (!components) {
      const sourceText = modules[file];
      if (sourceText === undefined) throw new Error(`fixture module not found: ${file}`);
      components = moduleComponents(sourceText);
      parsedModules.set(file, components);
    }
    return components;
  };
  const resolve = (_fromFile: string, specifier: string) => (specifier in modules ? specifier : null);
  return { load, resolve };
}

const TOOLBAR_MODULE = `export function Toolbar() {
   function reset() {
     history.back();
   }
   return <button onClick={reset}>Reset</button>;
 }`;

const SHARED_UI_MODULE = `
import { cn } from "./cn";

export function EmptyState({ title }) {
  return <p className={cn("empty")}>{title}</p>;
}

export function IconButton({ onPress, label }) {
  return <button type="button" onClick={() => onPress()}>{label}</button>;
}
`;

describe("rsc boundary - check A: event handlers on the server side", () => {
  it("reports a handler rendered directly by a Server Component page", () => {
    const project = fixtureProject({
      "page.tsx": `export default function Page() {
         return <button onClick={() => revalidate()}>Refresh</button>;
       }`,
    });
    const violations = serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve);
    expect(
      violations.map(({ file, component, attribute, target }) => ({ file, component, attribute, target })),
    ).toEqual([{ file: "page.tsx", component: "default", attribute: "onClick", target: "host element" }]);
  });

  it("reports a handler in a module the server page renders through, and names the entry point", () => {
    const project = fixtureProject({
      "page.tsx": `import { Toolbar } from "./toolbar";
         export default function Page() {
           return <Toolbar />;
         }`,
      "./toolbar": TOOLBAR_MODULE,
    });
    const violations = serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve);
    expect(violations).toHaveLength(1);
    expect(violations[0]!.file).toBe("./toolbar");
    expect(violations[0]!.component).toBe("Toolbar");
    expect(violations[0]!.via).toEqual(["page.tsx", "<Toolbar>"]);
  });

  it("reports every handler-shaped attribute, not just onClick", () => {
    const project = fixtureProject({
      "page.tsx": `export default function Page() {
           return (
             <form onSubmit={() => submit()}>
               <input onChange={() => update()} onFocus={() => track()} />
             </form>
           );
         }`,
    });
    const violations = serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve);
    expect(violations.map((violation) => violation.attribute).sort()).toEqual(["onChange", "onFocus", "onSubmit"]);
  });

  it("reports a function handed to a client component's prop", () => {
    const project = fixtureProject({
      "page.tsx": `import { ClientCard } from "./client-card";
         export default function Page() {
           return <ClientCard onSelect={() => choose()} />;
         }`,
      "./client-card": `"use client";
         export function ClientCard({ onSelect }) {
           return <button onClick={onSelect}>Pick</button>;
         }`,
    });
    const violations = serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve);
    expect(violations.map(({ file, attribute, target }) => ({ file, attribute, target }))).toEqual([
      { file: "page.tsx", attribute: "onSelect", target: "<ClientCard>" },
    ]);
  });

  it("does not report a function handed to another Server Component's prop", () => {
    const project = fixtureProject({
      "page.tsx": `import { ServerList } from "./server-list";
         export default function Page() {
           return <ServerList onRender={(row) => row.label} />;
         }`,
      "./server-list": `export function ServerList({ onRender, rows = [] }) {
           return <ul>{rows.map(onRender)}</ul>;
         }`,
    });
    expect(serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve)).toEqual([]);
  });

  it("does not report a data-dependent handler in a generic template", () => {
    // The `ModeHomeTemplate` shape measured on main: the attribute is in the
    // source of a server-rendered component, but the value comes from data the
    // caller supplies as an empty array, so no function is ever serialised.
    const project = fixtureProject({
      "page.tsx": `import { ModeHome } from "./mode-home";
         export default function Page() {
           return <ModeHome actions={[]} />;
         }`,
      "./mode-home": `export function ModeHome({ actions }) {
           return (
             <div>
               {actions.map((action) =>
                 action.href ? (
                   <a key={action.title} href={action.href}>{action.title}</a>
                 ) : (
                   <button key={action.title} onClick={action.onClick}>{action.title}</button>
                 ),
               )}
             </div>
           );
         }`,
    });
    expect(serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve)).toEqual([]);
  });

  it('reports nothing when the page itself declares "use client"', () => {
    const project = fixtureProject({
      "page.tsx": `"use client";
         export default function Page() {
           return <button onClick={() => setOpen(true)}>Open</button>;
         }`,
    });
    expect(serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve)).toEqual([]);
  });

  it("stops at the boundary: a handler module reached only through a client module is not reported", () => {
    const project = fixtureProject({
      "page.tsx": `import { ClientCard } from "./client-card";
         export default function Page() {
           return <ClientCard />;
         }`,
      "./client-card": `"use client";
         import { Toolbar } from "./toolbar";
         export function ClientCard() {
           return <Toolbar />;
         }`,
      "./toolbar": TOOLBAR_MODULE,
    });
    expect(serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve)).toEqual([]);
  });

  it("does not report a sibling export the server page never renders", () => {
    const project = fixtureProject({
      "page.tsx": `import { EmptyState } from "./ui";
         export default function Page() {
           return <EmptyState title="None" />;
         }`,
      "./ui": SHARED_UI_MODULE,
      "./cn": `export const cn = (...parts) => parts.join(" ");`,
    });
    expect(serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve)).toEqual([]);
  });

  it("still reports that sibling export once a server page actually renders it", () => {
    const project = fixtureProject({
      "page.tsx": `import { IconButton } from "./ui";
         export default function Page() {
           return <IconButton label="Close" onPress={close} />;
         }`,
      "./ui": SHARED_UI_MODULE,
      "./cn": `export const cn = (...parts) => parts.join(" ");`,
    });
    const violations = serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve);
    // The page's own `onPress={close}` is not provably a function (`close` is
    // not declared here); the inline `onClick` inside the now-server-rendered
    // IconButton is the defect.
    expect(violations.map(({ file, component, attribute }) => ({ file, component, attribute }))).toEqual([
      { file: "./ui", component: "IconButton", attribute: "onClick" },
    ]);
  });

  it("does not mistake a lowercase or valueless attribute for a handler", () => {
    const project = fixtureProject({
      "page.tsx": `export default function Page() {
           return <div online ononsense="x" onClick />;
         }`,
    });
    expect(serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve)).toEqual([]);
  });

  it("follows a default export aliased to a local declaration, and a barrel re-export", () => {
    const project = fixtureProject({
      "page.tsx": `import { Toolbar } from "./barrel";
         function Page() {
           return <Toolbar />;
         }
         export default Page;`,
      "./barrel": `export { Toolbar } from "./toolbar";`,
      "./toolbar": TOOLBAR_MODULE,
    });
    const violations = serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve);
    expect(violations.map((violation) => violation.file)).toEqual(["./toolbar"]);
  });

  it("never walks out of a client entry point", () => {
    const project = fixtureProject({
      "page.tsx": `"use client";
         import { Toolbar } from "./toolbar";
         export default function Page() {
           return <Toolbar />;
         }`,
      "./toolbar": TOOLBAR_MODULE,
    });
    expect(serverRenderedHandlerViolations(["page.tsx"], project.load, project.resolve)).toEqual([]);
  });
});

const isClientFixtureSpecifier = (specifier: string) => specifier === "./client-catalog";

describe("rsc boundary - check B: server modules reading client data", () => {
  it("reports the exact class-2 bug: a server module operating on a client export", () => {
    const findings = clientDataUsages(
      `import { MODE_ROWS } from "./client-catalog";

       export default function Page() {
         return <ul>{MODE_ROWS.flatMap((row) => row.items)}</ul>;
       }`,
      isClientFixtureSpecifier,
    );
    expect(findings).toEqual([{ binding: "MODE_ROWS", specifier: "./client-catalog", usage: "member", line: 4 }]);
  });

  it("reports calling a value imported from a client module", () => {
    const findings = clientDataUsages(
      `import { buildRows } from "./client-catalog";
       export const rows = buildRows();`,
      isClientFixtureSpecifier,
    );
    expect(findings.map((finding) => finding.usage)).toEqual(["call"]);
  });

  it("reports namespace member access into a client module", () => {
    const findings = clientDataUsages(
      `import * as catalog from "./client-catalog";
       export const count = catalog.rows.length;`,
      isClientFixtureSpecifier,
    );
    expect(findings.map((finding) => finding.binding)).toEqual(["catalog"]);
  });

  it("reports nothing for a client component imported and rendered as JSX", () => {
    expect(
      clientDataUsages(
        `import { ClientCard } from "./client-catalog";
         export default function Page() {
           return <ClientCard title="Modes" />;
         }`,
        isClientFixtureSpecifier,
      ),
    ).toEqual([]);
  });

  it("reports nothing for a compound client component used as a JSX name", () => {
    expect(
      clientDataUsages(
        `import { Tabs } from "./client-catalog";
         export default function Page() {
           return (
             <Tabs>
               <Tabs.List />
             </Tabs>
           );
         }`,
        isClientFixtureSpecifier,
      ),
    ).toEqual([]);
  });

  it("reports nothing for a client component passed along as a value", () => {
    expect(
      clientDataUsages(
        `import { ClientCard } from "./client-catalog";
         export { ClientCard };
         export default function Page() {
           return <Slot render={ClientCard} fallback={[ClientCard]} />;
         }`,
        isClientFixtureSpecifier,
      ),
    ).toEqual([]);
  });

  it("reports nothing for a type-only import from a client module", () => {
    expect(
      clientDataUsages(
        `import type { CatalogRow } from "./client-catalog";
         import { type OtherRow, ClientCard } from "./client-catalog";
         const value: CatalogRow.Nested = load();
         export const rows: OtherRow[] = [];
         export default () => <ClientCard row={value} />;`,
        isClientFixtureSpecifier,
      ),
    ).toEqual([]);
  });

  it("reports nothing for member access on a module that is not a client module", () => {
    expect(
      clientDataUsages(
        `import { MODE_ROWS } from "./server-catalog";
         export const first = MODE_ROWS.at(0);`,
        isClientFixtureSpecifier,
      ),
    ).toEqual([]);
  });

  it("reports nothing for a same-named property key or a shadowing local", () => {
    expect(
      clientDataUsages(
        `import { ClientCard } from "./client-catalog";
         export const registry = { ClientCard, other: shape.ClientCard };
         export default () => <ClientCard />;`,
        isClientFixtureSpecifier,
      ),
    ).toEqual([]);
    expect(
      clientDataUsages(
        `import { rows } from "./client-catalog";
         export function render(rows: string[]) {
           return rows.length;
         }`,
        isClientFixtureSpecifier,
      ),
    ).toEqual([]);
  });

  it("reports nothing when the reading module is itself a client module", () => {
    expect(
      clientDataUsages(
        `"use client";
         import { MODE_ROWS } from "./client-catalog";
         export const count = MODE_ROWS.length;`,
        isClientFixtureSpecifier,
      ),
    ).toEqual([]);
  });
});

describe("rsc boundary - the repository", () => {
  it("finds Server Component entry points to walk from", { timeout: 120_000 }, () => {
    const { entries, serverModules } = boundaryState();
    expect(entries.length).toBeGreaterThan(20);
    expect(serverModules.size).toBeGreaterThan(entries.length);
  });

  it("has no event handler on the server side of the boundary", { timeout: 120_000 }, () => {
    const { entries, load, resolve } = boundaryState();
    const violations = serverRenderedHandlerViolations(entries, load, resolve).map(
      (violation) =>
        `${relative(violation.file)}:${violation.line} ${violation.attribute} in <${violation.component}> - rendered via ${violation.via
          .map((step) => (step.startsWith("<") ? step : relative(step)))
          .join(" -> ")}`,
    );
    expect([...new Set(violations)].sort()).toEqual([]);
  });

  it("has no server module reading data out of a client module", { timeout: 120_000 }, () => {
    const { fileSet, isClient, serverModules } = boundaryState();
    const violations: string[] = [];
    for (const [file, reachingEntries] of serverModules) {
      const findings = clientDataUsages(readSource(file), (specifier) => {
        const target = resolveModule(file, specifier, fileSet);
        return target !== null && isClient(target);
      });
      for (const finding of findings) {
        violations.push(
          `${relative(file)}:${finding.line} ${finding.usage} on ${finding.binding} from ${finding.specifier} - reached by ${reachingEntries
            .slice(0, 3)
            .map(relative)
            .join(", ")}`,
        );
      }
    }
    expect(violations.sort()).toEqual([]);
  });
});
