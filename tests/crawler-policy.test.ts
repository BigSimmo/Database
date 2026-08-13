import { describe, expect, it } from "vitest";

import robots from "../src/app/robots";
import { PRIVATE_APP_ROBOTS_METADATA, PRIVATE_APP_ROBOTS_TXT } from "../src/lib/crawler-policy";

describe("private application crawler policy", () => {
  it("asks crawlers not to fetch any application route and advertises no sitemap", () => {
    expect(robots()).toEqual(PRIVATE_APP_ROBOTS_TXT);
    expect(PRIVATE_APP_ROBOTS_TXT).toEqual({
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    });
    expect(PRIVATE_APP_ROBOTS_TXT).not.toHaveProperty("sitemap");
  });

  it("keeps fetched routes and their images out of search results", () => {
    expect(PRIVATE_APP_ROBOTS_METADATA).toMatchObject({
      index: false,
      follow: false,
      nocache: true,
      googleBot: {
        index: false,
        follow: false,
        noimageindex: true,
        nosnippet: true,
      },
    });
  });
});
