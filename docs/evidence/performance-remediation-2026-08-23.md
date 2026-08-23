# Current-main performance remediation evidence — 2026-08-23

## Outcome and evidence boundary

This change fixes the two deterministically attributed layout mechanisms on the shared search shell,
removes an unsolicited Applications-route prefetch, and makes the bundle baseline's provenance
uncertainty visible without weakening any size ceiling. It also turns the CLS investigation harness
into a fail-closed, responsive, degraded-state matrix. The attempted request-rendered root start-state
experiment was rejected and reverted because JavaScript-disabled Chromium still remained on the
repository-wide streamed `Loading` boundary; widening the change into the global loading architecture
was not justified by the evidence.

Three evidence generations must not be conflated:

- **Historical Cloud:** commit `f3d1a3cce2c943ad3083425ed9c7c46dbef23087`. The four original
  untracked Cloud Lighthouse JSON files did not transfer to this local checkout. Only the committed
  summaries remain, so these numbers are historical context, not a current comparison.
- **Windows pre-remediation:** exact head `6c0e7598ba73e803f4a2ad4b155763f1ddd5b549`, Chrome/Lighthouse
  151, three unchanged-input runs retained across `lighthouse-cloud-audit/`, `lighthouse-pre-2/`, and
  `lighthouse-pre-3/`.
- **Windows post-remediation application head:** `7cf37b53010c52eaa3c2deb1de816a56c4f9e177`, after merging
  `origin/main` at `883f1007a`. The final PR may add evidence and immutable ledger-request files after
  this application measurement; those documentation-only commits do not change the measured build.

The Windows Lighthouse checker correctly reports **evidence incomplete** against the committed Linux
baseline. Windows reports are retained diagnostics only; Linux grading remains CI-owned. No provider,
database, hosted environment, production deployment, or physical iPhone Safari/PWA check was run.

## Historical Cloud context

| Cell                        | LCP (ms) | FCP (ms) | TBT (ms) |      CLS |
| --------------------------- | -------: | -------: | -------: | -------: |
| Desktop `/documents/search` |      866 |      340 |      4.5 | 0.119263 |
| Desktop `/`                 |      822 |      335 |      2.5 | 0.007424 |
| Mobile `/documents/search`  |    2,271 |    2,271 |  347.669 |        0 |
| Mobile `/`                  |    2,252 |    2,252 |  296.283 | 0.015750 |

These values cannot be used as a same-host before/after comparison because the raw Cloud artifacts are
unavailable and the local host/OS differs.

## Windows Lighthouse distribution

### Pre-remediation: every retained run

| Cell                        | Run |  LCP (ms) |  FCP (ms) | TBT (ms) |         CLS | Unused JS (B) | Transfer (B) | Requests |
| --------------------------- | --: | --------: | --------: | -------: | ----------: | ------------: | -----------: | -------: |
| Desktop `/documents/search` |   1 |     1,017 |       380 |       79 | 0.027229314 |        96,978 |      548,400 |       61 |
| Desktop `/documents/search` |   2 |   1,038.5 |       380 |        0 | 0.027229314 |        96,978 |      551,441 |       61 |
| Desktop `/documents/search` |   3 |     1,034 |       380 |      1.5 | 0.027229314 |        96,978 |      547,502 |       61 |
| Desktop `/`                 |   1 |     1,418 |       380 |       30 | 0.007020331 |       154,107 |      676,289 |       71 |
| Desktop `/`                 |   2 |     1,566 |       380 |        0 |           0 |       154,107 |      675,941 |       71 |
| Desktop `/`                 |   3 |     1,358 |       390 |        0 | 0.007020331 |       154,107 |      671,286 |       71 |
| Mobile `/documents/search`  |   1 | 2,737.394 | 2,737.394 |  881.361 | 0.000816348 |       102,994 |      481,225 |       38 |
| Mobile `/documents/search`  |   2 | 2,741.402 | 2,741.402 |  621.069 | 0.000816348 |       102,994 |      481,238 |       38 |
| Mobile `/documents/search`  |   3 | 2,763.269 | 2,763.269 |  634.817 | 0.000816348 |       103,274 |      481,229 |       38 |
| Mobile `/`                  |   1 | 6,794.509 | 2,023.587 |   61.193 |           0 |       131,743 |      637,485 |       60 |
| Mobile `/`                  |   2 | 7,073.383 | 2,244.424 |  547.381 |           0 |       131,743 |      637,496 |       60 |
| Mobile `/`                  |   3 | 7,415.561 | 2,554.813 |  681.867 |           0 |       131,743 |      636,847 |       60 |

