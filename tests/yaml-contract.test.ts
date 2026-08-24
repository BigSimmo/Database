import { describe, expect, it } from "vitest";

import { yamlBlock, yamlContractSyntaxFailures } from "../scripts/yaml-contract.mjs";

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

  it("rejects quoted or duplicate keys and YAML reference indirection", () => {
    const failures = yamlContractSyntaxFailures(`jobs:
  safe:
    permissions: &write
      contents: write
  "quoted":
    permissions: *write
  safe:
    <<: *write
`);

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("unsupported quoted mapping key"),
        expect.stringContaining("duplicate YAML mapping key safe"),
        expect.stringContaining("anchors, aliases, and merge keys"),
      ]),
    );
  });

  it("rejects explicit and otherwise unsupported YAML mapping key forms", () => {
    const failures = yamlContractSyntaxFailures(`jobs:
  ? unrelated-write
  :
    permissions: write-all
  [flow-key]:
    permissions: read-all
`);

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining("unsupported explicit YAML mapping key"),
        expect.stringContaining("unsupported YAML mapping key at line 5"),
      ]),
    );
  });

  it("does not interpret block-scalar script contents as YAML aliases or duplicate keys", () => {
    expect(
      yamlContractSyntaxFailures(`jobs:
  safe:
    steps:
      - run: |
          const glob = "*write";
          const duplicate = { key: 1, key: 2 };
          if (left && right) console.log(glob, duplicate);
`),
    ).toEqual([]);
  });
});
