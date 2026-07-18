import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard for the PR #890 fix: the ~915 KB services snapshot reaches
// the client the moment "@/lib/services" is value-imported anywhere in a
// client module graph (~100 KB gzip in that chunk). The enforced bundle
// budget alone cannot catch a re-introduction — its 10% tolerance sits above
// the pre-fix total — so the boundary is asserted at the source level, and it
// must be TRANSITIVE: a helper without its own "use client" directive still
// lands in the client bundle when a client component imports it. Type-only
// imports are erased at compile time and stay allowed.
const SRC_ROOT = join(process.cwd(), "src");
const TARGET_SPECIFIER = "@/lib/services";
// Side-effect imports have no `from` clause but still execute the module.
const SIDE_EFFECT_IMPORT_PATTERN = /^import\s+["']([^"']+)["']/gm;
// import/export ... from "..." — clause analysed by hasRuntimeBindings below so
// `import type`, `export type`, and named clauses whose specifiers are all
// `type X` (including multiline) stay allowed while default, namespace, mixed,
// star re-export, and value re-export forms are treated as runtime.
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

interface ModuleInfo {
  importsServices: boolean;
  isClientEntry: boolean;
  valueImports: string[];
}

function buildModuleGraph(): Map<string, ModuleInfo> {
  const graph = new Map<string, ModuleInfo>();

  for (const filePath of collectSourceFiles(SRC_ROOT)) {
    const source = readFileSync(filePath, "utf8");
    const valueImports: string[] = [];
    let importsServices = false;

    const recordRuntimeSpecifier = (specifier: string) => {
      if (specifier === TARGET_SPECIFIER || specifier.startsWith(`${TARGET_SPECIFIER}/`)) importsServices = true;
      const resolved = resolveImport(specifier, filePath);
      if (resolved) valueImports.push(resolved);
    };

    for (const match of source.matchAll(SIDE_EFFECT_IMPORT_PATTERN)) recordRuntimeSpecifier(match[1]);
    for (const match of source.matchAll(FROM_STATEMENT_PATTERN)) {
      if (hasRuntimeBindings(match[1], match[2])) recordRuntimeSpecifier(match[3]);
    }

    graph.set(filePath, {
      importsServices,
      isClientEntry: /^\s*["']use client["']/m.test(source.slice(0, 400)),
      valueImports,
    });
  }

  return graph;
}

describe("services snapshot client boundary", () => {
  it("keeps @/lib/services value-imports out of every client module graph", () => {
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

        if (current.importsServices) {
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
      "Client module graphs must not value-import @/lib/services: it compiles the full services " +
        "snapshot into their chunk. Compute what you need server-side and pass it as a prop " +
        "(see src/app/services/page.tsx), or use `import type` for types only. Chains shown as " +
        "client entry -> ... -> importing module.",
    ).toEqual([]);
  });
});
