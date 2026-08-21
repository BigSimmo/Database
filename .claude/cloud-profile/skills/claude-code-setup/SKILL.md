---
name: claude-code-setup
description: Set up or configure Claude Code for a project or machine — scaffold CLAUDE.md, wire up settings.json (permissions, env, hooks), add MCP servers, configure the status line, and create personal or project skills. Use when the user wants to set up, configure, initialize, or onboard Claude Code, or asks how to add hooks, permissions, MCP servers, or skills.
---

# Claude Code Setup

Help the user set up or configure Claude Code. Work incrementally: confirm scope, inspect what already exists, make the smallest change, then explain it. Route to the specialized skills below whenever one fits — this skill is the entry point that ties them together.

## Scope first

Ask (or infer from the request) whether the change is:
- **Project-level** — `.claude/` in the repo, committed and shared with the team (`.claude/settings.json`, `.mcp.json`, `CLAUDE.md`, `.claude/skills/`).
- **User-level** — `~/.claude/`, applies to every project on this machine (`~/.claude/settings.json`, `~/.claude/skills/`).
- **Local/untracked** — `.claude/settings.local.json` for machine-specific project settings that must not be committed.

## What this can configure

- **Project memory (`CLAUDE.md`)** — run the built-in **`/init`** to scaffold codebase docs, or edit an existing `CLAUDE.md`. Keep it tight: build/test commands, conventions, and gotchas — not everything.
- **Settings (`settings.json`)** — permissions, env vars, model, hooks. Prefer the **`update-config`** skill; it knows the schema and file precedence.
- **Permissions** — add allow rules for common safe commands to cut prompt noise. The **`fewer-permission-prompts`** skill mines your transcripts for good allowlist candidates.
- **Hooks** — automated "whenever X, do Y" behaviors that run on events (PreToolUse, PostToolUse, Stop, etc.). They live in `settings.json` and are executed by the harness, not by Claude — so they're the right tool for durable automation. Configure via **`update-config`**.
- **MCP servers** — external tools/data sources. Add to `.mcp.json` (project) or user config; each server needs a command/URL and any auth.
- **Status line** — use the **`statusline-setup`** agent to configure `statusLine` in `~/.claude/settings.json`.
- **Skills** — personal skills live in `~/.claude/skills/<name>/SKILL.md`; project skills in `.claude/skills/<name>/SKILL.md`. Each is a folder with a `SKILL.md` whose frontmatter has `name` + `description`. Use the **`skill-creator`** skill to author, test, and optimize new ones.
- **Keybindings** — use the **`keybindings-help`** skill to edit `~/.claude/keybindings.json`.

## Approach

1. Inspect before writing: read any existing `settings.json`, `CLAUDE.md`, and `.mcp.json` so you extend rather than clobber.
2. Make the smallest change that meets the request.
3. Never write secrets, tokens, or credentials into committed files — use `settings.local.json` or environment variables and tell the user.
4. Show the resulting diff and explain what each setting does.

Interactive terminal panels (`/permissions`, `/config`, `/agents`, `/hooks`) may not be available in every client — when they aren't, edit the underlying files directly instead of telling the user to run those commands.
