import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("CircleCI config contract", () => {
  const config = read(".circleci/config.yml");
  const engines = JSON.parse(read("package.json")).engines as { node: string; npm: string };
  const expectedNodeMajor = engines.node.match(/^(\d+)/)?.[1];
  const expectedNpmMajor = engines.npm.match(/^(\d+)/)?.[1];

  it("pins the executor image to the package.json node engine major version", () => {
    const image = config.match(/image:\s*cimg\/node:(\d+)/);
    expect(image, "expected a cimg/node:<major>… docker image").not.toBeNull();
    expect(image?.[1]).toBe(expectedNodeMajor);
  });

  it("pins npm to the package.json npm engine major version", () => {
    const npmPin = config.match(/npm install -g npm@(\d+)/);
    expect(npmPin, "expected an `npm install -g npm@<major>` pin step").not.toBeNull();
    expect(npmPin?.[1]).toBe(expectedNpmMajor);
  });

  it("runs real verification, not the stock hello-world template", () => {
    expect(config).not.toContain("say-hello");
    expect(config).not.toContain("Hello, World!");
    expect(config).not.toContain("cimg/base");

    for (const command of ["npm ci", "npm run format:check", "npm run lint", "npm run typecheck", "npm run test"]) {
      expect(config, `missing step: ${command}`).toContain(command);
    }
  });
});
