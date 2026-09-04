# Final fix wave — builder-plan-2026-09-01

Branch: `claude/ward-builder-community-route`
Worktree: `D:/Worktrees/Database/ward-builder-community-route`

## Status: 2 of 3 findings fixed and committed. Finding 1 stopped per its own instruction — handed back, not committed.

## Findings 2 and 3 — fixed and committed

Commit `10378f264baef8a847c3731d76349c4648c8d1a3`:
`fix(ward-flow): review round 2 — stale test title and an overclaimed invariant`

- `tests/ward-patient-search.dom.test.tsx:94` — retitled `"...links to its patient page"` to
  `"...links to its movement page"`, matching the assertion below it
  (`href` = `/mockups/ward-flow/movements/WF-003`). Body of the test untouched.
- `src/components/ward-management/ward-model.ts:366` — narrowed the headline from
  `"⚠️ THESE THREE READ AS INDEPENDENT AND ARE NOT"` to
  `"⚠️ \`arrivedAt\` AND \`cancelledAt\` READ AS INDEPENDENT AND ARE NOT"`. Only the headline
line changed; the corrective body seventeen lines down (the `collectedAt` exclusion
  paragraph) was left exactly as written, per the brief.

`git log --stat -1` on that commit confirms exactly these two files, nothing else, matching
what was staged.

## Finding 1 — STOPPED, not committed. Handing back.

Ran `npm run snapshot:repo-awareness`. The regenerated `data/repo-awareness-snapshot.json`
diff contains far more than the route move and the added plan doc the brief named. Per the
brief's own instruction ("If the regenerated diff contains changes that are NOT the route
move and NOT the added plan doc, stop and hand it back to me with what you saw"), I stopped
and left the file uncommitted rather than deciding on my own that the extra content was fine.

**What the regenerated diff actually contains, beyond the two named changes:**

1. **The expected route move** — `/mockups/ward-flow/patients/[patientId]` removed,
   `/mockups/ward-flow/movements/[movementId]` added. This matches the brief.
