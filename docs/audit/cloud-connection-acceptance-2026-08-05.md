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
- The installed app exposed these read actions: `Fetch-docs`, `Get-feature-flag`, `Get-logs`,
  `Get-service-config`, `Get-service-metrics`, `Get-status`, `List-deployments`, `List-domains`,
  `List-feature-flags`, `List-projects`, `List-services`, `List-variables`, `List-workspaces`,
  `Search-docs`, and `Whoami`. `List-variables` reports names only.
- It exposed these change actions, all approval-gated by **Allow read actions**: `Accept-deploy`,
  `Create-deployment`, `Create-project`, `Create-service`, `Delete-feature-flag`, `Generate-domain`,
  `Railway-agent`, `Redeploy`, `Set-feature-flag`, `Set-variables`, and `Update-service`. None was
  invoked.
- Railway OAuth metadata advertises `openid`, `profile`, `email`, `offline_access`, and
  `workspace:member`. Confirm the scanned consent requests `offline_access`, then repeat a
  read-only call from a new task after the one-hour access-token lifetime. If ChatGPT receives no
  refresh token, record reauthentication as required; never introduce a static-token workaround.

## Acceptance status

| Surface             | Required proof                                                                                                          | Status                                                                                                                                                                                                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository boundary | Setup never writes Railway/Supabase MCP servers; local templates stay secret-free                                       | PASS: focused tests and static checker pass; Cloud setup also no longer installs Railway CLI                                                                                                                                |
| GitHub              | Connector reads `BigSimmo/Database`; exact commit is published and verified                                             | Read PASS via `mcp__codex_apps__github_get_repo`; draft publication pending                                                                                                                                                 |
| Railway             | Exact tools callable in a fresh ChatGPT chat and fresh Codex Cloud task; read-only identity/project/service checks pass | ChatGPT PASS via `mcp__codex_apps__railway_whoami`, `railway_list_projects`, and `railway_list_services`; exact project and services `app`, `worker`, `Database` visible. Fresh Codex Cloud rerun pending after publication |
| Supabase            | Existing app exposes only project-scoped read-only metadata without row queries                                         | ChatGPT PASS via `mcp__codex_apps__supabase_list_projects`: `sjrfecxgysukkwxsowpy`, `Clinical KB Database`, `ACTIVE_HEALTHY`; no schema/table/row/log call                                                                  |
| Raw Cloud shell     | Only five documented non-secret values; `OPENAI_BASE_URL` absent before profiles/shims                                  | Environment UI PASS: exactly the five documented values and no `OPENAI_BASE_URL`; fresh raw-shell PASS pending                                                                                                              |
| OAuth durability    | Second read-only Railway call succeeds after one hour, or reauthentication is documented                                | Pending elapsed-time validation; no token workaround added                                                                                                                                                                  |

The first fresh Codex Cloud acceptance attempt did not reach the agent: setup failed while
`@railway/cli@5.30.4` tried to download its binary from GitHub Releases and received
`ENETUNREACH`. The repository fix removes that unnecessary CLI installation. This is evidence of
the old setup defect, not evidence that Railway is callable in Codex Cloud; the corrected branch
must be published and tested in another fresh Cloud task.

## Prior branch and blocked-result disposition

- GitHub connector inspection found PR #1613 still open at current head
  `68c1f17909802c1d0e7b8e999de2259de4072dc7`; its description still cites stale acceptance head
  `8a4ad8ff53072bc796c81c0039006222bca6c068` and retains the old claim that repository setup enables
  connected Railway/Supabase MCPs. This repair is isolated from that unrelated PR and does not
  merge, close, or rewrite it.
- Connector commit search did not find the Cloud-only `fe31128` GitHub preflight commit. The bounded
  behavior was recreated as `check:github-shell-access`: its normal mode intentionally checks only
  the optional `gh` shell fallback, while `--self-test` is fully offline. `GH_AUTH_MISSING` therefore
  says nothing about the hosted GitHub connector, which passed independently.
- The original blocked report's `OPENAI_BASE_URL` condition was removed in Codex environment
  settings. `Database - connected` now contains exactly the five documented non-secret variables.
  A new raw-shell probe is still required because only a new task can prove the launcher stopped
  inheriting the removed value.

Do not mark Railway accepted because it appears in workspace settings or repository files. Success
requires a callable tool in both fresh hosted contexts. If direct Railway exposure or safe project
isolation fails, stop before deployment and design a separate tool-only gateway with per-user OAuth
and PKCE/refresh, exact project allowlisting, read-only v1 tools, encrypted server-side tokens,
audit logs, redaction, rate limits, bounded log metadata, request timeouts, and explicit write
approvals. Its hosting target and Railway OAuth registration require separate approval before code.

References: [OpenAI Developer Mode](https://help.openai.com/en/articles/12584461-developer-mode-and-full-mcp-connectors-in-chatgpt-beta), [Apps in ChatGPT](https://help.openai.com/en/articles/11487775-connectors-in-chatgpt/), [Railway MCP server](https://docs.railway.com/ai/mcp-server), and [Railway OAuth token lifecycle](https://docs.railway.com/integrations/oauth/login-and-tokens).
