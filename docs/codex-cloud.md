# Codex Cloud environment

> This Bash setup is for Linux-based Codex Cloud environments. Codex Desktop on
> Windows uses `npm run setup:codex-worktree`; pointing Desktop at this Cloud
> script starts WSL outside the Windows worktree and cannot provision it.

This repository supports reproducible Codex Cloud work with Node 24, npm 11, locked
development dependencies, Deno 2, Python/OCR tooling, and the Chromium, Firefox, and
WebKit Playwright browser matrix. The repository setup can prepare and validate the
container. It cannot grant GitHub installation permissions, workspace RBAC, agent-network
policy, or provider-account permissions; those are configured in Codex and each provider.

## Issues this setup resolves

- Codex Cloud had no tracked setup or maintenance command on `main`.
- Two incompatible Cloud checkers existed only in dirty worktrees.
- The prompt-perfector bootstrap parsed the Windows task-start output incorrectly and
  rejected Cloud's legitimate single primary checkout.
- Tool repair covered Node dependencies but not Deno, OCR, Python, or browsers.
- Provider-variable clearing was incomplete and the Cursor Cloud guidance was easy to
  mistake for Codex Cloud guidance.
- GitHub connector access, shell Git credentials, network access, and provider credentials
  were treated as one permission even though they are separate controls.
- The Codex Cloud CLI can emit a root `error.log` containing account/session metadata; the
  repository now ignores that exact diagnostic path.

## Create the environment

In Codex environment settings, create an environment for `BigSimmo/Database` using the
official [Cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environment)
contract:

| Setting               | Value                                  |
| --------------------- | -------------------------------------- |
| Repository            | `BigSimmo/Database`                    |
| Base image            | Default universal image                |
| Node version          | `24`                                   |
| Setup command         | `bash scripts/setup-codex-cloud.sh`    |
| Maintenance command   | `bash scripts/maintain-codex-cloud.sh` |
| Environment variables | Use the complete profile below         |

Enable agent internet access only when a task needs it. Prefer a domain allowlist and the
minimum HTTP methods for the task. Package installation happens during setup; ordinary
structure-only work, including the RAG decomposition prompt below, should remain offline.

