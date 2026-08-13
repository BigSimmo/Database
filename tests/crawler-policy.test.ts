import { expect, it } from "vitest";

import robots from "../src/app/robots";
import { PRIVATE_APP_ROBOTS_METADATA } from "../src/lib/crawler-policy";

it("serves restrictive search metadata through crawlable routes", () => {
  expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" } });
  expect(robots()).not.toHaveProperty("sitemap");
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
