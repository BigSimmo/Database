import { expect, it } from "vitest";

import { metadata as caringContactsMetadata } from "../src/app/caring-contacts/layout";
import robots from "../src/app/robots";
import { PRIVATE_APP_ROBOTS_METADATA, PUBLIC_APP_ROBOTS_METADATA } from "../src/lib/crawler-policy";
import { readFileSync } from "node:fs";
import { join } from "node:path";

it("allows indexing on public app routes while robots.txt stays crawlable", () => {
  expect(robots()).toEqual({ rules: { userAgent: "*", allow: "/" } });
  expect(robots()).not.toHaveProperty("sitemap");
  expect(PUBLIC_APP_ROBOTS_METADATA).toMatchObject({
    index: true,
    follow: true,
  });
  const rootLayout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
  expect(rootLayout).toContain("PUBLIC_APP_ROBOTS_METADATA");
  expect(rootLayout).not.toContain("PRIVATE_APP_ROBOTS_METADATA");
});

it("keeps Caring Contacts and mockups on the private noindex robots object", () => {
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
  expect(caringContactsMetadata.robots).toEqual(PRIVATE_APP_ROBOTS_METADATA);
  const mockupsLayout = readFileSync(join(process.cwd(), "src/app/mockups/layout.tsx"), "utf8");
  expect(mockupsLayout).toContain("PRIVATE_APP_ROBOTS_METADATA");
});

it("keeps offline.html noindexed independently of app metadata", () => {
  const offlineHtml = readFileSync(join(process.cwd(), "public/offline.html"), "utf8");
  expect(offlineHtml).toMatch(/name=["']robots["'][^>]*content=["']noindex/i);
});
