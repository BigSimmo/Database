import { describe, expect, it } from "vitest";

import { yamlBlock } from "../scripts/yaml-contract.mjs";

describe("yamlBlock", () => {
  it("scopes properties to the requested job and step instead of comments or sibling jobs", () => {
    const yaml = `jobs:
  decoy:
    # continue-on-error: true
    steps:
      - name: Semgrep scan
        run: echo decoy
  semgrep:
    steps:
      - name: Checkout
        run: echo checkout
      - name: Semgrep scan
        continue-on-error: true
        run: semgrep scan src
  later:
    continue-on-error: true
`;
    const job = yamlBlock(yaml, "semgrep:", 2);
    const scan = yamlBlock(job, "- name: Semgrep scan", 6);
    expect(job).not.toContain("echo decoy");
    expect(job).not.toContain("later:");
    expect(scan).toContain("continue-on-error: true");
    expect(scan).toContain("semgrep scan src");
  });
});
