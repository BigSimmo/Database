/** Client-safe environment helpers. Keep this module limited to NEXT_PUBLIC_* values. */
export function isLocalNoAuthMode() {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_LOCAL_NO_AUTH === "true";
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

export function resolveUploadReadOnlyMode({
  explicitDemoMode,
  authUnavailableFallback,
  environment = process.env.NODE_ENV,
}: {
  explicitDemoMode: boolean;
  authUnavailableFallback: boolean;
  environment?: string;
}) {
  return resolveClientDemoMode({
    explicitDemoMode,
    authUnavailableFallback,
    localNoAuthMode: false,
    environment,
  });
}

export function publicUploadsEnabled() {
  return process.env.NEXT_PUBLIC_PUBLIC_UPLOADS_ENABLED === "true";
}
