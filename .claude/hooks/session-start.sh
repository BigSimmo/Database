#!/bin/bash
# SessionStart hook for Claude Code on the web.
# The app is engine-strict on Node 24.x / npm 11.x, but web containers ship an
# older Node on PATH, so nothing installs or runs until Node 24 is present.
# Installs Node 24 into $HOME/.node24 (cached with the container), exposes it
# via $CLAUDE_ENV_FILE, and installs npm dependencies.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

NODE_VERSION="24.13.0"
NODE_HOME="$HOME/.node24"
NODE_BIN="$NODE_HOME/node-v${NODE_VERSION}-linux-x64/bin"

current_major="$(node -v 2>/dev/null | sed -E 's/^v([0-9]+).*/\1/' || echo 0)"
if [ "$current_major" != "24" ] && [ ! -x "$NODE_BIN/node" ]; then
  echo "[session-start] Installing Node ${NODE_VERSION} (found v${current_major:-none})"
  mkdir -p "$NODE_HOME"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    | tar -xJ -C "$NODE_HOME"
fi

if [ -x "$NODE_BIN/node" ]; then
  export PATH="$NODE_BIN:$PATH"
  echo "export PATH=\"$NODE_BIN:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

echo "[session-start] Using node $(node -v) / npm $(npm -v)"

cd "$CLAUDE_PROJECT_DIR"
# npm ci keeps the lockfile untouched (npm install rewrites peer/optional
# metadata and dirties the worktree); skip entirely when the cached container
# already has node_modules.
if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
  echo "[session-start] Dependencies installed"
else
  echo "[session-start] node_modules already present, skipping install"
fi
