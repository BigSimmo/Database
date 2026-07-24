# WebKit RSC Prefetch Disposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disposition issue #024 by proving whether the WebKit `_rsc` access-control page error is caused by the route-coverage harness, applying only a test correction when that proof succeeds, and otherwise recording a concrete native-Safari impact investigation.

**Architecture:** Keep application and Next.js runtime code unchanged. Start with one affected WebKit journey, remove only the catch-all interception in a temporary experiment, and accept the harness hypothesis only if the same journey changes from the characteristic `_rsc` failure to a clean pass. The permanent candidate intercepts cross-origin HTTP(S) requests without routing same-origin RSC prefetches through Playwright, while retaining explicit proof that external requests are blocked and all page errors remain failures.

**Tech Stack:** Next.js 16.2.11, React 19.2.7, Playwright 1.61.1, Playwright WebKit, TypeScript, npm 11 on Node 24.

**Specification Link:** The source specification is the 2026-07-24 chat request; no Notion page URL was supplied. Do not create or update a Notion page because this task forbids provider calls.

## Global Constraints

- Work only in a fresh worktree created from the latest `origin/main`.
- Make no OpenAI, Supabase, hosted CI, live-site, or other provider-backed calls.
- Keep `pageerror` collection unfiltered; do not ignore the WebKit message.
- Keep cross-origin request detection and blocking executable and directly tested.
- Make no application/runtime change unless a native-Safari defect is independently proven.
- Start with one affected WebKit test before any file-wide or Chromium gate.
- Do not inspect, switch to, edit, merge, rebase, or otherwise touch `codex/chat-document-text-accordion-7cb4`.
- Leave issue #065 and its document-viewer accordion paused unless a later user message explicitly resumes it.

## File Map

- Modify conditionally: `tests/ui-route-coverage.spec.ts`
  - Owns offline API fixtures, cross-origin request blocking, unfiltered page-error collection, and the affected route journeys.
  - Receives the external-only matcher and its focused blocking proof only when the temporary experiment discriminates.
- Modify: `docs/outstanding-issues.md`
  - Records either the proven test-harness resolution or the still-open native-Safari impact plan.
  - Must leave every #065 row byte-for-byte unchanged.
- Do not modify: `playwright.config.ts`
  - The browser projects and required Chromium gate remain unchanged; the defect is isolated inside one spec's catch-all route.
- Do not modify: application files under `src/`
  - There is no current evidence of a Safari user defect.

---

### Task 1: Reproduce and discriminate the WebKit failure

**Files:**

- Inspect: `tests/ui-route-coverage.spec.ts`
- Evidence only: ignored `.local/workflow-evidence/` and Playwright terminal output

**Interfaces:**

- Consumes: `blockExternalRequests(page, problems)`, `problemsByPage`, and the existing unfiltered `page.on("pageerror", ...)` listener.
- Produces: one of two evidence states:
  - `harness-proven`: broad local interception fails and the same test without that interception passes.
  - `harness-unproven`: the current failure does not reproduce or survives removal of broad interception.

- [ ] **Step 1: Verify the worktree and local app identity**

Run:

```bash
node scripts/check-base-freshness.mjs
npm run ensure
```

Expected: base freshness reports `behind 0`; `ensure` prints an identity-checked local URL. Do not attach the Playwright run to that server—the repository e2e runner owns a separate isolated production server.

- [ ] **Step 2: Run the smallest current-main WebKit reproducer**

Run:

```bash
npm run test:e2e -- tests/ui-route-coverage.spec.ts \
  --project=webkit \
  --grep "DSM home renders responsively and opens comparison"
```

Expected for the recorded #024 defect: the journey renders and interacts, then `afterEach` fails with a `pageerror` containing a same-origin `?_rsc=` URL and `due to access control checks`.

If it passes, run the same command once more. If both runs pass, do not invent a test fix; skip to Task 3's `harness-unproven` disposition.

- [ ] **Step 3: Temporarily remove only the broad interception**

Apply this uncommitted diagnostic edit in `test.beforeEach`:

```ts
test.beforeEach(async ({ page }) => {
  const problems: string[] = [];
  problemsByPage.set(page, problems);
  page.on("pageerror", (error) => problems.push(`pageerror ${error.message}`));
  // Diagnostic only: do not install blockExternalRequests.
  await installOfflineApiFixtures(page, problems);
  await installTherapyFixtures(page);
});
```

Keep the API and therapy fixtures, route assertions, UI interactions, and unfiltered page-error listener unchanged.

- [ ] **Step 4: Re-run the identical WebKit journey**

Run:

```bash
npm run test:e2e -- tests/ui-route-coverage.spec.ts \
  --project=webkit \
  --grep "DSM home renders responsively and opens comparison"
```

Expected for `harness-proven`: PASS with no `_rsc` page error.

If the error remains, immediately restore `tests/ui-route-coverage.spec.ts`, make no interception correction, and continue with Task 3's `harness-unproven` disposition.

- [ ] **Step 5: Restore the diagnostic edit before implementation**

Run:

```bash
git diff -- tests/ui-route-coverage.spec.ts
```

