#!/bin/bash
# SessionStart hook for Claude Code on the web.
# The app is engine-strict on Node >=24.15 <25 / npm 11.x, but web containers
# ship an older Node on PATH, so nothing installs or runs until a Node meeting
# that floor is present. Installs one into $HOME/.node24 (cached with the
# container), exposes it via $CLAUDE_ENV_FILE, and installs npm dependencies.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

NODE_VERSION="24.19.0"
# Keep in step with the floor in package.json engines.node. A matching major is
# not enough: dev dependencies (jsdom) carry a minor-level floor, so a 24.13 on
# PATH satisfied the old major-only check and then failed `npm ci` with
# EBADENGINE. That blocked PRs #1611, #1697, #1705 and #1740.
NODE_MINIMUM="24.15.0"
# Exclusive major ceiling, matching the "<25" half of engines.node. Checking only
# the floor would let a container shipping Node 25+ skip provisioning and then
# fail `npm ci`, which is the same blind-spot as the major-only check above.
NODE_MAJOR_CEILING="25"
NODE_HOME="$HOME/.node24"
NODE_BIN="$NODE_HOME/node-v${NODE_VERSION}-linux-x64/bin"

supported_runtime() {
  local version="$1"
  local actual_major actual_minor actual_patch minimum_major minimum_minor minimum_patch
  [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || return 1
  IFS=. read -r actual_major actual_minor actual_patch <<< "$version"
  IFS=. read -r minimum_major minimum_minor minimum_patch <<< "$NODE_MINIMUM"

  (( actual_major < NODE_MAJOR_CEILING )) || return 1
  (( actual_major > minimum_major )) && return 0
  (( actual_major == minimum_major )) || return 1
  (( actual_minor > minimum_minor )) && return 0
  (( actual_minor == minimum_minor )) || return 1
  (( actual_patch >= minimum_patch ))
}

current_version="$(node -v 2>/dev/null | sed -E 's/^v//' || true)"
if ! supported_runtime "$current_version" && [ ! -x "$NODE_BIN/node" ]; then
  echo "[session-start] Installing Node ${NODE_VERSION} (found v${current_version:-none}, need >= ${NODE_MINIMUM} and < ${NODE_MAJOR_CEILING})"
  mkdir -p "$NODE_HOME"
  curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    | tar -xJ -C "$NODE_HOME"
fi

if [ -x "$NODE_BIN/node" ]; then
  export PATH="$NODE_BIN:$PATH"
  echo "export PATH=\"$NODE_BIN:\$PATH\"" >> "$CLAUDE_ENV_FILE"
fi

if ! supported_runtime "$(node -v 2>/dev/null | sed -E 's/^v//' || true)"; then
  echo "[session-start] WARNING: node $(node -v 2>/dev/null || echo 'not found') is outside the supported >=${NODE_MINIMUM} <${NODE_MAJOR_CEILING} range; npm ci will refuse to install."
fi

echo "[session-start] Using node $(node -v) / npm $(npm -v)"

cd "$CLAUDE_PROJECT_DIR"
# npm ci keeps the lockfile untouched (npm install rewrites peer/optional
# metadata and dirties the worktree). A bare "node_modules exists" check is not
# enough: a cached container keeps stale node_modules after dependency-bumping
# merges, which surfaces as fake typecheck/test regressions (2026-07-19 audit).
# Stamp the lockfile hash after a successful install and reinstall whenever the
# lockfile no longer matches the stamp.
LOCK_STAMP="node_modules/.session-start-lock-hash"
lock_hash="$(sha256sum package-lock.json | cut -d' ' -f1)"
if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
  echo "$lock_hash" > "$LOCK_STAMP"
  echo "[session-start] Dependencies installed"
elif [ ! -f "$LOCK_STAMP" ] || [ "$(cat "$LOCK_STAMP")" != "$lock_hash" ]; then
  echo "[session-start] node_modules is stale for the current lockfile, reinstalling"
  npm ci --no-audit --no-fund
  echo "$lock_hash" > "$LOCK_STAMP"
  echo "[session-start] Dependencies reinstalled"
else
  echo "[session-start] node_modules matches the lockfile, skipping install"
fi
