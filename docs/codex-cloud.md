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

| Setting               | Value                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------- |
| Repository            | `BigSimmo/Database`                                                                         |
| Base image            | Default universal image                                                                     |
| Node version          | `24`                                                                                        |
| Setup command         | `bash scripts/setup-codex-cloud.sh && bash scripts/install-codex-cloud-command-shims.sh`    |
| Maintenance command   | `bash scripts/maintain-codex-cloud.sh && bash scripts/install-codex-cloud-command-shims.sh` |
| Environment variables | Use the complete profile below                                                              |

Keep agent internet access off for this repository's ordinary Cloud environments. Package
installation happens during setup; ordinary structure-only work, including the RAG
decomposition prompt below, remains offline. The appended command-shim installer is required:
it makes every normal `node`, `npm`, and `npx` invocation load the generated sanitized
profile before starting Node. It is idempotent and uses `nvm which` rather than
`command -v node`, so maintenance cannot accidentally wrap an earlier wrapper.

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
database, CI-trigger, test-user, and emergency-PAT variables. This prevents an unrelated
Cloud task from silently becoming provider-backed.

Set all five offline values in the environment UI. The setup also writes the generated
profile to `.bashrc`, `.profile`, and `.bash_profile`. Covering `.bash_profile` is required:
Bash stops login-profile discovery at the first matching file, so an existing `.bash_profile`
can otherwise prevent `.profile` from running. Offline mode values are forced after inherited
platform values so stale `auto`/`false` settings cannot outrank the repository contract.
Do not manually source the profile as an acceptance workaround: start a fresh task and invoke
the direct `npm run check:codex-cloud` commands below. The tracked command shims make those
ordinary Node commands load the profile themselves.

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
both access profiles. Connected access configures the repository profile for scoped OAuth MCP
servers and GitHub integration, but it does not expose raw credentials to the shell or guarantee
that every GitHub capability appears as a direct agent tool. For ordinary Cloud task publishing,
use the native Cloud diff/PR controls and verify the resulting GitHub branch and PR link. A
metadata-only `make_pr` response is not publication evidence. If a requested GitHub API is not
available, report that limitation rather than using shell credentials as a workaround.

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

For an explicitly authorised GitHub task, use Cloud's authenticated GitHub integration
as the remote control plane. For ordinary Cloud work, publish through the native task
diff/PR controls and verify the returned GitHub branch and pull-request link. Do not infer
that GitHub is unavailable merely because `gh`, shell Git credentials, or a particular
direct agent tool are absent. The intended GitHub identity is `BigSimmo`. Use repository
write access for branch and pull-request publication; reserve administrator access for separately
approved operations. Some GitHub APIs, including review-thread or Actions management,
may not be exposed in every Cloud task; use an approved GitHub-connected workflow for those
operations or report the unavailable capability. Do not use shell credentials as a workaround.

GitHub connector permission is separate from credentials inside the agent shell. The connector
remains the default for repository, PR, review, and Actions work. For an explicitly authorised
connector gap, a fine-grained GitHub PAT may be stored only as the connected environment secret
`CODEX_CLOUD_GITHUB_PAT`. Scope it to the `BigSimmo/Database` repository, give it only the
least privilege needed for the named operation (for stale-branch deletion, **Contents: write**),
and set a short expiry. Never add it as an ordinary environment variable, print it, put it in a
remote URL, cache, profile, or repository file, or use it for provider access. The default and
ordinary connected profiles both scrub the name before Node work begins.