Restore only the temporary omission so the next diff begins from the current-main catch-all implementation. Expected before Task 2: `git diff -- tests/ui-route-coverage.spec.ts` is empty.

---

### Task 2: Apply the test-only correction when the harness hypothesis is proven

**Condition:** Execute this task only when Task 1 produced `harness-proven`.

**Files:**

- Modify: `tests/ui-route-coverage.spec.ts`
- Test: `tests/ui-route-coverage.spec.ts`

**Interfaces:**

- Consumes: Playwright's `baseURL` fixture and `page.route(RegExp, handler)` API.
- Produces: `externalHttpUrlPattern(baseURL: string): RegExp` and `blockExternalRequests(page: Page, problems: string[], baseURL: string): Promise<void>`.

- [ ] **Step 1: Add an explicit failing proof for the external-request guard**

Add this test inside `previously uncovered production routes` before the route journeys:

```ts
test("external request guard blocks and records cross-origin HTTP", async ({ page }) => {
  const problems = problemsByPage.get(page);
  expect(problems).toBeDefined();

  const outcome = await page.evaluate(async () => {
    try {
      await fetch("https://example.invalid/route-coverage-acl-probe");
      return "resolved";
    } catch {
      return "blocked";
    }
  });

  expect(outcome).toBe("blocked");
  expect(problems?.splice(0)).toEqual(["external GET https://example.invalid/route-coverage-acl-probe"]);
});
```

The request must be aborted by Playwright before network egress. The exact `problems` assertion prevents DNS/CORS failure from falsely passing the test.

- [ ] **Step 2: Run the proof against the existing broad matcher**

Run:

```bash
npm run test:e2e -- tests/ui-route-coverage.spec.ts \
  --project=webkit \
  --grep "external request guard blocks and records cross-origin HTTP"
```

Expected: PASS. This establishes that the existing guard is executable before its matching scope changes.

- [ ] **Step 3: Replace the catch-all route with an external-only matcher**

Replace the current `blockExternalRequests` implementation with:

```ts
function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function externalHttpUrlPattern(baseURL: string) {
  const localOrigin = escapeRegExp(new URL(baseURL).origin);
  return new RegExp(`^(?!${localOrigin}(?:/|$))https?://`);
}

async function blockExternalRequests(page: Page, problems: string[], baseURL: string) {
  await page.route(externalHttpUrlPattern(baseURL), async (route) => {
    const url = new URL(route.request().url());
    problems.push(`external ${route.request().method()} ${url.origin}${url.pathname}`);
    await route.abort("blockedbyclient");
  });
}
```

This leaves same-origin documents, assets, and Next.js `_rsc` prefetches outside Playwright routing while continuing to intercept every cross-origin HTTP(S) URL.

- [ ] **Step 4: Pass the verified Playwright base URL into the guard**

Replace the `beforeEach` callback with:

```ts
test.beforeEach(async ({ page, baseURL }) => {
  const problems: string[] = [];
  problemsByPage.set(page, problems);
  page.on("pageerror", (error) => problems.push(`pageerror ${error.message}`));
  if (!baseURL) throw new Error("ui-route-coverage requires the verified Playwright base URL.");
  await blockExternalRequests(page, problems, baseURL);
  await installOfflineApiFixtures(page, problems);
  await installTherapyFixtures(page);
});
```

Do not change the `afterEach` equality assertion or add any browser-specific page-error filtering.

- [ ] **Step 5: Prove both sides of the correction in WebKit**

Run the guard proof first:

```bash
npm run test:e2e -- tests/ui-route-coverage.spec.ts \
  --project=webkit \
  --grep "external request guard blocks and records cross-origin HTTP"
```

Expected: PASS with the exact external-request record consumed by the test.

Then run the original reproducer:

```bash
npm run test:e2e -- tests/ui-route-coverage.spec.ts \
  --project=webkit \
  --grep "DSM home renders responsively and opens comparison"
```

Expected: PASS with no `_rsc` page error.

- [ ] **Step 6: Commit the independently testable harness correction**

Run:

```bash
git add tests/ui-route-coverage.spec.ts
git commit -m "test: avoid intercepting local WebKit RSC prefetches"
```

Expected: one commit containing only the spec correction and focused proof.

---

### Task 3: Disposition #024 without touching #065

**Files:**

- Modify: `docs/outstanding-issues.md`
- Verify unchanged: every row containing `#065`

**Interfaces:**

- Consumes: Task 1's evidence state and Task 2's focused results when applicable.
- Produces: an auditable #024 archive row or a bounded native-Safari impact plan.

- [ ] **Step 1: Snapshot the paused #065 rows before editing**

Run:

```bash
rg -n "#065" docs/outstanding-issues.md
```

Save the output locally for comparison. Do not inspect or modify the paused branch.

- [ ] **Step 2A: Record a proven harness resolution**

When Task 1 produced `harness-proven` and Task 2 is green:

