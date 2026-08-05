# Cloud connection acceptance — 2026-08-05

## Root cause and durable boundary

Hosted ChatGPT/Codex does not register tools from repository `.mcp.json`, `.codex/config.toml`,
or container setup. Those files remain secret-free Desktop/CLI templates. Hosted tools require an
installed, workspace-authorized, OAuth-authenticated app and must be verified in a fresh task.
Cloud setup also omits Railway CLI: it is unnecessary for the hosted-app path and its binary
postinstall can fail when GitHub release downloads are unavailable.

## Hosted Railway setup and observed controls

- Railway's official hosted app was already installed and OAuth-connected in the available ChatGPT
  Pro workspace. Its permission was tightened from **Allow low-risk actions** to **Allow read
  actions**, so reads can run automatically and every change must ask. No static token, header, or
  repository secret was supplied.
- The available workspace is personal Pro, not the Enterprise/Edu workspace assumed by the plan.
  It offers the global read-versus-change control but not per-tool disable or dedicated-group RBAC.
  If Enterprise/Edu governance is required, an admin must enable Developer Mode and either govern
  the official app or create `Railway — Database` at `https://mcp.railway.com`, run Scan Tools,
  restrict it to a dedicated group, and disable write tools individually.
- A current Codex settings review independently confirmed the **PRO** classification. Its connector
  page shows GitHub connected to `BigSimmo` and offers GitHub, Slack, and Linear; it provides no
  Railway or Supabase connector control. This is a product-surface limit, not a repository setup
  failure.
- The installed app exposed these read actions: `Fetch-docs`, `Get-feature-flag`, `Get-logs`,
  `Get-service-config`, `Get-service-metrics`, `Get-status`, `List-deployments`, `List-domains`,
  `List-feature-flags`, `List-projects`, `List-services`, `List-variables`, `List-workspaces`,
  `Search-docs`, and `Whoami`. `List-variables` reports names only.
- It exposed these change actions, all approval-gated by **Allow read actions**: `Accept-deploy`,
  `Create-deployment`, `Create-project`, `Create-service`, `Delete-feature-flag`, `Generate-domain`,
  `Railway-agent`, `Redeploy`, `Set-feature-flag`, `Set-variables`, and `Update-service`. None was
  invoked.
- Railway OAuth metadata advertises `openid`, `profile`, `email`, `offline_access`, and
  `workspace:member`. An elapsed-time follow-up from a new ChatGPT Work task displayed **Your
  Railway connection has expired** before `whoami` could run and offered the normal **Reconnect**
  flow. Treat reauthentication as required for this Personal Pro app path; never introduce a
  static-token workaround.

## Acceptance status

| Surface             | Required proof                                                                                                          | Status                                                                                                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository boundary | Setup never writes Railway/Supabase MCP servers; local templates stay secret-free                                       | PASS: focused tests and static checker pass; Cloud setup also no longer installs Railway CLI                                                                                                                                                               |
| GitHub              | Connector reads `BigSimmo/Database`; exact commit is published and verified                                             | ChatGPT PASS via `mcp__codex_apps__github_get_repo`; draft PR #1617 was published through the GitHub connector. Fresh Codex Cloud FAIL: no GitHub tool exposed at tested head `7d485f88db391cc7e8e73c57ddbde61f532375fc`                                   |
| Railway             | Exact tools callable in a fresh ChatGPT chat and fresh Codex Cloud task; read-only identity/project/service checks pass | ChatGPT PASS via `railway_whoami`, `railway_get_status`, `railway_list_projects`, and `railway_list_services`; project `Database` and services `Database` and `worker` were visible with `SUCCESS` status. Fresh Codex Cloud FAIL: no Railway tool exposed |
| Supabase            | Existing app exposes only project-scoped read-only metadata without row queries                                         | ChatGPT PASS via `mcp__codex_apps__supabase_list_projects`: `sjrfecxgysukkwxsowpy`, `Clinical KB Database`, `ACTIVE_HEALTHY`; no schema/table/row/log call. Codex Cloud FAIL: no Supabase tool exposed                                                     |
| Raw Cloud shell     | Only five documented non-secret values; `OPENAI_BASE_URL` absent before profiles/shims                                  | Environment UI has exactly the five documented values and no `OPENAI_BASE_URL`, but fresh raw-shell FAIL still reports the inherited name. This is a launcher/workspace defect, not repository state                                                       |
| OAuth durability    | Second read-only Railway call succeeds after one hour, or reauthentication is documented                                | REAUTH REQUIRED: the elapsed-time task reported that the Railway connection had expired and opened Railway's normal login/OAuth flow; no token workaround was added                                                                                        |

