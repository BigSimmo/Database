/**
 * ONE MUTATION, WITH THE TWO GUARANTEES THAT MAKE ITS RESULT MEAN ANYTHING — importable.
 *
 * 🔴 **WHY THIS EXISTS, AND IT IS NOT THAT THE GUARDS WERE MISSING.** `mutation-run.mjs` already
 * refuses an untracked file and an anchor that does not appear exactly once. It prevented nothing
 * on 2026-09-05, three separate times, because the work was happening in a hand-typed
 * `node -e '...'` probe that never reached it. The shell ate the escapes, the anchor was never
 * found, the substitution silently did nothing — and the run reported the UNMUTATED code as a pass.
 *
 * **A mutation that never executed is indistinguishable from one the assertions cannot detect,
 * except that it invents a defect rather than missing one.** A green from a mutation that did not
 * apply reads as "the guard is weak" and sends somebody to strengthen a guard that was fine.
 *
 * So the fix is not another harness. It is the same two assertions, in a module small enough that
 * importing it is easier than retyping the wrong thing:
 *
 *     import { withMutation } from "../scripts/ward-flow/mutate.mjs";
 *     await withMutation({ file, find, replace }, () => run("npx vitest run ..."));
 *
 * ⚠️ **The file is ALWAYS restored, including when the body throws**, and the restore is verified
 * by hash rather than assumed. `git checkout --` is not used: it is blocked by this machine's
 * protection hook in some paths, and it silently does nothing at all for an untracked file.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Git's own blob hash, so a comparison here means the same thing a comparison in git does. */
export function blobHash(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return createHash("sha1")
    .update(Buffer.concat([header, bytes]))
    .digest("hex");
}

function isTracked(file) {
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", file], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export class MutationRefused extends Error {
  constructor(message) {
    super(message);
    this.name = "MutationRefused";
  }
}

/**
 * Apply exactly one textual mutation, run `body`, and restore.
 *
 * Refuses — rather than warns — when the mutation cannot be trusted:
 *   - the file does not exist, or is UNTRACKED (nothing could restore it if this process died);
 *   - `find` does not appear EXACTLY once (a non-global replace silently prefers a comment);
 *   - `replace` equals `find` (a no-op dressed as a mutation);
 *   - the file's hash did not change after writing (the mutation did not take).
 *
 * Returns whatever `body` returns. `body` may be async.
 */
export async function withMutation({ file, find, replace }, body) {
  const absolute = resolve(file);
  if (!existsSync(absolute)) throw new MutationRefused(`REFUSED: no such file — ${file}`);
  if (!isTracked(file)) {
    throw new MutationRefused(
      `REFUSED: ${file} is UNTRACKED. Version control cannot restore a file it has never seen, ` +
        "and a process that dies between the edit and the restore leaves the mutation in place. Commit it first.",
    );
  }
  if (find === replace) {
    throw new MutationRefused(
      "REFUSED: `find` and `replace` are identical. That is a no-op wearing the costume of a mutation, " +
        "and it reports the unmutated result as a pass.",
    );
  }

  const original = readFileSync(absolute);
  const before = blobHash(original);
  const text = original.toString("utf8");

  const occurrences = text.split(find).length - 1;
  if (occurrences !== 1) {
    throw new MutationRefused(
      `REFUSED: the anchor appears ${occurrences} times in ${file}, expected exactly 1.\n` +
        "  0 — most often the escapes were eaten by a shell, or this checkout holds CRLF while a\n" +
        "      multi-line anchor was written with \\n. A single-line anchor avoids the second.\n" +
        "  2+ — a substitution would silently prefer whichever comes first, usually a comment.",
    );
  }

  writeFileSync(absolute, text.replace(find, replace), "utf8");
  const mutatedHash = blobHash(readFileSync(absolute));
  if (mutatedHash === before) {
    writeFileSync(absolute, original);
    throw new MutationRefused(
      `REFUSED: ${file} is byte-identical after the write, so the mutation did not take. ` +
        "Whatever the run reports next would be a result about the ORIGINAL code.",
    );
  }

  try {
    return await body();
  } finally {
    writeFileSync(absolute, original);
    const after = blobHash(readFileSync(absolute));
    if (after !== before) {
      throw new Error(
        `RESTORE FAILED for ${file}: hash ${after} != ${before}. The working tree is NOT as it was; ` +
          "do not commit until this is resolved.",
      );
    }
  }
}
