export type MetadataBaseOptions = {
  configuredSiteUrl?: string;
  trustedDeploymentDomain?: string;
  allowRequestOrigin?: boolean;
};

function httpUrl(value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

/** Resolve metadata from validated configuration, trusted deployment state, or an explicit dev fallback. */
export function resolveMetadataBase(requestHeaders: Headers, options: MetadataBaseOptions = {}) {
  const configuredUrl = httpUrl(options.configuredSiteUrl);
  if (configuredUrl) return configuredUrl;

  const deploymentDomain = options.trustedDeploymentDomain?.trim();
  const deploymentUrl = httpUrl(
    deploymentDomain?.includes("://") ? deploymentDomain : deploymentDomain ? `https://${deploymentDomain}` : undefined,
  );
  if (deploymentUrl) return deploymentUrl;

  if (!options.allowRequestOrigin) return undefined;
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host")?.trim();
  if (!host) return undefined;
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https" ? forwardedProtocol : "https";
  return httpUrl(`${protocol}://${host}`);
}
