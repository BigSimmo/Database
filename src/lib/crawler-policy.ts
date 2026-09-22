import type { Metadata, MetadataRoute } from "next";

import { resolveMetadataBase } from "@/lib/metadata-base";

/**
 * Default robots for public application surfaces that should be discoverable
 * once PsychSift is served on its production host. Auth still protects private
 * clinical content; indexing is not access control.
 */
export const PUBLIC_APP_ROBOTS_METADATA = {
  index: true,
  follow: true,
} satisfies Metadata["robots"];

/**
 * Restrictive robots for surfaces that must stay out of search results:
 * synthetic demos (Caring Contacts), prototype mockups, and similar
 * non-product pages. Offline/error static documents keep their own noindex
 * meta in markup or response headers.
 */
export const PRIVATE_APP_ROBOTS_METADATA = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
    nosnippet: true,
  },
} satisfies Metadata["robots"];

/**
 * Resolves the absolute sitemap URL robots.txt advertises, from the same
 * canonical-origin sources as generated app metadata (`NEXT_PUBLIC_SITE_URL`,
 * then `RAILWAY_PUBLIC_DOMAIN`). The request host is deliberately not consulted,
 * so robots.txt never points crawlers at an arbitrary or attacker-controlled host.
 */
function publicSitemapUrl(): string | undefined {
  const base = resolveMetadataBase(new Headers(), {
    configuredSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    trustedDeploymentDomain: process.env.RAILWAY_PUBLIC_DOMAIN,
  });
  return base ? `${base.origin}/sitemap.xml` : undefined;
}

const PUBLIC_SITEMAP_URL = publicSitemapUrl();

/**
 * The app-wide robots.txt. Compliant crawlers may fetch application routes so
 * they can observe per-route robots metadata (including noindex on private/demo
 * surfaces such as Caring Contacts and the developer mockups).
 *
 * A public-only sitemap is advertised here. The sitemap lists ONLY the canonical
 * public surface — the shared home (`/`) and the public-knowledge tool landing
 * pages — so advertising it cannot reveal private records, signed document URLs,
 * account-scoped routes, or demo/mockup surfaces. Indexing stays governed by the
 * per-route PUBLIC/PRIVATE robots metadata; the sitemap is an index of public
 * routes, not an access-control or disclosure list. When no trusted canonical
 * origin is configured, the sitemap line is omitted rather than emitting an
 * origin the app cannot vouch for.
 */
export const PRIVATE_APP_ROBOTS_TXT = {
  rules: {
    userAgent: "*",
    allow: "/",
  },
  ...(PUBLIC_SITEMAP_URL ? { sitemap: PUBLIC_SITEMAP_URL } : {}),
} satisfies MetadataRoute.Robots;
