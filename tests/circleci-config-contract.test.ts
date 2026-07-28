import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("CircleCI config contract", () => {
  const config = read(".circleci/config.yml");

  it("uses cimg/node 24 and is not the stock hello-world template", () => {
    expect(config).toMatch(/image:\s*cimg\/node:24/);
    expect(config).not.toContain("say-hello");
    expect(config).not.toContain("Hello, World!");
    expect(config).not.toMatch(/(?<!\\)<</);
  });
});
