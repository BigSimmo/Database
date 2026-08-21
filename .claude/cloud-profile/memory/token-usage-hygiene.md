---
name: token-usage-hygiene
description: "Session habits that avoid burning tokens on unnecessary reads in the Database repo — no .claudeignore exists, so this is the real mechanism"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3547fb94-e641-4bd8-bc60-cd44f14c7094
  modified: 2026-08-19T08:02:34.883Z
---

Do not read entire large directories or dependency trees when only one fact is needed. In the Database repo
this matters most for `node_modules/next/dist/docs/` (AGENTS.md requires checking it for Next.js 16 breaking
changes before writing framework code) — grep for the specific topic/API first, then read only the matched
file, never the whole docs folder.

For any search that needs more than 2-3 targeted Grep/Glob calls, delegate to the Explore agent instead of
reading many files inline in the main conversation. Keeping the main session's own context small is what
actually controls token cost turn over turn, since everything already in the conversation gets reprocessed on
every new turn — a subagent's exploration doesn't carry that cost back.

Do not speculatively load MCP tool schemas via ToolSearch "just in case" — only load the tools a task actually
needs, and batch a known set into one call rather than loading them one at a time.

**Why:** Josh (the user, a psychiatrist and non-technical) asked directly on 2026-08-19 to reduce wasted token
usage without slowing down development, and specifically asked about a "claudeignore" mechanism. Checked with
the claude-code-guide agent first rather than guessing: Claude Code has no `.claudeignore` file or per-file-read
exclusion list, so that request can't be fulfilled as literally asked — this note is the real substitute.
`.claude/settings.json`'s permission allowlist was already recently expanded (commit 89ae14fad) and is in good
shape, so there was nothing to add there. [[dev-drive-project-location]] separately notes `node_modules` is most
of the repo's disk footprint — the same directory is the main _token_ risk for reads, not just disk space.

**How to apply:** Follow this automatically in every Database repo session; it needs no action or approval from
Josh each time. Do not shrink or restructure `AGENTS.md`/`CLAUDE.md` to save tokens even though they are large —
that size is deliberate (shared safety/process rules read by five different AI tooling systems, per the file's
own "AI tooling map"), and trimming it is a project decision for the team, not something to do unilaterally for
token savings.
