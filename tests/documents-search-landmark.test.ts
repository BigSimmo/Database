import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const route = readFileSync(new URL("../src/app/(search-app)/documents/search/page.tsx", import.meta.url), "utf8");

describe("Documents search landing semantics", () => {
  it("owns one main landmark inside the shared shell container", () => {
    expect(route.match(/<main\b/g)).toHaveLength(1);
    expect(route.match(/<\/main>/g)).toHaveLength(1);
    expect(route).not.toMatch(/<section\b/);
  });
});
