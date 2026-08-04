import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  analyzeCkbV2ClassUsage,
  buildAdoptionManifest,
  checkAdoptionManifest,
  checkGeneratedAdoptionDocuments,
  deriveSurfaceV2Observation,
  productionPageRoutes,
  reachableSourceFiles,
  validateAdoptionArtifactPath,
} from "../scripts/generate-design-system-adoption.mjs";

const root = path.resolve(__dirname, "..");

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function writeFixtureFile(fixtureRoot: string, relativePath: string, content: string | Buffer = "fixture\n") {
  const absolutePath = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, content);
}

function createCheckerFixture() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "design-system-adoption-check-"));
  writeFixtureFile(
    fixtureRoot,
    "docs/design-system/adoption-contract.json",
    read("docs/design-system/adoption-contract.json"),
  );
  writeFixtureFile(fixtureRoot, ".design-sync/config.json", read(".design-sync/config.json"));
  return fixtureRoot;
}

describe("design-system adoption manifest", () => {
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
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
      name: "literal token beside a theme interpolation",
      source:
        "export function Root({ theme }: { theme: string }) { return <main className={`page ckb-v2 ${theme}`} />; }",
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

  it("scopes the global observation to the declared html element", () => {
    const source =
      `const nested = { className: "ckb-v2" }; ` +
      `export function Root() { return <html className="page"><body className="ckb-v2" {...nested} /></html>; }`;
    expect(analyzeCkbV2ClassUsage("src/app/layout.tsx", source, { elementName: "html" })).toEqual({
      literalCkbV2: false,
      dynamicCkbV2: false,
    });
  });

  it.each([
    {
      name: "inline literal spread",
      source: `export function Root() { return <html {...{ className: "ckb-v2" }} />; }`,
      expected: { literalCkbV2: true, dynamicCkbV2: false },
    },
    {
      name: "bound literal spread",
      source: `const props = { className: "ckb-v2" }; export function Root() { return <html {...props} />; }`,
      expected: { literalCkbV2: true, dynamicCkbV2: false },
    },
    {
      name: "dynamic spread",
      source:
        `const props = { className: ["ckb", "v2"].join("-") }; ` +
        `export function Root() { return <html {...props} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: true },
    },
    {
      name: "unresolved spread",
      source: `export function Root(props: object) { return <html {...props} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: true },
    },
    {
      name: "safe object spread",
      source: `const props = { lang: "en" }; export function Root() { return <html {...props} />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: false },
    },
    {
      name: "body-only spread",
      source: `export function Root() { return <html><body {...{ className: "ckb-v2" }} /></html>; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: false },
    },
    {
      name: "wrong element literal",
      source: `export function Root() { return <section className="ckb-v2" />; }`,
      expected: { literalCkbV2: false, dynamicCkbV2: false },
    },
  ])("classifies global html $name", ({ source, expected }) => {
    expect(analyzeCkbV2ClassUsage("src/app/layout.tsx", source, { elementName: "html" })).toEqual(expected);
  });

  it("distinguishes direct literal mounts from global-root inheritance", () => {
    const globalShell = { file: "src/app/layout.tsx", literalCkbV2: true };
    expect(
      deriveSurfaceV2Observation({
        globalShell,
        roots: [
          { file: "src/app/first/page.tsx", literalCkbV2: false },
          { file: "src/components/direct.tsx", literalCkbV2: true },
        ],
      }),
    ).toEqual({
      observedShellState: "v2",
      v2ShellMounted: true,
      v2MountMode: "inherited-global-root",
      inheritedFrom: "src/app/layout.tsx",
      directV2MountFiles: ["src/components/direct.tsx"],
    });

    expect(
      deriveSurfaceV2Observation({
        globalShell: { file: "src/app/layout.tsx", literalCkbV2: false },
        roots: [{ file: "src/components/direct.tsx", literalCkbV2: true }],
      }),
    ).toMatchObject({
      observedShellState: "v2",
      v2MountMode: "direct-literal",
      inheritedFrom: null,
    });
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
          declaredShellState: "v2",
          proof: incompleteProof,
        },
      ],
    };

    expect(checkAdoptionManifest(manifest)).toContain("fixture-v2 surface proof is missing browser");
  });

  it("requires passed evidence and a committed existing baseline for declared v2", () => {
    const current = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    const declaredV2 = {
      ...current.surfaces[0],
      id: "fixture-v2",
      declaredShellState: "v2",
      proof: {
        ...current.surfaces[0].proof,
        dark: { status: "passed", evidence: [] },
      },
      baseline: { status: "not-committed", files: [] },
    };
    const failures = checkAdoptionManifest({ ...current, surfaces: [declaredV2] });

    expect(failures).toContain("fixture-v2 dark proof is passed without evidence");
    expect(failures).toContain("fixture-v2 v2 adoption requires passed browser proof");
    expect(failures).toContain("fixture-v2 v2 adoption requires a committed visual baseline");
  });

  it("allows the documented non-visual redirect to declare v2 without fabricated visual proof", () => {
    const current = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    const fixtureRoot = createCheckerFixture();
    try {
      writeFixtureFile(fixtureRoot, "tests/proof.test.ts");
      writeFixtureFile(fixtureRoot, "tests/__screenshots__/linux/surface.png", pngSignature);
      const proof = Object.fromEntries(
        current.requiredProofCategories.map((category: string) => [
          category,
          { status: "passed", evidence: ["tests/proof.test.ts"] },
        ]),
      );
      const promoted = {
        ...current,
        surfaces: current.surfaces.map((surface: { proofApplicability: string }) =>
          surface.proofApplicability === "not-applicable"
            ? { ...surface, declaredShellState: "v2" }
            : {
                ...surface,
                declaredShellState: "v2",
                proof,
                baseline: {
                  status: "committed",
                  files: ["tests/__screenshots__/linux/surface.png"],
                },
              },
        ),
      };
      const failures = checkAdoptionManifest(promoted, {
        root: fixtureRoot,
        trackedFiles: new Set(["tests/proof.test.ts", "tests/__screenshots__/linux/surface.png"]),
      });

      expect(failures).toEqual([]);
    } finally {
      fs.rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });

  it("rejects not-applicable proof on a visual surface", () => {
    const current = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    const surface = {
      ...current.surfaces.find((candidate: { disposition: string }) => candidate.disposition === "owned"),
      proofApplicability: "not-applicable",
      proof: Object.fromEntries(
        current.requiredProofCategories.map((category: string) => [
          category,
          { status: "not-applicable", evidence: [] },
        ]),
      ),
      baseline: { status: "not-applicable", files: [] },
    };
    const failures = checkAdoptionManifest({ ...current, surfaces: [surface] });

    expect(failures).toContain(`${surface.id} proof applicability drifted from its owned disposition`);
    expect(failures).toContain(`${surface.id} may omit visual proof only as a documented rootless legacy redirect`);
  });

  it("requires classified tracked regular files for proof and Linux visual baselines", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "design-system-adoption-artifacts-"));
    try {
      writeFixtureFile(fixtureRoot, "AGENTS.md");
      writeFixtureFile(fixtureRoot, "tests/proof.test.ts");
      writeFixtureFile(fixtureRoot, "tests/README.md");
      writeFixtureFile(fixtureRoot, "tests/untracked.test.ts");
      writeFixtureFile(fixtureRoot, "tests/__screenshots__/linux/surface.png", pngSignature);
      writeFixtureFile(fixtureRoot, "tests/__screenshots__/linux/not-a-png.png");
      writeFixtureFile(fixtureRoot, "public/arbitrary.png");
      const trackedFiles = new Set([
        "AGENTS.md",
        "tests/proof.test.ts",
        "tests/README.md",
        "tests/__screenshots__/linux/surface.png",
        "tests/__screenshots__/linux/not-a-png.png",
        "public/arbitrary.png",
      ]);

      expect(
        validateAdoptionArtifactPath("tests/proof.test.ts", { root: fixtureRoot, trackedFiles, kind: "proof" }),
      ).toEqual([]);
      expect(
        validateAdoptionArtifactPath("tests/__screenshots__/linux/surface.png", {
          root: fixtureRoot,
          trackedFiles,
          kind: "visual-baseline",
        }),
      ).toEqual([]);
      expect(validateAdoptionArtifactPath(".", { root: fixtureRoot, trackedFiles, kind: "proof" })).toContain(
        "must reference an existing regular file",
      );
      expect(
        validateAdoptionArtifactPath("../outside.md", { root: fixtureRoot, trackedFiles, kind: "proof" }),
      ).toContain("must stay within the repository root");
      expect(validateAdoptionArtifactPath("AGENTS.md", { root: fixtureRoot, trackedFiles, kind: "proof" })).toContain(
        "must be a test/spec or a design-system evidence document",
      );
      expect(
        validateAdoptionArtifactPath("tests/README.md", { root: fixtureRoot, trackedFiles, kind: "proof" }),
      ).toContain("must be a test/spec or a design-system evidence document");
      expect(
        validateAdoptionArtifactPath("tests/untracked.test.ts", { root: fixtureRoot, trackedFiles, kind: "proof" }),
      ).toContain("must reference a Git-tracked file");
      expect(
        validateAdoptionArtifactPath("tests/missing.test.ts", {
          root: fixtureRoot,
          trackedFiles: new Set(["tests/missing.test.ts"]),
          kind: "proof",
        }),
      ).toContain("must reference an existing regular file");
      expect(
        validateAdoptionArtifactPath("public/arbitrary.png", {
          root: fixtureRoot,
          trackedFiles,
          kind: "visual-baseline",
        }),
      ).toContain("must be a Linux visual baseline under tests/__screenshots__/linux/");
      expect(
        validateAdoptionArtifactPath("tests/__screenshots__/linux/not-a-png.png", {
          root: fixtureRoot,
          trackedFiles,
          kind: "visual-baseline",
        }),
      ).toContain("must contain a PNG file signature");
    } finally {
      fs.rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });

  it("pins the global shell declaration even if a manifest and edited contract agree", () => {
    const current = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    const fixtureRoot = createCheckerFixture();
    try {
      const contract = JSON.parse(
        fs.readFileSync(path.join(fixtureRoot, "docs/design-system/adoption-contract.json"), "utf8"),
      );
      contract.globalShellRoot = { file: "src/app/not-the-root.tsx", element: "body" };
      fs.writeFileSync(
        path.join(fixtureRoot, "docs/design-system/adoption-contract.json"),
        `${JSON.stringify(contract, null, 2)}\n`,
      );
      const manifest = {
        ...current,
        globalShell: {
          ...current.globalShell,
          file: contract.globalShellRoot.file,
          element: contract.globalShellRoot.element,
        },
      };

      expect(checkAdoptionManifest(manifest, { root: fixtureRoot, trackedFiles: new Set() })).toContain(
        "globalShellRoot must remain src/app/layout.tsx / html",
      );
    } finally {
      fs.rmSync(fixtureRoot, { force: true, recursive: true });
    }
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

  it("derives component reachability from production entries rather than reference imports", () => {
    const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "design-system-reachability-"));
    try {
      writeFixtureFile(
        fixtureRoot,
        "src/app/page.tsx",
        `import { Mounted } from "@/components/mounted"; export default function Page() { return <Mounted />; }\n`,
      );
      writeFixtureFile(
        fixtureRoot,
        "src/components/mounted.tsx",
        `import { Leaf } from "./leaf"; export function Mounted() { return <Leaf />; }\n`,
      );
      writeFixtureFile(fixtureRoot, "src/components/leaf.tsx", `export function Leaf() { return null; }\n`);
      writeFixtureFile(
        fixtureRoot,
        "src/components/reference-only.tsx",
        `import { ReferenceLeaf } from "./reference-leaf"; export function ReferenceOnly() { return <ReferenceLeaf />; }\n`,
      );
      writeFixtureFile(
        fixtureRoot,
        "src/components/reference-leaf.tsx",
        `export function ReferenceLeaf() { return null; }\n`,
      );

      expect([...reachableSourceFiles(["src/app/page.tsx"], { root: fixtureRoot })].sort()).toEqual([
        "src/app/page.tsx",
        "src/components/leaf.tsx",
        "src/components/mounted.tsx",
      ]);
    } finally {
      fs.rmSync(fixtureRoot, { force: true, recursive: true });
    }
  });

  it("is deterministic and separates observed global v2 from the pending contract", () => {
    const manifest = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    expect(manifest).toEqual(buildAdoptionManifest({ root }));
    expect(manifest.schemaVersion).toBe(5);
    expect(manifest.globalShell).toMatchObject({
      file: "src/app/layout.tsx",
      element: "html",
      literalCkbV2: true,
      observedShellState: "v2",
    });
    expect(manifest.adoption.literalCkbV2RootCount).toBe(1);
    expect(manifest.adoption.v2MountedSurfaceCount).toBe(manifest.surfaces.length);
    expect(manifest.adoption.declaredV2SurfaceCount).toBe(0);
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
    for (const name of ["Button", "ConfirmDialog", "Quantity", "AnswerCard"]) {
      const component = manifest.components.find((candidate: { name: string }) => candidate.name === name);
      expect(component.productImportFiles, `${name} should remain reference-only`).toEqual([]);
      expect(component.v2ShellMounted, `${name} should not claim a production v2 mount`).toBe(false);
    }
    expect(
      manifest.components.find((component: { name: string }) => component.name === "Button").directImportFiles,
    ).toContain("src/components/ui/confirm-dialog.tsx");
    expect(
      manifest.components.find((component: { name: string }) => component.name === "Quantity").directImportFiles,
    ).toContain("src/components/ui/answer-card.tsx");
    expect(
      manifest.surfaces.every(
        (surface: { declaredShellState: string; observedShellState: string; v2MountMode: string }) =>
          surface.declaredShellState === "compatibility" &&
          surface.observedShellState === "v2" &&
          surface.v2MountMode === "inherited-global-root",
      ),
    ).toBe(true);
    expect(
      manifest.components.every(
        (component: { productImportFiles: string[]; v2ShellMounted: boolean; v2MountMode: string }) =>
          component.productImportFiles.length > 0
            ? component.v2ShellMounted && component.v2MountMode === "inherited-global-root"
            : !component.v2ShellMounted && component.v2MountMode === "none",
      ),
    ).toBe(true);
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

  it("keeps the real source/contract mismatch intentionally blocking", () => {
    const manifest = buildAdoptionManifest({ root });
    const failures = checkAdoptionManifest(manifest, { root });
    expect(failures).toEqual(
      manifest.surfaces.map(
        (surface: { id: string }) =>
          `${surface.id} declares compatibility but observes v2 through global root src/app/layout.tsx`,
      ),
    );
  });

  it("keeps generated adoption sections synchronized with the manifest", () => {
    const manifest = JSON.parse(read("docs/design-system/adoption-manifest.json"));
    const componentsDocument = read("docs/design-system/COMPONENTS.md");
    const adoptionDocument = read("docs/design-system/ADOPTION.md");
    expect(checkGeneratedAdoptionDocuments(manifest, { componentsDocument, adoptionDocument })).toEqual([]);
    const expected = `Registered public components: ${manifest.summary.registeredComponentCount}`;
    expect(componentsDocument).toContain(expected);
    expect(adoptionDocument).toContain(expected);
    expect(componentsDocument).toMatch(/\|\s*Component\s*\|\s*Family\s*\|\s*Built\s*\|\s*Locally registered\s*\|/);
    expect(adoptionDocument).toMatch(/\|\s*Surface\s*\|\s*Disposition\s*\|\s*Routes\s*\|\s*Roots\s*\|/);

    expect(
      checkGeneratedAdoptionDocuments(manifest, {
        componentsDocument: componentsDocument.replace(
          /(<!-- adoption-manifest:maturity:start -->[\s\S]*?)`Button`/,
          "$1`BogusButton`",
        ),
        adoptionDocument,
      }),
    ).toContain("docs/design-system/COMPONENTS.md generated maturity section is out of date");
    expect(
      checkGeneratedAdoptionDocuments(manifest, {
        componentsDocument,
        adoptionDocument: adoptionDocument.replace(
          /(<!-- adoption-manifest:adoption:start -->[\s\S]*?)`root-shell-and-settings`/,
          "$1`bogus-surface`",
        ),
      }),
    ).toContain("docs/design-system/ADOPTION.md generated adoption section is out of date");
  });

  it("keeps the AnswerCard and AccessibleTable gate prose aligned with landed contracts", () => {
    const components = read("docs/design-system/COMPONENTS.md");
    const gates = read("docs/design-system/GATES.md");
    expect(components).toMatch(
      /Required\s+verification\/state props, structured actions and the fifth `ungrounded` state are implemented/,
    );
    expect(components).toMatch(/missing cells already render `MissingValue`, never a bare dash/);
    expect(components).not.toContain("Missing clinical data renders as a bare dash (`AccessibleTable` today)");
    expect(components).not.toContain("`AccessibleTable`'s bare-dash cells are adoption work");
    expect(components).toMatch(/already composed inside `AnswerFooter`, `DateDisplay`, and\s+`AccessibleTable`/);
    expect(gates).toMatch(/Render `AnswerCard` without[\s\S]*implemented-blocking in `AnswerCard`/);
    expect(gates).toMatch(/Use a bare dash[\s\S]*implemented-partial — `AccessibleTable` composes `MissingValue`/);
  });
});
