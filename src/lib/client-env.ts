/** Client-safe environment helpers. Keep this module limited to NEXT_PUBLIC_* values. */
export function isLocalNoAuthMode() {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_LOCAL_NO_AUTH === "true";
}

/**
 * Build-time client gate for #100 Phase 1 evidence-preview rendering.
 *
 * On unless explicitly disabled (2026-08-27 owner decision). The rail is the wait's most
 * useful content and the unit reaching the browser has already passed the stream contract's
 * structural validation, so an unset variable renders it rather than silently withholding it.
 * `false` is the rollback, and it is the SECOND rollback step: disable server emission
 * (RAG_INCREMENTAL_EVIDENCE_PREVIEW) first, per
 * docs/verified-answer-incremental-delivery-design.md.
 *
 * This value is inlined at build time, so changing it requires a rebuild, not a restart.
 */
export function incrementalEvidencePreviewRenderingEnabled(
  value = process.env.NEXT_PUBLIC_RAG_INCREMENTAL_EVIDENCE_PREVIEW_RENDER,
) {
  return value !== "false";
}

export function resolveClientDemoMode({
  explicitDemoMode,
  authUnavailableFallback,
  localNoAuthMode,
  environment = process.env.NODE_ENV,
}: {
  explicitDemoMode: boolean;
  authUnavailableFallback: boolean;
  localNoAuthMode: boolean;
  environment?: string;
}) {
  return explicitDemoMode || (environment !== "production" && (authUnavailableFallback || localNoAuthMode));
}
