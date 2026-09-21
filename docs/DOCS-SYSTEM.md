# Documentation system

How Documentation keeps project docs accurate, logged, and non-stale across Joshua’s repos. **Process doc — no product DDL.**

_Owned by Documentation. Updated 2026-09-21 (adversarial registry accuracy)._

## Principles

1. **One live source per topic** — archive or stub duplicates.
2. **Stamp what you touch** — live docs carry `_Updated YYYY-MM-DD — <why>; Documentation owns._`
3. **Names only for secrets** — never paste values, JWTs, or dashboard passwords.
4. **Status in one board** — one deferred/status owner per topic; other docs link, don’t fork.
5. **Improve the map while you’re here** — one small discoverability/archive/link fix per pass when cheap.
6. **Ward Flow tip lock (operator rule, not portable config)** — Repo identity is `BigSimmo/Database`. When Joshua asks for Ward Flow, use only the checkout he names; confirm tip (`git log -1` / `rev-parse`) before acting. Default on **Josh’s PC** is the `ward-lead` worktree under his Database worktrees folder — discover that path at runtime on his machine; do **not** treat a workstation-absolute path as something Cloud/Linux/other PCs can open. Discover the running app origin via `npm run ensure` (path-stable port helper in-repo — never hardcode ports) — never hardcode ports. No stale worktrees, detached inventory/suite checkouts, older SHAs, or cloud agents unless Joshua explicitly names another path.
7. **Recheck triggers** — every live doc class has an event that invalidates it (below). Weekday sweep is backup, not the only freshness mechanism.
8. **Registry claims must be tip-true** — script names, entry filenames, and “generated” claims must match the tip you are editing (`package.json` + tree). Prefer under-claiming over inventing tip-only paths.

## Pipeline (every docs change)

```
Scope → Read tip → Edit (class-aware) → Stamp + ship (auth-gated PR) → Memory/FYI → One map improvement
```

| Step    | Do                                                                                                                                                                                                               |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Scope   | Project + tip path/branch; list files; no drive-by WIP                                                                                                                                                           |
| Read    | Entry doc + any closeout/board; hunt duplicates                                                                                                                                                                  |
| Edit    | Prefer short appends; fix relative links; scrub `file://`                                                                                                                                                        |
| Ship    | Local docs commit on a `docs/` branch when in scope. **Open/push a GitHub PR only with explicit user authorization** (or a standing ask for that docs PR); otherwise stop at a local handoff (branch + summary). |
| Log     | Agent memory (path, PR, ownership, TBDs); FYI sibling agents only if they own adjacent work                                                                                                                      |
| Improve | One Start-here / archive / link / port-env fix if cheap                                                                                                                                                          |

## Doc classes

| Class                     | Rule                                                    | Recheck when                                      |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------- |
| Entry (README, first-run) | Short, current, linked from root / docs README          | Tip SHA / boot command / entry path changes       |
| Runbook                   | Imperative; restamp when operator state changes         | Operator dashboard/CLI steps change               |
| Closeout / deferred       | Short; deferred list + status; no secrets               | Teammate reports phase done / deferred item moves |
| Plan / playbook           | Don’t duplicate live status — point at the board        | Plan superseded or board moves                    |
| Historical                | Under an archive/ folder (+ stub if old path is linked) | Never “update” — supersede with a new dated note  |
| Generated                 | Don’t hand-edit                                         | After regenerating indexes/inventories            |

## Freshness

- **Event-driven first:** apply the recheck column when the triggering event happens (handoff from Supabase/Railway, tip move, boot script rename, merge of a docs PR).
- **Weekday sweep (Documentation routine, 08:15 AWST Mon–Fri):** tip identity → entry docs → stamps vs known operator moves → dual ledgers → archive hygiene → link check → open docs PRs vs teammate updates.
- Fix cheap issues in-sweep; queue large rewrites.
- Stay quiet to Joshua unless something changed or a decision is needed.

## Project registry

Verified against `origin/main` on 2026-09-21 unless noted. Tip-only claims are labeled.

| Project                                  | Tip / repo                                                                                                                                                               | Entry docs (on `main` unless noted)                                                                                                                   | Doc check on `main`                                                                                                         | Notes                                                                                                                                                                                                                            |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PsychSift** (repo `BigSimmo/Database`) | GitHub default `main`; local tips on Josh PC worktrees as named                                                                                                          | Root `README.md`, curated `docs/README.md` (hand-maintained Start-here / index — **not** auto-written by `docs:update`), process: this file           | `npm run docs:check-links`, `docs:check-scripts`, `docs:check-inventory`, `docs:check-index`                                | Product name is **PsychSift**. Supabase project label is **Clinical KB Database**. Closeout board (when merged): [PR #2959](https://github.com/BigSimmo/Database/pull/2959).                                                     |
| **Ward Flow**                            | Same monorepo. Operator tip lock: checkout Joshua names (default on Josh PC: `ward-lead` worktree — confirm with `git log -1`; other machines must not assume that path) | On `main` today: `docs/ward-flow/README.md`, `docs/ward-flow/START-LOCAL-CHAT.md` (many dated ledgers also live under `docs/ward-flow/` — historical) | Same PsychSift docs checks for paths that exist on `main`. **No** dedicated Ward docs-check npm script on main package.json | Discover origin via `npm run ensure` (path-stable port helper in-repo — never hardcode ports) — never hardcode ports. Before citing tip-only entry names or scripts, confirm they exist on **that** tip’s tree / `package.json`. |

### Catalog honesty

- `docs/README.md` is a **curated** map. `npm run docs:update` / repo-awareness snapshot **reads** it to mark paths catalogued vs not; it does **not** regenerate the README.
- Hundreds of Ward Flow docs paths are currently uncatalogued in the snapshot — treat that as known debt, not “the index is complete.”
- New docs need a manual Start-here / README row (or an explicit backlog note) when they are load-bearing.

### Registry accuracy rules

- Script names and filenames in this table must match `package.json` and the tip tree — verify before editing this file.
- If an entry doc cites a tip SHA, that SHA must equal `git rev-parse HEAD` on the locked tip (or the sentence must say “as of &lt;date&gt;” and be updated on the next docs pass).
- Agent skills (**Documentation Operating System**, **Docs Freshness Audit**) mirror this file; when they disagree, **this file on the project tip/PR wins**, then skills are updated.

## Related

- Agent skills (Documentation bot): **Documentation Operating System**, **Docs Freshness Audit**.
- Active PsychSift / Clinical KB Database closeout PR: [#2959](https://github.com/BigSimmo/Database/pull/2959) (lands `docs/supabase-remediation-closeout-notes.md`).
