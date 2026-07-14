import type { CSSProperties } from "react";

/**
 * Parse a raw CSS declaration string into a React style object.
 *
 * The Therapy Compass screens are a faithful port of a design-tool export that
 * expresses every rule as inline CSS using the app's design tokens
 * (`var(--surface)`, `var(--clinical-accent)`, …). Rather than re-transcribe
 * hundreds of declarations into Tailwind arbitrary values — which would both
 * lose fidelity and trip the `check:type-scale` guardrail — we keep the exact
 * CSS strings and parse them at render time. Custom properties (`--foo`) are
 * preserved verbatim; everything else is camel-cased for React.
 *
 * Mockup-only helper: the tiny per-render parse cost is irrelevant for a
 * design-scratch route and never runs in the production bundle.
 */
export function s(css: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const idx = decl.indexOf(":");
    if (idx === -1) continue;
    const prop = decl.slice(0, idx).trim();
    const value = decl.slice(idx + 1).trim();
    if (!prop || !value) continue;
    const key = prop.startsWith("--") ? prop : prop.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
    out[key] = value;
  }
  return out as CSSProperties;
}
