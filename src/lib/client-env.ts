/** Client-safe environment helpers. Keep this module limited to NEXT_PUBLIC_* values. */
export function isLocalNoAuthMode() {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_LOCAL_NO_AUTH === "true";
}

/** Build-time client gate for #100 Phase 1 evidence-preview rendering. */
export function incrementalEvidencePreviewRenderingEnabled(
  value = process.env.NEXT_PUBLIC_RAG_INCREMENTAL_EVIDENCE_PREVIEW_RENDER,
) {
  return value === "true";
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
