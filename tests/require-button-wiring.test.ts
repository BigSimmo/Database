import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import rule from "../eslint-rules/require-button-wiring.mjs";

/**
 * The wiring gate is only worth having if it still fires. `npm run lint` going
 * green proves the repo is clean, not that the rule can fail — a rule that
 * silently matches nothing looks identical from the outside. These cases pin
 * both directions, and in particular the `redundantDisabledPair` message added
 * when the disabled-placeholder pattern moved to `aria-disabled` (ledger `#291`).
 */
const linter = new Linter();

function lint(code: string) {
  return linter.verify(code, {
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: "latest", sourceType: "module" },
    },
    plugins: { local: { rules: { "require-button-wiring": rule } } },
    rules: { "local/require-button-wiring": "error" },
  });
}

function messageIds(code: string) {
  return lint(code).map((message) => message.messageId);
}

describe("require-button-wiring", () => {
  it("flags a type=button with no handler and no disabled state", () => {
    expect(messageIds('<button type="button" aria-label="Go">x</button>')).toEqual(["unwired"]);
  });

  it("accepts either disabled encoding on its own", () => {
    expect(messageIds('<button type="button" disabled>x</button>')).toEqual([]);
    expect(messageIds('<button type="button" aria-disabled="true" onClick={noop}>x</button>')).toEqual([]);
    expect(messageIds('<button type="button" onClick={go}>x</button>')).toEqual([]);
  });

  it("flags aria-disabled without an onClick, because aria-disabled alone stays operable", () => {
    expect(messageIds('<button type="button" aria-disabled="true">x</button>')).toEqual(["ariaDisabledNeedsHandler"]);
    // Explicit after a spread still needs a handler — the spread escape must not hide it.
    expect(messageIds('<button type="button" {...props} aria-disabled="true" />')).toEqual([
      "ariaDisabledNeedsHandler",
    ]);
  });

  it("flags the two encodings together, because native disabled wins on focus", () => {
    expect(messageIds('<button type="button" disabled aria-disabled="true">x</button>')).toEqual([
      "redundantDisabledPair",
    ]);
    // Dynamic on both sides is the same defect, not a different one.
    expect(messageIds('<button type="button" disabled={busy} aria-disabled={busy}>x</button>')).toEqual([
      "redundantDisabledPair",
    ]);
    // A submit button is not exempt: the pairing is wrong regardless of type.
    expect(messageIds('<button type="submit" disabled aria-disabled="true">x</button>')).toEqual([
      "redundantDisabledPair",
    ]);
  });

  it("does not flag a pair where one side is statically off", () => {
    expect(messageIds('<button type="button" disabled={false} aria-disabled="true" onClick={noop}>x</button>')).toEqual(
      [],
    );
    expect(messageIds('<button type="button" disabled aria-disabled="false">x</button>')).toEqual([]);
  });

  it("keeps the spread escape hatch for unwired checks only", () => {
    expect(messageIds('<button type="button" {...props} />')).toEqual([]);
    // Explicit pair after a spread is still the forbidden pairing — native wins
    // on focus, so the rule must not let the spread escape hatch hide it.
    expect(messageIds('<button type="button" {...props} disabled aria-disabled="true" />')).toEqual([
      "redundantDisabledPair",
    ]);
  });
});
