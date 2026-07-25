/**
 * Fail if tracked SVGs under public/ or src/app/ are not SVGO-stable.
 *
 * Unlike `svgo -f …` (which rewrites in place and is non-recursive without -r),
 * this check optimizes to a temp copy and compares bytes so CI never mutates
 * the worktree and nested icons (e.g. src/app/icon.svg) are covered.
 */
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { optimize } from "svgo";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const roots = ["public", path.join("src", "app")];

async function* walkSvgFiles(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      yield* walkSvgFiles(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".svg")) {
      yield fullPath;
    }
  }
}

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function main() {
  const dirty = [];

  for (const relRoot of roots) {
    const absRoot = path.join(rootDir, relRoot);
    for await (const filePath of walkSvgFiles(absRoot)) {
      const original = await fs.readFile(filePath, "utf8");
      const result = optimize(original, {
        path: filePath,
        multipass: true,
      });
      if ("error" in result && result.error) {
        throw new Error(`SVGO failed for ${path.relative(rootDir, filePath)}: ${result.error}`);
      }
      const optimized = result.data.endsWith("\n") ? result.data : `${result.data}\n`;
      const originalNormalized = original.endsWith("\n") ? original : `${original}\n`;
      if (digest(originalNormalized) !== digest(optimized)) {
        dirty.push(path.relative(rootDir, filePath).replaceAll("\\", "/"));
      }
    }
  }

  if (dirty.length > 0) {
    console.error("SVG assets are not SVGO-stable. Re-optimize and commit:");
    for (const file of dirty.sort()) {
      console.error(`  - ${file}`);
    }
    console.error("Hint: npx svgo --multipass <file>");
    process.exit(1);
  }

  console.log("check:assets OK — SVG assets are SVGO-stable.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
