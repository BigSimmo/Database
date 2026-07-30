import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  STYLE_CONTRACT_EXEMPTIONS,
  STYLE_EFFECT_CONTRACTS,
  isMediaOverrideOnly,
  parseUnlayeredVisualClasses,
} from "./helpers/style-contracts";

const globalsCss = readFileSync(path.join(process.cwd(), "src", "app", "globals.css"), "utf8");

/**
 * Ledger #094: a style contract must not be able to pass while the style is inert.
 *
 * The gate itself lives in `tests/ui-style-contract.spec.ts` (a real browser is the
 * only thing that can evaluate cascade layers). This file keeps that gate's
 * *inventory* closed, so the next unlayered class cannot be added without a
 * conscious decision — which is exactly how the accent rail slipped through.
 */
describe("unlayered visual style inventory", () => {
  const inventory = parseUnlayeredVisualClasses(globalsCss);
  const contracted = new Set(STYLE_EFFECT_CONTRACTS.map((contract) => contract.className));

  it("finds the unlayered classes it is supposed to police", () => {
    // A parser that silently matched nothing would make every assertion below
    // vacuously true — the failure mode this repo has hit with soft-skipping gates.
    expect(inventory.length).toBeGreaterThan(20);
    expect(inventory.map((entry) => entry.className)).toContain("search-band");
  });

  it("covers every unlayered visual class with a contract or a reasoned exemption", () => {
    const unregistered = inventory
      .filter((entry) => !isMediaOverrideOnly(entry))
      .filter((entry) => !contracted.has(entry.className) && !(entry.className in STYLE_CONTRACT_EXEMPTIONS))
      .map((entry) => `${entry.className} (globals.css:${entry.lines.join(", ")})`);

    expect(
      unregistered,
      "These class rules sit outside @layer and set a visual property, so they exist to beat a " +
        "Tailwind utility — and nothing proves they still do. Add a STYLE_EFFECT_CONTRACTS entry " +
        "(preferred) or an explicit STYLE_CONTRACT_EXEMPTIONS reason in tests/helpers/style-contracts.ts.",
    ).toEqual([]);
  });

  it("keeps the exemption list free of classes that no longer qualify", () => {
    // A stale exemption is worse than none: it reads as "considered and excused"
    // for a rule that has since moved into a layer or lost its visual property.
    const inventoryNames = new Set(inventory.map((entry) => entry.className));
    const stale = Object.keys(STYLE_CONTRACT_EXEMPTIONS).filter((className) => !inventoryNames.has(className));

    expect(stale, "Exempted classes that are no longer unlayered visual rules — delete these entries.").toEqual([]);
  });

  it("does not exempt a class that already has a contract", () => {
    const both = STYLE_EFFECT_CONTRACTS.map((contract) => contract.className).filter(
      (className) => className in STYLE_CONTRACT_EXEMPTIONS,
    );

    expect(both, "A contracted class must not also be exempt — delete the exemption.").toEqual([]);
  });

  it("points every contract at a class that is actually unlayered", () => {
    // If a contracted class gets moved into `@layer`, the browser assertion may
    // still pass (a utility can coincidentally supply the same value) while the
    // rule it was written to protect is gone.
    const inventoryNames = new Set(inventory.map((entry) => entry.className));
    const missing = STYLE_EFFECT_CONTRACTS.map((contract) => contract.className).filter(
      (className) => !inventoryNames.has(className),
    );

    expect(missing, "Contracted classes that are no longer unlayered visual rules in globals.css.").toEqual([]);
  });
});

describe("parseUnlayeredVisualClasses", () => {
  it("ignores class rules inside @layer, which lose to utilities", () => {
    const css = `@layer components {\n  .layered {\n    border-top: 2px solid red;\n  }\n}\n`;

    expect(parseUnlayeredVisualClasses(css)).toEqual([]);
  });

  it("reports an unlayered class rule with a visual property", () => {
    const css = `.rail {\n  border-top: 2px solid red;\n}\n`;

    expect(parseUnlayeredVisualClasses(css)).toEqual([{ className: "rail", lines: [1], media: [], unmediated: true }]);
  });

  it("ignores an unlayered rule with no visual property", () => {
    const css = `.spacing {\n  padding: 1rem;\n}\n`;

    expect(parseUnlayeredVisualClasses(css)).toEqual([]);
  });

  it("does not mistake a vendor-prefixed colour property for a visual declaration", () => {
    // `-webkit-tap-highlight-color` ends in `color` and produced a false positive
    // in the first draft of this parser.
    const css = `.tap {\n  -webkit-tap-highlight-color: transparent;\n}\n`;

    expect(parseUnlayeredVisualClasses(css)).toEqual([]);
  });

  it("records the media query wrapping an unlayered override", () => {
    const css = `@media (forced-colors: active) {\n  .pinned {\n    border-color: CanvasText;\n  }\n}\n`;
    const [entry] = parseUnlayeredVisualClasses(css);

    expect(entry.className).toBe("pinned");
    expect(entry.media).toEqual(["(forced-colors: active)"]);
    expect(isMediaOverrideOnly(entry)).toBe(true);
  });

  it("treats a class styled both plainly and under forced-colors as a real component rule", () => {
    const css =
      `.band {\n  border-top: 2px solid red;\n}\n` +
      `@media (forced-colors: active) {\n  .band {\n    border-color: CanvasText;\n  }\n}\n`;
    const [entry] = parseUnlayeredVisualClasses(css);

    expect(entry.lines).toEqual([1, 5]);
    expect(isMediaOverrideOnly(entry)).toBe(false);
  });

  it("collects every class in a multi-class selector", () => {
    const css = `.one,\n.two {\n  background: red;\n}\n`;

    // Only the line that opens the block is scanned, so a selector list split
    // across lines contributes the classes on that final line.
    expect(parseUnlayeredVisualClasses(css).map((entry) => entry.className)).toEqual(["two"]);
  });

  it("ignores commented-out rules without shifting reported line numbers", () => {
    const css = `/* .ghost {\n  border-top: 2px solid red;\n} */\n.real {\n  border-top: 2px solid red;\n}\n`;

    expect(parseUnlayeredVisualClasses(css)).toEqual([{ className: "real", lines: [4], media: [], unmediated: true }]);
  });
});
