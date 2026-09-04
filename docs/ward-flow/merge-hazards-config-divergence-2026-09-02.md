# ⚠️ Two config files diverged BEHAVIOURALLY, and one is a silent merge trap

**Measured 2026-09-02. `HEAD 72ef7de4f` · `origin/main a4a95ec89` · merge-base `b183dc65a`.**
Read-only, local objects only. **The owner intends to merge `origin/main` "in a few hours", so these
are live hazards, not background facts.**

## ⚠️ HAZARD 1 — the Playwright regex. A naive merge silently deletes tests.

`playwright.config.ts` has one regex listing which spec files run. **Both sides added to it.**

```
origin/main added:   sources          therapy-pathways
this branch added:   ward-morning     ward-referrals
```

**Each side's new spec files are matched ONLY by its own side's regex** — verified by running each
branch's actual regex text against the other's filenames in Node, all four returning `false`:

```
origin/main has  tests/ui-sources.spec.ts, tests/ui-therapy-pathways.spec.ts   -> this branch's regex: NO MATCH
this branch has  tests/ui-ward-morning.spec.ts, tests/ui-ward-referrals.spec.ts -> origin/main's regex: NO MATCH
```

⚠️ **SO A MERGE THAT RESOLVES THIS HUNK BY KEEPING EITHER SIDE DROPS THE OTHER SIDE'S SPEC FILES OUT
OF EVERY PLAYWRIGHT PROJECT.** They are not deleted, they are not reported, they simply stop being
collected. **The suite goes green because it ran fewer tests.**

⚠️ **AND IT IS THE MOST LIKELY RESOLUTION.** A conflict inside one long regex on one line looks like
a formatting collision, and "take theirs" or "take ours" both produce valid, compiling, passing
config. **The correct resolution is the UNION of all four tokens, and nothing about the conflict says
so.**

**Mitigation that already exists:** the file's own comment says
`tests/playwright-project-isolation.test.ts` exists to catch this, and it is present on both branches.
⚠️ **Whether it actually fires on a dropped token is NOT verified and should be checked before the
merge, not after.**

**Projects, testDir, timeouts, retries, workers and reporter are all UNCHANGED** — six projects,
identical names, on both sides. The regex is the whole divergence.

## ⚠️ HAZARD 2 — the typecheck config. This branch is running the version main wrote a fix to retire.

```diff
-  "include": ["next-env.d.ts", ...]
+  "include": ["next-env.typecheck.d.ts", ...]
+  "exclude": [..., "next-env.d.ts", ...]
```

`next-env.typecheck.d.ts` is a **new 37-line file added by `origin/main`.**
⚠️ **It does not exist on this branch at all** — `git show HEAD:next-env.typecheck.d.ts` returns
_"path does not exist in HEAD"_. So this branch's `tsconfig.typecheck.json` is still the untouched
merge-base version, still including the real, gitignored, Next-regenerated `next-env.d.ts`.

Under Next 16 that file now contains `import "./.next/dev/types/routes.d.ts"` — **the build-artifact
dependency the change exists to strip out, and the cause of a documented incident: 106 spurious
errors on 2026-09-01 from a truncated `.next` file.**

⚠️ `typecheck:internal`, `typecheck:source:internal` and `typecheck:ci:internal` all run this config.
**Every `tsc` green reported on this branch today was produced by the pre-fix gate with that failure
mode still live.** No such failure was observed — but the protection main added is not present here.

## What else moved that changes gate behaviour

- **`.github/workflows/ci.yml`** — a script-injection hardening refactor around the Lighthouse
  baseline dispatch. **Logically equivalent; does not change which jobs run for an ordinary PR.**
- **`package.json` scripts** — main adds `test:cc-guards`, `check:source-catalogue`,
  `check:stale-docs`, two design-system updaters, and extends `check:design-system-contract`; drops
  `backfill:smart-v2-labels`.
- **Unchanged, each checked individually:** `eslint.config.mjs`, `vitest.config.mts`, `.prettierrc`,
  `.prettierignore`.

## ⚠️ The general lesson, and it is bigger than these two files

Both hazards have the same shape: **this branch is not "behind" in the sense of missing features. It
is running OLDER VERSIONS OF THE INSTRUMENTS THAT MEASURE IT.** A branch can be measured green by a
gate that main has already replaced, and nothing in the green says so.

⚠️ **"Is my code stale" and "is my measuring equipment stale" are different questions, and only the
first one gets asked.**
