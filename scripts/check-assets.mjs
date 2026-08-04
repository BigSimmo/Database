/**
 * Lightweight asset gate that does not require an `svgo` lockfile delta.
 *
 * Full SVGO multipass stability checking is deferred: adding `svgo` flips CI
 * `lockfile_changed` and makes pre-existing exceljs/brace-expansion audit highs
 * blocking. Until that lands in a dedicated dependency PR, this gate protects
 * the highest-value asset contract: `src/app/icon.svg` must keep the
 * prefers-color-scheme theme swap owned by `brand:check` / `brandIconSvg()`.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconPath = path.join(rootDir, "src", "app", "icon.svg");

async function main() {
  const icon = await fs.readFile(iconPath, "utf8");
  const required = ["prefers-color-scheme: dark", "viewBox=", "<style>"];

  const missing = required.filter((token) => !icon.includes(token));
  if (missing.length > 0) {
    console.error("src/app/icon.svg is missing themed-favicon markers:");
    for (const token of missing) {
      console.error(`  - ${token}`);
    }
    console.error("Hint: npm run brand:update  (do not SVGO-multipass this file)");
    process.exit(1);
  }

  console.log("check:assets OK — themed favicon markers present (SVGO multipass deferred).");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
