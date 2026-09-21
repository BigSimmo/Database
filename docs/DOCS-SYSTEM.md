# Documentation system

How Documentation keeps project docs accurate, logged, and non-stale across Joshua’s repos. **Process doc — no product DDL.**

_Owned by Documentation. Updated 2026-09-21 (adversarial harden)._ 

## Principles

1. **One live source per topic** — archive or stub duplicates.
2. **Stamp what you touch** — live docs carry `_Updated YYYY-MM-DD — <why>; Documentation owns._`
3. **Names only for secrets** — never paste values, JWTs, or dashboard passwords.
4. **Status in one board** — closeout/coordination files own deferred status; other docs link, don’t fork.
5. **Improve the map while you’re here** — one small discoverability/archive/link fix per pass when cheap.
6. **Ward Flow tip lock** — Ward Flow work uses only `D:\Worktrees\Database\ward-lead` on Josh’s PC. Confirm tip (`git log -1` / `rev-parse`) before acting. No stale worktrees, detached inventory/suite checkouts, older SHAs, or cloud agents unless Joshua explicitly names another path.
7. **Recheck triggers** — every live doc class has an event that invalidates it (below). Weekday sweep is backup, not the only freshness mechanism.

## Pipeline (every docs change)

```
Scope → Read tip → Edit (class-aware) → Stamp + PR → Memory/FYI → One map improvement
```

| Step | Do |
| --- | --- |
| Scope | Project + tip path/branch; list files; no drive-by WIP |
| Read | Entry doc + any closeout/board; hunt duplicates |
| Edit | Prefer short appends; fix relative links; scrub `file://` |
| Ship | docs: commit on a docs/* branch; PR with Summary + Test plan |
| Log | Agent memory (path, PR, ownership, TBDs); FYI sibling agents only if they own adjacent work |
| Improve | One Start-here / archive / link / port-env fix if cheap |

## Doc classes

| Class | Rule | Recheck when |
| --- | --- | --- |
| Entry (README, first-run) | Short, current, linked from root / docs README | Tip SHA / boot command / entry path changes |
| Runbook | Imperative; restamp when operator state changes | Operator dashboard/CLI steps change |
| Closeout / deferred | Short; deferred list + status; no secrets | Teammate reports phase done / deferred item moves |
| Plan / playbook | Don’t duplicate live status — point at the board | Plan superseded or board moves |
| Historical | Under an archive/ folder (+ stub if old path is linked) | Never “update” — supersede with a new dated note |
| Generated | Don’t hand-edit | After regenerating indexes/inventories |

## Freshness

- **Event-driven first:** apply the recheck column when the triggering event happens (handoff from Supabase/Railway, tip move, boot script rename, merge of a docs PR).
- **Weekday sweep (Documentation routine, 08:15 AWST Mon–Fri):** tip identity → entry docs → stamps vs known operator moves → dual ledgers → archive hygiene → link check → open docs/* PRs vs teammate updates.
- Fix cheap issues in-sweep; queue large rewrites.
- Stay quiet to Joshua unless something changed or a decision is needed.

## Project registry

| Project | Tip / repo | Entry docs | Doc check | Notes |
| --- | --- | --- | --- | --- |
| **PsychSift** (repo `BigSimmo/Database`) | GitHub default `main`; local tips on Josh PC worktrees as named | Root `README.md`, `docs/README.md` (generated catalog — do not hand-edit), process: this file | `npm run docs:check-links`, `docs:check-scripts`, `docs:check-inventory`, `docs:check-index` | Product name is PsychSift; “Clinical KB” is the Supabase project label. Closeout: [PR #2959 closeout notes](https://github.com/BigSimmo/Database/pull/2959) (PR #2959) |
| **Ward Flow** | **Only** Josh PC `D:\Worktrees\Database\ward-lead` (confirm tip before acting) | Ward Flow tip live set: README / LOCAL-FIRST-RUN / ARCHIVE-NOTE / STATUS (live under the tip docs/ward-flow tree; that folder layout is not on main) | Ward Flow tip only: script `ward:check-docs` (alias of `check:ward-doc-links`; not on main) | Port via `npm run ensure` / `stableProjectPort` — never hardcode. Dated notes under dated-notes archive on the Ward Flow tip (not on main). Never stale worktrees / cloud / other paths unless Joshua names them |

Extend this table when a new product tip is confirmed — don’t invent paths.

### Registry accuracy rules

- Script names and filenames in this table must match `package.json` and the tip tree — verify before editing this file.
- If an entry doc cites a tip SHA, that SHA must equal `git rev-parse HEAD` on the locked tip (or the sentence must say “as of &lt;date&gt;” and be updated on the next docs pass).
- Agent skills (**Documentation Operating System**, **Docs Freshness Audit**) mirror this file; when they disagree, **this file on the project tip/PR wins**, then skills are updated.

## Related

- Agent skills (Documentation bot): **Documentation Operating System**, **Docs Freshness Audit**.
- Active PsychSift / Clinical KB closeout: [PR #2959 closeout notes](https://github.com/BigSimmo/Database/pull/2959).
