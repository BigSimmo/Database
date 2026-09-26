// Shared helpers for the organisation weekly report sections (scripts/organisation/weekly/*.mjs).
// Everything here is read-only: it asks git for the tracked file list, asks the organisation
// checker where each file belongs, and reads source text. It never writes to the repository.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";
import { evaluate } from "../check-organisation.mjs";

export const CHECKER_SCRIPT = fileURLToPath(new URL("../check-organisation.mjs", import.meta.url));
export const MAP_SYSTEMS_DIR = "docs/organisation/systems";

function git(root, args) {
  const result = spawnSync("git", ["--no-optional-locks", "-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error) throw new Error(`git could not be run: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${(result.stderr || "").trim().split("\n")[0]}`);
  return result.stdout;
}

// The same file list the checker's default mode judges: committed and staged files that still exist
// on disk. Untracked scratch files never count.
function workingTreeSnapshot(root) {
  const blobs = new Map();
  for (const entry of git(root, ["ls-files", "-z", "--stage"]).split("\0").filter(Boolean)) {
    const tab = entry.indexOf("\t");
    const file = entry.slice(tab + 1);
    if (fs.existsSync(path.join(root, file))) blobs.set(file, entry.slice(0, tab).split(" ")[1]);
  }
  return {
    label: "working tree",
    blobs,
    read: (file) => (blobs.has(file) ? fs.readFileSync(path.join(root, file), "utf8") : null),
  };
}

/**
 * Where the map places every tracked file, straight from the checker's own `evaluate`, so the
 * report can never disagree with `npm run check:organisation`.
 * @returns {{ files: string[], placement: Record<string, string>, systems: { id: string, name: string, kind: string }[] }}
 */
export function loadPlacement(root) {
  const snapshot = workingTreeSnapshot(root);
  const result = evaluate(snapshot);
  return {
    files: [...snapshot.blobs.keys()].sort(),
    placement: result.placement,
    systems: result.systems.map(({ id, name, kind }) => ({ id, name, kind })),
  };
}

/** Areas first, then workstreams, each alphabetical, so every report lists them in one order. */
export function orderedSystems(systems) {
  return [...systems].sort((a, b) => (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === "area" ? -1 : 1));
}

/**
 * The area ids a placement value stands for: one for a placed file, two or more for a shared file,
 * none for an ignored, unplaced, not-yet-placed or tied file.
 */
export function areasOf(value) {
  if (typeof value !== "string" || value === "") return [];
  if (value.startsWith("(shared) ")) return value.slice("(shared) ".length).split(" + ").filter(Boolean);
  if (value.startsWith("(")) return [];
  return [value];
}

// ---------- Markdown ----------

/** One line of plain text: control characters and runs of whitespace collapse to one space. */
export function oneLine(text, max = 300) {
  const flat = String(text ?? "")
    .replace(/[\u0000-\u001f\u007f\s]+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** Inline code that stays inline code whatever it contains, including backticks. */
export function inlineCode(text) {
  const value = oneLine(text, 500);
  const longest = Math.max(0, ...[...value.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = "`".repeat(longest + 1);
  const pad = value.startsWith("`") || value.endsWith("`") ? " " : "";
  return `${fence}${pad}${value}${pad}${fence}`;
}

// ---------- local imports ----------

const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".mjs", ".cjs", ".js", ".jsx", ".json"];
const SKIP_KEYS = new Set(["loc", "extra", "leadingComments", "trailingComments", "innerComments", "comments"]);
export const CODE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;

function parserPlugins(file) {
  if (/\.tsx$/.test(file)) return ["typescript", "jsx"];
  if (/\.[cm]?ts$/.test(file)) return ["typescript"];
  if (/\.jsx?$/.test(file)) return ["jsx"];
  return [];
}

/** Every string-literal module specifier a JavaScript or TypeScript file imports, re-exports or requires. */
export function importSpecifiers(sourceText, file = "file.ts") {
  const ast = parse(sourceText, {
    sourceType: /\.cjs$/.test(file) ? "script" : "module",
    plugins: parserPlugins(file),
    errorRecovery: true,
    allowReturnOutsideFunction: true,
  });
  const specifiers = new Set();
  const literal = (node) => {
    if (node?.type === "StringLiteral") specifiers.add(node.value);
    else if (node?.type === "TemplateLiteral" && node.expressions.length === 0 && node.quasis.length === 1) {
      const cooked = node.quasis[0].value?.cooked;
      if (typeof cooked === "string") specifiers.add(cooked);
    }
  };
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (node.type === "ImportDeclaration" || node.type === "ExportAllDeclaration") literal(node.source);
    else if (node.type === "ExportNamedDeclaration" && node.source) literal(node.source);
    else if (node.type === "ImportExpression") literal(node.source);
    else if (node.type === "TSExternalModuleReference") literal(node.expression);
    else if (node.type === "CallExpression") {
      const callee = node.callee;
      if (callee?.type === "Import" || (callee?.type === "Identifier" && callee.name === "require")) {
        literal(node.arguments?.[0]);
      }
    }
    for (const [key, value] of Object.entries(node)) if (!SKIP_KEYS.has(key)) visit(value);
  };
  visit(ast.program);
  return [...specifiers];
}

/** A relative or `@/` specifier resolved to a tracked file, or null for packages and misses. */
export function resolveLocalImport(fromFile, specifier, fileSet) {
  const clean = specifier.split("?")[0];
  let base;
  if (clean.startsWith("@/")) base = `src/${clean.slice(2)}`;
  else if (clean === "." || clean === ".." || clean.startsWith("./") || clean.startsWith("../")) {
    base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), clean));
  } else return null;
  if (base === ".." || base.startsWith("../")) return null;
  base = base.replace(/\/$/, "");
  const candidates = [base];
  // TypeScript's ESM convention: `./x.js` in source names `./x.ts` on disk.
  const js = /\.([cm]?)js$/.exec(base);
  if (js) {
    const stem = base.slice(0, -js[0].length);
    candidates.push(`${stem}.${js[1]}ts`);
    if (!js[1]) candidates.push(`${stem}.tsx`);
  }
  candidates.push(...RESOLVE_EXTENSIONS.map((ext) => `${base}${ext}`));
  candidates.push(...RESOLVE_EXTENSIONS.map((ext) => `${base}/index${ext}`));
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

/** The tracked files a code file imports, sorted and without duplicates or itself. */
export function localImports(root, file, fileSet) {
  const text = fs.readFileSync(path.join(root, file), "utf8");
  const resolved = importSpecifiers(text, file)
    .map((specifier) => resolveLocalImport(file, specifier, fileSet))
    .filter((target) => target && target !== file);
  return [...new Set(resolved)].sort();
}
