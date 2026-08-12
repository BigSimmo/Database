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

Keep agent internet access off for the offline environment. In `Database - connected`, allow only
`github.com` and `api.github.com` so authenticated GitHub CLI and Git transport can reach the
repository without opening unrelated provider access. Package installation happens during setup.
The appended command-shim installer is required:
it makes every normal `node`, `npm`, and `npx` invocation load the generated sanitized
profile before starting Node. It is idempotent and builds the executable path from `nvm version`
instead of resolving through `PATH`, so maintenance cannot accidentally wrap an earlier wrapper.

The setup command fails if the required Cloud toolchain cannot be installed. It intentionally does
not install Railway CLI: hosted Railway access comes from the authenticated workspace app, and the
CLI postinstall downloads a separate binary that may be blocked in the Cloud setup network. It pins
Codex CLI `0.146.0`, reviewed on 2026-07-30. OpenAI's
[official Codex CLI guide](https://learn.chatgpt.com/docs/codex/cli) supports Linux installation;
the npm package is used here so maintenance can verify an exact version without running an
unversioned installer. Set
`CODEX_CLOUD_SKIP_BROWSER_INSTALL=1` only for an explicitly source-only environment; that
environment is not full browser-ready.

### Cloud compared with local development

The Cloud bootstrap intentionally brings the repository-owned development surface close to local
development, but it cannot reproduce capabilities owned by the host, an operator, or physical
hardware. Use this matrix when deciding whether a failed task needs a repository fix or a different
execution environment.

| Capability                             | Codex Cloud                                                                                                                | Local/Desktop difference                                                                                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node and npm                           | Exact Node 24 range and npm 11 version; locked dev install                                                                 | Desktop can reuse a byte-identical `node_modules` tree from another worktree, while a fresh Cloud image must populate its own cache                                                         |
| Dependency install                     | `npm ci --include=dev --prefer-offline --no-audit --no-fund`; integrity is checked after install                           | Local reuse is faster when another complete worktree exists; Cloud cache availability depends on the disposable host image                                                                  |
| Git hooks and repository checks        | Installed by npm postinstall; the same format, lint, type, unit, build, and repository gates are available                 | Desktop shell Git credentials may support direct push; connected Cloud uses the native connector when available or the authenticated `gh` fallback                                          |
| Browser testing                        | Matching Chromium, Firefox, and WebKit are installed and launch-tested unless the environment is explicitly source-only    | Cloud can run Playwright, but it cannot replace physical Safari, installed-PWA, camera, touch, GPU, or device-specific acceptance                                                           |
| Worker/OCR tooling                     | Python 3.12 hashed lock, PyMuPDF, Pillow, pytesseract, medspaCy, spaCy, and Tesseract are installed and checked            | Production workers use their separate Python 3.11 lock; local operators may have additional native inspection tools                                                                         |
| Deno and Codex CLI                     | Deno 2 and the reviewed Codex CLI version are installed and checked                                                        | Local CLI configuration can enable operator-owned MCP servers; tracked Cloud setup deliberately does not copy or enable them                                                                |
| Application runtime                    | Demo/offline app and browser journeys can run through `npm run ensure`                                                     | Authenticated or production-like behavior needs approved provider access; Cloud demo health is not production readiness                                                                     |
| Provider access                        | Offline by default; connected capability comes from separately installed host OAuth apps and explicit approvals            | A trusted local operator can use separately managed provider CLIs or credentials, subject to the same approval and safety rules                                                             |
| GitHub operations                      | Native connector first; the connected environment provisions authenticated `gh` when required APIs are not injected        | The fallback covers PR/review-thread/checks/Actions APIs and ordinary non-force feature-branch Git transport; repository policy still prohibits protected-branch and PR lifecycle mutations |
| Containers and privileged host changes | Repository checks do not assume a durable Docker daemon, nested virtualization, swap, or persistent system state           | A local workstation or CI runner can provide Docker, larger disks, persistent caches, device access, and operator-managed capacity                                                          |
| Persistence                            | Repository commits survive when published; home-directory caches and installed tools may be discarded with the environment | Local worktrees, caches, browser state, OAuth sessions, and tool configuration can persist between sessions                                                                                 |

The remaining parity gaps cannot safely be fixed by placing more credentials or mutable provider
state in the Cloud shell. The practical improvement path is:

1. Keep repository-owned runtimes, locks, browsers, diagnostics, and checks reproducible here.
2. Prefer native GitHub publication. When the fresh-task tool inventory lacks required APIs, use
   the connected environment's authenticated `gh` fallback and verify every remote mutation.
3. Add provider capabilities only through a separate connected environment with least-privileged
   OAuth and explicit task authorization.
4. Keep authenticated Supabase/OpenAI tests and write-capable Railway operations in protected
   workflows rather than weakening the ordinary Cloud boundary.
5. Use local hardware or a dedicated runner for physical Safari/PWA, device, Docker, privileged,
   or persistent-state acceptance.

### Playwright browser readiness (#255)

Browser gates need the **locked** Playwright package and a Chromium revision that matches
`node_modules/playwright-core/browsers.json`. When a remote/Cloud image forces
`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` and that
tree only ships an older revision (for example 1194 while the lock expects 1234):

1. Run `npm run check:installed-lock-parity` and `npm run check:playwright-browser-revision`.
2. Do **not** point `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` at the mismatched shell.
3. Delegate browser proof to CI Production UI, or refresh the environment image / install matching
   browsers into a managed cache, or unset the container browser env vars so
   `npx playwright install` can populate the managed path.

`CODEX_CLOUD_SKIP_BROWSER_INSTALL=1` remains source-only: that environment is not browser-ready.

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
environment as ordinary variables. The sole GitHub fallback exception is the encrypted,
setup-only Secret `CODEX_CLOUD_GITHUB_PAT`, described below. The generated agent profile removes
the complete provider-variable inventory in
both access profiles. Connected access records authorization intent and keeps the GitHub boundary
explicit, but it does not register hosted MCP apps, expose raw credentials to the shell, or guarantee
that every GitHub capability appears as a direct agent tool. Prefer native Cloud tools when they are
actually present. Otherwise use the verified GitHub CLI fallback and verify the resulting remote
state. A metadata-only `make_pr` response is not publication evidence.

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
approved operations. Some GitHub APIs, including review-thread or Actions management, may not be
exposed in every Cloud task. When the fresh-task inventory proves that gap, the connected
environment uses the supported GitHub CLI fallback below rather than treating an unverified
connector as authenticated.

GitHub connector permission is separate from credentials inside the agent shell. Configure the
native connector first. If a fresh task receives no connector tools for review threads, failed-job
logs, Actions reruns, or branch publication, add `CODEX_CLOUD_GITHUB_PAT` as an encrypted **Secret**
in `Database - connected`, never as an ordinary environment variable. Prefer a fine-grained token
owned by `BigSimmo`, restricted to `BigSimmo/Database`, with only Metadata read, Contents read/write,
Pull requests read/write, Issues read/write, Actions read/write, and Checks read. Do not grant
Administration, Deployments, Environments, Secrets, Webhooks, organization administration, or
unrelated repositories.

[GitHub CLI documents](https://cli.github.com/manual/gh_auth_login) that fine-grained tokens passed
through `--with-token` can behave confusingly outside their selected resources. That is why setup
validates this exact repository and the fresh task must exercise the complete read surface before
any mutation; `gh auth status` alone is not acceptance evidence.

Codex exposes Secrets only during setup. `configure-codex-cloud-github-shell.sh` sends the secret to
`gh auth login` over standard input, immediately unsets all token variables, and requires GitHub CLI
to use an OS-backed secure credential store. If `gh` falls back to an `oauth_token` entry in its
plaintext `hosts.yml`, setup logs out, removes that file, and fails closed. A successful setup then
verifies identity `BigSimmo` and repository push permission and configures the token-free Git
credential helper. The generated runtime profile and Codex shell policy continue to exclude the
original secret and token variables. No credential is written to the checkout, remote URL, task
prompt, logs, or a plaintext home-directory file. Changing a Secret invalidates the setup cache;
start a new task and run the acceptance checks below.

GitHub's repository permission model does not provide separate token switches for every prohibited
workflow action. The `Run PR` policy therefore remains authoritative: never merge or close a PR,
push to `main`, `master`, `develop`, or `release/*`, delete or rename a branch, force-push, rewrite
history, or run deployment/provider operations. Branch protections remain the remote backstop.

`bash scripts/delete-codex-cloud-branch-with-pat.sh <non-protected-branch>` is retained only for
an explicitly authorised operator running outside Codex Cloud. It rejects `CODEX_CLOUD=1`,
protected/invalid refs, and any origin other than the credential-free
`https://github.com/BigSimmo/Database.git`. Never copy a PAT into a Cloud task, profile, checkout,
remote URL, cache, or log.

Setup restores a missing `origin` to the credential-free URL
`https://github.com/BigSimmo/Database.git`; it preserves an existing correct remote and fails
instead of overwriting a wrong or credential-bearing remote. Setup installs `gh` only when the
connected fallback needs it and asks `gh auth setup-git` to install its token-free helper command.
It also fetches `origin/main`, stores the current task's merge base outside the checkout, and exports
that exact 40-character SHA as `CODEX_CLOUD_EXPECTED_BASE_SHA` in subsequent agent shells. `git
ls-remote` and a non-mutating dry-run push remain separate acceptance checks.

Suggested GitHub acceptance task:

```text
Read AGENTS.md, docs/codex-cloud.md, docs/codex-review-protocol.md, and the Run PR skill. Confirm
the GitHub identity and BigSimmo/Database permission, list open PRs, and inspect one PR's exact
head SHA, labels, draft/mergeability state, checks, reviews, comments, unresolved-thread count,
workflow jobs, and bounded failed-job logs when applicable. Confirm reply/resolve and failed-job
rerun API availability without synthetic mutations. Run git ls-remote and an ordinary push
--dry-run against the current authorized non-protected branch; do not create an artificial commit.
Run npm run check:github-shell-access:live and verify every remote mutation that is genuinely
needed. Never merge/close a PR, push a protected branch, delete/rename a branch, rebase, rewrite
history, force-push, deploy, or call OpenAI/Supabase.
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

The command is Cloud-only: outside a `CODEX_CLOUD=1` shell it reports `NOT_APPLICABLE` rather than
mistaking a desktop Python installation for Cloud runtime drift.

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
npm run check:installed-lock-parity, and npm run check:codex-cloud -- --runtime. Confirm that
setup exported CODEX_CLOUD_EXPECTED_BASE_SHA as a verified 40-character ancestor. Do not call a
provider unless this task explicitly names and authorizes that provider. Report the decisive
line from every command and any unrun check.
```

Expected decisive lines include:

```text
[Codex Cloud Check] PASS: static and environment Cloud contracts match.
[Codex Cloud Check] PASS: static, environment, and runtime Cloud contracts match.
```

The effective-environment check runs automatically when `CODEX_CLOUD=1`, including without
`--runtime`, so a newly started agent shell cannot pass with stale modes. Its report prints only
approved mode values and presence booleans. The runtime check additionally verifies Node/npm
policy and installed-lock parity, the pinned Codex CLI, Deno 2, Python 3 and worker imports,
Tesseract, actual headless launch-and-close for Chromium/Firefox/WebKit, the Python requirements
fingerprint plus `pip check` and medspaCy/spaCy versions, the expected base commit as an ancestor
of HEAD, the `BigSimmo/Database` origin identity, offline credential absence when applicable,
and obsolete npm proxy variable names without reading or printing their values. It reports
the full current HEAD, local main and origin/main when present, expected base, ancestry result,
and a separate freshness state. Setup and maintenance use the process-local
`CODEX_CLOUD_PROVISIONING=1` flag so an unavoidable task-only checkout reports
`freshness=unverified` without entering a repair loop. The explicit acceptance command does
not set that flag and fails unless the setup-generated `CODEX_CLOUD_EXPECTED_BASE_SHA` proves the
intended base.
MCP inspection emits server names, commands, and environment variable names only.

A repository cannot remove a variable already inherited by the top-level task process. Before
sourcing any profile or invoking node/npm in a fresh task, run:

```bash
bash --noprofile --norc scripts/check-codex-cloud-raw-env.sh
```

The probe checks the complete provider-variable inventory and prints names only. Outcomes are
name-scoped in the probe itself:

- exit `0` / `PASS` — raw boundary clean
- exit `1` / `FAIL` + `STOP` — any unexpected provider name (for example
  `SUPABASE_SERVICE_ROLE_KEY`); start another fresh task and do not continue
- exit `2` / `FAIL-KNOWN` + `CONTINUE-RESTRICTED` — only the documented Personal Pro launcher
  defect name `OPENAI_BASE_URL`

Exit `2` is still a failed raw boundary: humans/agents may continue only under this contract.
Do not treat “non-1” or “retry on any failure” as success in future automation — wire the three
states explicitly. When the probe reports `FAIL-KNOWN` for `OPENAI_BASE_URL` alone, preserve that
name-only output for OpenAI support and continue provider-free work only through the generated
profile and command shims, followed by a passing `npm run check:codex-cloud`. Do not generalize
that restricted path to any other inherited name. An inherited `OPENAI_BASE_URL` can redirect
OpenAI-bound traffic, so never call OpenAI clients from the raw parent process or from binaries
that bypass the profile/`node`/`npm`/`npx` shim scrub. A sanitized child shell is never proof
that the raw-parent boundary passed.

`npm run check:production-readiness` remains useful in the offline profile for local safeguards.
Missing Supabase/OpenAI agent-phase credentials are reported as a provider capability gap and do
not make the provider-free cache unhealthy. `ALLOW_PROVIDER_TESTS=true` expresses authorization,
not credential availability; live tests still fail closed with a sanitized capability-gap message
in the offline profile.

## Provider acceptance

Provider access is verified separately because a generic bootstrap must not make paid or
production-like calls. The active hosted workspace is **Personal Pro**. It does not have the
dedicated-group RBAC or per-tool action disabling assumed by Enterprise/Edu instructions. Use
Railway's installed official ChatGPT app, complete browser OAuth without static tokens or headers,
set the global app policy to **Allow read actions**, and leave changes approval-gated. Authorize
only workspace `bigsimmo's Projects` and project `Database`
(`5deaad0b-675a-4c13-978e-5ca2b5b877f9`) where Railway offers that choice. Reduce read results to
non-secret account, project, workspace, environment, and service metadata. Railway's remote MCP
does not accept project tokens; install Railway CLI separately only for explicitly approved
local/operator workflows (for example `npm run check:env-parity -- --railway`). That CLI path is
not available in ordinary Cloud tasks and is not part of Cloud runtime acceptance. Prefer
`RAILWAY_API_TOKEN` for personal CLI auth; never substitute the project-scoped CI
`RAILWAY_TOKEN`. Enterprise/Edu custom-app controls are an optional future governance upgrade,
not the current operating target.

The Supabase MCP entry is scoped to production project `sjrfecxgysukkwxsowpy`, forces
`read_only=true`, and exposes only documentation/development metadata tools. The database and
debugging groups are excluded so ordinary Cloud cannot execute SQL, read clinical rows, or inspect
production logs. Complete its browser OAuth flow for the organization containing `Clinical KB Database`
and restart the client if tools do not appear. Schema writes, Edge Function deployment, branching,
and storage mutations require a separately configured non-production project or branch; do not
broaden the production entry. OpenAI generation, Supabase live data, Railway changes, hosted CI
reruns, ingestion, deployment, and release workflows remain separate explicit actions.

Project `.codex/config.toml` is the checked-in Codex Desktop/CLI MCP template. Its URL-only entries
must stay `enabled = false` in git — `npm run check:codex-cloud` hard-fails on any tracked
`enabled = true`. A trusted local operator opts in outside the committed tree: prefer enabling
`railway` in `$CODEX_HOME/config.toml`, or make a never-committed local edit to the project file for
the session, then run `codex mcp login railway`. Setup does not copy any MCP server into
`$CODEX_HOME`. Hosted ChatGPT and Codex Cloud require the separately installed/authenticated
workspace app. Start a fresh task after consent and verify the actual callable inventory.
The root `.mcp.json` is a cross-client Desktop/CLI template and static allowlist only. It does not
prove hosted Cloud availability. Context7 / library-docs MCP is Cursor-side
(`.cursor/mcp.json` local `@upstash/context7-mcp@3.2.5` with `CONTEXT7_API_KEY` from `${env:…}`,
or a host-injected connector), not part of this Codex Cloud Railway + Supabase allowlist. When the
host connector is quota-blocked, use `npx ctx7` with the agent Secret in `process.env`.

### Personal Pro split control plane

Personal Pro currently exposes GitHub, Slack, and Linear on the Codex connector settings page; it
does not expose Railway or Supabase there. Use the smallest functional split instead of copying
credentials into Cloud:

- **Codex Cloud:** repository work, offline checks, and GitHub reads/publication through the native
  GitHub connector or Cloud PR controls.
- **ChatGPT web:** Railway through the official OAuth app and Supabase through the pinned
  project-scoped read-only app. Keep Railway on **Allow read actions** and ask before every change.
- **Desktop/CLI:** opt-in local MCP via `$CODEX_HOME/config.toml` (preferred) or a
  never-committed local enable of the project `.codex/config.toml` `railway` entry, followed by
  `codex mcp login railway`; this is a local operator fallback, never hosted proof.

The repository checker prints these routes as sanitized `provider_route.*` lines. They describe
where a capability is allowed, not proof that a host installed or authenticated it. A fresh task
must still establish the callable inventory.

Production Supabase stays project-scoped and `read_only=true`, with
`default_tools_approval_mode = "prompt"` so every production metadata/read call requires
confirmation. Do not use unrestricted SQL or query clinical rows. Railway, Figma, and Sentry
write-capable tools remain approval-gated. OAuth credentials stay in the host store—never the
tracked files or agent environment.

For Figma, that means using the official app/plugin OAuth path for a named design task, not adding
Figma client IDs, client secrets, REST tokens, or npm registry tokens to Cloud environment
variables. Product truth remains `docs/design-system/` and the app code; design writes still need
explicit task approval.

In a fresh connected task, first run the raw-shell probe and repository acceptance, then inspect
the actual callable tool inventory. A configured URL or `enabled = false` template is not runtime
proof. Verify Railway and Supabase with read-only identity/project metadata calls and report only
non-secret status; if either tool is absent, the host integration is not activated.

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
   `ALLOW_PROVIDER_TESTS`. Connected setup writes only the managed shell-environment policy; it
   never registers hosted MCP apps or writes OAuth tokens.
2. **Grant the host integrations.** In the Personal Pro workspace, install Railway's official
   ChatGPT app, complete Railway OAuth, select **Allow read actions**, and keep all changes subject
   to explicit approval. If a stale custom app or connector named `railway_cloud` shows an
   authentication-expired reconnect banner, remove or reconnect that host-local app in the MCP/App
   settings before starting a new task; repository setup cannot refresh hosted OAuth tokens.
   Personal Pro has no dedicated-group RBAC or per-tool disabling, so do not claim those controls.
   Authorize the Codex GitHub connector for
   `BigSimmo/Database` with repository write access. Complete Railway OAuth only for workspace
   `bigsimmo's Projects` and project `Database` (`5deaad0b-675a-4c13-978e-5ca2b5b877f9`). Complete
   Supabase OAuth only for the organization containing `Clinical KB Database`; retain project ref
   `sjrfecxgysukkwxsowpy`, `read_only=true`, and the docs/development-only feature allowlist. Do not broaden the
   production Supabase MCP to write access. Enable Figma or Sentry only for a task that names that
   provider; their write-capable tools remain approval-gated. Railway's OAuth metadata advertises
   `offline_access`; verify the scanned consent includes it and prove refresh behavior with a second
   read-only call after the one-hour access-token lifetime. If no refresh token is issued, require
   reauthentication instead of adding a token workaround.
3. **Start a fresh task.** OAuth tools and environment values are fixed when the task starts. A
   setup rerun inside an already-running offline task can validate a generated connected profile,
   but it cannot inject host MCP tools or retroactively grant OAuth. Restart the MCP client or open
   a new task after consent. When the host exposes its app identifiers, pass that non-secret
   inventory to the environment check with
   `--hosted-app-inventory=github,railway,supabase`. The exact `=` form is required and the option
   may appear only once; every other unsupported argument fails closed. The checker rejects stale
   `railway_cloud`, shared sensitive-token patterns, and identifiers outside its reviewed connector
   allowlist. It normalizes connector-name case and never echoes supplied values. Invalid input
   suppresses capability output rather than printing a misleading unverified state. Inventory
   remains explicitly unverified when the host does not provide it; repository config is never
   substituted for this evidence.
4. **Prove the shell boundary before providers.** First run the direct raw-shell command above
   before profiles or command shims. Then run `npm run check:codex-cloud`,
   `npm run check:codex-cloud -- --runtime`, `npm run check:runtime`, and
   `npm run check:installed-lock-parity`. Confirm the setup-generated
   `CODEX_CLOUD_EXPECTED_BASE_SHA` is a full intended merge-base commit. Require the raw PASS line,
   both Cloud PASS lines, correct runtime/lock
   parity, `CODEX_CLOUD_ACCESS_PROFILE=connected`, no provider variable reported present, and a
   credential-free matching origin. Repository MCP metadata is configuration evidence only.
5. **Prove each provider with its approved route.** Prefer tools exposed by the fresh host session.
   If GitHub tools are absent, use the authenticated `gh` fallback and confirm `BigSimmo/Database`
   plus the intended identity and repository permission. For Railway, read workspace/project/service metadata and confirm the IDs above without
   triggering a deployment. Record the exact Railway inventory. Set the app to allow reads and ask
   before changes. The Personal Pro global read-versus-change control does not provide tool-level
   RBAC. If the account later moves to Enterprise/Edu, an admin may additionally allow only
   `whoami`, `list-projects`, `list-services`, `list-feature-flags`, and `get-feature-flag`, while
   disabling write/agent tools and newly discovered actions by default. For Supabase, read
   project/schema metadata and confirm the pinned ref
   without querying clinical row contents. Report only non-secret identity and status metadata.
   OpenAI has no generic connected-profile credential: leave `RAG_PROVIDER_MODE=offline` until a
   separately approved paid canary or protected workflow supplies its own credential boundary.
6. **Publish a task branch safely.** Work on a task-specific non-protected branch. Format, stage,
   and commit the intended repository change, then publish that exact existing commit through the
   native GitHub connector or authenticated GitHub CLI fallback, and verify the remote branch and
   PR link. `git push --set-upstream origin <task-branch>` is acceptable only after confirming the
   credential-free origin and protected-branch exclusions. Never embed a PAT in a remote or command.
   Do not publish a generic detached `work` branch merely to remove an informational "no upstream"
   warning.
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

| Capability              | Required evidence                                                                      | Not sufficient                                                     |
| ----------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Connected boundary      | Cloud environment and runtime PASS lines with provider variables absent                | Editing the generated profile in one running task                  |
| GitHub read/write       | Connector repository read plus verified publication of the exact task commit           | Repository discovery, `make_pr` metadata, or a local commit        |
| Railway read            | Exact callable hosted-app tools plus OAuth metadata for the expected workspace/project | Installed Railway CLI or repository MCP config alone               |
| Supabase read           | OAuth-backed metadata for the pinned read-only project                                 | A configured MCP URL without completed OAuth                       |
| OpenAI/live application | Explicitly approved paid canary or protected authenticated workflow                    | Setting `RAG_PROVIDER_MODE=auto` without credentials               |
| Local application       | Project identity plus the reported health status from the `ensure` URL                 | Assuming a localhost port or treating demo 503 as production-ready |
| Capacity                | Full intended checks complete without OOM, or a host-level capacity change is proven   | Swap size by itself                                                |

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
