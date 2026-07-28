import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("CircleCI config contract", () => {
  const config = read(".circleci/config.yml");
  const engines = JSON.parse(read("package.json")).engines as { node: string; npm: string };
  const expectedNodeMajor = engines.node.match(/^(\d+)/)?.[1];

  it("pins the executor image to the package.json node engine major version", () => {
    const image = config.match(/image:\s*cimg\/node:(\d+)/);
    expect(image, "expected a cimg/node:<major>… docker image").not.toBeNull();
    expect(image?.[1]).toBe(expectedNodeMajor);
  });

  it("runs npm ci on a real verify job, not the stock hello-world template", () => {
    expect(config).not.toContain("say-hello");
    expect(config).not.toContain("Hello, World!");
    expect(config).toContain("npm ci");
  });
});
