# Codex Cloud environment

This is the copy/paste setup for provider-free work on `BigSimmo/Database` in an
OpenAI-managed Codex Cloud container. It mirrors the repository's Node, npm, Deno,
Python/OCR, and Playwright toolchain without copying local credentials or connecting to
live OpenAI, Supabase, Railway, or GitHub APIs from the agent shell.

## Create the environment

Open [Codex environment settings](https://chatgpt.com/codex/settings/environments),
create an environment for `BigSimmo/Database`, and use these values:

| Setting               | Value                                  |
| --------------------- | -------------------------------------- |
| Environment name      | `BigSimmo/Database`                    |
| Repository            | `BigSimmo/Database`                    |
| Base image            | Default `universal` image              |
| Node version          | `24`                                   |
| Setup script          | `bash scripts/setup-codex-cloud.sh`    |
| Maintenance script    | `bash scripts/maintain-codex-cloud.sh` |
| Agent internet access | Off                                    |
| Environment variables | Use the provider-free values below     |
| Secrets               | None                                   |

Add these non-secret environment variables so every agent shell starts with the same
provider-free defaults even when shell startup files are not sourced:

```text
CODEX_CLOUD=1
RAG_PROVIDER_MODE=offline
NEXT_PUBLIC_DEMO_MODE=true
PLAYWRIGHT_OFFLINE_MODE=true
```

The setup script installs the exact npm version pinned by `packageManager`, restores
`package-lock.json` with development dependencies, installs Deno 2.x, prepares the
Python OCR environment, and installs the Chromium, Firefox, and WebKit Playwright
browsers. Codex caches this container; the maintenance script repairs runtime or
lockfile drift when a cached environment resumes on a newer commit.

Set `CODEX_CLOUD_SKIP_BROWSER_INSTALL=1` only if a source-only environment is required.
Leaving it unset produces the closest reproducible match to the local verification
toolchain.

## Security boundary

Codex Cloud secrets exist only during setup and are removed before the agent phase.
Ordinary environment variables remain visible to the agent. Do not work around that
boundary by adding OpenAI, Supabase, Railway, GitHub, database, or user credentials as
ordinary environment variables or by writing them into repository files.

The generated agent-shell profile explicitly selects:

```text
RAG_PROVIDER_MODE=offline
NEXT_PUBLIC_DEMO_MODE=true
PLAYWRIGHT_OFFLINE_MODE=true
```

It also unsets known provider credentials. Provider-backed checks, deployments,
production data operations, hosted CI mutations, and live API tests remain local or
operator-controlled workflows requiring explicit authorization.

## What matches local

The environment mirrors the repository development toolchain: Node, npm, locked
dependencies, Deno, Python/OCR, and the Playwright browser matrix. It also checks out
tracked repository instructions, scripts, tests, and skills.

It does not inherit Windows files, `.env.local`, desktop browser sessions, user-global
Codex configuration, desktop plugins, OAuth sessions, local services, or uncommitted
work. Put durable project behavior in tracked `AGENTS.md` files, repository scripts,
tests, and repo-local skills rather than relying on machine-global configuration.

## GitHub integration

Selecting `BigSimmo/Database` proves that the Codex GitHub connection can discover and
clone the repository. Codex can also show task diffs and offer pull-request workflows
through its GitHub integration when that installation has write permission.

GitHub connector permission is separate from credentials inside the agent shell. Do
not add a personal access token to Cloud secrets or environment variables to make
`git push` or `gh` work. If a Cloud task cannot publish a branch, reconnect the
repository in Codex settings and run a controlled branch/PR write test.

## First Cloud task

Start a Cloud task against the default branch with:

```text
Read AGENTS.md and docs/codex-cloud.md. Confirm the repository identity and report
node --version, npm --version, deno --version, python --version, tesseract --version,
and npx playwright --version. Run npm run check:codex-cloud, npm run check:runtime,
and npm run check:installed-lock-parity. Do not call APIs, providers, hosted CI, or
production-like services. Do not commit or push.
```

Expected runtime majors are Node 24, npm 11, and Deno 2. The final three checks must
exit successfully. The Cloud check validates the Python/OCR tools, offline environment
defaults, and all three browser executables when run inside Cloud, unless the explicit
source-only browser opt-out is set. Treat a missing required tool as an environment setup
failure and reset the environment cache after fixing the setup script.

## Verification after code changes

Use the same repository gates as local work:

1. Run the smallest focused test for the changed files.
2. Run `npm run verify:cheap` for non-trivial source, configuration, or test changes.
3. Use `npm run verify:pr-local -- --dry-run --files <comma-separated-paths>` to inspect
   the handoff plan before running broader local gates.
4. Use `npm run verify:release:offline` only when full offline release confidence is
   required. It includes the browser matrix and production build and may be expensive.

Never describe Chromium as physical iPhone Safari/PWA evidence. Physical-device,
desktop-app, local-secret, and provider-backed acceptance remains outside Codex Cloud.

## Troubleshooting

- Wrong Node version: select Node 24 under **Set package versions**, then reset the
  environment cache.
- Wrong npm version: rerun setup; it installs the exact `packageManager` version.
- Stale dependencies: rerun the maintenance script or reset the environment cache.
- Browser missing: confirm `CODEX_CLOUD_SKIP_BROWSER_INSTALL` is absent and reset the
  cache.
- Git push cannot authenticate: reconnect the repository in Codex settings. Do not add
  a personal access token to Cloud environment variables or secrets.