1. Remove #024 from the recommended execution queue.
2. Remove its open-item row.
3. Run `git rev-parse HEAD`, then append a `Resolved / archive` row dated `2026-07-24`. Its outcome must state:
   - the affected journey failed only while same-origin requests passed through the catch-all Playwright route;
   - the same journey passed when that interception was removed;
   - the committed external-only matcher leaves local RSC prefetches native;
   - the explicit cross-origin probe proves blocking and recording;
   - the unfiltered page-error assertion remains intact; and
   - focused WebKit, the full route-coverage WebKit file, Chromium UI, and offline gates passed on commit followed by the literal 40-character SHA printed by `git rev-parse HEAD`.

- [ ] **Step 2B: Record a native-Safari impact plan when the harness is not proven**

When Task 1 produced `harness-unproven`, keep #024 open and replace its next action with this bounded plan:

```markdown
Next: on a provider-free macOS test host, run the same production build in current stable Safari and Safari Technology Preview without Playwright interception; visit `/dsm`, `/dsm/compare?ids=major-depressive-disorder,bipolar-ii-disorder`, `/specifiers/compare?a=with-mixed-features&b=with-anxious-distress`, and `/differentials/diagnoses?q=delirium`; capture console text plus the `_rsc` request/response status and response access-control headers. Compare those results with Playwright WebKit using the catch-all route enabled and disabled. Treat as an application defect only if native Safari reproduces without interception; otherwise return to the test harness. Do not suppress page errors or change application CORS headers without native evidence.
```

Do not modify `tests/ui-route-coverage.spec.ts` in this branch.

- [ ] **Step 3: Prove #065 is unchanged**

Run:

```bash
git diff --word-diff=porcelain origin/main -- docs/outstanding-issues.md
rg -n "#065" docs/outstanding-issues.md
```

Expected: the diff mentions #024 only; the #065 output exactly matches the pre-edit snapshot.

- [ ] **Step 4: Commit the disposition**

Run:

```bash
git add docs/outstanding-issues.md
git commit -m "docs: disposition WebKit RSC prefetch issue"
```

Expected: one documentation commit with no #065 change.

---

### Task 4: Widen verification only after the focused WebKit proof

**Files:**

- Test: `tests/ui-route-coverage.spec.ts`
- Verify: repository-wide offline checks selected by the flightplan

**Interfaces:**

- Consumes: the final committed #024 path.
- Produces: focused WebKit evidence, required Chromium evidence, and offline handoff evidence.

- [ ] **Step 1: Run the complete affected spec in WebKit**

Run:

```bash
npm run test:e2e -- tests/ui-route-coverage.spec.ts --project=webkit
```

Expected: all route-coverage tests pass with no unmocked API/external request and no page error.

- [ ] **Step 2: Run the affected spec in Chromium**

Run:

```bash
npm run test:e2e -- tests/ui-route-coverage.spec.ts --project=chromium
```

Expected: all route-coverage tests pass. This confirms the required browser did not regress before the broad UI gate.

- [ ] **Step 3: Run the broad offline source gate**

Run:

```bash
npm run verify:cheap
```

Expected: runtime/config checks, lint, typecheck, and the full unit suite pass.

- [ ] **Step 4: Run the required Chromium UI gate**

Run:

```bash
npm run verify:ui
```

Expected: the required production Chromium project passes. The repository's PR gate remains Chromium-only.

- [ ] **Step 5: Run the risk-scoped PR-local gate**

Run:

```bash
npm run verify:pr-local
```

Expected: formatting and all selected local/offline checks pass without provider access.

- [ ] **Step 6: Stop at the provider boundary**

Do not run `verify:release`, `test:live`, `check:supabase-project`, hosted CI reruns, OpenAI/Supabase checks, or live Safari services. Record those as not run because this task explicitly forbids provider calls.

---

## Dependencies

- Node 24.x and npm 11.x.
- Lockfile-installed Playwright 1.61.1 browser binaries, including WebKit.
- The repository-owned production Playwright runner and heavy-command lock.
- A separate provider-free macOS host only if Task 1 cannot prove the harness hypothesis.

## Risks and Mitigations

- **False harness attribution:** Require the same test to fail with broad local interception and pass without it before changing the matcher.
- **Silenced access-control regressions:** Keep `pageerror` unfiltered and add an explicit intercepted cross-origin probe whose exact record must be observed.
- **Accidental egress:** Use `example.invalid` only behind a Playwright route that aborts it; the assertion fails if the route does not record the request.
- **Over-broad configuration change:** Keep the correction inside `ui-route-coverage.spec.ts`; do not alter browser projects or application CORS behavior.
- **Stale intermittent evidence:** Start from current `origin/main`, use one known affected WebKit journey, then run the whole affected file after correction.
- **Scope collision with #065:** Compare all #065 rows before and after the ledger edit and never enter its preserved branch/worktree.

## Acceptance Evidence

- The baseline and no-broad-route runs differ as specified, or the native-Safari impact plan is recorded with no speculative test fix.
- External HTTP(S) blocking is directly proven after any matcher correction.
- The unfiltered page-error assertion remains byte-for-byte present.
- The complete WebKit route-coverage file passes after a harness fix.
- `verify:cheap`, `verify:ui`, and `verify:pr-local` pass offline.
- `docs/outstanding-issues.md` accurately archives or re-scopes #024 while #065 remains unchanged and paused.
