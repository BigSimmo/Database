// Shared read-only helpers for the organisation weekly report sections: run git, read the map
// at HEAD, and say which area the map places a path in. Placement is always the checker's own
// (`evaluate` in scripts/check-organisation.mjs), never a second copy of its rules.
import { spawnSync } from "node:child_process";
import { evaluate } from "../check-organisation.mjs";

const MAP_DIR = "docs/organisation";
const SYSTEMS_DIR = `${MAP_DIR}/systems`;

/** Runs git in `root`; returns stdout, or null on failure when `allowFail` is set. */
export function git(root, args, { allowFail = false } = {}) {
  const result = spawnSync("git", ["--no-optional-locks", "-C", root, ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    if (allowFail) return null;
    const reason = result.error?.message ?? (result.stderr || "").trim().split("\n")[0];
    throw new Error(`git ${args.join(" ")} failed: ${reason}`);
  }
  return result.stdout;
}

/** Streams many blob ids through one `git cat-file --batch`; returns Map<blobId, text>. */
export function readBlobs(root, blobIds) {
  const texts = new Map();
  const unique = [...new Set(blobIds)];
  if (!unique.length) return texts;
  const result = spawnSync("git", ["--no-optional-locks", "-C", root, "cat-file", "--batch"], {
    input: `${unique.join("\n")}\n`,
    maxBuffer: 1024 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) throw new Error("git cat-file --batch failed");
  const out = result.stdout;
  let offset = 0;
  for (const id of unique) {
    const headerEnd = out.indexOf(10, offset);
    if (headerEnd === -1) break;
    const [, type, sizeText] = out.subarray(offset, headerEnd).toString("utf8").split(" ");
    if (type === undefined || sizeText === undefined) {
      offset = headerEnd + 1; // "<id> missing"
      continue;
    }
    const size = Number(sizeText);
    if (type === "blob") texts.set(id, out.subarray(headerEnd + 1, headerEnd + 1 + size).toString("utf8"));
    offset = headerEnd + 1 + size + 1;
  }
  return texts;
}

/** Committer time of HEAD, the default "now" so a report never depends on the wall clock. */
export function headTime(root) {
  const seconds = Number(git(root, ["show", "-s", "--format=%ct", "HEAD"]).trim());
  return new Date(seconds * 1000);
}

export function isShallow(root) {
  return git(root, ["rev-parse", "--is-shallow-repository"], { allowFail: true })?.trim() === "true";
}

export function headCommit(root) {
  return git(root, ["rev-parse", "HEAD"], { allowFail: true })?.trim() ?? null;
}

/** Tracked files at HEAD with their blob ids. */
export function headFiles(root) {
  const blobs = new Map();
  for (const entry of git(root, ["ls-tree", "-r", "-z", "HEAD"]).split("\0")) {
    if (!entry) continue;
    const tab = entry.indexOf("\t");
    const meta = entry.slice(0, tab).split(" ");
    if (meta[1] === "blob") blobs.set(entry.slice(tab + 1), meta[2]);
  }
  return blobs;
}

/**
 * The map as committed at HEAD, evaluated by the checker. `extraPaths` (for example files that
 * only exist in history) are placed by the same rules without being read.
 */
export function mapAtHead(root, { extraPaths = [] } = {}) {
  const blobs = headFiles(root);
  const read = (file) => (blobs.has(file) ? git(root, ["cat-file", "blob", blobs.get(file)]) : null);
  const files = new Set(blobs.keys());
  const placedBlobs = new Map(blobs);
  for (const extra of extraPaths) if (!placedBlobs.has(extra)) placedBlobs.set(extra, "0".repeat(40));
  const result = evaluate({ label: "HEAD", blobs: placedBlobs, read });

  const canonicalDocs = new Map();
  for (const file of [...blobs.keys()].filter((f) => f.startsWith(`${SYSTEMS_DIR}/`) && f.endsWith(".json")).sort()) {
    let data;
    try {
      data = JSON.parse(read(file));
    } catch {
      continue; // the checker reports unreadable map files
    }
    for (const doc of Array.isArray(data?.canonicalDocs) ? data.canonicalDocs : []) {
      if (typeof doc !== "string") continue;
      if (!canonicalDocs.has(doc)) canonicalDocs.set(doc, []);
      canonicalDocs.get(doc).push(data.id);
    }
  }
  const skipKinds = [...(result.kinds?.values() ?? [])].flat();
  return {
    files,
    blobs,
    read,
    placement: result.placement,
    systems: result.systems,
    canonicalDocs,
    /** True for generated files, records and historical evidence (kinds.json). */
    isRecordOrGenerated: (file) =>
      skipKinds.some((rule) => (rule.exact ? rule.pattern === file : rule.regex.test(file))),
  };
}

/** Area ids a placement value stands for: one area, every area of a shared entry, or none. */
export function areasOf(placementValue) {
  if (typeof placementValue !== "string") return [];
  if (placementValue.startsWith("(shared) ")) return placementValue.slice("(shared) ".length).split(" + ");
  if (placementValue.startsWith("(")) return [];
  return [placementValue];
}

/** Escapes text for a Markdown table cell or list item. */
export function mdEscape(text) {
  return String(text).replace(/[\\`*_[\]<>|]/g, (c) => `\\${c}`);
}
