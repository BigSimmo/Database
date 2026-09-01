#!/bin/bash
# SessionStart hook for Claude Code on the web.
# The app is engine-strict on Node >=26.0.0 <27 / npm 11.x, but web containers
# ship an older Node on PATH, so nothing installs or runs until a Node meeting
# that floor is present. Installs one into $HOME/.node26 (cached with the
# container), exposes it via $CLAUDE_ENV_FILE, and installs npm dependencies.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

payload="$(cat 2>/dev/null || true)"

NODE_VERSION="26.8.1"
# Keep in step with the floor in package.json engines.node. A matching major is
# not enough: keep the complete range check so a future minor-level floor cannot
# let an older Node 26 runtime reach `npm ci` and fail with an opaque EBADENGINE.
NODE_MINIMUM="26.0.0"
# Exclusive major ceiling, matching the "<27" half of engines.node. Checking only
# the floor would let a container shipping Node 27+ skip provisioning and then
# fail `npm ci`, which is the same blind-spot as the major-only check above.
NODE_MAJOR_CEILING="27"
NODE_HOME="$HOME/.node26"
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
  # CLAUDE_ENV_FILE and CLAUDE_PROJECT_DIR below are set by Claude Code when this
  # runs as a hook, and unset when a human or agent runs it by hand. Under
  # `set -u` an unguarded expansion aborts the script — and it aborts *here*,
  # after the tarball has downloaded and after PATH is exported only inside this
  # soon-to-exit child process, but before that PATH can be persisted for the
  # caller and before the install below. The operator sees a failure and cannot
  # tell the download actually succeeded.
  #
  # That matters because manual invocation is not a hypothetical: SessionStart
  # hooks do not re-fire when a long-lived session re-bases onto a newer main, so
  # a session that predates this file acquires it without ever running it, stays
  # on the container's older Node, and then fails `check:runtime` — the first
  # step of verify:pr-local — for every diff. Running this script is the remedy,
  # so it has to work when run.
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PATH=\"$NODE_BIN:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  else
    echo "[session-start] CLAUDE_ENV_FILE is unset (run by hand?); PATH is active only inside this hook process."
    echo "[session-start] To keep it in your invoking shell, run this command there:"
    echo "export PATH=\"$NODE_BIN:\$PATH\""
  fi
fi

if ! supported_runtime "$(node -v 2>/dev/null | sed -E 's/^v//' || true)"; then
  echo "[session-start] WARNING: node $(node -v 2>/dev/null || echo 'not found') is outside the supported >=${NODE_MINIMUM} <${NODE_MAJOR_CEILING} range; npm ci will refuse to install."
fi

echo "[session-start] Using node $(node -v) / npm $(npm -v)"

# Fall back to the repository this script lives in, derived from its own path
# rather than from the caller's cwd, so a manual run installs into the right tree
# from anywhere.
cd "${CLAUDE_PROJECT_DIR:-"$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"}"
# npm ci keeps the lockfile untouched (npm install rewrites peer/optional
# metadata and dirties the worktree). A bare "node_modules exists" check is not
# enough: a cached container keeps stale node_modules after dependency-bumping
# merges, which surfaces as fake typecheck/test regressions (2026-07-19 audit).
# Stamp the lockfile hash after a successful install and reinstall whenever the
# lockfile no longer matches the stamp.
# Keep this marker inside node_modules/.cache. npm's postinstall records a
# trusted file inventory of node_modules (scripts/check-installed-lock-parity.mjs
# --write-stamp), and this hook writes its own marker *after* that runs — so a
# marker written directly into node_modules/ leaves the tree one file ahead of
# the stamp and fails check:installed-lock-parity, which is the first real step
# of verify:pr-local. `.cache` is in that check's VOLATILE_DIRECTORIES set, so a
# marker there is ignored by the inventory while still being wiped by npm ci
# along with the rest of node_modules, preserving the staleness semantics below.
LOCK_STAMP="node_modules/.cache/session-start-lock-hash"
lock_hash="$(sha256sum package-lock.json | cut -d' ' -f1)"
if [ ! -d node_modules ]; then
  npm ci --no-audit --no-fund
  mkdir -p "$(dirname "$LOCK_STAMP")"
  echo "$lock_hash" > "$LOCK_STAMP"
  echo "[session-start] Dependencies installed"
  status_msg="Dependencies installed"
elif [ ! -f "$LOCK_STAMP" ] || [ "$(cat "$LOCK_STAMP")" != "$lock_hash" ]; then
  echo "[session-start] node_modules is stale for the current lockfile, reinstalling"
  npm ci --no-audit --no-fund
  mkdir -p "$(dirname "$LOCK_STAMP")"
  echo "$lock_hash" > "$LOCK_STAMP"
  echo "[session-start] Dependencies reinstalled"
  status_msg="Dependencies reinstalled"
else
  echo "[session-start] node_modules matches the lockfile, skipping install"
  status_msg="node_modules matches the lockfile, skipping install"
fi

if [ -n "${CLAUDE_ENV_FILE:-}" ] || printf '%s' "$payload" | grep -Eq '"(hook_event_name|hookEventName)"[[:space:]]*:[[:space:]]*"SessionStart"'; then
  node_v="$(node -v 2>/dev/null || echo 'unknown')"
  npm_v="$(npm -v 2>/dev/null || echo 'unknown')"
  context="[session-start] Node ${node_v} / npm ${npm_v} ready. ${status_msg}."
  printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$context"
fi
