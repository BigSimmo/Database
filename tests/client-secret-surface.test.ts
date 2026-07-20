import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, extname, join, relative, resolve } from "node:path";
import { parse } from "@babel/parser";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, "src");
const SERVER_ENV = join(SRC_ROOT, "lib", "env.ts");
const PUBLIC_ENV = join(SRC_ROOT, "lib", "client-env.ts");
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
const PUBLIC_ENV_KEYS = new Set(["NODE_ENV", "NEXT_PUBLIC_LOCAL_NO_AUTH"]);
const importCache = new Map<string, string[]>();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true })
    .map(String)
    .map((name) => join(dir, name))
    .filter((file) => SOURCE_EXTENSIONS.includes(extname(file)) && statSync(file).isFile());
}

function isClientModule(text: string) {
  return /^\s*["']use client["'];/m.test(text);
}

function resolveLocalImport(importer: string, specifier: string) {
  const base = specifier.startsWith("@/")
    ? join(SRC_ROOT, specifier.slice(2))
    : specifier.startsWith(".")
      ? resolve(dirname(importer), specifier)
      : null;
  if (!base) return null;
  for (const candidate of [
    base,
    ...SOURCE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => join(base, `index${extension}`)),
  ]) {
    if (SOURCE_EXTENSIONS.includes(extname(candidate)) && existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

function localImports(file: string) {
  const cached = importCache.get(file);
  if (cached) return cached;
  const text = readFileSync(file, "utf8");
  const source = parse(text, {
    sourceType: "module",
    plugins: ["jsx", "typescript", "importAttributes"],
  });
  const specifiers: string[] = [];
  for (const statement of source.program.body) {
    if (statement.type === "ImportDeclaration") {
      const isTypeOnly =
        statement.importKind === "type" ||
        Boolean(
          !statement.specifiers.some((specifier) => specifier.type === "ImportDefaultSpecifier") &&
          statement.specifiers.some((specifier) => specifier.type === "ImportSpecifier") &&
          statement.specifiers.every(
            (specifier) => specifier.type === "ImportSpecifier" && specifier.importKind === "type",
          ),
        );
      if (!isTypeOnly) specifiers.push(statement.source.value);
    }
    if (
      (statement.type === "ExportNamedDeclaration" || statement.type === "ExportAllDeclaration") &&
      statement.exportKind !== "type" &&
      statement.source
    ) {
      specifiers.push(statement.source.value);
    }
  }
  const imports = specifiers.flatMap((specifier) => {
    const resolved = resolveLocalImport(file, specifier);
    return resolved ? [resolved] : [];
  });
  importCache.set(file, imports);
  return imports;
}

function serverEnvImportChains() {
  const clientRoots = sourceFiles(SRC_ROOT).filter((file) => isClientModule(readFileSync(file, "utf8")));
  const memo = new Map<string, string[] | null>();

  const pathToServerEnv = (file: string, visiting: Set<string>): string[] | null => {
    if (file === SERVER_ENV) return [file];
    if (memo.has(file)) return memo.get(file) ?? null;
    if (visiting.has(file)) return null;

    visiting.add(file);
    for (const imported of localImports(file)) {
      const childPath = pathToServerEnv(imported, visiting);
      if (childPath) {
        const path = [file, ...childPath];
        memo.set(file, path);
        visiting.delete(file);
        return path;
      }
    }
    visiting.delete(file);
    memo.set(file, null);
    return null;
  };

  return clientRoots.flatMap((root) => {
    const chain = pathToServerEnv(root, new Set());
    return chain ? [chain.map((file) => relative(ROOT, file).replaceAll("\\", "/")).join(" -> ")] : [];
  });
}

describe("client environment isolation", () => {
  it("marks the server environment contract as server-only", () => {
    expect(readFileSync(SERVER_ENV, "utf8")).toMatch(/^import ["']server-only["'];/);
  });

  it("prevents client module graphs from reaching the server environment contract", { timeout: 30000 }, () => {
    expect(serverEnvImportChains()).toEqual([]);
  });

  it("keeps the public environment module limited to allowlisted public flags", () => {
    const text = readFileSync(PUBLIC_ENV, "utf8");
    const referencedKeys = [...text.matchAll(/process\.env\.([A-Z0-9_]+)/g)].map((match) => match[1]!);
    expect(new Set(referencedKeys)).toEqual(PUBLIC_ENV_KEYS);
    expect(text).not.toMatch(
      /SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|OPENAI_SAFETY_IDENTIFIER_SECRET|RAG_QUERY_HASH_SECRET/,
    );
  });

  it("scans public assets and generated client chunks without printing surrounding content", () => {
    const scannerPath = join(ROOT, "scripts", "check-client-bundle-secrets.mjs");
    const packageJson = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["check:client-bundle-secrets"]).toContain("check-client-bundle-secrets.mjs");
    expect(packageJson.scripts.build).toContain("run-heavy.mjs");
    expect(packageJson.scripts["build:internal"]).toContain("check-client-bundle-secrets.mjs");

    const fixtureRoot = mkdtempSync(join(tmpdir(), "clinical-kb-client-bundle-"));
    try {
      const staticRoot = join(fixtureRoot, ".next", "static");
      mkdirSync(staticRoot, { recursive: true });
      mkdirSync(join(fixtureRoot, "public"), { recursive: true });
      writeFileSync(join(staticRoot, "safe.js"), "console.log('safe client chunk');", "utf8");
      const safeResult = spawnSync(process.execPath, [scannerPath], { cwd: fixtureRoot, encoding: "utf8" });
      expect(safeResult.status).toBe(0);

      writeFileSync(join(staticRoot, "unsafe.js"), "const marker = 'OPENAI_API_KEY';", "utf8");
      const unsafeResult = spawnSync(process.execPath, [scannerPath], { cwd: fixtureRoot, encoding: "utf8" });
      expect(unsafeResult.status).toBe(1);
      expect(unsafeResult.stderr).toContain(".next/static/unsafe.js");
      expect(unsafeResult.stderr).toContain("OPENAI_API_KEY");
      expect(unsafeResult.stderr).not.toContain("const marker");

      rmSync(join(staticRoot, "unsafe.js"));
      writeFileSync(join(fixtureRoot, "public", "unsafe.txt"), "SUPABASE_SERVICE_ROLE_KEY", "utf8");
      const publicResult = spawnSync(process.execPath, [scannerPath], { cwd: fixtureRoot, encoding: "utf8" });
      expect(publicResult.status).toBe(1);
      expect(publicResult.stderr).toContain("public/unsafe.txt");
      expect(publicResult.stderr).toContain("SUPABASE_SERVICE_ROLE_KEY");

      rmSync(join(fixtureRoot, "public", "unsafe.txt"));
      // @supabase/supabase-js ships a bare `key.startsWith('sb_secret_')` prefix
      // check client-side; that literal alone must not trip the scanner.
      writeFileSync(
        join(staticRoot, "sdk-prefix-check.js"),
        'const isNewApiKey = (key) => key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");',
        "utf8",
      );
      const prefixOnlyResult = spawnSync(process.execPath, [scannerPath], { cwd: fixtureRoot, encoding: "utf8" });
      expect(prefixOnlyResult.status).toBe(0);

      rmSync(join(staticRoot, "sdk-prefix-check.js"));
      // Built via concatenation so this fixture's synthetic, non-functional key
      // never appears as a contiguous literal in this test's own source (which
      // would otherwise look like a real leaked secret to git secret scanners).
      const fakeSecretKey = ["sb_secret_", "abc123DEF456"].join("");
      writeFileSync(join(staticRoot, "leaked-key.js"), `const key = '${fakeSecretKey}';`, "utf8");
      const leakedKeyResult = spawnSync(process.execPath, [scannerPath], { cwd: fixtureRoot, encoding: "utf8" });
      expect(leakedKeyResult.status).toBe(1);
      expect(leakedKeyResult.stderr).toContain(".next/static/leaked-key.js");
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