### Post-remediation: every retained run

| Cell                        | Run |  LCP (ms) |  FCP (ms) |  TBT (ms) |         CLS | Unused JS (B) | Transfer (B) | Requests | LCP render delay (ms) |
| --------------------------- | --: | --------: | --------: | --------: | ----------: | ------------: | -----------: | -------: | --------------------: |
| Desktop `/documents/search` |   1 |     1,002 |       380 |      14.5 | 0.000251762 |       118,700 |      550,796 |       62 |               362.554 |
| Desktop `/documents/search` |   2 |       980 |       380 |      39.5 | 0.000251762 |       118,693 |      550,199 |       62 |               447.968 |
| Desktop `/documents/search` |   3 |     1,080 |       380 |        34 | 0.000251762 |       118,693 |      552,110 |       62 |               405.685 |
| Desktop `/`                 |   1 |     1,457 |       380 |        40 | 0.007020331 |       156,316 |      677,373 |       69 |               777.143 |
| Desktop `/`                 |   2 |     1,390 |       380 |         4 | 0.007020331 |       156,322 |      678,133 |       69 |               475.801 |
| Desktop `/`                 |   3 |     1,432 |       380 |      33.5 | 0.007020331 |       156,316 |      679,204 |       69 |               803.899 |
| Mobile `/documents/search`  |   1 | 2,836.584 | 2,836.583 |     802.5 | 0.000816348 |       123,763 |      484,899 |       39 |             2,456.843 |
| Mobile `/documents/search`  |   2 | 2,793.331 | 2,793.331 |   713.112 | 0.000816348 |       123,691 |      484,895 |       39 |             2,403.369 |
| Mobile `/documents/search`  |   3 | 2,771.706 | 2,771.706 |   793.742 | 0.000816348 |       123,691 |      484,898 |       39 |             2,410.990 |
| Mobile `/`                  |   1 | 8,032.226 | 2,631.240 | 1,380.717 |           0 |       134,306 |      622,541 |       52 |             7,327.524 |
| Mobile `/`                  |   2 | 7,595.028 | 2,273.824 | 1,029.670 |           0 |       134,377 |      622,545 |       52 |             6,919.824 |
| Mobile `/`                  |   3 | 7,422.315 | 2,651.457 |   747.078 |           0 |       134,306 |      622,548 |       52 |             6,561.400 |

### Same-host medians

