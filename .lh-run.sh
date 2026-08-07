#!/usr/bin/env bash
set -euo pipefail

REPO=/repo
REPORT_DIR=/repo/lighthouse-linux-run
REPORT_SNAP=/repo/lighthouse-linux-run-report
BACKUP=/tmp/lighthouse-budget.json.orig

cd "$REPO"

# Force clean Linux dependency tree so native modules match runtime.
rm -rf node_modules
npm ci --include=dev

cp lighthouse-budget.json "$BACKUP"
trap 'cp "$BACKUP" lighthouse-budget.json || true; rm -f "$BACKUP"' EXIT

node - <<'NODE'
import fs from "node:fs";
const path = "lighthouse-budget.json";
const budget = JSON.parse(fs.readFileSync(path, "utf8"));
budget.routes = ["/","/services","/forms","/differentials","/dsm","/specifiers","/tools"];
budget.enforce = false;
budget.baseline = null;
fs.writeFileSync(path, `${JSON.stringify(budget, null, 2)}\n`, "utf8");
NODE

if command -v chromium >/dev/null 2>&1; then
  export CHROME_PATH="$(command -v chromium)"
elif command -v chromium-browser >/dev/null 2>&1; then
  export CHROME_PATH="$(command -v chromium-browser)"
else
  echo "[lh] installing chromium for Lighthouse"
  apt-get update -y >/tmp/apt-update.log
  apt-get install -y --no-install-recommends chromium >/tmp/apt-install.log
  rm -rf /var/lib/apt/lists/*
  if command -v chromium >/dev/null 2>&1; then
    export CHROME_PATH="$(command -v chromium)"
  else
    export CHROME_PATH="$(command -v chromium-browser)"
  fi
fi

echo "[lh] using CHROME_PATH=$CHROME_PATH"

rm -rf "$REPORT_DIR"
mkdir -p "$REPORT_DIR"

npm run verify:lighthouse -- --dir "$REPORT_DIR" --keep

rm -rf "$REPORT_SNAP"
cp -a "$REPORT_DIR" "$REPORT_SNAP"
echo "[lh] saved reports to $REPORT_SNAP"
