import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Playwright production-project isolation", () => {
  it("excludes advisory mockup cases from every required browser project", () => {
    const source = readFileSync(resolve(process.cwd(), "playwright.config.ts"), "utf8");

    for (const project of ["chromium", "firefox", "webkit"]) {
      expect(source).toMatch(
        new RegExp(`name: ["']${project}["'],\\s+testMatch: productionSpecPattern,\\s+grepInvert: mockupTag,`, "m"),
      );
    }

    expect(source).toMatch(/name: ["']chromium-mockups["'],\s+testMatch: mockupSpecPattern,\s+grep: mockupTag,/m);
  });
});
