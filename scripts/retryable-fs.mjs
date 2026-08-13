import { rmSync } from "node:fs";

// Windows can retain a handle briefly after a child process, antivirus scanner,
// or browser exits. Node retries these transient recursive deletion failures
// (EBUSY, EPERM, ENOTEMPTY, EMFILE, and ENFILE) when these options are present.
export const recursiveRemovalRetryOptions = Object.freeze({ maxRetries: 5, retryDelay: 100 });
const transientRemovalCodes = new Set(["EBUSY", "EMFILE", "ENFILE", "ENOTEMPTY", "EPERM"]);

function waitSync(milliseconds) {
  const signal = new Int32Array(new SharedArrayBuffer(4));
  Atomics.wait(signal, 0, 0, milliseconds);
}

/**
 * Remove a temporary path without turning a transient Windows handle into a
 * false test or cleanup failure. Keep this helper for run-coordinator and
 * browser-runner state only; callers must still validate any user-controlled
 * path before they pass it here.
 */
export function removePathSync(targetPath, options = {}, { remove = rmSync } = {}) {
  const { recursive = false, force = true } = options;
  if (recursive) {
    remove(targetPath, { ...options, recursive, force, ...recursiveRemovalRetryOptions });
    return;
  }
  // Node only honours maxRetries for recursive removal. Coordinator queue and
  // temporary JSON files still need the same protection, so retry those short
  // file removals explicitly.
  for (let attempt = 0; ; attempt += 1) {
    try {
      remove(targetPath, { ...options, force });
      return;
    } catch (error) {
      if (!transientRemovalCodes.has(error?.code) || attempt >= recursiveRemovalRetryOptions.maxRetries) throw error;
      waitSync((attempt + 1) * recursiveRemovalRetryOptions.retryDelay);
    }
  }
}