The setup command fails if the complete toolchain cannot be installed. It pins Railway CLI
`5.30.1` and Codex CLI `0.146.0`, both stable npm releases as reviewed on 2026-07-30. Railway's
[official CLI guide](https://docs.railway.com/cli) supports global npm installation on Node 16+
(this repository uses Node 24). OpenAI's
[official Codex CLI guide](https://learn.chatgpt.com/docs/codex/cli) supports Linux installation;
the npm package is used here so maintenance can verify an exact version without running an
unversioned installer. Set
`CODEX_CLOUD_SKIP_BROWSER_INSTALL=1` only for an explicitly source-only environment; that
environment is not full browser-ready.

## Access profiles

### Offline (default)

Use this for refactors, static checks, mocked tests, and all work that expressly forbids
providers:

```text
CODEX_CLOUD=1
CODEX_CLOUD_ACCESS_PROFILE=offline
RAG_PROVIDER_MODE=offline
NEXT_PUBLIC_DEMO_MODE=true
PLAYWRIGHT_OFFLINE_MODE=true
```

The generated shell profile removes known OpenAI, Supabase, Railway, GitHub/GitLab,
database, CI-trigger, and test-user credential variables. This prevents an unrelated Cloud
task from silently becoming provider-backed.

Set all five offline values in the environment UI. The setup also writes the generated
profile to `.bashrc`, `.profile`, and `.bash_profile`. Covering `.bash_profile` is required:
Bash stops login-profile discovery at the first matching file, so an existing `.bash_profile`
can otherwise prevent `.profile` from running. Offline mode values are forced after inherited
platform values so stale `auto`/`false` settings cannot outrank the repository contract.

### Connected (explicit opt-in)

Use `CODEX_CLOUD_ACCESS_PROFILE=connected` only in a separate environment whose tasks are
expected to call named providers. Configure the smallest domain/method allowlist and the
least-privileged credentials for those tasks. Never commit credentials or print their
values. The setup script does not call providers and does not prove provider authorization.

Create or select a separate environment named `Database - connected` for `BigSimmo/Database`,
then set only these ordinary environment variables in
[Codex environment settings](https://chatgpt.com/codex/settings/environments):

```text
CODEX_CLOUD=1
CODEX_CLOUD_ACCESS_PROFILE=connected
RAG_PROVIDER_MODE=offline
NEXT_PUBLIC_DEMO_MODE=true
PLAYWRIGHT_OFFLINE_MODE=true
```

Keep OpenAI disabled unless a later task explicitly authorizes it. Do not add provider keys,
tokens, database URLs, service-role values, E2E credentials, or `ALLOW_PROVIDER_TESTS` to this
environment. The generated agent profile removes the complete provider-variable inventory in
both access profiles. Connected access means the scoped OAuth MCP servers and GitHub connector
are available; it does not mean raw credentials are exposed to the shell.

Codex Cloud secrets and ordinary environment variables have different exposure and lifecycle
properties. This repository has no mechanism that promotes setup-only OpenAI, Supabase, E2E,
or Railway secrets into the agent phase. Do not persist them in profiles, repository files,
`.env*`, caches, logs, or ordinary variables as a workaround. A `connected` profile models
explicit authorization and relaxes the offline-mode assertions, but it does not create
credentials. Authenticated Supabase/E2E tests use the protected manual workflow documented
below. Run other provider checks locally/operator-side or through a separately approved,
least-privilege provider mechanism.

## GitHub access

The GitHub connector is the supported repository/PR path. Follow the official
[Codex GitHub setup](https://help.openai.com/en/articles/11390924), authorize the
`BigSimmo/Database` repository, and ensure the installation grants the user write access if
Cloud tasks must publish PRs. Repository discovery proves read access only.

For an explicitly authorised GitHub task, treat the authenticated GitHub connector/MCP
tools as the default remote control plane. Use the connector for repository and PR reads,
issue and PR comments, inline-review-thread replies/resolution, Actions
run/job/log/artifact inspection and retries, and approved branch, file, or PR mutations.
Do not infer that GitHub is unavailable because `gh`, shell GitHub credentials, or
direct shell access are absent. The intended connection is `BigSimmo` with administrator
access to this repository. Use shell `git` or `gh` only for a genuine connector gap and
only when the task permits it.

GitHub connector permission is separate from credentials inside the agent shell. Do
not add a personal access token to Cloud secrets or environment variables to make
`git push` or `gh` work. If a Cloud task cannot publish a branch, reconnect the
repository in Codex settings and run a controlled branch/PR write test. Confirm the
exact repository and PR/thread/job before a write, and verify the connector result
before treating the write as successful. If the connector does not expose a required
repository/organisation setting, report the limit rather than attempting a credential or
secret workaround.

Setup restores a missing `origin` to the credential-free URL
`https://github.com/BigSimmo/Database.git`; it preserves an existing correct remote and fails
instead of overwriting a wrong or credential-bearing remote. When GitHub CLI authentication is
already available, setup asks `gh auth setup-git` to install its token-free helper command. It
never embeds a token or invents a PAT. `git ls-remote` and a dry-run push remain separate
acceptance checks; if the connector does not expose shell Git authentication, report that
platform capability gap.

Suggested GitHub acceptance task:

```text
Read AGENTS.md and docs/codex-cloud.md. Create a task-specific branch, add one harmless
documentation-only line, and offer a draft pull request through the Codex GitHub workflow.
Do not merge. Report whether repository clone, branch publication, and draft PR creation
each succeeded. Remove the draft branch/PR only after I approve cleanup.
```

## Setup and maintenance

Setup:

```bash
bash scripts/setup-codex-cloud.sh
```

Maintenance:

```bash
bash scripts/maintain-codex-cloud.sh
```

The maintenance command reasserts the safe `origin`, runs static/effective environment
acceptance, then runtime acceptance. Any runtime, dependency, CLI, Deno, Python/OCR, or browser
drift reruns the full setup instead of repairing only `node_modules`. All profile insertions,
CLI installs, and remote repair are idempotent.

## Acceptance

Run this in a fresh Cloud task before relying on the environment:

```text
Read all applicable AGENTS.md files and docs/codex-cloud.md. State whether this is the
offline or connected profile. Report tool versions without printing environment values.
Run npm run check:codex-cloud, npm run check:runtime,
npm run check:installed-lock-parity, and npm run check:codex-cloud -- --runtime. Do not
call a provider unless this task explicitly names and authorizes that provider. Report the
decisive line from every command and any unrun check.
```

Expected decisive lines include:

```text
[Codex Cloud Check] PASS: static and environment Cloud contracts match.
[Codex Cloud Check] PASS: static, environment, and runtime Cloud contracts match.
```

The effective-environment check runs automatically when `CODEX_CLOUD=1`, including without
`--runtime`, so a newly started agent shell cannot pass with stale modes. Its report prints only
approved mode values and presence booleans. The runtime check additionally verifies Node/npm
policy and installed-lock parity, pinned Railway/Codex CLIs, Deno 2, Python 3 and worker imports,
Tesseract, browser executables, local `main`/`origin/main`, the `BigSimmo/Database` origin
identity, offline credential absence when applicable, and obsolete npm proxy variable names
without reading or printing their values. MCP inspection emits server names, commands, and
environment variable names only.

`npm run check:production-readiness` remains useful in the offline profile for local safeguards.
Missing Supabase/OpenAI agent-phase credentials are reported as a provider capability gap and do
not make the provider-free cache unhealthy. `ALLOW_PROVIDER_TESTS=true` expresses authorization,
not credential availability; live tests still fail closed with a sanitized capability-gap message
in the offline profile.

## Provider acceptance

Provider access is verified separately because a generic bootstrap must not make paid or
production-like calls. For a connected environment, name each provider, use a read-only or
minimal no-op endpoint, confirm the intended account/project by non-secret metadata, and
report cost or mutation risk before any write. The checked-in MCP configuration uses Railway's
hosted `https://mcp.railway.com` endpoint so fresh Cloud tasks authenticate through browser OAuth
instead of depending on machine-local CLI state. Authorize only workspace `bigsimmo's Projects`
and project `Database` (`5deaad0b-675a-4c13-978e-5ca2b5b877f9`), restart the MCP client after
consent, and reduce identity/status results to non-secret account, project, workspace, environment,
and service metadata. Railway's remote MCP does not accept project tokens; retain the pinned CLI
only for explicitly approved local/operator workflows.

The Supabase MCP entry is scoped to production project `sjrfecxgysukkwxsowpy`, forces
`read_only=true`, and exposes only documentation, database, debugging, and development feature
groups. Complete its browser OAuth flow for the organization containing `Clinical KB Database`
and restart the client if tools do not appear. Schema writes, Edge Function deployment, branching,
and storage mutations require a separately configured non-production project or branch; do not
broaden the production entry. OpenAI generation, Supabase live data, Railway changes, hosted CI
reruns, ingestion, deployment, and release workflows remain separate explicit actions.

In a fresh connected Cloud session, run `npm run check:codex-cloud -- --environment` before any
provider call. The sanitized report must show `CODEX_CLOUD_ACCESS_PROFILE=connected`, every
provider environment variable as `present=false`, the credential-free `BigSimmo/Database` origin,
and only the hosted Railway and project-scoped read-only Supabase MCP metadata. This proves the
shell boundary and configured capabilities, not OAuth authorization. Then verify each explicitly
authorized provider with a read-only identity/status call and report only non-secret metadata.

## Authenticated live testing

Do not expose provider credentials to the Codex Cloud agent. Cloud secrets are removed
before the agent phase, and copying them into ordinary environment variables or files
would bypass that security boundary.

Use the manual **Authenticated live tests** GitHub Actions workflow instead. It runs the
repository's explicit `npm run test:live` suite from protected `main`, requires the
`run-authenticated-live-tests` dispatch confirmation, records the run against the
`Database / production` environment, checks the expected Supabase project, and receives
only the GitHub secrets required by the current authenticated Supabase test. It is not
triggered by pushes, pull requests, or schedules.

The suite is not read-only. Dispatching it explicitly authorizes the bounded mutations made
by the E2E user: production sign-in/sign-out, authenticated test requests, and rate-limit
row inserts or updates. It does not authorize unrelated production changes.

To run it after a Codex Cloud change:

1. Merge the reviewed change to `main` through the normal protected workflow.
2. Open **Actions → Authenticated live tests → Run workflow**.
3. Select `main` and choose `run-authenticated-live-tests` after reviewing the disclosed mutations.
4. Review the `Database / production` environment deployment and test log.

The current GitHub plan does not support required environment reviewers for this private
repository, so the workflow's manual dispatch and explicit confirmation are the approval
gate. Add required reviewers to the environment if the repository plan later supports
them.

Adding a future provider to `*.live.test.ts` does not automatically grant its credentials.
Expand the workflow's secret list deliberately and preserve the project/target guard.

## RAG X3 prompt

The corrected structure-only extraction prompt is tracked at
[`prompts/rag-coverage-gate-extraction.md`](prompts/rag-coverage-gate-extraction.md). It
uses the offline profile, keeps private coverage preparation/telemetry helpers in `rag.ts`,
and moves only the independently bounded evaluator. This avoids the import back-edge in the
older proposed three-function extraction.