| Cell                        | Metric           |   Pre median |  Post median |                Change |
| --------------------------- | ---------------- | -----------: | -----------: | --------------------: |
| Desktop `/documents/search` | LCP              |     1,034 ms |     1,002 ms |        −32 ms (−3.1%) |
|                             | FCP              |       380 ms |       380 ms |             unchanged |
|                             | TBT              |       1.5 ms |        34 ms |              +32.5 ms |
|                             | CLS              |  0.027229314 |  0.000251762 |            **−99.1%** |
|                             | Unused JS        |     96,978 B |    118,693 B |    +21,715 B (+22.4%) |
|                             | Transfer         |    548,400 B |    550,796 B |      +2,396 B (+0.4%) |
|                             | Requests         |           61 |           62 |                    +1 |
|                             | LCP render delay |   279.864 ms |   405.685 ms |           +125.821 ms |
| Desktop `/`                 | LCP              |     1,418 ms |     1,432 ms |        +14 ms (+1.0%) |
|                             | FCP              |       380 ms |       380 ms |             unchanged |
|                             | TBT              |         0 ms |      33.5 ms |              +33.5 ms |
|                             | CLS              |  0.007020331 |  0.007020331 |             unchanged |
|                             | Unused JS        |    154,107 B |    156,316 B |      +2,209 B (+1.4%) |
|                             | Transfer         |    675,941 B |    678,133 B |      +2,192 B (+0.3%) |
|                             | Requests         |           71 |           69 |        **−2 (−2.8%)** |
|                             | LCP render delay |   599.103 ms |   777.143 ms |           +178.040 ms |
| Mobile `/documents/search`  | LCP/FCP          | 2,741.402 ms | 2,793.331 ms |    +51.929 ms (+1.9%) |
|                             | TBT              |   634.817 ms |   793.742 ms |  +158.925 ms (+25.0%) |
|                             | CLS              |  0.000816348 |  0.000816348 |             unchanged |
|                             | Unused JS        |    102,994 B |    123,691 B |    +20,697 B (+20.1%) |
|                             | Transfer         |    481,229 B |    484,898 B |      +3,669 B (+0.8%) |
|                             | Requests         |           38 |           39 |                    +1 |
|                             | LCP render delay | 2,392.082 ms | 2,410.990 ms |            +18.908 ms |
| Mobile `/`                  | LCP              | 7,073.383 ms | 7,595.028 ms |   +521.645 ms (+7.4%) |
|                             | FCP              | 2,244.424 ms | 2,631.240 ms |  +386.816 ms (+17.2%) |
|                             | TBT              |   547.381 ms | 1,029.670 ms |  +482.289 ms (+88.1%) |
|                             | CLS              |            0 |            0 |             unchanged |
|                             | Unused JS        |    131,743 B |    134,306 B |      +2,563 B (+1.9%) |
|                             | Transfer         |    637,485 B |    622,545 B | **−14,940 B (−2.3%)** |
|                             | Requests         |           60 |           52 |       **−8 (−13.3%)** |
|                             | LCP render delay | 6,579.421 ms | 6,919.824 ms |           +340.403 ms |

The desktop Documents CLS reduction and root request-count reductions are invariant across all three
runs and are credible same-host signals. Desktop timings and mobile Documents LCP/FCP overlap their
pre-run ranges and are not treated as decisive. Mobile Documents TBT increased at the median but the
ranges overlap. Mobile root is a real follow-up signal: all post LCP readings are above the pre median,
and post TBT is `747–1,381 ms` versus `61–682 ms` pre. That signal is reported, not attributed to this
patch: the post head also includes four concurrent `origin/main` commits, Lighthouse timing is host-load
sensitive, root transfer and requests both fell, and the retained code changes do not add a root startup
request. A quiet-host current-main control or Linux CI distribution is required before changing product
code from it.

The request-rendering experiment is therefore not claimed as an LCP improvement. Only changes retained
after the experiment's revert are evaluated here.

## Deterministic CLS attribution

The production attribution harness uses named profiles and records viewport, DPR, touch/mobile
semantics, phase boundaries, layout-shift sources, first/settled geometry, and LCP-candidate visibility.
It stays provider-free and database-free. Offline is toggled only after loopback assets are ready; the
local-identity fault is a one-shot deterministic 503 after a validated healthy identity response.
Completed cells are checkpointed atomically, and an early failure first replaces stale output with an
empty current-run schema.

### Root `/`

