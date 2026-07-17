import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const sourceRoots = [path.join(projectRoot, "src"), path.join(projectRoot, "worker")];
const extensions = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"];

function sourceFiles() {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filePath);
      else if (extensions.includes(path.extname(entry.name))) files.push(path.resolve(filePath));
    }
  };
  sourceRoots.forEach(visit);
  return files;
}

function parseModuleSource(sourceText: string) {
  return parse(sourceText, {
    sourceType: "module",
    plugins: ["jsx", "typescript", "importAttributes"],
  });
}

function moduleSpecifiersFromSource(_filePath: string, sourceText: string) {
  const staticImports = new Set<string>();
  const dynamicImports = new Set<string>();
  const source = parseModuleSource(sourceText);

  for (const statement of source.program.body) {
    if (statement.type === "ImportDeclaration") {
      const typeOnly =
        statement.importKind === "type" ||
        Boolean(
          !statement.specifiers.some((specifier) => specifier.type === "ImportDefaultSpecifier") &&
          statement.specifiers.some((specifier) => specifier.type === "ImportSpecifier") &&
          statement.specifiers.every(
            (specifier) => specifier.type === "ImportSpecifier" && specifier.importKind === "type",
          ),
        );
      if (!typeOnly) staticImports.add(statement.source.value);
    }
    if (
      (statement.type === "ExportNamedDeclaration" || statement.type === "ExportAllDeclaration") &&
      statement.source
    ) {
      const typeOnly =
        statement.exportKind === "type" ||
        Boolean(
          statement.type === "ExportNamedDeclaration" &&
          statement.specifiers.length > 0 &&
          statement.specifiers.every((specifier) => "exportKind" in specifier && specifier.exportKind === "type"),
        );
      if (!typeOnly) staticImports.add(statement.source.value);
    }
  }

  const visit = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const current = node as Record<string, unknown>;
    const argumentsList = Array.isArray(current.arguments) ? current.arguments : null;
    if (
      current.type === "CallExpression" &&
      current.callee &&
      argumentsList &&
      (argumentsList.length === 1 || argumentsList.length === 2)
    ) {
      const callee = current.callee as Record<string, unknown>;
      const moduleSpecifier = argumentsList[0] as Record<string, unknown> | undefined;
      if (callee.type === "Import" && moduleSpecifier) {
        if (moduleSpecifier.type === "StringLiteral" && typeof moduleSpecifier.value === "string") {
          dynamicImports.add(moduleSpecifier.value);
        } else if (
          moduleSpecifier.type === "TemplateLiteral" &&
          Array.isArray(moduleSpecifier.expressions) &&
          moduleSpecifier.expressions.length === 0 &&
          Array.isArray(moduleSpecifier.quasis) &&
          moduleSpecifier.quasis.length === 1
        ) {
          const cooked = ((moduleSpecifier.quasis[0] as Record<string, unknown>).value as Record<string, unknown>)
            ?.cooked;
          if (typeof cooked === "string") dynamicImports.add(cooked);
        }
      }
    }
    for (const value of Object.values(current)) {
      if (Array.isArray(value)) value.forEach(visit);
      else visit(value);
    }
  };
  visit(source);

  return { source, staticImports, dynamicImports };
}

function moduleSpecifiers(filePath: string) {
  return moduleSpecifiersFromSource(filePath, fs.readFileSync(filePath, "utf8"));
}

