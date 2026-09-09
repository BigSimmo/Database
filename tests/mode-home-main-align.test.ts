import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = resolve(process.cwd(), "src");

function walkTsxFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      walkTsxFiles(fullPath, out);
      continue;
    }
    if (fullPath.endsWith(".tsx")) out.push(fullPath);
  }
  return out;
}

describe("ModeHomeMain alignment contract", () => {
  const modeHomeSource = readFileSync(resolve(SRC_ROOT, "components/mode-home-template.tsx"), "utf8");
  const differentialsPageSource = readFileSync(
    resolve(SRC_ROOT, "components/differentials/differentials-home-page.tsx"),
    "utf8",
  );

  it("owns exclusive justify alignment via contentAlign (cn cannot merge Tailwind)", () => {
    expect(modeHomeSource).toMatch(/export type ModeHomeMainAlign/);
    expect(modeHomeSource).toMatch(/MODE_HOME_MAIN_ALIGN_CLASS/);
    expect(modeHomeSource).toMatch(/withoutJustifyUtilities/);
    // `\s*` (not a literal space) tolerates Prettier moving a long value onto
    // its own line — this only asserts the value itself starts with the
    // right justify-* utility, not source-line adjacency to the key.
    expect(modeHomeSource).toMatch(/center:\s*"justify-center/);
    expect(modeHomeSource).toMatch(/start: "justify-start/);
    expect(modeHomeSource).toMatch(/startOnPhone: "justify-start/);
    // Must strip responsive/prefixed justify utilities, not only bare ones.
    expect(modeHomeSource).toContain("(?:[\\w-]+:)*justify-");
    // Alignment must win over consumer className — apply align map last.
    expect(modeHomeSource).toMatch(
      /withoutJustifyUtilities\(className\),\s*MODE_HOME_MAIN_ALIGN_CLASS\[contentAlign\]/,
    );
  });

  it("strips bare and prefixed justify utilities from className", () => {
    // Mirror withoutJustifyUtilities — keep in sync with mode-home-template.tsx.
    const strip = (className: string) =>
      className
        .replace(/(?:^|\s)(?:[\w-]+:)*justify-(?:normal|start|end|center|between|around|evenly|stretch)(?=\s|$)/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    expect(strip("px-4 justify-center sm:px-6")).toBe("px-4 sm:px-6");
    expect(strip("sm:justify-center max-sm:justify-start gap-2")).toBe("gap-2");
    expect(strip("lg:justify-between justify-end")).toBe("");
  });

  it("top-aligns differentials search results; empty search redirects home", () => {
    expect(differentialsPageSource).toContain('contentAlign="start"');
    expect(differentialsPageSource).not.toMatch(/showingResults = autoRunSearch/);
    expect(differentialsPageSource).not.toMatch(/contentAlign=\{showingResults \? "start" : "center"\}/);
  });

  it("forbids ModeHomeMain className justify-* overrides across src/", () => {
    // Regression: 39d14a51 made ModeHomeMain a flex-1 justify-center shell.
    // Call-site className="justify-start …" looked like a fix but cn() leaves
    // both utilities in the class string, so CSS source order decides — flaky.
    const offenders: string[] = [];
    for (const filePath of walkTsxFiles(SRC_ROOT)) {
      const source = readFileSync(filePath, "utf8");
      if (!source.includes("ModeHomeMain")) continue;
      const matches = source.matchAll(/<ModeHomeMain\b([\s\S]*?)>/g);
      for (const match of matches) {
        const attrs = match[1] ?? "";
        if (/className=\{?["'`][^"'`]*justify-/.test(attrs) || /className=\{[^}]*justify-/.test(attrs)) {
          offenders.push(`${filePath.replace(`${process.cwd()}/`, "")}: ModeHomeMain className contains justify-*`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
