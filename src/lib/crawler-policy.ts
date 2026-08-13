import type { Metadata, MetadataRoute } from "next";

/**
 * Clinical KB is a private application, not a public content catalogue. Keep its
 * routes out of search results even when a crawler reaches a URL without first
 * consulting robots.txt.
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
 * Do not advertise a sitemap for private application routes, and ask compliant
 * crawlers not to fetch them.
 */
export const PRIVATE_APP_ROBOTS_TXT = {
  rules: {
    userAgent: "*",
    disallow: "/",
  },
} satisfies MetadataRoute.Robots;
