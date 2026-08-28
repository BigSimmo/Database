import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import owners from "@/lib/site-content/site-content-change-owners.json";
import { siteContentProducerRegistry } from "@/lib/site-content/site-content-registry";

function classify(file: string): string {
  return execFileSync("node", ["scripts/ci-change-scope.mjs", "--files", file], { encoding: "utf8" });
}

function runSelectorWithInjectedOwner(owner: string): void {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "site-content-ci-owner-"));
  const temporaryScript = join(temporaryDirectory, "ci-change-scope.mjs");
  try {
    const source = readFileSync("scripts/ci-change-scope.mjs", "utf8");
    const injected = source.replace(
      /const siteContentOwnerManifest = JSON\.parse\([\s\S]*?\);\r?\nconst siteContentProducerOwners/,
      `const siteContentOwnerManifest = ${JSON.stringify({
        version: "site-content-change-owners-v1",
        producers: { injected: [owner] },
      })};\nconst siteContentProducerOwners`,
    );
    expect(injected).not.toBe(source);
    writeFileSync(temporaryScript, injected, "utf8");
    execFileSync("node", [temporaryScript, "--self-test"], { cwd: process.cwd(), encoding: "utf8" });
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

describe("site-content CI owner contract", () => {
  it("covers every registry mode, canonical owner, and declared transitive owner", () => {
    expect(owners.version).toBe("site-content-change-owners-v1");
    expect(Object.keys(owners.producers).sort()).toEqual(
      siteContentProducerRegistry.map((entry) => entry.modeId).sort(),
    );
    for (const producer of siteContentProducerRegistry) {
      expect(producer.changeOwners).toEqual(owners.producers[producer.modeId]);
      expect(producer.changeOwners).toContain(producer.canonicalOwner);
      expect(producer.changeOwners).toEqual([...new Set(producer.changeOwners)].sort());
      for (const owner of producer.changeOwners) expect(owner).not.toMatch(/^(?:data|src)\/\*\*$/);
    }
    expect(execFileSync("node", ["scripts/ci-change-scope.mjs", "--self-test"], { encoding: "utf8" })).toContain(
      "CI change scope self-test passed.",
    );
  });

  it("classifies shared owners and the full-run sentinel without widening unrelated files", () => {
    for (const owner of [
      "src/lib/site-content/site-content-health.ts",
      "src/lib/retrieval-selection.ts",
      "supabase/migrations/20260824123000_add_site_content_health_probe.sql",
      "tests/fixtures/site-content/release-evidence-current.json",
      "src/components/__ci_full_run__.tsx",
    ]) {
      expect(classify(owner)).toContain("site_content_changed=true");
    }
    for (const unrelated of ["docs/ordinary-note.md", "src/components/ordinary-card.tsx", "data/unrelated.json"]) {
      expect(classify(unrelated)).toContain("site_content_changed=false");
    }
  });

  it("keeps manifest validation fail-closed in the selector self-test", () => {
    const source = readFileSync("scripts/ci-change-scope.mjs", "utf8");
    expect(source).toContain("validateSiteContentChangeOwners");
    expect(source).toContain("site-content-owner-manifest-malformed");
    expect(source).toContain("site-content-owner-manifest-broad-path");
    expect(source).toContain("site-content-owner-manifest-empty-owner");
    expect(source).toContain("site-content-owner-manifest-missing-owner");
    expect(source).toContain("site-content-owner-manifest-unknown-root");
    expect(source).toContain("site-content-owner-manifest-malformed-glob");
  });

  it.each([
    ["exact duplicate separator", "src/lib//dictionary-data.ts"],
    ["exact internal dot segment", "src/lib/./dictionary-data.ts"],
    ["glob duplicate separator", "public/therapy-compass-data//**"],
    ["glob internal dot segment", "public/therapy-compass-data/./**"],
  ])("rejects the %s alias before filesystem existence checks", (_name, owner) => {
    expect(() => runSelectorWithInjectedOwner(owner)).toThrow(/site-content-owner-manifest-noncanonical-owner/);
  });

  it.each(["data/**", "public/**", "src/**"])("rejects the broad %s root owner glob", (owner) => {
    expect(() => runSelectorWithInjectedOwner(owner)).toThrow(/site-content-owner-manifest-broad-path/);
  });

  it("still triggers for canonical exact and glob owner paths", () => {
    expect(classify("src/lib/dictionary-data.ts")).toContain("site_content_changed=true");
    expect(classify("public/therapy-compass-data/therapies.d0358686e452b00b.json")).toContain(
      "site_content_changed=true",
    );
  });
});
