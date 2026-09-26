// Weekly report section (suggestion 12): code files added recently that no test reaches.
//
// "Added" comes from git history: a file added (or added and then renamed) in the window that ends
// at the injected `now`. "Reached" means a file under tests/ imports it, directly or through other
// files, or names it by path (tests that run a script as a child process or read a source file);
// type-only imports do not count. Next.js route files (pages, routes, layouts and their siblings),
// type-only files and test files are skipped. Report only; it never blocks a PR.
import fs from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";
import { areasOf, git, headTime, isShallow, mapAtHead, mdEscape, readBlobs } from "../map-placement.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
export const WINDOW_DAYS = 14;
const LIST_CAP = 20;
const CODE_ROOTS = ["src/", "worker/", "scripts/"];
const CANDIDATE_EXT = /\.(?:ts|tsx|mjs|js)$/;
const GRAPH_EXT = /\.(?:ts|tsx|mts|cts|mjs|cjs|js|jsx)$/;
// Same order as the resolver in tests/helpers/module-graph.ts, which is tied to the real repo root.
const RESOLVE_EXTENSIONS = [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"];
const TEST_FILE = /(?:\.(?:test|spec)\.[cm]?[jt]sx?$|(?:^|\/)__tests__\/)/;
// Next.js route and metadata files: the framework calls them, and browser journeys test them.
const NEXT_ROUTE_FILE =
  /^src\/app\/(?:.*\/)?(?:page|route|layout|loading|error|global-error|not-found|template|default|sitemap|robots|manifest|opengraph-image|twitter-image|icon|apple-icon)\.(?:ts|tsx|js|jsx|mjs)$/;
const PATH_LITERAL = /["'`]([^"'`\s]+\.(?:ts|tsx|mts|cts|mjs|cjs|js|jsx))["'`]/g;
const DYNAMIC_IMPORT = /\b(?:import|require)\s*\(\s*(["'`])([^"'`\n]+)\1\s*[,)]/g;
const TYPE_DECLARATIONS = new Set(["TSTypeAliasDeclaration", "TSInterfaceDeclaration", "TSDeclareFunction"]);

// History in the window is complete unless a shallow clone's cut-off falls inside it.
function shallowCutsWindow(root, sinceSeconds) {
  if (!isShallow(root)) return false;
  const shallowFile = git(root, ["rev-parse", "--git-path", "shallow"], { allowFail: true })?.trim();
  let boundaries;
  try {
    boundaries = fs
      .readFileSync(path.resolve(root, shallowFile ?? ""), "utf8")
      .split("\n")
      .filter(Boolean);
  } catch {
    return true; // shallow, and the cut-off cannot be read: do not guess
  }
  return boundaries.some((sha) => {
    const time = Number(git(root, ["show", "-s", "--format=%ct", sha], { allowFail: true })?.trim());
    return !Number.isFinite(time) || time >= sinceSeconds;
  });
}

/** Paths added between `since` and `until`, following renames of files added in that window. */
export function addedPaths(root, since, until) {
  const log = git(root, [
    "-c",
    "core.quotePath=false",
    "log",
    "--reverse",
    "--no-merges",
    "-M",
    "--diff-filter=AR",
    "--name-status",
    "--format=%x01%H",
    `--since=${since.toISOString()}`,
    `--until=${until.toISOString()}`,
    "HEAD",
  ]);
  const added = new Set();
  for (const block of log.split("\x01")) {
    for (const line of block.split("\n").slice(1)) {
      const [status, first, second] = line.split("\t");
      if (status === "A" && first) added.add(first);
      else if (status?.startsWith("R") && second && added.has(first)) {
        added.delete(first);
        added.add(second);
      }
    }
  }
  return added;
}

function isTypeOnlyStatement(node) {
  if (TYPE_DECLARATIONS.has(node.type) || node.type === "EmptyStatement") return true;
  if (node.declare) return true; // declare const / class / enum / namespace
  // An import with bindings emits nothing by itself; a bare `import "x"` runs x.
  if (node.type === "ImportDeclaration") return node.specifiers.length > 0;
  if (node.type === "ExportAllDeclaration") return node.exportKind === "type";
  if (node.type === "ExportNamedDeclaration") {
    if (node.exportKind === "type") return true;
    if (node.declaration) return TYPE_DECLARATIONS.has(node.declaration.type) || Boolean(node.declaration.declare);
    return node.specifiers.length > 0 && node.specifiers.every((s) => s.exportKind === "type");
  }
  return false;
}

// Babel plugins by extension: JSX only where it can occur, so a generic arrow function in a .ts
// file (`<T>(x: T) => x`) is not misread as a JSX tag.
function pluginsFor(file) {
  if (/\.tsx$/.test(file)) return ["jsx", "typescript"];
  if (/\.[cm]?ts$/.test(file)) return ["typescript"];
  return ["jsx"];
}

// A value import or re-export: the same type-only rules as tests/helpers/module-graph.ts.
function isValueImport(node) {
  if (node.importKind === "type") return false;
  const specifiers = node.specifiers ?? [];
  const named = specifiers.filter((s) => s.type === "ImportSpecifier");
  const allNamedTypes =
    named.length > 0 && named.length === specifiers.length && named.every((s) => s.importKind === "type");
  return !allNamedTypes;
}

function isValueReExport(node) {
  if (node.exportKind === "type") return false;
  if (node.type !== "ExportNamedDeclaration" || !node.specifiers?.length) return true;
  return !node.specifiers.every((s) => s.exportKind === "type");
}

function parseModule(file, text) {
  let program;
  try {
    program = parse(text, { sourceType: "unambiguous", plugins: pluginsFor(file), errorRecovery: true }).program;
  } catch {
    return { imports: [], typeOnly: false, parsed: false };
  }
  const imports = new Set();
  for (const node of program.body) {
    if (node.type === "ImportDeclaration" && isValueImport(node)) imports.add(node.source.value);
    if ((node.type === "ExportNamedDeclaration" || node.type === "ExportAllDeclaration") && node.source) {
      if (isValueReExport(node)) imports.add(node.source.value);
    }
  }
  // Dynamic imports and require() with a literal specifier. Read from the text rather than a full
  // tree walk: much faster, and a false match only ever marks one more file as reached.
  for (const match of text.matchAll(DYNAMIC_IMPORT)) imports.add(match[2]);
  return { imports: [...imports], typeOnly: program.body.every(isTypeOnlyStatement), parsed: true };
}

function resolveSpecifier(fromFile, specifier, fileSet) {
  const bare = specifier.split("?")[0];
  let base;
  if (bare.startsWith("@/")) base = `src/${bare.slice(2)}`;
  else if (bare.startsWith(".")) base = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), bare));
  else return null;
  if (base.startsWith("../")) return null;
  const candidates = [
    base,
    ...RESOLVE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...RESOLVE_EXTENSIONS.map((ext) => `${base}/index${ext}`),
  ];
  // TypeScript lets `./x.js` name `./x.ts`.
  const js = /^(.*)\.(m?)js$/.exec(base);
  if (js) candidates.push(`${js[1]}.${js[2]}ts`, `${js[1]}.tsx`);
  return candidates.find((candidate) => fileSet.has(candidate)) ?? null;
}

