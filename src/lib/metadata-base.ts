/** Resolve the canonical metadata origin from validated configuration or trusted request headers. */
export function resolveMetadataBase(requestHeaders: Headers, configuredSiteUrl?: string) {
  const configured = configuredSiteUrl?.trim();
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === "http:" || url.protocol === "https:") return url;
    } catch {
      // Fall through to the request-derived origin.
    }
  }

  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host")?.trim();
  if (!host) return undefined;
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https" ? forwardedProtocol : "https";
  try {
    return new URL(`${protocol}://${host}`);
  } catch {
    return undefined;
  }
}