## Personal Pro operating workarounds

| Blocker                                                          | Safe workaround applied                                                                                                                                                        | Functional boundary                                                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| No Personal Pro group RBAC or per-tool disabling                 | Railway app policy is **Allow read actions**; every change remains approval-gated                                                                                              | Maximum available Pro control; not equivalent to Enterprise/Edu RBAC                                                      |
| Railway and Supabase absent from Codex Cloud connectors          | Use a split control plane: Codex Cloud for repository/GitHub work; ChatGPT web for official Railway OAuth and project-scoped read-only Supabase                                | Providers remain usable without copying tokens; a single Codex Cloud task still cannot call them                          |
| Raw `OPENAI_BASE_URL` injected although absent in environment UI | Keep the name-only raw probe fail-closed, then use the generated profile, Codex shell policy, and `node`/`npm`/`npx` shims that remove provider variables before ordinary work | Normal repository commands are sanitized and functional; the raw parent-process defect remains visible for OpenAI support |
| Railway OAuth expires instead of refreshing in this app path     | Use the app's normal **Reconnect** flow when prompted; never add a static or shared token                                                                                      | Safe continuity workaround; Railway login/consent remains user-controlled                                                 |

This operating mode favors maximum safe functionality on Personal Pro. It does not relabel the
Codex Cloud provider-tool acceptance failure as success.

The first fresh Codex Cloud acceptance attempt did not reach the agent: setup failed while
`@railway/cli@5.30.4` tried to download its binary from GitHub Releases and received
`ENETUNREACH`. The corrected fresh task at
`https://chatgpt.com/codex/cloud/tasks/task_e_6a7303bcdd988322bc979d5d2c0f946f` passed setup and ran at
exact head `76dfe85fa93787b3845d0bd460aa18ff753ca2ca`. It reported:

- `[Codex Cloud Check] PASS: static and environment Cloud contracts match.`
- `[Runtime Check] PASS: Node runtime 24.19.0 matches required Node 24.x.`
- `[Runtime Check] PASS: npm runtime 11.17.0 matches required npm 11.x.`
- `[Codex Cloud Check] PASS: static, environment, and runtime Cloud contracts match.`
- `git.expected_base_ancestor=true` and `git.checkout_freshness=verified` for base
  `9d4a28c16e189256d2e2b1fc6edfb351138837cc`.
- `[Codex Cloud Raw Env] FAIL: inherited provider variable names: OPENAI_BASE_URL` before profiles,
  npm, Node, or shims.
- No callable Railway, GitHub, or Supabase tools: MCP resources/templates were empty and focused
  tool discovery returned zero tools. No provider call was attempted.

A second, independently provisioned environment-attached task at
`https://chatgpt.com/codex/cloud/tasks/task_e_6a7313d1364483228b7642cb942e674c` repeated acceptance at
exact head `7d485f88db391cc7e8e73c57ddbde61f532375fc`. It passed locked installation, static and runtime
Cloud contracts, Node `24.19.0`, npm `11.17.0`, installed-lock parity, and expected-base ancestry and
freshness for `9d4a28c16e189256d2e2b1fc6edfb351138837cc`. The raw probe again failed only on the inherited
name `OPENAI_BASE_URL`, and the task again exposed no callable Railway, GitHub, or Supabase tools.

A separate fresh ChatGPT Work task did expose the hosted apps and completed only safe metadata
reads: GitHub authenticated as `BigSimmo`; Supabase project `Clinical KB Database`
(`sjrfecxgysukkwxsowpy`) was `ACTIVE_HEALTHY`; Railway authenticated as `bigsimmo`, project
`Database` was visible, and services `Database` and `worker` were `SUCCESS`. No logs, variables,
SQL, row contents, or provider writes were requested. This validates the Personal Pro split-control
plane workaround, not single-task Codex Cloud provider acceptance.

