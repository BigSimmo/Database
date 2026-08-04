import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyzeCkbV2ClassUsage,
  checkAdoptionManifest,
  productionPageRoutes,
} from "../scripts/generate-design-system-adoption.mjs";

const root = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

describe("design-system adoption manifest", () => {
  it.each([
    {
      name: "literal class",
      source: `export function Root() { return <main className="ckb-v2 page" />; }`,
      expected: { literalCkbV2: true, dynamicCkbV2: false },
    },
    {
      name: "literal class helper argument",
      source: `export function Root() { return <main className={cn("page", "ckb-v2")} />; }`,
      expected: { literalCkbV2: true, dynamicCkbV2: false },
    },
    {
      name: "array join",
      source: `export function Root() { return <main className={["ckb", "v2"].join("-")} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: true },
    },
    {
      name: "concatenated version",
      source: `export function Root({ version }: { version: string }) { return <main className={"ckb-" + version} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: true },
    },
    {
      name: "class helper concatenation",
      source: `export function Root({ version }: { version: string }) { return <main className={cn("page", "ckb-" + version)} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: true },
    },
    {
      name: "bound array join",
      source: `const shell = ["ckb", "v2"].join("-"); export function Root() { return <main className={clsx("page", shell)} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: true },
    },
    {
      name: "string replace",
      source: `export function Root() { return <main className={"ckb_v2".replace("_", "-")} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: true },
    },
    {
      name: "filtered array join",
      source: `export function Root() { return <main className={["ckb-v2"].filter(Boolean).join(" ")} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: true },
    },
    {
      name: "unresolved call with static token evidence",
      source: `export function Root() { return <main className={normalise("ckb", "v2")} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: true },
    },
    {
      name: "sibling function shadowing",
      source:
        `export function First({ version }: { version: string }) { const shell = "ckb-" + version; return <main className={shell} />; } ` +
        `export function Second() { const shell = "page"; return <main className={shell} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: true },
    },
    {
      name: "nested lexical shadowing",
      source:
        `export function Root({ version }: { version: string }) { const shell = "ckb-" + version; ` +
        `{ const shell = "page"; void shell; } return <main className={shell} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: true },
    },
    {
      name: "default parameter binding",
      source:
        `export function Root({ version }: { version: string }, shell = "ckb-" + version) { ` +
        `return <main className={shell} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: true },
    },
    {
      name: "parameter shadows outer binding",
      source: `const shell = "ckb-v2"; export function Root(shell: string) { return <main className={shell} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: false },
    },
    {
      name: "unrelated dynamic class",
      source:
        `export function Root({ state }: { state: string }) { return <main className={cn("page", ` +
        "`state-${state}`" +
        `)} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: false },
    },
  ])("classifies $name without regex gaps", ({ source, expected }) => {
    expect(analyzeCkbV2ClassUsage("src/components/fixture-root.tsx", source)).toEqual(expected);
  });

  it("fails the adoption contract when a declared root constructs ckb-v2", () => {
    const current = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    const manifest = {
      ...current,
      surfaces: [
        {
          id: "fixture",
          shellState: "compatibility",
          permittedComponentFamilies: [],
          roots: [
            {
              file: "src/components/fixture-root.tsx",
              exists: true,
              imports: [],
              importedFamilies: [],
              literalCkbV2: false,
              dynamicCkbV2: true,
            },
          ],
        },
      ],
    };

    expect(checkAdoptionManifest(manifest)).toContain(
      "fixture root dynamically constructs ckb-v2: src/components/fixture-root.tsx",
    );
  });

  it("fails closed when a production page route has no declared owner", () => {
    const current = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    const manifest = {
      ...current,
      routeCoverage: {
        ...current.routeCoverage,
        undeclared: ["src/app/unowned/page.tsx"],
      },
    };

    expect(checkAdoptionManifest(manifest)).toContain("production page route is undeclared: src/app/unowned/page.tsx");
  });

  it("requires documentation for non-owned route and shared-shell dispositions", () => {
    const current = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    const manifest = {
      ...current,
      surfaces: current.surfaces.map((surface: { id: string }) =>
        surface.id === "documents-source-legacy-redirect" ? { ...surface, documentedDisposition: null } : surface,
      ),
    };

    expect(checkAdoptionManifest(manifest)).toContain(
      "documents-source-legacy-redirect legacy-redirect disposition is undocumented",
    );
  });

  it("fails closed when a v2-adopted surface omits required proof", () => {
    const current = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    const { browser: _browser, ...incompleteProof } = current.surfaces[0].proof;
    const manifest = {
      ...current,
      surfaces: [
        {
          ...current.surfaces[0],
          id: "fixture-v2",
          shellState: "v2",
          proof: incompleteProof,
        },
      ],
    };

    expect(checkAdoptionManifest(manifest)).toContain("fixture-v2 surface proof is missing browser");
  });

  it("discovers production pages while excluding api and mockup trees", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "design-system-routes-"));
    try {
      for (const route of ["src/app/real/page.tsx", "src/app/api/debug/page.tsx", "src/app/mockups/demo/page.tsx"]) {
        const absolutePath = path.join(fixtureRoot, route);
        fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
        fs.writeFileSync(absolutePath, "export default function Page() { return null; }\n");
      }
      expect(productionPageRoutes(fixtureRoot)).toEqual(["src/app/real/page.tsx"]);
    } finally {
      fs.rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });

  it("is deterministic and records the compatibility-layer baseline", () => {
    execFileSync(process.execPath, ["scripts/generate-design-system-adoption.mjs", "--check"], {
      cwd: root,
      stdio: "pipe",
    });

    const manifest = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    expect(manifest.schemaVersion).toBe(3);
    expect(manifest.adoption.literalCkbV2RootCount).toBe(0);
    expect(
      manifest.components.every(
        (component: Record<string, unknown>) =>
          typeof component.built === "boolean" &&
          typeof component.locallyRegistered === "boolean" &&
          typeof component.v2ShellMounted === "boolean" &&
          typeof component.proofDeclared === "boolean" &&
          typeof component.baselineCommitted === "boolean",
      ),
    ).toBe(true);
    expect(manifest.surfaces.every((surface: { shellState: string }) => surface.shellState === "compatibility")).toBe(
      true,
    );
    expect(
      manifest.surfaces.every(
        (surface: { proof: Record<string, unknown>; baseline: { status: string } }) =>
          Object.keys(surface.proof).sort().join("|") === "browser|compact320|dark|forcedColours|print" &&
          ["not-committed", "not-applicable"].includes(surface.baseline.status),
      ),
    ).toBe(true);
    expect(manifest.routeCoverage.discovered).toHaveLength(47);
    expect(manifest.routeCoverage.declared).toEqual(manifest.routeCoverage.discovered);
    expect(manifest.routeCoverage.undeclared).toEqual([]);
    expect(manifest.routeCoverage.missing).toEqual([]);
    expect(manifest.routeCoverage.duplicates).toEqual([]);
  });

  it("keeps generated adoption sections synchronized with the manifest", () => {
    const manifest = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    const expected = `Registered public components: ${manifest.summary.registeredComponentCount}`;
    expect(read("docs/design-system/COMPONENTS.md")).toContain(expected);
    expect(read("docs/design-system/ADOPTION.md")).toContain(expected);
    expect(read("docs/design-system/COMPONENTS.md")).toMatch(
      /\|\s*Component\s*\|\s*Family\s*\|\s*Built\s*\|\s*Locally registered\s*\|/,
    );
    expect(read("docs/design-system/ADOPTION.md")).toMatch(
      /\|\s*Surface\s*\|\s*Disposition\s*\|\s*Routes\s*\|\s*Roots\s*\|/,
    );
  });

  it("keeps the AnswerCard and AccessibleTable gate prose aligned with landed contracts", () => {
    const components = read("docs/design-system/COMPONENTS.md");
    const gates = read("docs/design-system/GATES.md");
    expect(components).toMatch(
      /Required\s+verification\/state props, structured actions and the fifth `ungrounded` state are implemented/,
    );
    expect(components).toMatch(/missing cells already render `MissingValue`, never a bare dash/);
    expect(components).not.toContain("Missing clinical data renders as a bare dash (`AccessibleTable` today)");
    expect(gates).toMatch(/Render `AnswerCard` without[\s\S]*implemented-blocking in `AnswerCard`/);
    expect(gates).toMatch(/Use a bare dash[\s\S]*implemented-partial — `AccessibleTable` composes `MissingValue`/);
  });
});
