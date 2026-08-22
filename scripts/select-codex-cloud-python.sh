#!/usr/bin/env bash

set -Eeuo pipefail

select_codex_cloud_python() {
  local expected_version="$1"
  local command_name command_path actual_version host_path
  local candidates=("python${expected_version}" python3 python)
  host_path=":${PATH}:"
  while [[ "$host_path" == *":$HOME/.cache/clinical-kb-codex/ocr-venv-${expected_version}/bin:"* ]]; do
    host_path="${host_path//:$HOME/.cache/clinical-kb-codex/ocr-venv-${expected_version}/bin:/:}"
  done
  host_path="${host_path#:}"
  host_path="${host_path%:}"

  for command_name in "${candidates[@]}"; do
    command_path="$(PATH="$host_path" command -v "$command_name" 2>/dev/null || true)"
    [[ -n "$command_path" ]] || continue
    actual_version="$("$command_path" -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")' 2>/dev/null || true)"
    if [[ "$actual_version" = "$expected_version" ]]; then
      printf '%s\n' "$command_path"
      return 0
    fi
  done

  return 1
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  expected_version="${1:-3.12}"
  selected_python="$(select_codex_cloud_python "$expected_version" || true)"
  if [[ -z "$selected_python" ]]; then
    printf '[codex-cloud:python] ERROR: Python %s is unavailable. Pin Python %s in the Codex Cloud environment.\n' \
      "$expected_version" "$expected_version" >&2
    exit 1
  fi
  printf '%s\n' "$selected_python"
fi
