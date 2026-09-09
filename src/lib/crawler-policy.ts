import type { Metadata, MetadataRoute } from "next";

/**
 * PsychSift is a private application, not a public content catalogue. Keep its
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
 * Let compliant crawlers fetch application routes so they can observe the global
 * `noindex` metadata. Search exclusion is not access control; private content must
 * remain protected by authentication. Do not advertise an XML sitemap.
 */
export const PRIVATE_APP_ROBOTS_TXT = {
  rules: {
    userAgent: "*",
    allow: "/",
  },
} satisfies MetadataRoute.Robots;
