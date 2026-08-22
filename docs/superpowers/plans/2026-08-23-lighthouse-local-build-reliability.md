# Lighthouse Local Build Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Let the repository-owned Lighthouse workflow complete its isolated production build on the supported Windows workstation without weakening the 45-minute CI budget.
**Architecture:** Keep CI's existing ten-minute build stage unchanged. Select a larger bound only for non-CI Windows runs, where current-main reproducibly reaches the fixed timeout and the same repository build path is known to complete after roughly 13–14 minutes.
**Tech Stack:** Node.js 24, ESM, Vitest 4, Next.js 16.3, repository Lighthouse wrapper.

## Global Constraints

- Do not update `lighthouse-budget.json` or `bundle-budget.json` baselines.
- CI and every non-Windows environment retain the exact `10 * 60_000` build timeout.
- Only non-CI Windows runs receive `20 * 60_000`.
- Keep server readiness, measurement-suite, and per-Lighthouse-process timeouts unchanged.
- Preserve the heavy-run lease and isolated `.next-playwright/lighthouse-*` build ownership.
- The change must be covered by deterministic unit tests before another Lighthouse run.

## Task 1: Select the Lighthouse build timeout by execution environment

**Files**

- Modify: `scripts/lighthouse-time-budget.mjs`
- Modify: `scripts/run-lighthouse-budget.mjs`
- Modify: `tests/check-lighthouse-budget.test.ts`

**Interfaces**

- Produces: `lighthouseBuildTimeoutMs(options: { platform: NodeJS.Platform; ci: boolean }): number`
- Consumes: `process.platform` and the presence of `process.env.CI` only at the call site.

**Steps**

- [ ] Add failing tests to `tests/check-lighthouse-budget.test.ts`:

  First add `lighthouseBuildTimeoutMs` to the named import from
  `scripts/lighthouse-time-budget.mjs`, so the RED result exercises the missing
  export contract rather than an undefined local identifier.

  ```ts
  expect(lighthouseBuildTimeoutMs({ platform: "win32", ci: false })).toBe(20 * 60_000);
  expect(lighthouseBuildTimeoutMs({ platform: "win32", ci: true })).toBe(10 * 60_000);
  expect(lighthouseBuildTimeoutMs({ platform: "linux", ci: false })).toBe(10 * 60_000);
  ```

- [ ] Run `npm run test:focused -- --files tests/check-lighthouse-budget.test.ts` and confirm RED because `lighthouseBuildTimeoutMs` is not exported.

- [ ] Replace the single exported timeout constant with explicit CI/local constants and the selector:

  ```js
  export const LIGHTHOUSE_CI_BUILD_TIMEOUT_MS = 10 * 60_000;
  export const LIGHTHOUSE_LOCAL_WINDOWS_BUILD_TIMEOUT_MS = 20 * 60_000;

  export function lighthouseBuildTimeoutMs({ platform, ci }) {
    return platform === "win32" && !ci ? LIGHTHOUSE_LOCAL_WINDOWS_BUILD_TIMEOUT_MS : LIGHTHOUSE_CI_BUILD_TIMEOUT_MS;
  }
  ```

- [ ] In `scripts/run-lighthouse-budget.mjs`, compute the selected timeout once and pass it to the existing `spawnSync` build call:

  ```js
  const buildTimeoutMs = lighthouseBuildTimeoutMs({
    platform: process.platform,
    ci: process.env.CI !== undefined,
  });
  // ...
  timeout: buildTimeoutMs,
  ```

- [ ] Add a source-contract assertion for the runner's `process.env.CI !== undefined`
      call-site detector. This preserves the CI timeout even when `CI` is present
      with an empty string value.

- [ ] Update the source-contract assertion to require `timeout: buildTimeoutMs` and the explicit `lighthouseBuildTimeoutMs({ ... })` call while retaining the existing bounds for readiness, suite, and child processes.

- [ ] Run `npm run test:focused -- --files tests/check-lighthouse-budget.test.ts` and confirm GREEN with pristine output.

- [ ] Run `npm run format -- --check scripts/lighthouse-time-budget.mjs scripts/run-lighthouse-budget.mjs tests/check-lighthouse-budget.test.ts` if the formatter supports scoped arguments; otherwise run the repository formatter once and inspect the scoped diff.

- [ ] Commit as `fix(lighthouse): allow supported Windows build duration`.

## Completion proof

- [ ] Generate the task review package from the recorded pre-task base to Task 1 HEAD.
- [ ] Obtain independent spec-compliance and code-quality approval.
- [ ] Run `npm run verify:lighthouse` exactly once on the reviewed Task 1 HEAD, without `--update`, and retain the four current-main JSON reports for Phase 1 product triage.