| Profile                  | Before total CLS | After total CLS | Result                                             |
| ------------------------ | ---------------: | --------------: | -------------------------------------------------- |
| Mobile 412x823, DPR 1.75 |      0.238731842 |               0 | Mobile remains zero after stabilization            |
| Desktop 800x900          |      0.234190629 |     0.000408296 | Initial and every degraded phase below 0.01        |
| Desktop 1280x900         |      0.161783808 |     0.008335677 | Existing wide initial reserve retained; below 0.01 |
| Desktop 1350x940         |      0.154370962 |     0.007174769 | Existing wide initial reserve retained; below 0.01 |
| Desktop 1440x900         |      0.136826009 |     0.006586214 | Existing wide initial reserve retained; below 0.01 |

Before the fix, each offline, reconnecting, and local-identity-unavailable phase contributed about
`0.07957728` on mobile, and about `0.043–0.071` on desktop. The main start-state section moved by
76–83 px as the degraded notice was inserted or removed. After the always-mounted exact 62 px
`DegradedNoticeFrame`, the main displacement is absent and every degraded phase is below 0.01.

At 800 px, the mode-home composer grew from 88 px to 199 px and initial CLS was `0.02167583`, crossing
the plan's 0.01 intervention threshold. A 640–1023.98 px one-line prompt rail plus 160 px reserve removes
that shift. The 1280/1350/1440 initial shifts were already below 0.01, so the 88 px desktop reserve was
deliberately left unchanged.

### `/documents/search`

| Profile                  |  Before CLS |   After CLS | Result                    |
| ------------------------ | ----------: | ----------: | ------------------------- |
| Mobile 412x823, DPR 1.75 |           0 |           0 | Unchanged                 |
| Desktop 800x900          | 0.094035848 | 0.000060848 | Main displacement removed |
| Desktop 1280x900         | 0.029576740 | 0.000334506 | Main displacement removed |
| Desktop 1350x940         | 0.026650832 | 0.000269450 | Main displacement removed |
| Desktop 1440x900         | 0.023369276 | 0.000021128 | Main displacement removed |

The generic page moved 135 px at 800 and 96 px at wider profiles while page composer/header ownership
settled. A separate 184 px generic-page reserve removes that displacement without borrowing the
mode-home reserve. Headers are visible and stable at 72 px from first observation, LCP candidates become
visible in every cell, and hidden composer owners retain zero reserve.

Raw attribution artifacts are intentionally outside tracked source:

- `output/performance-remediation/cls-before-layout-root.json`
- `output/performance-remediation/cls-after-layout-root.json`
- evidence worktree `output/performance-remediation/cls-before-layout-documents.json`
- evidence worktree `output/performance-remediation/cls-after-layout-documents.json`

## Bundle analysis and budget

`npm run build:analyze` passed at application head `7cf37b530`: webpack compilation 2.9 minutes,
TypeScript 2.7 minutes, 1,982/1,982 static pages, and the client-bundle secret surface passed. Reports:

- `.next/analyze/client.html` — 1,416,324 bytes
- `.next/analyze/nodejs.html` — 2,771,191 bytes
- `.next/analyze/edge.html` — 274,827 bytes; no edge bundles parsed

Largest client assets were `9b0008ae…` (126,744 gzip bytes, `pdfjs-dist/build/pdf.mjs`), `3928…`
(81,827, primarily `src/lib/therapies.ts`), `8322…` (65,453, Next client/runtime), `4bd1…`
(63,162, React DOM client), and current `1566.86a…` (61,560, ClinicalDashboard and supporting
libraries).

Historical asset IDs were mapped only when the full filename/hash matched: `4411-d9ab…` is Supabase
SSR/auth, `8322-a6ca…` is Next client/runtime, and `4bd1b696-66b3…` is React DOM client. Historical
`1566.42db…` differs from current `1566.86a…` and remains explicitly unmapped; no code change was made
from an opaque identifier.

`npm run check:bundle-budget` passed without `--update`:

