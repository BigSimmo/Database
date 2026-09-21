import type { Metadata, MetadataRoute } from "next";

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
 * Let compliant crawlers fetch application routes so they can observe per-route
 * robots metadata (including noindex on private/demo surfaces). Do not advertise
 * an XML sitemap from this private-product robots.txt.
 */
export const PRIVATE_APP_ROBOTS_TXT = {
  rules: {
    userAgent: "*",
    allow: "/",
  },
} satisfies MetadataRoute.Robots;
