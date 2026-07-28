import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

describe("CircleCI config contract", () => {
  const config = read(".circleci/config.yml");
  const engines = JSON.parse(read("package.json")).engines as { node: string; npm: string };
  const expectedNodeMajor = engines.node.match(/^(\d+)/)?.[1];
  const expectedNpmMajor = engines.npm.match(/^(\d+)/)?.[1];

  it("pins the executor image to a Node 24.11+ cimg tag (lockfile engine-strict)", () => {
    const image = config.match(/image:\s*cimg\/node:(\d+)\.(\d+)/);
    expect(image, "expected a cimg/node:<major>.<minor> docker image").not.toBeNull();
    expect(image?.[1]).toBe(expectedNodeMajor);
    expect(Number(image?.[2]), "Node minor must be >= 11 for @babel/parser engines").toBeGreaterThanOrEqual(11);
  });

  it("asserts npm matches the package.json npm engine major (no broken global reinstall)", () => {
    expect(config).not.toMatch(/npm install -g npm@/);
    expect(config).toContain(`expected npm ${expectedNpmMajor}.x`);
    expect(config).toContain("Node >=24.11.0");
    // CircleCI config v2.1 rejects unescaped shell heredocs.
    expect(config).not.toMatch(/(?<!\\)<</);
  });

  it("runs real verification, not the stock hello-world template", () => {
    expect(config).not.toContain("say-hello");
    expect(config).not.toContain("Hello, World!");
    expect(config).not.toContain("cimg/base:");

    for (const command of ["npm ci", "npm run format:check", "npm run lint", "npm run typecheck", "npm run test"]) {
      expect(config, `missing step: ${command}`).toContain(command);
    }
  });

  it("reuses scripts/ci-change-scope.mjs for the docs-only skip (no naive md regex)", () => {
    expect(config).toContain("scripts/ci-change-scope.mjs");
    expect(config).toContain("docs_only=true");
    expect(config).toContain("main:refs/remotes/origin/main");
    expect(config).not.toMatch(/\^\(docs\/\|\.\*\\?\.md\$\)/);
  });

  it("bootstraps a venv + pinned PyMuPDF and exports PYTHON_BIN for tests", () => {
    expect(config).toContain("python3-venv");
    expect(config).toContain("PyMuPDF==1.28.0");
    expect(config).toContain("PYTHON_BIN: /tmp/ci-pdf-venv/bin/python");
    const actions = read(".github/workflows/ci.yml");
    const actionsPin = actions.match(/PyMuPDF==[\d.]+/)?.[0];
    const circlePin = config.match(/PyMuPDF==[\d.]+/)?.[0];
    expect(circlePin).toBe(actionsPin);
    expect(config.indexOf("PyMuPDF==1.28.0")).toBeLessThan(config.indexOf("npm run test"));
  });

  it("avoids the executor knobs that failed before any step ran on this project", () => {
    expect(config).not.toMatch(/^\s*resource_class:\s*small\s*$/m);
    expect(config).not.toMatch(/^\s*-\s*image:\s*cimg\/node:[^\n]*@sha256:/m);
  });
});