The only tracked PAT helper is
`bash scripts/delete-codex-cloud-branch-with-pat.sh <non-protected-branch>`. It refuses offline
mode, protected/invalid refs, and any origin other than the credential-free
`https://github.com/BigSimmo/Database.git`; it uses a temporary askpass program and deletes
only the specified branch and disables Git hooks for its PAT-bearing push. Use it only for the exact
user-authorised cleanup, then remove or
rotate the secret. If Cloud does not expose secrets to the requested task phase, the PAT is not a
usable workaround—report that platform limit rather than copying the token anywhere.

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
documentation-only line, commit it, and record its branch name and full 40-character HEAD SHA.
Use the Codex GitHub workflow to publish that exact existing branch and create a draft pull
request. Do not recreate, rename, amend, rebase, or rebuild the branch or commit. Do not merge.
Report whether repository clone, branch publication, and draft PR creation each succeeded, then
report the expected and published branch names and full HEAD SHAs and whether they match exactly.
If branch publication or draft PR creation succeeds, include its link. For each failed write,
report the failure and state that no link is available. Remove the draft branch/PR only after I
approve cleanup.
```

## Setup and maintenance

Configure the following complete commands in the environment UI:

```bash
bash scripts/setup-codex-cloud.sh && bash scripts/install-codex-cloud-command-shims.sh
```

```bash
bash scripts/maintain-codex-cloud.sh && bash scripts/install-codex-cloud-command-shims.sh
```

The maintenance command reasserts the safe `origin`, runs static/effective environment
acceptance, then runtime acceptance. The shim installer runs after either lifecycle command and
repairs the normal Node command boundary. Any runtime, dependency, CLI, Deno, Python/OCR, or
browser drift reruns the full setup instead of repairing only `node_modules`. All profile
insertions, command shims, CLI installs, and remote repair are idempotent.

### Automatic setup diagnostics

Cloud setup tracks its current phase. If a command fails, the error trap runs
`npm run diagnose:codex-cloud` automatically and prints sanitized `ISSUE` and `FIX` lines after
the original error. The diagnostic checks the Node/npm contract, the active Cloud Python runtime,
the runtime-specific Python lock header, and the failed setup phase without printing environment
values or calling a provider. Run it manually in an agent shell when setup completed but the
runtime later appears stale:

```bash
npm run diagnose:codex-cloud
```

The production worker image and Codex Cloud deliberately use separate hashed Python locks because
medspaCy 1.3.1 requires spaCy `<3.8` on Python 3.11 but `>=3.8` on Python 3.12. Production uses
`worker/python/requirements.txt` (Python 3.11); Cloud uses
`worker/python/requirements-cloud.txt` (Python 3.12). After changing
`worker/python/requirements.in`, regenerate and verify both locks with their matching interpreters.

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

A repository cannot remove a variable already inherited by the top-level task process. The
command shims protect normal Node work, which is what the acceptance commands exercise. If a
fresh task still exposes a provider variable to a direct raw `/bin/bash`, Python, or another
native child before the generated profile is loaded, treat that as a Codex Cloud launcher defect
and report the variable name only; do not weaken the profile or reintroduce provider variables.

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

Project `.codex/config.toml` is a second, project-scoped MCP template that trusted Codex
hosts load in addition to `$CODEX_HOME/config.toml` (where `setup-codex-cloud.sh` writes the
shell-environment policy). It is not inert documentation: Codex applies project-local
`.codex/config.toml` when the project is trusted. The tracked template lists Figma
(`https://mcp.figma.com/mcp`), Railway, read-only Supabase, and Sentry
(`https://mcp.sentry.dev/mcp`) as URL-only registrations with `enabled = false`. Ordinary/offline
sessions therefore do not initialize those providers. Production read-only Supabase uses
`default_tools_approval_mode = "auto"`; write-capable Figma, Railway, and Sentry use `"writes"`
so reads avoid per-tool prompts while writes still require explicit confirmation per AGENTS.md.
Paid API canaries also require explicit confirmation. Figma and Sentry OAuth credentials stay in
the host credential store — never in the tracked file. Runtime Cloud MCP allowlist remains
`.mcp.json` (Railway + read-only Supabase only). `npm run check:codex-cloud` validates both files.

In a fresh connected Cloud session, run `npm run check:codex-cloud -- --environment` before any
provider call. The sanitized report must show `CODEX_CLOUD_ACCESS_PROFILE=connected`, every
provider environment variable as `present=false`, the credential-free `BigSimmo/Database` origin,
and only the hosted Railway and project-scoped read-only Supabase MCP metadata. This proves the
shell boundary and configured capabilities, not OAuth authorization. Then verify each explicitly
authorized provider with a read-only identity/status call and report only non-secret metadata.

### Connected-environment remediation checklist

Use this checklist when a Cloud task reports a connected profile but cannot call providers, publish
its branch, or make the local health endpoint ready. Repository setup can prepare the boundary, but
the host must grant OAuth and repository access in a fresh task; do not try to repair those gaps by
copying credentials into the checkout.

1. **Create the durable host environment.** In Codex environment settings, create or select
   `Database - connected` for `BigSimmo/Database`. Set exactly the five non-secret values from the
   connected profile above. Configure setup as
   `bash scripts/setup-codex-cloud.sh && bash scripts/install-codex-cloud-command-shims.sh` and
   maintenance as
   `bash scripts/maintain-codex-cloud.sh && bash scripts/install-codex-cloud-command-shims.sh`.
   Do not add provider keys, database URLs, service-role credentials, test-user credentials, or
   `ALLOW_PROVIDER_TESTS`.
