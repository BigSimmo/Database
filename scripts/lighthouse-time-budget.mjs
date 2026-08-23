/**
 * Bounded-stage timing helpers for the local Lighthouse budget runner.
 *
 * The CI job allows 45 minutes. Its runner reserves 10 minutes for the Next
 * build, 2 minutes for readiness, and 28 minutes for the complete measurement
 * suite, leaving five minutes for grading, cleanup, and artifact upload.
 */
export const LIGHTHOUSE_CI_BUILD_TIMEOUT_MS = 10 * 60_000;
export const LIGHTHOUSE_LOCAL_WINDOWS_BUILD_TIMEOUT_MS = 20 * 60_000;
export const LIGHTHOUSE_SERVER_READY_TIMEOUT_MS = 2 * 60_000;
export const LIGHTHOUSE_MEASUREMENT_SUITE_TIMEOUT_MS = 28 * 60_000;
export const LIGHTHOUSE_PROCESS_TIMEOUT_MS = 120_000;

export function lighthouseBuildTimeoutMs({ platform, ci }) {
  return platform === "win32" && !ci ? LIGHTHOUSE_LOCAL_WINDOWS_BUILD_TIMEOUT_MS : LIGHTHOUSE_CI_BUILD_TIMEOUT_MS;
}

export function deadlineAfter(timeoutMs, now = Date.now()) {
  return now + timeoutMs;
}

export function remainingMs(deadline, now = Date.now()) {
  return Math.max(0, deadline - now);
}

/** The next Lighthouse child may use no more than the suite time still available. */
export function processTimeoutMs(deadline, maximumMs, now = Date.now()) {
  return Math.min(maximumMs, remainingMs(deadline, now));
}
