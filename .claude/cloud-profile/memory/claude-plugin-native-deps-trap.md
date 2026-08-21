---
name: claude-plugin-native-deps-trap
description: Claude Code plugins with native deps ship without node_modules; npm 11 then blocks their build scripts, so the feature silently half-works
metadata:
  type: reference
---

`claude plugin install` does NOT install a plugin's npm dependencies. For plugins with
native modules (episodic-memory needs better-sqlite3, onnxruntime-node, sharp, protobufjs)
the CLI and MCP server fail with `ERR_MODULE_NOT_FOUND` until you run `npm install
--omit=dev` inside the plugin's cache directory
(`~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`). That install took ~9 minutes
for episodic-memory 1.4.2.

Second trap: npm 11 on this machine blocks package install scripts by default
(`npm warn allow-scripts`), so native rebuilds report failure even though the package files
land. episodic-memory's own postinstall printed
"rebuild of better-sqlite3 failed (status=1)". Despite that warning, better-sqlite3 and the
HuggingFace embeddings both worked — verified 2026-08-21 by running `node
cli/episodic-memory.js stats` and a real `search` that returned 81% matches. So treat that
postinstall warning as advisory, not proof of breakage; prove it with `stats` + `search`
before either declaring it broken or declaring it fine.

Related: [[local-test-failures-windows]], [[checks-that-cannot-fail]].
