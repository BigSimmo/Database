import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sourceSegment } from "./helpers/source-contract";

const globals = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const primitives = readFileSync(new URL("../src/components/ui-primitives.tsx", import.meta.url), "utf8");
const comparePicker = readFileSync(
  new URL("../src/components/compare/compare-catalog-picker.tsx", import.meta.url),
  "utf8",
);

describe("search / field focus is quiet and shell-owned", () => {
  it("does not paint a 2px inset --focus rectangle on text fields", () => {
    const body = sourceSegment(
      globals,
      ':where(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, select):focus-visible {',
      "}",
      { label: "shared text-field focus rule" },
    );
    expect(body).not.toContain("outline: 2px solid var(--focus)");
    expect(body).not.toContain("outline-offset: -2px");
    expect(body).toContain("color-mix(in srgb, var(--clinical-accent)");
  });

  it("keeps button / link focus as the sanctioned 2px outline", () => {
    const body = sourceSegment(globals, ':where(button, a, summary, input[type="checkbox"]', "}", {
      label: "shared control focus rule",
    });
    expect(body).toContain("outline: 2px solid var(--focus)");
    expect(body, "the shared button focus rule must not paint a box-shadow").not.toContain("box-shadow");
  });

  it("lets the rounded search shell own focus and suppresses the nested input", () => {
    const shell = sourceSegment(globals, ".search-shell:focus-within {", "}", { label: "search-shell focus" });
    expect(shell).toContain("color-mix(in srgb, var(--clinical-accent)");
    expect(shell).not.toContain("outline: 2px solid var(--focus)");

    const input = sourceSegment(globals, ".search-shell-input:focus,", "}", { label: "search-shell-input focus" });
    expect(input).toContain("outline: none");
    expect(input).toContain("box-shadow: none");
  });

  it("exports field-control and the search-shell pair from the primitive recipes", () => {
    const field = primitives.match(/export const fieldControl\s*=\s*"([^"]+)"/);
    expect(field, "fieldControl recipe missing").toBeTruthy();
    expect(field![1]).toMatch(/\bfield-control\b/);
    expect(field![1]).not.toContain("focus:border-[color:var(--focus)]");

    expect(primitives).toMatch(/export const searchShell\s*=\s*"search-shell /);
    expect(primitives).toMatch(/export const searchShellInput\s*=\s*"search-shell-input /);
    expect(primitives).toMatch(/export const chatComposerInput\s*=\s*"chat-composer-input search-shell-input"/);
  });

  it("uses the search-shell pair on the compare catalog picker", () => {
    expect(comparePicker).toContain("searchShell");
    expect(comparePicker).toContain("searchShellInput");
    expect(comparePicker).not.toMatch(/className="min-w-0 flex-1 bg-transparent text-base outline-none/);
  });

  it("does not put a second 2px --focus outline on the composer pill", () => {
    const body = sourceSegment(globals, ".chat-composer-shell-delta:focus-within {", "}", {
      label: "composer shell focus",
    });
    expect(body).toContain("outline: none");
    expect(body).not.toContain("outline: 2px solid var(--focus)");
  });
});
