import { describe, expect, it } from "vitest";
import {
  auditDeletions,
  auditIndex,
  deletedRouteSlugs,
  inlineCodeSpans,
  listRouteSlugs,
  main,
  mentionedSlugs,
  moduleSpecifiersFor,
  parseArguments,
  readDeveloperGatedPrefixes,
  retiredSection,
  retiredSlugs,
  MOCKUP_ROUTE_ROOT,
  RETIRED_SECTION_HEADING,
} from "../scripts/check-mockup-retirement.mjs";

/**
 * A synthetic repository. Every case below is a real would-be deletion the 2026-09-02 survey
 * found, reduced to its smallest reproduction — see docs/mockup-retirement-policy.md.
 */
function fakeRepo(files: Record<string, string>, directories: Record<string, string[]>) {
  const normalize = (p: string) => p.replaceAll("\\", "/").replace(/^\/+/, "");
  return {
    readFileSync: (p: string) => {
      const key = normalize(p);
      const hit = Object.entries(files).find(([name]) => key.endsWith(name));
      if (!hit) throw new Error(`ENOENT: ${key}`);
      return hit[1];
    },
    readdirSync: (p: string) => {
      const key = normalize(p);
      const hit = Object.entries(directories).find(([name]) => key.endsWith(name));
      return (hit?.[1] ?? []).map((name) => ({ name, isDirectory: () => !name.includes(".") }));
    },
    existsSync: (p: string) => Object.keys(directories).some((name) => normalize(p).endsWith(name)),
  } as never;
}

const GATE_SOURCE = `export const DEVELOPER_GATED_PATH_PREFIXES = [
  "/mockups/development",
  "/mockups/ward-flow",
] as const;`;

describe("mockup index parsing", () => {
  const markdown = [
    "# Project Mockups",
    "",
    "`example-study` — Active study.",
    "`document-search/source` — nested route rolls up.",
    "",
    RETIRED_SECTION_HEADING,
    "",
    "| Retired | Route | Superseded by | Evidence |",
    "| --- | --- | --- | --- |",
    "| 2026-09-02 | `document-navigation-pane` | `document-navigation-perfected` | Exact code match. |",
    "",
    "## Design tokens",
    "",
    "`some-other-token`",
  ].join("\n");

  it("unwraps inline code spans", () => {
    expect(inlineCodeSpans("a `b` and `c`")).toEqual(["b", "c"]);
  });

  it("stops the retired section at the next heading", () => {
    expect(retiredSection(markdown)).not.toContain("some-other-token");
    expect(retiredSection(markdown)).toContain("document-navigation-pane");
  });

  it("treats only the retired section as a retirement record", () => {
    expect(retiredSlugs(markdown).has("document-navigation-pane")).toBe(true);
    expect(retiredSlugs(markdown).has("example-study")).toBe(false);
  });

  /**
   * The "Superseded by" column names the LIVE winner. Reading every code span in the section
   * marked that winner retired — a real bug this check found against its own first record.
   */
  it("never reads the successor column as a retirement", () => {
    expect(retiredSlugs(markdown).has("document-navigation-perfected")).toBe(false);
  });

  it("rolls a nested route up to its top-level slug", () => {
    expect(mentionedSlugs(markdown).has("document-search")).toBe(true);
  });

  it("returns an empty record when the section is absent", () => {
    expect(retiredSlugs("# No section here").size).toBe(0);
  });
});

describe("index audit", () => {
  it("fails a route with no entry in the index", () => {
    const fs = fakeRepo(
      { "mockups/README.md": "# Project Mockups\n\n`indexed-route`\n" },
      {
        [MOCKUP_ROUTE_ROOT]: ["indexed-route", "undocumented-route"],
      },
    );
    const result = auditIndex("/repo", fs);
    expect(result.violations.join()).toContain("/mockups/undocumented-route has no entry");
    expect(result.violations.join()).not.toContain("indexed-route has no entry");
  });

  it("fails a route recorded as retired that still exists on disk", () => {
    const fs = fakeRepo(
      {
        "mockups/README.md": `# M\n\n${RETIRED_SECTION_HEADING}\n\n| Retired | Route | Superseded by | Evidence |\n| --- | --- | --- | --- |\n| 2026-09-02 | \`still-here\` | \`winner\` | Evidence. |\n`,
      },
      { [MOCKUP_ROUTE_ROOT]: ["still-here"] },
    );
    expect(auditIndex("/repo", fs).violations.join()).toContain("still exists on disk");
  });

  it("ignores the shared shell files, which are not routes", () => {
    const fs = fakeRepo(
      { "mockups/README.md": "# M\n" },
      {
        [MOCKUP_ROUTE_ROOT]: ["layout.tsx", "mockups.css", "mockups-layout-client.tsx"],
      },
    );
    expect(auditIndex("/repo", fs).violations).toHaveLength(0);
  });

  it("fails closed when the index cannot be read", () => {
    const fs = fakeRepo({}, { [MOCKUP_ROUTE_ROOT]: ["a-route"] });
    expect(auditIndex("/repo", fs).violations.join()).toContain("unreadable");
  });
});

