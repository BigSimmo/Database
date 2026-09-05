"use client";

import { useReportWebVitals } from "next/web-vitals";
import { useState } from "react";

/**
 * Dev-only Core Web Vitals reporter. Opt-in via `NEXT_PUBLIC_WEB_VITALS_DEBUG=true`
 * so production is untouched and the strict CSP is respected — everything here is
 * local (console + an in-page overlay), with no network requests.
 *
 * Reports LCP, CLS, INP, FCP, TTFB with their good / needs-improvement / poor
 * rating so a UX-performance screening can be re-run and regressions caught
 * objectively.
 *
 * The flag is checked at the MODULE boundary, not inside the hook. Next inlines
 * `NEXT_PUBLIC_*` at build time, so `DEBUG_ENABLED` is a static boolean and the
 * production export is the empty component — `useReportWebVitals` is never
 * referenced and `next/dist/compiled/web-vitals` leaves the client graph. Gating
 * only the callback body does NOT achieve that: Next's hook subscribes
 * onCLS/onFID/onLCP/onINP/onFCP/onTTFB from a `useEffect` regardless of what the
 * callback does, so six PerformanceObservers ran on every route for no consumer
 * while this comment claimed the opposite (2026-09-02 audit, L108). Pinned by
 * `tests/web-vitals-reporter.dom.test.tsx`; keep the check out of the component.
 */

const DEBUG_ENABLED = process.env.NEXT_PUBLIC_WEB_VITALS_DEBUG === "true";

const RATING_COLOR: Record<string, string> = {
  good: "#16a34a",
  "needs-improvement": "#d97706",
  poor: "#dc2626",
};

type MetricSnapshot = { name: string; value: number; rating: string };

function formatValue(name: string, value: number): string {
  // CLS is a unitless score; every other metric is a duration in milliseconds.
  return name === "CLS" ? value.toFixed(3) : `${Math.round(value)} ms`;
}

function WebVitalsReporterDebug() {
  const [metrics, setMetrics] = useState<Record<string, MetricSnapshot>>({});
  const [dismissed, setDismissed] = useState(false);

  useReportWebVitals((metric) => {
    const rating = metric.rating ?? "";
    const color = RATING_COLOR[rating] ?? "#64748b";
    console.log(
      `%c[web-vitals] ${metric.name} ${formatValue(metric.name, metric.value)} (${rating || "unrated"})`,
      `color:${color};font-weight:600`,
    );
    setMetrics((prev) => ({ ...prev, [metric.name]: { name: metric.name, value: metric.value, rating } }));
  });

  if (dismissed) return null;

  const rows = Object.values(metrics).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div
      // Inline styles keep this self-contained (a dev tool must not depend on app
      // CSS/tokens and must never affect product layout). Fixed + high z-index so
      // it floats above the app; pointer-events limited to the panel itself.
      style={{
        position: "fixed",
        bottom: "max(0.5rem, env(safe-area-inset-bottom))",
        left: "max(0.5rem, env(safe-area-inset-left))",
        zIndex: 2147483000,
        font: "12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
        color: "#f8fafc",
        background: "rgba(15,23,42,0.92)",
        border: "1px solid rgba(148,163,184,0.4)",
        borderRadius: "8px",
        padding: "8px 10px",
        minWidth: "150px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
      }}
      role="status"
      aria-label="Web Vitals debug overlay"
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", marginBottom: "4px" }}>
        <strong>Web Vitals</strong>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Hide Web Vitals overlay"
          style={{ background: "transparent", border: "none", color: "#cbd5e1", cursor: "pointer", padding: 0 }}
        >
          ×
        </button>
      </div>
      {rows.length === 0 ? (
        <div style={{ color: "#94a3b8" }}>measuring…</div>
      ) : (
        rows.map((row) => (
          <div key={row.name} style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <span>{row.name}</span>
            <span style={{ color: RATING_COLOR[row.rating] ?? "#e2e8f0" }}>{formatValue(row.name, row.value)}</span>
          </div>
        ))
      )}
    </div>
  );
}

/** The production build: nothing mounted, nothing observed, nothing imported. */
function WebVitalsReporterDisabled() {
  return null;
}

export const WebVitalsReporter = DEBUG_ENABLED ? WebVitalsReporterDebug : WebVitalsReporterDisabled;