| Scope               | Current gzip |    Baseline | Tolerance |
| ------------------- | -----------: | ----------: | --------: |
| Production          |  1,672.5 KiB | 1,610.0 KiB |       10% |
| Mockups             |    516.6 KiB |   495.2 KiB |       25% |
| `/`                 |    219.3 KiB |   216.7 KiB |       10% |
| `/documents/search` |    222.4 KiB |   219.8 KiB |       10% |

Total output is 2,189.1 KiB gzip / 7,909.4 KiB raw across 445 chunks. The initial-dashboard fixture
assertion passed for four chunks. Baseline source `e5ee533bc04ff0ab34ff17c23341cb67abf3d59a` does not
resolve locally, so the checker emitted the intended non-failing remediation warning and omitted a
misleading commit-distance claim. This improves diagnosis but does not supply the missing scheduled
refresh owner; `#QSHHGK` remains open.

## Retained-finding matrix

| Finding                                           | Disposition             | Current evidence and stop rule                                                                                                                                                                                                                                             |
| ------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated preference GET then conditional PUT | Intentionally unchanged | The PUT is conditional on the authoritative GET returning no stored preferences. Parallelizing it could overwrite an existing account preference. No authenticated/provider waterfall was run; change only with provider-safe measurement and a concurrency-safe contract. |
| Local identity → setup-status sequencing          | Intentionally unchanged | Local identity is a wrong-project/safe-origin gate. The strengthened harness now validates the full identity body and fails closed. Do not start private API work before that gate without a reviewed equivalent safety proof.                                             |
| Initial dashboard fan-out                         | Measurement-deferred    | Documents/jobs/batches/quality already use `Promise.all` after identity/setup and authorization decisions. No provider-backed waterfall was authorized; optimize only from a measured hosted trace without weakening ownership or demo-mode gates.                         |
| Non-passive zoom handlers                         | Already resolved/stale  | The viewer handler is deliberately non-passive only so Ctrl/Command-wheel and trackpad pinch can prevent browser zoom; plain wheel returns without cancellation and the listener is viewer-scoped (`#214`). Do not make it passive without gesture regression evidence.    |
| Clinical fixture snapshot isolation               | Prevention-only         | Bundle guard now requires complete low-collision marker groups for medication snapshot and interaction index, and all four initial-dashboard chunks pass. This prevents accidental client leakage; it is not a measured runtime improvement.                               |
| Skeleton shimmer                                  | Intentionally unchanged | The default shimmer remains reduced-motion-gated. No paint profile proved it material on the measured routes; change only after a DevTools/profile comparison preserves visual and motion contracts.                                                                       |
| Scoped theme transitions                          | Intentionally unchanged | Theme transitions are user-triggered and have a reduced-motion override. No theme-toggle profile was captured; do not broaden this Lighthouse task into visual-theme behavior.                                                                                             |
| CSP nonce behavior                                | Intentionally unchanged | Per-request nonce extraction is a security boundary even though it makes routes dynamic. Do not trade CSP strength for static rendering without a separate security-reviewed design.                                                                                       |
| Unsolicited Applications prefetch                 | Fixed                   | Removed only the 250 ms mount timer. Desktop/mobile pointer and focus intent still call the existing prefetch callback; auth, favourites, and route eligibility are unchanged.                                                                                             |

## Issue dispositions

After this evidence document is complete, immutable inbox requests queue the following future canonical
ledger transitions; this feature branch does not directly edit or reconcile `docs/outstanding-issues.md`:

- `#308`: queue done — generic `/documents/search` desktop CLS is below 0.01 at every measured profile.
- `#JVYQEM`: queue done — the already-fixed phone case remains zero; 800 px is fixed; 1280+ remains
  deliberately unchanged because measured initial CLS was already below 0.01.
- `#K9XD5N`: queue done — the always-mounted 62 px frame removes every attributed degraded insertion.
- `#2TAQDC`: queue done — documentation, bounded CSS markers, whole-file scan, and a whitespace-mutation
  test reject an unclassified `:has(#main-content …)` consumer.
