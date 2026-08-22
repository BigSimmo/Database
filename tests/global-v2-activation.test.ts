import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sourceFrom } from "./helpers/source-contract";

import { APP_THEME_COLORS, THEME_BOOTSTRAP_SCRIPT } from "../src/lib/theme";

const layout = readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
const globals = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");
const v2 = readFileSync(new URL("../src/app/ckb-v2-tokens.css", import.meta.url), "utf8");

function cssBlock(stylesheet: string, marker: string) {
  const start = stylesheet.indexOf(marker);
  expect(start, `${marker} block is missing`).toBeGreaterThan(-1);
  const end = stylesheet.indexOf("\n}", start);
  expect(end, `${marker} block is unterminated`).toBeGreaterThan(start);
  return stylesheet.slice(start, end);
}

function runBootstrap(prefersDark: boolean) {
  const classes = new Set(["ckb-v2"]);
  const themeColour = { content: "" };
  const run = new Function("localStorage", "window", "document", THEME_BOOTSTRAP_SCRIPT);

  run(
    { getItem: () => null },
    { matchMedia: () => ({ matches: prefersDark }) },
    {
      cookie: "",
      documentElement: {
        classList: {
          toggle(name: string, force: boolean) {
            if (force) classes.add(name);
            else classes.delete(name);
          },
        },
      },
      querySelectorAll: () => [
        {
          setAttribute(name: string, value: string) {
            if (name === "content") themeColour.content = value;
          },
        },
      ],
    },
  );

  return { classes, themeColour: themeColour.content };
}

describe("global v2 activation", () => {
  it("mounts one literal ckb-v2 class on the server root", () => {
    const htmlTag = layout.match(/<html\b[\s\S]*?>/)?.[0];
    expect(htmlTag, "RootLayout does not render an html element").toBeTruthy();
    expect(htmlTag).toMatch(/className=\{`[^`]*\bckb-v2\b[^`]*`\}/);
    expect(htmlTag?.match(/\bckb-v2\b/g)).toHaveLength(1);
    expect(layout.match(/\bckb-v2\b/g)).toHaveLength(1);
    expect(htmlTag).not.toMatch(/\$\{[^}]*ckb-v2[^}]*\}/);
  });

  it.each([
    { prefersDark: false, expectedClasses: ["ckb-v2"], expectedColour: APP_THEME_COLORS.light },
    { prefersDark: true, expectedClasses: ["ckb-v2", "dark"], expectedColour: APP_THEME_COLORS.dark },
  ])(
    "retains ckb-v2 through the $prefersDark first-paint branch",
    ({ prefersDark, expectedClasses, expectedColour }) => {
      const result = runBootstrap(prefersDark);
      expect([...result.classes]).toEqual(expectedClasses);
      expect(result.themeColour).toBe(expectedColour);
    },
  );

  it("keeps v2 dark and forced-colour scopes available at the root", () => {
    expect(v2).toMatch(/\.dark \.ckb-v2\.ckb-v2,\s*\n\.ckb-v2\.dark\.ckb-v2\s*\{/);
    const forcedColours = sourceFrom(v2, "@media (forced-colors: active)", {
      label: "v2 @media (forced-colors: active)",
    });
    expect(forcedColours).toContain(".ckb-v2.ckb-v2,");
    expect(forcedColours).toContain(".dark .ckb-v2.ckb-v2,");
    expect(forcedColours).toContain(".ckb-v2.dark.ckb-v2");
    expect(forcedColours).toContain("--background: Canvas;");
  });

  it("keeps compatibility tokens in :root instead of promoting v2 values", () => {
    const compatibilityRoot = cssBlock(globals, "\n:root {");
    expect(compatibilityRoot).toContain("--background: #f1f4f8;");
    expect(compatibilityRoot).toContain("--command: #111827;");
    expect(compatibilityRoot).not.toContain("--background: #ffffff;");
    expect(compatibilityRoot).not.toContain("--command: #1a66a8;");
    expect(v2).not.toMatch(/^:root\s*\{/m);
  });
});
