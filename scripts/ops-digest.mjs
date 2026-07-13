#!/usr/bin/env node
/**
 * ops-digest — render a one-screen operational summary from the live deep health
 * probe, for the daily ops-digest workflow.
 *
 * The app already exposes rich signal at GET /api/health?deep=1 (SLO counters,
 * cache hit-rate, answer spend, degraded/truncation rates), but nothing surfaces
 * it proactively — a regression is only found when someone looks. This fetches
 * that probe and renders Markdown so the workflow can post it to a rolling issue.
 *
 * Config (all via env, so nothing is hardcoded):
 *   PROD_HEALTH_URL           base URL of the deployment (e.g. https://app.example)
 *                             OR the full health URL; the script appends
 *                             /api/health?deep=1 when only a base is given.
 *   HEALTH_DEEP_PROBE_SECRET  deep-probe token (sent as x-health-deep-token)
 *   OPS_DIGEST_TIMEOUT_MS     fetch timeout (default 20000)
 * Flags:
 *   --out <path>   also write the Markdown to a file (for the workflow to read)
 *
 * Always exits 0 after writing a digest — an unreachable/degraded app is itself
 * the report, not a script failure. Emits `status=ok|degraded|unreachable` and
 * `alerting=true|false` to $GITHUB_OUTPUT when present so the workflow can flag
 * the run without re-parsing.
 */
import { appendFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

function argValue(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function resolveHealthUrl(raw) {
  if (!raw) return undefined;
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (/\/api\/health/.test(trimmed)) return trimmed;
  return `${trimmed}/api/health?deep=1`;
}

function pct(value) {
  return typeof value === "number" ? `${(value * 100).toFixed(1)}%` : "—";
}

function usd(value) {
  return typeof value === "number" ? `$${value.toFixed(2)}` : "—";
}

export function renderDigest(health, meta = {}) {
  const lines = [];
  const stamp = new Date().toISOString();
  const status = health?.status ?? "unreachable";
  const badge = status === "ok" ? "🟢 ok" : status === "degraded" ? "🟠 degraded" : "🔴 unreachable";
  lines.push(`### Ops digest — ${stamp}`, "", `**Status:** ${badge}`);
  if (meta.error) lines.push("", `> Probe error: \`${meta.error}\``);

  if (health) {
    if (typeof health.uptimeSeconds === "number") {
      const h = Math.floor(health.uptimeSeconds / 3600);
      lines.push(`**Uptime:** ${h}h  ·  **Demo mode:** ${health.demoMode ? "yes" : "no"}`);
    }
    if (health.checks) {
      const checks = Object.entries(health.checks)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      lines.push(`**Checks:** ${checks}`);
    }

    if (health.slo) {
      const s = health.slo;
      lines.push(
        "",
        "**Answer SLO** (trailing " + (s.windowMinutes ?? "?") + "m)",
        `- queries: ${s.totalQueries ?? 0}`,
        `- hybrid RPC errors: ${s.hybridRpcErrorQueries ?? 0} (${pct(s.hybridRpcErrorRate)})`,
        `- degraded/source-only: ${s.degradedQueries ?? 0} (${pct(s.degradedRate)})`,
        `- truncation fallbacks: ${s.truncationFallbackQueries ?? 0} (${pct(s.truncationFallbackRate)})`,
        `- timeout fallbacks: ${s.timeoutFallbackQueries ?? 0} (${pct(s.timeoutFallbackRate)})`,
      );
    }

    if (health.cache) {
      const c = health.cache;
      lines.push("", `**Cache:** ${c.hits ?? 0}/${c.lookups ?? 0} hits (${pct(c.hitRate)})`);
    }

    if (health.spend) {
      const sp = health.spend;
      const routes = Object.entries(sp.usdByRoute ?? {})
        .map(([r, v]) => `${r} ${usd(v)}`)
        .join(", ");
      lines.push(
        "",
        `**Spend** (trailing ${sp.windowMinutes ?? "?"}m): ${usd(sp.usd)} · answers ${sp.answers ?? 0}`,
        `- projected/day: ${usd(sp.projectedDailyUsd)}${
          sp.alertDailyUsdThreshold ? ` (threshold ${usd(sp.alertDailyUsdThreshold)})` : ""
        }${sp.alerting ? "  ⚠ OVER THRESHOLD" : ""}`,
        routes ? `- by route: ${routes}` : "",
        sp.sampleTruncated ? "- ⚠ sample truncated — figures are a lower bound" : "",
      );
    }
  }

  lines.push("", "_Read-only deep-probe snapshot. Enable/adjust in `.github/workflows/ops-digest.yml`._");
  return lines.filter((l) => l !== "").join("\n") + "\n";
}

async function main() {
  const url = resolveHealthUrl(process.env.PROD_HEALTH_URL);
  const token = process.env.HEALTH_DEEP_PROBE_SECRET;
  const timeoutMs = Number.parseInt(process.env.OPS_DIGEST_TIMEOUT_MS ?? "20000", 10) || 20000;

  let health = null;
  let error;
  if (!url) {
    error = "PROD_HEALTH_URL not set";
  } else {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: token ? { "x-health-deep-token": token } : {},
        signal: controller.signal,
      });
      const text = await res.text();
      try {
        health = JSON.parse(text);
      } catch {
        error = `non-JSON response (HTTP ${res.status})`;
      }
    } catch (e) {
      error = e?.name === "AbortError" ? `timeout after ${timeoutMs}ms` : (e?.message ?? String(e));
    } finally {
      clearTimeout(timer);
    }
  }

  const digest = renderDigest(health, { error });
  process.stdout.write(digest);
  const out = argValue("--out");
  if (out) writeFileSync(out, digest);

  const status = health?.status ?? "unreachable";
  const alerting = Boolean(health?.spend?.alerting);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `status=${status}\nalerting=${alerting}\n`);
  }
  // Always exit 0 — the digest content carries the health signal.
  process.exit(0);
}

const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main();
}
