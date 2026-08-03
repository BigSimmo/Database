#!/usr/bin/env bash

set -Eeuo pipefail

# Run this directly with a pristine shell before sourcing profiles or invoking
# node/npm shims. It reports names and presence only, never values.
provider_variables=(
  OPENAI_API_KEY OPENAI_ORG_ID OPENAI_PROJECT_ID OPENAI_BASE_URL
  NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY
  SUPABASE_SERVICE_ROLE_KEY SUPABASE_ACCESS_TOKEN SUPABASE_DB_URL
  SUPABASE_PROJECT_REF SUPABASE_PROJECT_NAME SUPABASE_STAGING_PROJECT_REF SUPABASE_STAGING_PROJECT_NAME
  DATABASE_URL POSTGRES_PASSWORD CROSS_TENANT_SERVICE_ROLE_KEY
  RAILWAY_API_TOKEN RAILWAY_TOKEN
  GH_TOKEN GITHUB_TOKEN CODEX_CLOUD_GITHUB_PAT GITLAB_TOKEN GLAB_TOKEN CODEX_TRIGGER_TOKEN
  HEALTH_DEEP_PROBE_SECRET INDEXING_V3_AGENT_SECRET
  E2E_AUTH_ENABLED E2E_USER_EMAIL E2E_USER_PASSWORD ALLOW_PROVIDER_TESTS
)

present=()
for name in "${provider_variables[@]}"; do
  if [[ -n "${!name:-}" ]]; then
    present+=("$name")
  fi
done

if (( ${#present[@]} > 0 )); then
  printf '[Codex Cloud Raw Env] FAIL: inherited provider variable names: %s\n' "${present[*]}" >&2
  exit 1
fi

printf '[Codex Cloud Raw Env] PASS: no provider variables are inherited by the raw task shell.\n'
