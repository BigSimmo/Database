# Claude Code cloud/local connector parity — 2026-08-17

Point-in-time record of a user-requested check: bring a Claude Code cloud (web,
`CLAUDE_CODE_REMOTE=true`) session as close to this desktop session's capability as
possible — MCP connectors, dependency currency, GitHub write access. Supersede with a new
dated document rather than editing this one.

## What was verified live (not just configuration)

Each connector was proven with a real read-only identity call from this desktop session,
not inferred from settings:

| Connector | Call                      | Result                                                                                                         |
| --------- | ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Railway   | `whoami`                  | `bigsimmo`, `joshsimpson@outlook.com.au`                                                                       |
| Figma     | `whoami`                  | Josh Simpson, `josh@stoicable.com`, pro team seat                                                              |
| Sentry    | `find_organizations`      | org `clinibase-xz`                                                                                             |
| Supabase  | `list_projects`           | `Clinical KB Database` (`sjrfecxgysukkwxsowpy`, matches the pinned ref in AGENTS.md) and `Clinical KB Staging` |
| GitHub    | `get_me` (via MCP_DOCKER) | `BigSimmo`                                                                                                     |

All five resolved to the expected account/identity. Context7 (`d05e084d…` docs-fetch tool)
was already callable without an auth gate.

## Dependency currency — already automatic, no action taken

`.claude/hooks/session-start.sh` is a repo-committed `SessionStart` hook gated on
`CLAUDE_CODE_REMOTE=true`. On every Claude Code cloud session it installs a Node
matching `engines.node` (`>=24.15.0 <25`) into `$HOME/.node24` if the container's Node
is out of range, then runs `npm ci --no-audit --no-fund` when `node_modules` is missing
or a `sha256` stamp of `package-lock.json` no longer matches. This means cloud
dependency parity is enforced every session by the repository itself — nothing in this
task needed to change it.

## Open items — not resolved by this record

- **Supabase connector scope is broader than AGENTS.md's recommended production
  posture.** The live tool list includes `execute_sql`, `apply_migration`,
  `create_branch`, `deploy_edge_function` — not the read-only/docs-and-development-only
  allowlist the Codex Cloud `.codex/config.toml` entry enforces. This session did not
  restrict it; restricting Supabase connector scope happens outside this repository, at
  the connector/OAuth-app level, and was left to the user. Any mutating Supabase call
  through this connector still requires explicit per-action confirmation regardless of
  connector capability — see "API and provider confirmation boundary" in AGENTS.md.
- **GitHub via `MCP_DOCKER` is unconfirmed for actual cloud sessions.** The tool name
  suggests a Docker MCP Toolkit gateway, which is plausibly bound to this desktop
  machine's Docker Desktop rather than the Claude account. It was verified live only
  from this desktop worktree session (`CLAUDE_CODE_REMOTE` unset) — never from a real
  cloud/web session. First actual cloud chat should re-run `get_me` (or equivalent) and
  confirm it still resolves to `BigSimmo`; if it does not, cloud GitHub write/comment
  access needs its own connector path, separate from this desktop's Docker-based one.
- No cloud session was actually opened during this task — verification of the
  `CLAUDE_CODE_REMOTE=true` code path itself (not just the four account-level
  connectors) remains outstanding until the user runs one.

## What this record does not cover

Local-machine-bound tools with no cloud equivalent were out of scope by design, not
omitted by oversight: Windows-MCP (desktop control), `claude-in-chrome`/Control_Chrome
(paired to this machine's Chrome), `computer-use` (desktop mouse/keyboard),
Desktop-commander (local filesystem/terminal), `scheduled-tasks` (Windows Task
Scheduler), and `mcp__terminal` (local terminal reader). These cannot run in an isolated
cloud container regardless of account authorization; the cloud environment's own Browser
pane tool (`mcp__Claude_Browser__*`) is the equivalent already available there.