function resolveModule(fromFile: string, specifier: string, fileSet: Set<string>) {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join(projectRoot, "src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.resolve(path.dirname(fromFile), specifier);
  else return null;

  const candidates = [
    base,
    ...extensions.map((extension) => `${base}${extension}`),
    ...extensions.map((extension) => path.join(base, `index${extension}`)),
  ];
  return candidates.map((candidate) => path.resolve(candidate)).find((candidate) => fileSet.has(candidate)) ?? null;
}

let runtimeGraphCache: ReturnType<typeof buildRuntimeGraph> | undefined;

function buildRuntimeGraph() {
  const files = sourceFiles();
  const fileSet = new Set(files);
  const graph = new Map<string, string[]>();
  const parsed = new Map<string, ReturnType<typeof moduleSpecifiers>>();

  for (const file of files) {
    const modules = moduleSpecifiers(file);
    parsed.set(file, modules);
    const dependencies = [...modules.staticImports, ...modules.dynamicImports]
      .map((specifier) => resolveModule(file, specifier, fileSet))
      .filter((dependency): dependency is string => Boolean(dependency));
    graph.set(file, [...new Set(dependencies)]);
  }

  return { files, fileSet, graph, parsed };
}

function runtimeGraph() {
  runtimeGraphCache ??= buildRuntimeGraph();
  return runtimeGraphCache;
}

function runtimeCycles(graph: Map<string, string[]>) {
  let nextIndex = 0;
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const cycles: string[][] = [];

  const visit = (file: string) => {
    indexes.set(file, nextIndex);
    lowLinks.set(file, nextIndex);
    nextIndex += 1;
    stack.push(file);
    onStack.add(file);

    for (const dependency of graph.get(file) ?? []) {
      if (!indexes.has(dependency)) {
        visit(dependency);
        lowLinks.set(file, Math.min(lowLinks.get(file)!, lowLinks.get(dependency)!));
      } else if (onStack.has(dependency)) {
        lowLinks.set(file, Math.min(lowLinks.get(file)!, indexes.get(dependency)!));
      }
    }

    if (lowLinks.get(file) !== indexes.get(file)) return;
    const component: string[] = [];
    let current: string;
    do {
      current = stack.pop()!;
      onStack.delete(current);
      component.push(current);
    } while (current !== file);
    const hasSelfCycle = (graph.get(file) ?? []).includes(file);
    if (component.length > 1 || hasSelfCycle) cycles.push(component);
  };

  for (const file of graph.keys()) {
    if (!indexes.has(file)) visit(file);
  }
  return cycles;
}

function relative(filePath: string) {
  return path.relative(projectRoot, filePath).replaceAll("\\", "/");
}

describe("architecture boundaries", () => {
  it("tracks statically resolvable dynamic imports", () => {
    const parsed = moduleSpecifiersFromSource(
      "fixture.ts",
      'import(`./template`); import("./with-options", { with: { type: "json" } }); import(`./${name}`);',
    );

    expect([...parsed.dynamicImports]).toEqual(["./template", "./with-options"]);
  });

  it("counts a runtime self-import as a cycle", () => {
    const file = path.join(projectRoot, "src", "self.ts");
    expect(runtimeCycles(new Map([[file, [file]]]))).toEqual([[file]]);
  });

  it("has no runtime import cycles", () => {
    const { graph } = runtimeGraph();
    const cycles = runtimeCycles(graph).map((cycle) => cycle.map(relative).sort());
    expect(cycles).toEqual([]);
  });

  it("keeps server environment and provider modules out of the client graph", () => {
    const { files, graph, parsed } = runtimeGraph();
    const clientEntries = files.filter((file) => {
      const program = parsed.get(file)?.source.program;
      return program?.directives?.some((directive) => directive.value.value === "use client");
    });
    const clientGraph = new Set(clientEntries);
    const pending = [...clientEntries];
    while (pending.length) {
      const file = pending.pop()!;
      for (const dependency of graph.get(file) ?? []) {
        if (clientGraph.has(dependency)) continue;
        clientGraph.add(dependency);
        pending.push(dependency);
      }
    }

    const forbidden = new Set([
      "src/lib/env.ts",
      "src/lib/openai.ts",
      "src/lib/rag.ts",
      "src/lib/supabase/admin.ts",
      "src/lib/supabase/server.ts",
    ]);
    expect([...clientGraph].map(relative).filter((file) => forbidden.has(file))).toEqual([]);
  });

  it("does not make runtime source modules depend on operational scripts", () => {
    const { files, parsed } = runtimeGraph();
    const scriptImports = files.flatMap((file) => {
      const modules = parsed.get(file)!;
      return [...modules.staticImports, ...modules.dynamicImports]
        .filter((specifier) =>
          path.resolve(path.dirname(file), specifier).startsWith(path.join(projectRoot, "scripts")),
        )
        .map((specifier) => `${relative(file)} -> ${specifier}`);
    });
    expect(scriptImports).toEqual([]);
  });

  it("does not defeat a dynamic boundary with a static import of the same module", () => {
    const { fileSet, parsed } = runtimeGraph();
    const collisions: string[] = [];
    for (const [file, modules] of parsed) {
      const staticTargets = new Set(
        [...modules.staticImports]
          .map((specifier) => resolveModule(file, specifier, fileSet))
          .filter((target): target is string => Boolean(target)),
      );
      for (const specifier of modules.dynamicImports) {
        const target = resolveModule(file, specifier, fileSet);
        if (target && staticTargets.has(target)) collisions.push(`${relative(file)} -> ${relative(target)}`);
      }
    }
    expect(collisions).toEqual([]);
  });
});
