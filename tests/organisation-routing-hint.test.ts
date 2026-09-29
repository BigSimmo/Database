import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { PLANNER_SCRIPT, routingHint } from "../scripts/organisation/routing-hint.mjs";

const REPO = path.resolve(__dirname, "..");

/** The comma-separated value the hint passes to --files, with any shell quoting removed. */
function filesArgument(hint: string) {
  const match = hint.match(/--files ("(?:[^"\\]|\\.)*"|\S+)/);
  if (!match) return null;
  const raw = match[1];
  return raw.startsWith('"') ? raw.slice(1, -1).replace(/\\(["$`])/g, "$1") : raw;
}

describe("routing hint wording", () => {
  it("points at the planner for the given paths on one line", () => {
    const hint = routingHint(["src/lib/chunking.ts", "docs/testing.md"]);
    expect(hint).not.toContain("\n");
    expect(hint).toContain(`npm run ${PLANNER_SCRIPT} -- --files docs/testing.md,src/lib/chunking.ts`);
    expect(hint).toMatch(/^Before editing, plan the checks for these paths: /);
  });

  it("normalises, de-duplicates and sorts the paths", () => {
    const hint = routingHint(["./src\\lib\\chunking.ts", "src/lib/chunking.ts", " docs/a.md "]);
    expect(filesArgument(hint)).toBe("docs/a.md,src/lib/chunking.ts");
    expect(hint).toContain("for these paths");
  });

  it("quotes paths a shell would otherwise read, such as route groups and dynamic segments", () => {
    const file = "src/app/(search-app)/documents/[id]/page.tsx";
    const hint = routingHint([file]);
    expect(hint).toContain(`--files "${file}"`);
    expect(hint).toContain("for this path");
    expect(filesArgument(hint)).toBe(file);
  });

  it("leaves out a path the comma-separated planner cannot take, and falls back to the current change", () => {
    expect(filesArgument(routingHint(["docs/a,b.md", "docs/c.md"]))).toBe("docs/c.md");
    expect(routingHint(["docs/a,b.md"])).toBe(routingHint([]));
    expect(routingHint([])).toContain(`npm run ${PLANNER_SCRIPT} (`);
    expect(filesArgument(routingHint([]))).toBeNull();
  });
});

describe("routing hint target", () => {
  it("names a real npm script that runs the offline flightplan planner", () => {
    const scripts = JSON.parse(fs.readFileSync(path.join(REPO, "package.json"), "utf8")).scripts;
    expect(scripts[PLANNER_SCRIPT]).toBe("node scripts/productivity-workflow.mjs flightplan");
  });

  it("gives the planner the exact paths, which it plans for without touching any provider", () => {
    const files = ["src/lib/chunking.ts", "src/app/(search-app)/page.tsx"];
    const value = filesArgument(routingHint(files));
    expect(value).not.toBeNull();
    const result = spawnSync(
      process.execPath,
      ["scripts/productivity-workflow.mjs", "flightplan", "--files", value as string, "--json"],
      { cwd: REPO, encoding: "utf8" },
    );
    expect(result.status, result.stderr).toBe(0);
    const plan = JSON.parse(result.stdout);
    expect(plan.workflow).toBe("flightplan");
    expect([...plan.files].sort()).toEqual([...files].sort());
    expect(plan.risks.retrieval).toBe(true);
  });
});
