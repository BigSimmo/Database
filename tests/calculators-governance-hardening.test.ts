import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { allCalculatorFixtures, calculators, calculatorEvidence } from "@/components/calculators/calculator-fixtures";

const REPO_ROOT = process.cwd();

type RightsRecord = {
  status?: string;
  holder?: string;
  digitalUseAllowed?: boolean | null;
  modificationAllowed?: boolean | null;
  attributionRequired?: boolean | null;
  verifiedAt?: string;
};

type GovernanceFixture = {
  id: string;
  responseAnchorSetId?: string;
  rights?: RightsRecord;
};

type GovernanceSource = {
  id: string;
  accessedAt?: string;
  lastReviewed?: string;
  nextReview?: string;
  supersedes?: string | null;
};

describe("calculator governance hardening", () => {
  it("pins an exact response-anchor set for every calculator fixture", () => {
    for (const calc of allCalculatorFixtures as GovernanceFixture[]) {
      expect(calc.responseAnchorSetId, `${calc.id} responseAnchorSetId`).toMatch(/^[a-z0-9][a-z0-9._:-]+$/);
    }
  });

  it("records explicit rights metadata for every active calculator", () => {
    for (const calc of calculators as GovernanceFixture[]) {
      expect(calc.rights?.status, `${calc.id} rights status`).toBe("available");
      expect(calc.rights?.holder, `${calc.id} rights holder`).toBeTruthy();
      expect(calc.rights?.digitalUseAllowed, `${calc.id} digital-use permission`).toBe(true);
      expect(calc.rights?.modificationAllowed, `${calc.id} modification permission`).not.toBeUndefined();
      expect(calc.rights?.attributionRequired, `${calc.id} attribution requirement`).not.toBeUndefined();
      expect(calc.rights?.verifiedAt, `${calc.id} rights verification date`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("records source access, review, next-review and supersession metadata", () => {
    for (const source of calculatorEvidence.sources as GovernanceSource[]) {
      expect(source.accessedAt, `${source.id} accessedAt`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.lastReviewed, `${source.id} lastReviewed`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(source.nextReview, `${source.id} nextReview`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Date.parse(source.nextReview as string), `${source.id} nextReview after lastReviewed`).toBeGreaterThan(
        Date.parse(source.lastReviewed as string),
      );
      expect(Object.prototype.hasOwnProperty.call(source, "supersedes"), `${source.id} supersedes`).toBe(true);
    }
  });

  it("ships a golden-vector registry covering every active calculator", () => {
    const vectorPath = path.join(REPO_ROOT, "data", "calculators", "golden-vectors.json");
    expect(fs.existsSync(vectorPath)).toBe(true);
    const registry = JSON.parse(fs.readFileSync(vectorPath, "utf8")) as {
      calculators?: Array<{ calculatorId?: string; responseAnchorSetId?: string; vectors?: unknown[] }>;
    };
    const byId = new Map((registry.calculators ?? []).map((entry) => [entry.calculatorId, entry]));
    for (const calc of calculators as GovernanceFixture[]) {
      const entry = byId.get(calc.id);
      expect(entry, `${calc.id} golden-vector entry`).toBeTruthy();
      expect(entry?.responseAnchorSetId).toBe(calc.responseAnchorSetId);
      expect(entry?.vectors?.length ?? 0, `${calc.id} golden-vector count`).toBeGreaterThan(0);
    }
  });

  it("wires the calculator governance checker into verify:cheap", () => {
    const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.["check:calculator-content"]).toBe("node scripts/check-calculator-content.mjs");
    expect(packageJson.scripts?.["verify:cheap:internal"]).toContain("npm run check:calculator-content");
  });
});