2. **An unmentioned new route** — `/mockups/ward-flow/community/[teamId]` also appears as a
   new entry. I checked its provenance: it is genuinely committed and an ancestor of `HEAD`
   (`git merge-base --is-ancestor 634232c83 HEAD` → ancestor; introduced by
   `634232c83 feat(ward-flow): the community hub had no address, so nobody could open it`,
   further down this same branch's history). It is not stray or uncommitted content — but the
   brief only described the patients→movements move, not this.
3. **Nine unmentioned new documentation entries**, not just the one plan doc named in the
   brief (`docs/ward-flow/builder-plan-2026-09-01.md`, which is present as expected).
   The other eight/nine that also appear in the diff:
   - `docs/ward-flow-owner-rulings-2026-08-31-community.md`
   - `docs/ward-flow-owner-rulings-2026-08-31.md`
   - `docs/ward-flow-owner-rulings-2026-09-01.md`
   - `docs/ward-flow-plan.md`
   - `docs/ward-flow/control/BUILDER-ACTIVATION-RECEIPTS.md`
   - `docs/ward-flow/how-to-write-to-the-owner.md`
   - `docs/ward-flow/stale-claims.md`
   - `docs/ward-flow/three-chat-working-agreement.md`
   - `docs/ward-flow/who-is-who.md`
     (documents count moved 544 → 554, i.e. +10, matching the plan doc plus these nine)
4. Consequent count-field changes: `pages` 202→203, `mockup_pages` 147→148,
   `documents` 544→554, `uncatalogued` 438→448. `captured_revision` moved from
   `5db2f02fc6f0d04eed3425bc74b0adad438b7ea7` to `b2b7089f2e2d3fbfdc43919869cf40d65b26fbac`
   (the last commit before mine that touched a tracked route/doc path — not `HEAD`, by design
   of the generator, which pins to the last commit touching what it describes).

**Why this happened:** the previously committed snapshot (`5db2f02fc…`) was stale by far more
than this plan's own two changes — it predates a long run of prior commits already on this
branch (the community-hub route, several owner-ruling docs, coordination docs, etc.), all of
which are legitimately merged/committed ancestors of `HEAD`. Regenerating catches up on all of
that accumulated staleness at once, not just this plan's slice of it.

**What I did NOT do:** I did not commit `data/repo-awareness-snapshot.json`. I attempted to
revert the working-tree file back to its committed (stale) state with `git checkout --` and
`git restore`, but the repo's `protect-ward-flow.sh` pre-tool-use hook blocked both — it
appears to pattern-match on the word "restore"/"checkout" broadly and treated a single tracked
file revert as a worktree-deletion risk. I did not use the `CLAUDE_ALLOW_PROTECTED_DELETE=1`
override, since this is not a worktree deletion and no user approval was sought for that
framing. The regenerated file is therefore currently sitting **modified but uncommitted** in
the working tree (`git status --short` shows `M data/repo-awareness-snapshot.json`). Nothing
was staged or committed.

**What needs a decision:** should this snapshot regeneration include the community-hub route
and the eight extra docs (all real, all already committed on this branch), or should it be
scoped down to just this plan's two changes some other way? That is not mine to decide per the
brief. Recommend: if the owner confirms all of this branch's already-committed history should
be reflected (which is the normal/expected behaviour of this generated file — it always
reflects everything committed, not just the latest task), commit the regenerated file as-is in
its own commit. If not, investigate further before committing.

## Checks — actual output

### `npm run check:repo-awareness-snapshot`

Run against the **current working tree**, which includes the regenerated-but-uncommitted
snapshot file from Finding 1 (see above) plus the Finding 2/3 commit:

```
[repo-awareness] in step with data/repo-awareness-snapshot.json (203 pages, 554 documents, 2630 reviews)
```

Passes only because the uncommitted regenerated file is sitting in the tree. Against the
committed `HEAD`, this gate would still be red (`data/repo-awareness-snapshot.json` is
unchanged in any commit).

### `npx tsc -p tsconfig.typecheck.json --noEmit --tsBuildInfoFile /tmp/tsc-fix.tsbuildinfo`

No output, exit code `0`.

### `npx vitest run tests/ward-patient-search.dom.test.tsx tests/ward-nav.test.ts`

```
 Test Files  2 passed (2)
      Tests  64 passed (64)
```

## Concerns for the dispatcher

1. `data/repo-awareness-snapshot.json` is currently **modified in the working tree and
   uncommitted** — not clean, not reverted. Two attempts to revert it were blocked by
   `.claude/hooks/protect-ward-flow.sh` (a false-positive match on a single-file
   `checkout`/`restore`, not an actual worktree deletion). Someone with the ability to
   either approve the protected-delete override or investigate the hook's match pattern
   should resolve this — either commit the regenerated file (if its broader scope is
   accepted) or clear it back to the committed version.
2. Because of (1), `check:repo-awareness-snapshot` will read as green right now but would
   fail again on a fresh checkout of `HEAD` until Finding 1 is actually resolved and
   committed.
3. Findings 2 and 3 are fully committed, verified via `git log --stat -1`, and covered by
   the passing focused test run and clean typecheck above.

## Addendum — coordinator ruling on Finding 1, and its resolution

The coordinator inspected the diff independently, ruled it was not drift (the third route,
`community/[teamId]`, was the coordinator's own work from `634232c83` earlier the same day;
the extra docs are the same story — genuinely committed, on-branch, just predating the last
regeneration), and directed: commit the regenerated snapshot on its own, path only.

Staged with `git add data/repo-awareness-snapshot.json` (that path only — confirmed via
`git status --short` immediately after add: only that one line, `M`, staged). Committed as:

**`21e2cc5d8de2631c13d656e504654f51dfa32fc4`** —
`chore(ward-flow): regenerate the repo-awareness snapshot`

`git log --stat -1` on that commit confirms exactly one file:
`data/repo-awareness-snapshot.json | 77 +++++++++++++++++++++++++++++++++------` (66
insertions, 11 deletions — the same diff inspected earlier, now committed unchanged, not
hand-edited).

Also recorded per the coordinator's note: `.claude/hooks/protect-ward-flow.sh` false-positived
on `git checkout --` and `git restore` against a path under a ward-flow tree (neither is a
worktree deletion) — the third false positive from that hook the coordinator observed today,
after an earlier `git rm` requiring the override as the first token and a scoped `git stash
push` blocked by the auto-mode classifier. Not worked around; reported as-is.

### Re-run checks — now against committed `HEAD`, working tree clean

`git status --short` — empty, nothing uncommitted, before either check ran.

**`npm run check:repo-awareness-snapshot`**

```
[repo-awareness] in step with data/repo-awareness-snapshot.json (203 pages, 554 documents, 2630 reviews)
```

Green, and this time genuinely against committed state — the working tree was clean when it ran.

**`npx tsc -p tsconfig.typecheck.json --noEmit --tsBuildInfoFile /tmp/tsc-fix.tsbuildinfo`**
No output, exit code `0`.

### Final state

All three findings fixed and committed:

- `10378f264baef8a847c3731d76349c4648c8d1a3` — Findings 2 and 3 (test title, invariant headline)
- `21e2cc5d8de2631c13d656e504654f51dfa32fc4` — Finding 1 (regenerated snapshot)

Working tree clean. Both requested checks pass against committed `HEAD`. The earlier
`ward-patient-search.dom.test.tsx` / `ward-nav.test.ts` focused run (64/64 passed) is still
valid — nothing touched those files since.