/**
 * New code files that no test reaches. `now` defaults to HEAD's commit time, never the clock.
 * @returns {{ since: Date, until: Date, history: "complete"|"unavailable (shallow clone)",
 *   candidates: string[], untested: Array<{file: string, area: string}>, unparsed: string[] }}
 */
export function untestedNewCode({ root, now, days = WINDOW_DAYS } = {}) {
  const until = now ? new Date(now) : headTime(root);
  const since = new Date(until.getTime() - days * DAY_MS);
  if (shallowCutsWindow(root, Math.floor(since.getTime() / 1000))) {
    return { since, until, history: "unavailable (shallow clone)", candidates: [], untested: [], unparsed: [] };
  }
  const map = mapAtHead(root);
  const codeFiles = [...map.blobs.keys()].filter((f) => GRAPH_EXT.test(f));
  const fileSet = new Set(codeFiles);
  const texts = readBlobs(
    root,
    codeFiles.map((f) => map.blobs.get(f)),
  );
  const textOf = (file) => texts.get(map.blobs.get(file)) ?? "";

  const candidates = [...addedPaths(root, since, until)]
    .filter(
      (f) =>
        fileSet.has(f) &&
        CODE_ROOTS.some((r) => f.startsWith(r)) &&
        CANDIDATE_EXT.test(f) &&
        !f.endsWith(".d.ts") &&
        !TEST_FILE.test(f) &&
        !NEXT_ROUTE_FILE.test(f) &&
        map.placement[f] !== "(ignored)",
    )
    .sort();

  const modules = new Map();
  const moduleOf = (file) => {
    if (!modules.has(file)) modules.set(file, parseModule(file, textOf(file)));
    return modules.get(file);
  };

  // Basenames that name exactly one code file, for tests that build a path from its parts.
  const byBasename = new Map();
  for (const file of codeFiles) {
    if (!CODE_ROOTS.some((r) => file.startsWith(r))) continue;
    const name = path.posix.basename(file);
    byBasename.set(name, byBasename.has(name) ? null : file);
  }

  const reached = new Set();
  const queue = [];
  const reach = (file) => {
    if (file && !reached.has(file)) {
      reached.add(file);
      queue.push(file);
    }
  };
  const testFiles = codeFiles.filter((f) => f.startsWith("tests/"));
  for (const test of testFiles) {
    reach(test);
    for (const [, literal] of textOf(test).matchAll(PATH_LITERAL)) {
      const plain = literal.replace(/^\.\//, "");
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(test), literal));
      if (fileSet.has(plain)) reach(plain);
      else if (fileSet.has(relative)) reach(relative);
      else if (!literal.includes("/")) reach(byBasename.get(literal));
    }
  }
  while (queue.length) {
    const file = queue.pop();
    for (const specifier of moduleOf(file).imports) reach(resolveSpecifier(file, specifier, fileSet));
  }

  const untested = candidates
    .filter((f) => !reached.has(f) && !moduleOf(f).typeOnly)
    .map((file) => ({ file, area: areasOf(map.placement[file])[0] ?? map.placement[file] ?? "(unplaced)" }));
  const unparsed = [...modules.entries()].filter(([, m]) => !m.parsed).map(([f]) => f);
  return { since, until, history: "complete", candidates, untested, unparsed };
}

