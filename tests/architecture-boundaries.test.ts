import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
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

function scriptKind(filePath: string) {
  if (filePath.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (filePath.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function moduleSpecifiersFromSource(filePath: string, sourceText: string) {
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, scriptKind(filePath));
  const staticImports = new Set<string>();
  const dynamicImports = new Set<string>();

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const clause = statement.importClause;
      const namedImports =
        clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings : null;
      const typeOnly =
        clause?.isTypeOnly ||
        Boolean(
          clause &&
          !clause.name &&
          namedImports?.elements.length &&
          namedImports.elements.every((item) => item.isTypeOnly),
        );
      if (!typeOnly) staticImports.add(statement.moduleSpecifier.text);
    }
    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier)
    ) {
      const typeOnly =
        statement.isTypeOnly ||
        Boolean(
          statement.exportClause &&
          ts.isNamedExports(statement.exportClause) &&
          statement.exportClause.elements.length > 0 &&
          statement.exportClause.elements.every((item) => item.isTypeOnly),
        );
      if (!typeOnly) staticImports.add(statement.moduleSpecifier.text);
    }
  }

  const visit = (node: ts.Node) => {
    const moduleSpecifier = ts.isCallExpression(node) ? node.arguments[0] : undefined;
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      (node.arguments.length === 1 || node.arguments.length === 2) &&
      moduleSpecifier &&
      ts.isStringLiteralLike(moduleSpecifier)
    ) {
      dynamicImports.add(moduleSpecifier.text);
    }
    ts.forEachChild(node, visit);
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

function runtimeGraph() {
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
      const firstStatement = parsed.get(file)?.source.statements[0];
      return Boolean(
        firstStatement &&
        ts.isExpressionStatement(firstStatement) &&
        ts.isStringLiteral(firstStatement.expression) &&
        firstStatement.expression.text === "use client",
      );
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
    const scriptImports = sourceFiles().flatMap((file) => {
      const modules = moduleSpecifiers(file);
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