describe("module specifiers", () => {
  it("builds the @/ alias a survivor would import by", () => {
    expect(moduleSpecifiersFor("src/components/example-study-mockups.tsx")).toContain(
      "@/components/example-study-mockups",
    );
  });

  it("also matches a barrel imported without its /index", () => {
    expect(moduleSpecifiersFor("src/components/tools-page-mockups/index.ts")).toContain(
      "@/components/tools-page-mockups",
    );
  });

  it("never matches on a bare page or index basename", () => {
    expect(moduleSpecifiersFor("src/app/mockups/foo/page.tsx")).not.toContain("page");
    expect(moduleSpecifiersFor("src/components/bar/index.ts")).not.toContain("index");
  });
});

describe("deleted route slugs", () => {
  it("reports a route whose last page is removed", () => {
    expect(deletedRouteSlugs([`${MOCKUP_ROUTE_ROOT}/gone/page.tsx`], ["stays"])).toEqual(["gone"]);
  });

  it("stays quiet when a sibling page under the same route survives", () => {
    expect(deletedRouteSlugs([`${MOCKUP_ROUTE_ROOT}/stays/nested/page.tsx`], ["stays"])).toEqual([]);
  });
});

describe("deletion audit", () => {
  const index = `# M\n\n${RETIRED_SECTION_HEADING}\n\n| Retired | Route | Superseded by | Evidence |\n| --- | --- | --- | --- |\n| 2026-09-02 | \`retired-route\` | \`winner\` | Evidence. |\n`;

  function runAudit(deleted: string[], tracked: string[], sources: Record<string, string>, markdown = index) {
    const runGit = (args: string[]) => {
      if (args[0] === "diff") return deleted.join("\n");
      if (args[0] === "ls-files") return tracked.join("\n");
      throw new Error(`unexpected git ${args[0]}`);
    };
    const fs = fakeRepo(
      { "mockups/README.md": markdown, "src/lib/developer-area/headers.ts": GATE_SOURCE, ...sources },
      { [MOCKUP_ROUTE_ROOT]: ["winner"] },
    );
    return auditDeletions("origin/main", { root: "/repo", runGit, fileSystem: fs });
  }

  it("passes a recorded, unreferenced retirement", () => {
    const result = runAudit(
      [`${MOCKUP_ROUTE_ROOT}/retired-route/page.tsx`, "src/components/retired-route-mockups.tsx"],
      ["src/components/winner-mockups.tsx"],
      { "src/components/winner-mockups.tsx": "export const Winner = () => null;" },
    );
    expect(result.violations).toHaveLength(0);
  });

  it("refuses a deletion under a developer-gated prefix", () => {
    const result = runAudit([`${MOCKUP_ROUTE_ROOT}/ward-flow/handover/page.tsx`], [], {});
    expect(result.violations.join()).toContain("developer-gated prefix /mockups/ward-flow");
  });

  it("refuses a route deleted without a written record", () => {
    const result = runAudit([`${MOCKUP_ROUTE_ROOT}/unrecorded/page.tsx`], [], {});
    expect(result.violations.join()).toContain("not recorded under");
  });

  it("refuses a file a committed test still imports", () => {
    const result = runAudit(
      ["src/components/retired-route-mockups.tsx", `${MOCKUP_ROUTE_ROOT}/retired-route/page.tsx`],
      ["tests/retired-route.test.ts"],
      { "tests/retired-route.test.ts": 'import { X } from "@/components/retired-route-mockups";' },
    );
    expect(result.violations.join()).toContain("a committed test");
  });

  it("refuses a file repository tooling still names", () => {
    const result = runAudit(
      ["src/components/retired-route-mockups.tsx", `${MOCKUP_ROUTE_ROOT}/retired-route/page.tsx`],
      ["scripts/ci-change-scope.mjs"],
      { "scripts/ci-change-scope.mjs": 'const f = "@/components/retired-route-mockups";' },
    );
    expect(result.violations.join()).toContain("repository tooling");
  });

  it("refuses a file a survivor still reads from disk by path", () => {
    const result = runAudit(
      ["src/components/retired-route-mockups.tsx", `${MOCKUP_ROUTE_ROOT}/retired-route/page.tsx`],
      ["tests/boundary.test.ts"],
      { "tests/boundary.test.ts": 'readFileSync("src/components/retired-route-mockups.tsx")' },
    );
    expect(result.violations.join()).toContain("still named as a path");
  });

  /**
   * The inversion that makes this repository dangerous: `example-round-two` imports
   * `example-round-one`, so deleting "the older generation" breaks the newer one.
   */
  it("refuses deleting a base module a newer generation still imports", () => {
    const result = runAudit(
      ["src/components/example-round-one-mockups.tsx"],
      ["src/components/example-round-two-mockups.tsx"],
      {
        "src/components/example-round-two-mockups.tsx":
          'import { Composer } from "@/components/example-round-one-mockups";',
      },
    );
    expect(result.violations.join()).toContain("a surviving module");
  });

  it("fails closed when a surviving file cannot be read", () => {
    const runGit = (args: string[]) => {
      if (args[0] === "diff") return "src/components/retired-route-mockups.tsx";
      if (args[0] === "ls-files") return "src/components/unreadable.tsx";
      throw new Error(`unexpected git ${args[0]}`);
    };
    const fs = fakeRepo(
      { "mockups/README.md": index, "src/lib/developer-area/headers.ts": GATE_SOURCE },
      { [MOCKUP_ROUTE_ROOT]: ["winner"] },
    );
    const result = auditDeletions("origin/main", { root: "/repo", runGit, fileSystem: fs });
    expect(result.violations.join()).toContain("unreadable");
  });

  it("refuses when the developer-gate list can no longer be read", () => {
    const runGit = (args: string[]) => (args[0] === "diff" ? "src/components/x-mockups.tsx" : "");
    const fs = fakeRepo({ "mockups/README.md": index }, { [MOCKUP_ROUTE_ROOT]: [] });
    expect(() => auditDeletions("origin/main", { root: "/repo", runGit, fileSystem: fs })).toThrow();
  });
});

