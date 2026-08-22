import { describe, expect, it } from "vitest";

import { appModeDefinitions } from "@/lib/app-modes";
import {
  buildDocumentationSection,
  buildRoutesSection,
  type SiteMapInput,
} from "../scripts/generate-repo-awareness-snapshot";

const SITE_MAP: SiteMapInput = {
  pageRoutes: [
    { route: "/dsm", file: "src/app/(search-app)/dsm/page.tsx" },
    { route: "/mockups/development", file: "src/app/mockups/development/page.tsx" },
    { route: "/tools", file: "src/app/tools/page.tsx" },
  ],
  apiRoutes: [{ route: "/api/answer", file: "src/app/api/answer/route.ts" }],
  redirects: [{ route: "/tools", file: "src/app/tools/page.tsx", target: "/" }],
};

describe("buildRoutesSection", () => {
  it("separates product pages from mockup pages", () => {
    const section = buildRoutesSection(SITE_MAP);
    expect(section.pages).toEqual([
      { path: "/dsm", file: "src/app/(search-app)/dsm/page.tsx", area: "product" },
      { path: "/mockups/development", file: "src/app/mockups/development/page.tsx", area: "mockup" },
    ]);
  });

  it("moves a redirect out of pages so it is listed once, under redirects", () => {
    const section = buildRoutesSection(SITE_MAP);
    expect(section.pages.map((page) => page.path)).not.toContain("/tools");
    expect(section.redirects).toEqual([{ path: "/tools", file: "src/app/tools/page.tsx", target: "/" }]);
  });

  it("carries every app mode with a home href", () => {
    const section = buildRoutesSection(SITE_MAP);
    expect(section.modes).toHaveLength(appModeDefinitions.length);
    for (const mode of section.modes) {
      expect(mode.home).toMatch(/^\//);
      expect(mode.label.length).toBeGreaterThan(0);
      expect(typeof mode.dev_only).toBe("boolean");
    }
  });

  it("computes counts from the arrays it emits, so a count cannot disagree with its list", () => {
    const section = buildRoutesSection(SITE_MAP);
    expect(section.counts).toEqual({
      modes: section.modes.length,
      pages: 2,
      product_pages: 1,
      mockup_pages: 1,
      redirects: 1,
      api: 1,
    });
  });

  it("sorts every array by path so filesystem ordering cannot make the gate fire", () => {
    const shuffled: SiteMapInput = {
      ...SITE_MAP,
      pageRoutes: [...SITE_MAP.pageRoutes].reverse(),
      apiRoutes: [{ route: "/api/zeta", file: "z.ts" }, ...SITE_MAP.apiRoutes],
    };
    const section = buildRoutesSection(shuffled);
    expect(section.pages.map((page) => page.path)).toEqual(["/dsm", "/mockups/development"]);
    expect(section.api.map((route) => route.path)).toEqual(["/api/answer", "/api/zeta"]);
  });
});

const README = `
# Clinical KB Documentation Index

- [testing.md](testing.md) — how tests run
- [design-system/SPEC.md](design-system/SPEC.md) — the design system
- [an external link](https://example.com/testing.md) — not a repo doc
Referenced in prose as \`docs/rag-behaviour/README.md\` too.
`;

const DOC_PATHS = [
  "docs/testing.md",
  "docs/design-system/SPEC.md",
  "docs/design-system/GATES.md",
  "docs/rag-behaviour/README.md",
  "docs/uncatalogued.md",
];

describe("buildDocumentationSection", () => {
  it("marks a document catalogued when README links it relative to docs/", () => {
    const section = buildDocumentationSection(DOC_PATHS, README);
    const byPath = new Map(section.documents.map((document) => [document.path, document]));
    expect(byPath.get("docs/testing.md")?.catalogued).toBe(true);
    expect(byPath.get("docs/design-system/SPEC.md")?.catalogued).toBe(true);
  });

  it("marks a document catalogued when README names its full repo path in prose", () => {
    const section = buildDocumentationSection(DOC_PATHS, README);
    expect(section.documents.find((document) => document.path === "docs/rag-behaviour/README.md")?.catalogued).toBe(
      true,
    );
  });

  it("marks a document uncatalogued when README never names it", () => {
    const section = buildDocumentationSection(DOC_PATHS, README);
    expect(section.documents.find((document) => document.path === "docs/uncatalogued.md")?.catalogued).toBe(false);
    expect(section.documents.find((document) => document.path === "docs/design-system/GATES.md")?.catalogued).toBe(
      false,
    );
  });

  it("is not fooled by a repository URL that contains a doc path", () => {
    // Removing the URL strip in `catalogueTargets` makes this red: the bare
    // regex would match `docs/only-external.md` inside the blob URL and mark a
    // document catalogued that the index never lists.
    const readme = "See the source at https://github.com/BigSimmo/Database/blob/main/docs/only-external.md for detail.";
    const section = buildDocumentationSection(["docs/only-external.md"], readme);
    expect(section.documents[0].catalogued).toBe(false);
    expect(section.counts.uncatalogued).toBe(1);
  });

  it("still catalogues a document named in ordinary prose", () => {
    // The guard against URLs must not cost us the real prose case, which is the
    // reason the second scan exists at all.
    const section = buildDocumentationSection(["docs/testing.md"], "Read `docs/testing.md` before changing a test.");
    expect(section.documents[0].catalogued).toBe(true);
  });

  it("assigns a section from the first directory under docs/, or root", () => {
    const section = buildDocumentationSection(DOC_PATHS, README);
    const sections = new Map(section.documents.map((document) => [document.path, document.section]));
    expect(sections.get("docs/testing.md")).toBe("root");
    expect(sections.get("docs/design-system/SPEC.md")).toBe("design-system");
  });

  it("summarises each section and computes counts from its own arrays", () => {
    const section = buildDocumentationSection(DOC_PATHS, README);
    expect(section.sections).toEqual([
      { name: "design-system", documents: 2, uncatalogued: 1 },
      { name: "rag-behaviour", documents: 1, uncatalogued: 0 },
      { name: "root", documents: 2, uncatalogued: 1 },
    ]);
    expect(section.counts).toEqual({ documents: 5, catalogued: 3, uncatalogued: 2, sections: 3 });
  });

  it("sorts documents by path so listing order cannot make the gate fire", () => {
    const section = buildDocumentationSection([...DOC_PATHS].reverse(), README);
    expect(section.documents.map((document) => document.path)).toEqual([...DOC_PATHS].sort());
  });
});
