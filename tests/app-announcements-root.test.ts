import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("root announcements mount", () => {
  it("keeps both singleton owners inside one narrow client island", () => {
    const island = readFileSync(new URL("../src/components/app-announcements.tsx", import.meta.url), "utf8");

    expect(island).toMatch(/^\s*["']use client["'];?/m);
    expect(island.match(/<LiveAnnouncer\s*\/>/g)).toHaveLength(1);
    expect(island.match(/<RouteAnnouncer\s*\/>/g)).toHaveLength(1);
  });

  it("keeps the root layout server-rendered and mounts one announcement island", () => {
    const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

    expect(layout).not.toMatch(/^\s*["']use client["'];?/m);
    expect(layout.match(/<AppAnnouncements\s*\/>/g)).toHaveLength(1);
  });
});