- `#QSHHGK`: queue update only — provenance warnings now work, but there is still no scheduled baseline
  refresh owner or trigger.
- New P2 investigation: queue add — reproduce the mobile-root timing signal against a synchronized,
  quiet-host `origin/main` control and Linux CI before attributing or changing product code. The request
  explicitly preserves the proven CLS and request-count fixes.
- New P1 upstream-governance defect: queue add — PR #2306's two new manifests reference intermediate
  commit `f604bd41…`, which is absent from a clean main-based object graph; the governance owner must
  record a landed, evidence-faithful identity without weakening the ancestor/path checks.

These remain **queued**, not canonically closed, until a later serialized reconciliation branch applies
the landed requests.

## Verification

Passed:

- Aggregate focused Vitest: 17 files, 283 tests.
- Tailwind-merge follow-up after the aggregate suite found the new token missing from its registry:
  `tests/tailwind-merge-config.test.ts`, 33/33. Scoped Prettier and ESLint also passed for the corrected
  file.
- ESLint: 5,061 inputs.
- TypeScript: 5,061 inputs.
- Normal production build: compiled, TypeScript passed, 1,982/1,982 static pages, client-bundle secret
  check passed. This ran before the one-entry Tailwind-merge registry correction; the affected focused
  test, formatter, and linter were rerun after it.
- `build:analyze` and non-updating bundle budget, as recorded above.
- RAG fixture integrity: 36 golden cases / 26 regression fixtures.
- Medication interaction index: 525 rows; medication lexicon: 37 entries.
- Sitemap; docs index (60 roots); docs inventory (271 scripts / 271 npm scripts); docs script refs (797);
  docs links (3,187); outstanding-issues guard (449 rows, 73 open, 26 pending after final requests);
  branch-review ledger (880 live, 1,206 archived, 491 immutable at the time of the check).
- `git diff --check`.

The full unit suite was run exactly once: **9,323 passed, 72 skipped, 12 failed**. Nine failures are the
known untouched Windows baseline (six `claude-cloud-profile` status-127 expectations and three
`gate-receipts` chmod/mkdir cases). Of the remaining three, the Tailwind-merge registry failure belonged
to this task and was fixed immediately with the 33/33 focused pass above. Two failures are newly merged
upstream governance defects: `clinical-hazard-controls` and `privacy-readiness` both reference
`f604bd41bee8173fdeca560c03d1c34344f61945`, which is not a local Git object. GitHub identifies PR
#2306's final head as `99158b7b…` and its squash merge as `883f1007a…`; a P1 immutable issue request was
queued rather than falsifying the governance review identity or weakening the checks.

`verify:pr-local` was not used as an aggregate wrapper because its `format:changed` step deliberately
includes the preserved untracked raw Lighthouse JSON directories. Its routed constituent checks were
run explicitly so those artifacts remained unchanged; no full-suite rerun was used to hide the recorded
baseline/upstream failures.

All performance/browser work used repository wrappers and the shared coordinator. Exit 75 means lease
contention rather than a product failure; no lease owner was killed or bypassed. Some Windows Lighthouse
runs can finish with parseable reports but a non-zero wrapper verdict because the committed baseline is
Linux-only, and Chrome may report a temporary-profile cleanup `EPERM`; both are reported separately from
measurement validity.

## Remaining limits

- Linux Lighthouse grading and hosted CI remain pending on the PR.
- No live Supabase/OpenAI/provider, authenticated production waterfall, deployment, or migration was run.
- No physical iPhone Safari/PWA acceptance was run; Chromium device emulation is not that proof.
- The request-rendered root/documents experiment is not shipped. Solving JavaScript-disabled streamed
  fallback requires a separate, wider review of the global loading/request-rendering architecture.
- Bundle baseline provenance visibility is fixed, but baseline scheduling/ownership remains open.
