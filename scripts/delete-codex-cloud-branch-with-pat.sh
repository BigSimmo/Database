#!/usr/bin/env bash

set -Eeuo pipefail

usage() {
  printf 'Usage: %s <non-protected-branch>\n' "${0##*/}" >&2
  exit 64
}

fail() {
  printf '[codex-cloud:github-pat] ERROR: %s\n' "$*" >&2
  exit 1
}

[[ "$#" -eq 1 ]] || usage
branch="$1"
[[ "$branch" != -* ]] || fail "Refusing an option-like branch name."
[[ "${CODEX_CLOUD_ACCESS_PROFILE:-offline}" = "connected" ]] || fail "This emergency helper is connected-profile only."
[[ -n "${CODEX_CLOUD_GITHUB_PAT:-}" ]] || fail "CODEX_CLOUD_GITHUB_PAT is unavailable; add it only as a connected Cloud secret for this one operation."

case "$branch" in
  main|master|develop|release|release/*|HEAD|HEAD/*|refs/*|*..*|*~*|*@\{*|*\\*|*\ *|"")
    fail "Refusing to delete a protected or invalid branch name."
    ;;
esac
git check-ref-format --branch "$branch" >/dev/null || fail "Invalid branch name."
expected_origin="https://github.com/BigSimmo/Database.git"
[[ "$(git config --get remote.origin.url 2>/dev/null || true)" = "$expected_origin" ]] ||
  fail "origin must be the credential-free BigSimmo/Database URL."
push_urls="$(git remote get-url --push --all origin)" || fail "Could not read origin push URLs."
[[ -n "$push_urls" ]] || fail "origin has no push URL."
while IFS= read -r push_url; do
  [[ "$push_url" = "$expected_origin" ]] || fail "origin push URL must be the credential-free BigSimmo/Database URL."
done <<< "$push_urls"

askpass="$(mktemp)"
trap 'rm -f "$askpass"; unset CODEX_CLOUD_GITHUB_PAT' EXIT
cat > "$askpass" <<'EOF'
#!/bin/sh
case "$1" in
  *Username*) printf '%s\n' x-access-token ;;
  *Password*) printf '%s\n' "$CODEX_CLOUD_GITHUB_PAT" ;;
  *) exit 1 ;;
esac
EOF
chmod 0700 "$askpass"

GIT_ASKPASS="$askpass" GIT_TERMINAL_PROMPT=0 \
  git -c credential.helper= -c core.hooksPath=/dev/null push origin --delete "$branch"
printf '[codex-cloud:github-pat] PASS: deleted %s.\n' "$branch"
