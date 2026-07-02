# Clinical KB Codex Plugin

This plugin follows the repo-local structure used by `openai/plugins`:

- Marketplace: `.agents/plugins/marketplace.json`
- API-key-login marketplace: `.agents/plugins/api_marketplace.json`
- Plugin: `plugins/clinical-kb`
- Manifest: `plugins/clinical-kb/.codex-plugin/plugin.json`
- Skills: `plugins/clinical-kb/skills/`

The plugin currently ships repo guidance only. It does not add MCP servers, app connectors,
commands, hooks, dependencies, or runtime code.

Codex plugin discovery is marketplace-based. In a workspace marketplace,
`./plugins/clinical-kb` resolves to `C:\Dev\Apps\Database\plugins\clinical-kb`.
Restart Codex in this workspace if the plugin does not appear immediately.

If your Codex install requires explicit local marketplace registration, add the repo root as
a plugin marketplace, then install the plugin by marketplace name:

```powershell
codex plugin marketplace add C:\Dev\Apps\Database
codex plugin add clinical-kb@clinical-kb-local
```

For API-key-login marketplace flows, use `clinical-kb-api-local` as the marketplace name.
Start a new Codex thread after installing or updating the plugin so the skill list refreshes.
