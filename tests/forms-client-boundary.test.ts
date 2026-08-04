import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Mirror tests/services-client-boundary.test.ts: the forms catalog must not
// enter any client module graph via a value import of @/lib/forms.
const SRC_ROOT = join(process.cwd(), "src");
const TARGET_SPECIFIER = "@/lib/forms";
const SIDE_EFFECT_IMPORT_PATTERN = /^import\s+["']([^"']+)["']/gm;
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*["']([^"']+)["'][\s\S]*?\)/g;
const FROM_STATEMENT_PATTERN = /^(import|export)\s+([\s\S]+?)\s+from\s+["']([^"']+)["']/gm;

function hasRuntimeBindings(kind: string, clause: string): boolean {
  const trimmed = clause.trim();
  if (/^type\b/.test(trimmed)) return false;
  const named = trimmed.match(/^\{([\s\S]*)\}$/);
  if (named) {
    return named[1]
      .split(",")
      .map((specifier) => specifier.trim())
      .filter(Boolean)
      .some((specifier) => !/^type\b/.test(specifier));
  }
  return kind === "import" || kind === "export";
}

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) return collectSourceFiles(fullPath);
    return /\.(?:ts|tsx)$/.test(entry) ? [fullPath] : [];
  });
}

function resolveImport(specifier: string, fromFile: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(SRC_ROOT, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(fromFile), specifier);
  else return null;

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

const FORMS_MODULE_PATHS = new Set(
  ["lib/forms.ts", "lib/forms.tsx", "lib/forms/index.ts", "lib/forms/index.tsx"].map((candidate) =>
    join(SRC_ROOT, candidate),
  ),
);

function isClientEntry(source: string): boolean {
  const prologue = source.replace(/^(?:\s+|\/\/[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/, "");
  return /^["']use client["']/.test(prologue);
}

interface ModuleInfo {
  importsForms: boolean;
  isClientEntry: boolean;
  valueImports: string[];
}

function buildModuleGraph(): Map<string, ModuleInfo> {
  const graph = new Map<string, ModuleInfo>();

  for (const filePath of collectSourceFiles(SRC_ROOT)) {
    const source = readFileSync(filePath, "utf8");
    const valueImports: string[] = [];
    let importsForms = false;

    const recordRuntimeSpecifier = (specifier: string) => {
      const resolved = resolveImport(specifier, filePath);
      if (
        specifier === TARGET_SPECIFIER ||
        specifier.startsWith(`${TARGET_SPECIFIER}/`) ||
        (resolved !== null && FORMS_MODULE_PATHS.has(resolved))
      ) {
        importsForms = true;
      }
      if (resolved) valueImports.push(resolved);
    };

    for (const match of source.matchAll(SIDE_EFFECT_IMPORT_PATTERN)) recordRuntimeSpecifier(match[1]);
    for (const match of source.matchAll(DYNAMIC_IMPORT_PATTERN)) recordRuntimeSpecifier(match[1]);
    for (const match of source.matchAll(FROM_STATEMENT_PATTERN)) {
      if (hasRuntimeBindings(match[1], match[2])) recordRuntimeSpecifier(match[3]);
    }

    graph.set(filePath, {
      importsForms,
      isClientEntry: isClientEntry(source),
      valueImports,
    });
  }

  return graph;
}

describe("forms catalog client boundary", () => {
  it("keeps @/lib/forms value-imports out of every client module graph", () => {
    const graph = buildModuleGraph();
    const offenders: string[] = [];

    for (const [entryPath, entry] of graph) {
      if (!entry.isClientEntry) continue;

      const cameFrom = new Map<string, string>([[entryPath, ""]]);
      const queue = [entryPath];
      while (queue.length > 0) {
        const currentPath = queue.shift() as string;
        const current = graph.get(currentPath);
        if (!current) continue;

        if (current.importsForms) {
          const chain: string[] = [];
          for (let step: string | undefined = currentPath; step; step = cameFrom.get(step) || undefined) {
            chain.unshift(relative(process.cwd(), step));
          }
          offenders.push(chain.join(" -> "));
          break;
        }
        for (const next of current.valueImports) {
          if (!cameFrom.has(next)) {
            cameFrom.set(next, currentPath);
            queue.push(next);
          }
        }
      }
    }

    expect(
      offenders,
      "Client module graphs must not value-import @/lib/forms: it compiles the full forms " +
        "catalog into their chunk. Compute what you need server-side and pass it as a prop " +
        "(see src/app/(search-app)/forms/page.tsx), or use `import type` for types only.",
    ).toEqual([]);
  });
});