export async function section({ root, now } = {}) {
  const title = "New code that no test reaches";
  const result = untestedNewCode({ root, now });
  const window = `the ${WINDOW_DAYS} days to ${result.until.toISOString().slice(0, 10)}`;
  if (result.history !== "complete") {
    return {
      title,
      markdown: `Not checked: ${result.history}. Git history does not reach back ${WINDOW_DAYS} days in this checkout.\n`,
    };
  }
  const lines = [
    `Code files under \`src/\`, \`worker/\` and \`scripts/\` added in ${window} that no test reaches: no file ` +
      "under `tests/` imports them (directly or through other files) or names them by path. Next.js route files, " +
      "type-only files and tests are skipped.",
    "",
    `**${result.untested.length} of ${result.candidates.length}** new code files are not reached by any test.`,
  ];
  if (result.untested.length) {
    const perArea = new Map();
    for (const { area } of result.untested) perArea.set(area, (perArea.get(area) ?? 0) + 1);
    const counts = [...perArea.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    lines.push("", `By area: ${counts.map(([area, n]) => `${area} ${n}`).join(", ")}.`, "");
    const shown = [...result.untested].sort((a, b) => a.area.localeCompare(b.area) || a.file.localeCompare(b.file));
    for (const { file, area } of shown.slice(0, LIST_CAP)) lines.push(`- \`${mdEscape(file)}\` (${area})`);
    if (shown.length > LIST_CAP) lines.push(`- …and ${shown.length - LIST_CAP} more`);
  }
  if (result.unparsed.length) {
    lines.push(
      "",
      `${result.unparsed.length} file${result.unparsed.length === 1 ? "" : "s"} could not be parsed, so their imports ` +
        `were not followed: ${result.unparsed
          .slice(0, 5)
          .map((f) => `\`${mdEscape(f)}\``)
          .join(", ")}${result.unparsed.length > 5 ? " and more" : ""}.`,
    );
  }
  return { title, markdown: `${lines.join("\n")}\n` };
}
