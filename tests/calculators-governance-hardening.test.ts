import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  allCalculatorFixtures,
  calculators,
  calculatorEvidence,
  type CalculatorItem,
} from "@/components/calculators/calculator-fixtures";
import { deriveCalculator, type AnswerMap } from "@/components/calculators/calculator-ui";

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
  items: CalculatorItem[];
};

/**
 * `responseAnchorSetId` is supposed to pin the exact set of response options (and their point
 * values) a calculator's items expose — the thing an operator relies on when they read "this
 * instrument's anchors are unchanged" off the ID alone. A regex that only checks the ID's shape
 * cannot tell a real anchor set from an arbitrary string, and cannot notice when an option label
 * or point value is edited while the ID string is left untouched.
 *
 * So the ID is bound to content: it must equal a SHA-256 fingerprint derived from every item's
 * kind, options (label + points, in order) or checkbox point value, in item order. Change a
 * label, a point value, add/remove/reorder an option or an item, and the fingerprint — and so the
 * required `responseAnchorSetId` — changes with it. `slice(0, 16)` keeps the ID short while still
 * astronomically collision-resistant for a fixture set this size.
 */
function computeResponseAnchorFingerprint(items: CalculatorItem[]): string {
  const canonical = items
    .map((item) => {
      if (item.kind === "checkbox") {
        return `${item.id}:checkbox:${item.points ?? 0}`;
      }
      const options = (item.options ?? []).map((option) => `${option.label}=${option.points}`).join("|");
      return `${item.id}:options:${options}`;
    })
    .join(";");
  return `rax-${createHash("sha256").update(canonical, "utf8").digest("hex").slice(0, 16)}`;
}

type GovernanceSource = {
  id: string;
  accessedAt?: string;
  lastReviewed?: string;
  nextReview?: string;
  supersedes?: string | null;
};

/**
 * A golden vector pins one scored administration of a calculator: the raw
 * answers plus the score and band the current fixture must derive from them.
 * `answers` uses the same shape as `AnswerMap` — checkbox items take 1/0,
 * options items take the selected option's index.
 */
type GoldenVector = {
  name?: string;
  answers?: Record<string, number>;
  expectedScore?: number;
  expectedBand?: string;
};

describe("calculator governance hardening", () => {
  it("pins an exact response-anchor set for every calculator fixture", () => {
    for (const calc of allCalculatorFixtures as GovernanceFixture[]) {
      expect(calc.responseAnchorSetId, `${calc.id} responseAnchorSetId`).toMatch(/^[a-z0-9][a-z0-9._:-]+$/);
      // Syntax alone can't catch a modified instrument: an arbitrary but well-formed ID would
      // still pass the regex above. Bind the ID to the fixture's actual response anchors (option
      // labels + point values) so editing an anchor without updating the pinned ID goes red.
      expect(
        calc.responseAnchorSetId,
        `${calc.id} responseAnchorSetId must match a fingerprint of its response anchors — an option label or point value changed without updating the pinned ID`,
      ).toBe(computeResponseAnchorFingerprint(calc.items));
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

  it("ships a golden-vector registry covering every active calculator, and every vector scores correctly", () => {
    const vectorPath = path.join(REPO_ROOT, "data", "calculators", "golden-vectors.json");
    expect(fs.existsSync(vectorPath)).toBe(true);
    const registry = JSON.parse(fs.readFileSync(vectorPath, "utf8")) as {
      calculators?: Array<{ calculatorId?: string; responseAnchorSetId?: string; vectors?: GoldenVector[] }>;
    };
    const byId = new Map((registry.calculators ?? []).map((entry) => [entry.calculatorId, entry]));
    for (const calc of allCalculatorFixtures.filter((fixture) =>
      calculators.some((active) => active.id === fixture.id),
    )) {
      const entry = byId.get(calc.id);
      expect(entry, `${calc.id} golden-vector entry`).toBeTruthy();
      expect(entry?.responseAnchorSetId).toBe((calc as GovernanceFixture).responseAnchorSetId);
      const vectors = entry?.vectors ?? [];
      expect(vectors.length, `${calc.id} golden-vector count`).toBeGreaterThan(0);

      vectors.forEach((vector, index) => {
        const vectorLabel = `${calc.id} golden vector #${index}${vector?.name ? ` (${vector.name})` : ""}`;
        expect(vector, vectorLabel).toBeTruthy();
        expect(vector?.answers, `${vectorLabel} answers`).toBeTypeOf("object");
        expect(vector?.expectedScore, `${vectorLabel} expectedScore`).toBeTypeOf("number");
        expect(vector?.expectedBand, `${vectorLabel} expectedBand`).toBeTypeOf("string");

        // Run the vector's answers through the real scoring/banding derivation
        // used by every calculator mockup, so a registry entry can no longer
        // go green while claiming a score or band the fixture would not
        // actually produce.
        const derived = deriveCalculator(calc, (vector?.answers ?? {}) as AnswerMap);
        expect(derived.score, `${vectorLabel} derived score`).toBe(vector?.expectedScore);
        expect(derived.band?.label, `${vectorLabel} derived band`).toBe(vector?.expectedBand);
      });
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
