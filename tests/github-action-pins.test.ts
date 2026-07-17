import { describe, expect, it } from "vitest";

import { validateActionReference } from "../scripts/github-action-pins.mjs";

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
});
