import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Returns true if the file corresponding to metaUrl was the direct entrypoint of process.argv[1].
 * Resolves symlinks and NTFS junctions safely via fs.realpathSync.
 *
 * @param {string} metaUrl - import.meta.url of the calling script
 * @returns {boolean}
 */
export function isDirectEntrypoint(metaUrl) {
  if (!process.argv[1]) return false;
  try {
    const entry = realpathSync(process.argv[1]);
    const target = realpathSync(fileURLToPath(metaUrl));
    if (entry === target) return true;
    if (process.platform === "win32") {
      return entry.toLowerCase() === target.toLowerCase();
    }
    return false;
  } catch {
    return false;
  }
}