This proves the repository setup fix and also proves that repository code cannot close either
remaining hosted blocker. The environment UI and launcher disagree about `OPENAI_BASE_URL`, and
the Codex Cloud product did not project the installed ChatGPT apps into the task tool inventory.

## Prior branch and blocked-result disposition

- GitHub connector inspection found PR #1613 still open at current head
  `68c1f17909802c1d0e7b8e999de2259de4072dc7`; its description still cites stale acceptance head
  `8a4ad8ff53072bc796c81c0039006222bca6c068` and retains the old claim that repository setup enables
  connected Railway/Supabase MCPs. This repair is isolated from that unrelated PR and does not
  merge, close, or rewrite it.
- Connector commit search did not find the Cloud-only `fe31128` GitHub preflight commit. The bounded
  behavior was recreated as `check:github-shell-access`: the plain npm entry is offline
  `--self-test`; the live `gh` shell fallback is `check:github-shell-access:live` (or a direct
  script invocation with `--allow-provider` / `ALLOW_GITHUB_SHELL_ACCESS=true`, which overrides
  `--self-test`). `GH_AUTH_MISSING` therefore says nothing about the hosted GitHub connector,
  which passed independently.
- The original blocked report's `OPENAI_BASE_URL` condition was removed in Codex environment
  settings. `Database - connected` now contains exactly the five documented non-secret variables,
  but a new task still inherited the variable name. Escalate this mismatch to Codex environment
  support; repository scripts correctly fail closed and must not hide it.

## Tool-only gateway fallback design

Do not deploy this fallback unless OpenAI confirms that Codex Cloud can install the resulting app
and the user separately approves a hosting target and Railway OAuth registration.

- **Hosting boundary:** a new isolated service outside Railway project `Database`, with its own
  environment, network policy, secret store, persistence, monitoring, and public HTTPS callback.
  Do not host it in either production service. The exact provider, region, URL, and data-retention
  policy remain approval-required choices.
- **Identity:** one Railway authorization-code grant per ChatGPT user, using PKCE and refresh only
  if Railway's registered-client requirements allow it. Store client credentials and refresh tokens
  encrypted server-side; never return them to ChatGPT or place them in repository/Cloud variables.
  Railway client registration, redirect URIs, supported scopes, and revocation behavior must be
  confirmed from Railway before implementation. Do not invent endpoints or broader scopes.
- **Authorization:** hard-code the only allowed project ID as
  `5deaad0b-675a-4c13-978e-5ca2b5b877f9`; reject every other project/workspace after resolving the
  authenticated Railway identity. A workspace match alone is insufficient.
- **v1 tool surface:** expose only `whoami`, `list-projects`, `list-services`,
  `list-feature-flags`, and `get-feature-flag`. Return bounded non-secret metadata. Do not expose
  logs, variables, service configuration, deployments, agent tools, mutations, or generic HTTP/API
  forwarding in v1.
- **Operational controls:** authenticated per-user sessions, encrypted token storage, append-only
  audit events, correlation IDs, redaction, per-user/project rate limits, response-size limits,
  connection and request timeouts, strict schemas, and denial-by-default for new tools. Any later
  write tool requires a separate review, explicit per-call approval, and a non-production canary.

Do not mark Railway accepted because it appears in workspace settings or repository files. Success
requires a callable tool in both fresh hosted contexts. If direct Railway exposure or safe project
isolation fails, stop before deployment and design a separate tool-only gateway with per-user OAuth
and PKCE/refresh, exact project allowlisting, read-only v1 tools, encrypted server-side tokens,
audit logs, redaction, rate limits, bounded log metadata, request timeouts, and explicit write
approvals. Its hosting target and Railway OAuth registration require separate approval before code.

References: [OpenAI Developer Mode](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta), [Apps in ChatGPT](https://help.openai.com/en/articles/11487775-connectors-in-chatgpt/), [Railway MCP server](https://docs.railway.com/ai/mcp-server), and [Railway OAuth token lifecycle](https://docs.railway.com/integrations/oauth/login-and-tokens).
