import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { validateActionReference } from "../scripts/github-action-pins.mjs";
import { yamlBlock } from "../scripts/yaml-contract.mjs";

describe("GitHub Action pin validation", () => {
  it("accepts a reviewed immutable action reference with its exact version comment", () => {
    expect(
      validateActionReference("        uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0"),
    ).toBeNull();
  });

  it("rejects mutable major tags", () => {
    expect(validateActionReference("        uses: actions/setup-node@v5")).toContain("is mutable");
  });

  it("validates inline list-style action steps", () => {
    expect(validateActionReference("      - uses: actions/setup-node@v5")).toContain("is mutable");
    expect(
      validateActionReference("      - uses: actions/setup-node@a0853c24544627f65ddf259abe73b1d18a591444 # v5.0.0"),
    ).toBeNull();
  });

  it("rejects an unreviewed commit SHA", () => {
    expect(
      validateActionReference("        uses: actions/setup-node@1111111111111111111111111111111111111111 # v5.0.0"),
    ).toContain("is not a reviewed commit SHA");
  });

  it("rejects a misleading or unsupported version annotation", () => {
    expect(
      validateActionReference("        uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v6.0.3"),
    ).toContain("# v7.0.0");
  });

  it("allows repository-local actions", () => {
    expect(validateActionReference("        uses: ./.github/actions/example@v1")).toBeNull();
  });

  it("accepts the reviewed autofix.ci action pin", () => {
    expect(
      validateActionReference("      - uses: autofix-ci/action@c5b2d67aa2274e7b5a18224e8171550871fc7e4a # v1.3.4"),
    ).toBeNull();
  });

  describe("bundle-budget-refresh workflow validation (#8TKTV6)", () => {
    it("pins actions, sets ubuntu-24.04 runner, and contains valid syntax in bundle-budget-refresh.yml", () => {
      const workflowPath = path.join(process.cwd(), ".github/workflows/bundle-budget-refresh.yml");
      const content = readFileSync(workflowPath, "utf8");

      expect(content).toContain("runs-on: ubuntu-24.04");
      expect(content).not.toContain("ubuntu-latest");

      const lines = content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("uses:")) {
          const failure = validateActionReference(line);
          expect(failure, `Line ${i + 1}: ${line} failed pin validation`).toBeNull();
        }
      }

      expect(yamlBlock(content, "name: Bundle Budget Refresh", 0)).toContain("Bundle Budget Refresh");
      expect(yamlBlock(content, "on:", 0)).toContain("workflow_dispatch:");
      expect(yamlBlock(content, "permissions:", 0)).toContain("contents: read");
      expect(yamlBlock(content, "jobs:", 0)).toContain("bundle-budget-refresh:");
    });
  });
});