describe("developer gate source", () => {
  it("reads the prefixes from their own source of truth", () => {
    const fs = fakeRepo({ "src/lib/developer-area/headers.ts": GATE_SOURCE }, {});
    expect(readDeveloperGatedPrefixes("/repo", fs)).toEqual(["/mockups/development", "/mockups/ward-flow"]);
  });

  it("throws rather than guessing when the declaration is gone", () => {
    const fs = fakeRepo({ "src/lib/developer-area/headers.ts": "export const OTHER = [];" }, {});
    expect(() => readDeveloperGatedPrefixes("/repo", fs)).toThrow(/no longer declares/);
  });
});

describe("cli", () => {
  it("accepts --diff with a base ref", () => {
    expect(parseArguments(["--diff", "origin/main"])).toMatchObject({ mode: "diff", base: "origin/main" });
  });

  it("rejects a bare --diff", () => {
    expect(() => parseArguments(["--diff"])).toThrow(/requires a base ref/);
  });

  it("rejects an unknown option", () => {
    expect(() => parseArguments(["--wat"])).toThrow(/unknown option/);
  });

  it("exits 2 on a bad invocation", () => {
    expect(main(["--wat"], { stdout: () => {}, stderr: () => {} })).toBe(2);
  });

  it("passes its own self-test", () => {
    expect(main(["--self-test"], { stdout: () => {}, stderr: () => {} })).toBe(0);
  });
});

describe("the committed repository", () => {
  it("indexes every mockup route it ships", () => {
    const result = auditIndex(process.cwd());
    expect(result.violations).toEqual([]);
    expect(result.routeCount).toBeGreaterThan(0);
  });

  it("still declares the developer-gated prefixes the policy depends on", () => {
    const prefixes = readDeveloperGatedPrefixes(process.cwd());
    expect(prefixes).toContain("/mockups/development");
    expect(prefixes).toContain("/mockups/care-plan");
    expect(prefixes).toContain("/mockups/caring-contacts");
    expect(prefixes).toContain("/mockups/ward-flow");
  });

  it("keeps the four developer-gated prototypes out of retirement scope", () => {
    const gated = readDeveloperGatedPrefixes(process.cwd()).map((p) => p.replace("/mockups/", ""));
    const slugs = listRouteSlugs(process.cwd());
    for (const prefix of gated) expect(slugs).toContain(prefix);
  });
});