2. **Grant the host integrations.** Authorize the Codex GitHub connector for
   `BigSimmo/Database` with repository write access. Complete Railway OAuth only for workspace
   `bigsimmo's Projects` and project `Database` (`5deaad0b-675a-4c13-978e-5ca2b5b877f9`). Complete
   Supabase OAuth only for the organization containing `Clinical KB Database`; retain project ref
   `sjrfecxgysukkwxsowpy`, `read_only=true`, and the existing feature allowlist. Do not broaden the
   production Supabase MCP to write access. Enable Figma or Sentry only for a task that names that
   provider; their write-capable tools remain approval-gated.
3. **Start a fresh task.** OAuth tools and environment values are fixed when the task starts. A
   setup rerun inside an already-running offline task can validate a generated connected profile,
   but it cannot inject host MCP tools or retroactively grant OAuth. Restart the MCP client or open
   a new task after consent.
4. **Prove the shell boundary before providers.** Run `npm run check:codex-cloud`,
   `npm run check:codex-cloud -- --runtime`, `npm run check:runtime`, and
   `npm run check:installed-lock-parity`. Require the two Cloud PASS lines, correct runtime and
   lock parity, `CODEX_CLOUD_ACCESS_PROFILE=connected`, no provider variable reported present, a
   credential-free matching origin, and the expected MCP metadata. A connected label alone is not
   provider proof.
5. **Prove each provider read-only.** Use the tools exposed by the fresh host session, not shell
   tokens. For GitHub, read repository metadata and confirm `BigSimmo/Database` plus the intended
   identity. For Railway, read workspace/project/service metadata and confirm the IDs above without
   triggering a deployment. For Supabase, read project/schema metadata and confirm the pinned ref
   without querying clinical row contents. Report only non-secret identity and status metadata.
   OpenAI has no generic connected-profile credential: leave `RAG_PROVIDER_MODE=offline` until a
   separately approved paid canary or protected workflow supplies its own credential boundary.
6. **Publish a task branch safely.** Work on a task-specific non-protected branch. Commit and format
   the intended repository change, publish that exact existing commit through the native GitHub
   connector/Cloud PR workflow, and verify the remote branch and PR link. If shell Git
   authentication is intentionally available, `git push --set-upstream origin <task-branch>` is
   acceptable after confirming the credential-free origin; otherwise a failed `git ls-remote` is
   not repaired with an embedded PAT. Do not publish a generic detached `work` branch merely to
   remove an informational "no upstream" warning.
7. **Separate local app proof from live readiness.** Run `npm run ensure`, use the printed URL, and
   confirm `/api/local-project-id` before checking `/api/health`. In demo mode, an HTTP 503 with
   missing Supabase configuration and skipped OpenAI is expected and must not be relabelled healthy.
   Stop only the verified repository-owned server after the check. Production-connected health and
   authenticated tests run through the protected operator/provider workflow below, not by placing
   credentials in the Cloud agent shell.
8. **Treat swap as capacity control, not access setup.** Do not create persistent or ad-hoc swap by
   default. First run the intended full unit suite and production build while observing available
   memory. If they complete without memory pressure, record "swap not required." If a reproducible
   out-of-memory failure remains after using the repository's coordinated single-heavy-command
   workflow, resize the disposable environment or configure swap in the host image; do not commit a
   swapfile, add it under the repository, or rely on an ephemeral in-task swapfile as a durable fix.

Acceptance is complete only when evidence distinguishes these independent capabilities:

| Capability              | Required evidence                                                                    | Not sufficient                                                     |
| ----------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Connected boundary      | Cloud environment and runtime PASS lines with provider variables absent              | Editing the generated profile in one running task                  |
| GitHub read/write       | Connector repository read plus verified publication of the exact task commit         | Repository discovery, `make_pr` metadata, or a local commit        |
| Railway read            | OAuth-backed metadata for the expected workspace and project                         | Installed Railway CLI alone                                        |
| Supabase read           | OAuth-backed metadata for the pinned read-only project                               | A configured MCP URL without completed OAuth                       |
| OpenAI/live application | Explicitly approved paid canary or protected authenticated workflow                  | Setting `RAG_PROVIDER_MODE=auto` without credentials               |
| Local application       | Project identity plus the reported health status from the `ensure` URL               | Assuming a localhost port or treating demo 503 as production-ready |
| Capacity                | Full intended checks complete without OOM, or a host-level capacity change is proven | Swap size by itself                                                |

If a capability still fails, record the exact sanitized failure and its owner: repository setup,
Codex environment/OAuth, provider RBAC, GitHub installation, protected workflow, or host capacity.
Do not collapse those distinct boundaries into a generic "Cloud access" result.

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
