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

  it("asserts npm matches the package.json npm engine major (no broken global reinstall)", () => {
    expect(config).not.toMatch(/npm install -g npm@/);
    expect(config).toContain(`expected npm ${expectedNpmMajor}.x`);
  });

  it("runs real verification, not the stock hello-world template", () => {
    expect(config).not.toContain("say-hello");
    expect(config).not.toContain("Hello, World!");
    expect(config).not.toContain("cimg/base:");

    for (const command of ["npm ci", "npm run format:check", "npm run lint", "npm run typecheck", "npm run test"]) {
      expect(config, `missing step: ${command}`).toContain(command);
    }
  });

  it("bootstraps a venv + pinned PyMuPDF and exports PYTHON_BIN for tests", () => {
    expect(config).toContain("python3-venv");
    expect(config).toContain("PyMuPDF==1.28.0");
    expect(config).toContain("PYTHON_BIN: /tmp/ci-pdf-venv/bin/python");
  });
});
