#!/usr/bin/env bash

set -Eeuo pipefail
set +x

log() {
  printf '[codex-cloud:github] %s\n' "$*"
}

fail() {
  printf '[codex-cloud:github] ERROR: %s\n' "$*" >&2
  exit 1
}

repository="BigSimmo/Database"
expected_identity="BigSimmo"
export GH_CONFIG_DIR="$HOME/.config/gh"

[[ "${CODEX_CLOUD:-0}" = "1" ]] || fail "This helper is only supported during Codex Cloud setup or maintenance."

install_github_cli() {
  command -v apt-get >/dev/null 2>&1 || fail "GitHub CLI is unavailable and apt-get cannot install it."
  log "Installing GitHub CLI from the Cloud image package repository."
  if [[ "$(id -u)" -eq 0 ]]; then
    apt-get update
    apt-get install -y --no-install-recommends gh
  elif command -v sudo >/dev/null 2>&1; then
    sudo apt-get update
    sudo apt-get install -y --no-install-recommends gh
  else
    fail "GitHub CLI installation requires root or sudo."
  fi
}

validate_github_access() {
  local identity repository_permission
  identity="$(gh api user --jq .login 2>/dev/null)" || fail "GitHub identity verification failed."
  [[ "$identity" = "$expected_identity" ]] || fail "GitHub identity must be ${expected_identity}; detected ${identity:-unavailable}."

  repository_permission="$(gh api "repos/$repository" --jq '.permissions.push // false' 2>/dev/null)" ||
    fail "GitHub repository permission verification failed for $repository."
  [[ "$repository_permission" = "true" ]] || fail "GitHub access to $repository does not permit ordinary feature-branch pushes."

  gh auth setup-git --hostname github.com >/dev/null || fail "GitHub CLI could not configure its token-free Git credential helper."
  log "PASS: identity=$identity repository=$repository feature_branch_push=true"
}

if [[ -z "${CODEX_CLOUD_GITHUB_PAT:-}" ]]; then
  if ! command -v gh >/dev/null 2>&1 || ! gh auth status --hostname github.com >/dev/null 2>&1; then
    log "SKIP: no setup-only GitHub credential is available; a separately verified native connector may still provide access."
    exit 0
  fi
  validate_github_access
  exit 0
fi

[[ "${CODEX_CLOUD_ACCESS_PROFILE:-offline}" = "connected" ]] ||
  fail "CODEX_CLOUD_GITHUB_PAT may only be consumed by the connected Cloud access profile."

command -v gh >/dev/null 2>&1 || install_github_cli

github_auth_status=0
gh auth login --hostname github.com --git-protocol https --with-token <<< "$CODEX_CLOUD_GITHUB_PAT" >/dev/null ||
  github_auth_status=$?
unset CODEX_CLOUD_GITHUB_PAT GH_TOKEN GITHUB_TOKEN
[[ "$github_auth_status" -eq 0 ]] || fail "GitHub CLI authentication failed."
unset github_auth_status

if [[ -d "$GH_CONFIG_DIR" ]]; then
  chmod 0700 "$GH_CONFIG_DIR"
  [[ ! -f "$GH_CONFIG_DIR/hosts.yml" ]] || chmod 0600 "$GH_CONFIG_DIR/hosts.yml"
fi
if [[ -f "$GH_CONFIG_DIR/hosts.yml" ]] && grep -Eq '^[[:space:]]*oauth_token:' "$GH_CONFIG_DIR/hosts.yml"; then
  gh auth logout --hostname github.com --user "$expected_identity" >/dev/null 2>&1 || true
  rm -f "$GH_CONFIG_DIR/hosts.yml"
  fail "GitHub CLI fell back to plaintext credential storage; configure the native connector or a Cloud image with OS-backed secure storage."
fi

validate_github_access
