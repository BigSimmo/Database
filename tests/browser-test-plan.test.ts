import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  BROWSER_SPEC_PATTERN,
  browserTestPlan,
  isBrowserLanePath,
  isRenderingSource,
  isSharedFoundation,
  ownershipKeys,
  specsReferencing,
} from "../scripts/browser-test-plan.mjs";

const root = resolve(__dirname, "..");
const read = (relative: string) => readFileSync(resolve(root, relative), "utf8");

const SPECS = new Map([
  [
    "tests/ui-smoke.spec.ts",
    'const chip = page.getByTestId("answer-evidence-gaps-trigger"); await gotoApp(page, "/documents");',
  ],
  ["tests/ui-tools.spec.ts", 'page.getByTestId("tools-launcher");'],
  ["tests/ui-accessibility.spec.ts", "await checkA11y(page);"],
]);

function plan(
  files: string[],
  sources: Array<[string, string]>,
  scope: { ui_changed: boolean },
  mode?: "auto" | "full",
) {
  return browserTestPlan({ files, scope, specSources: SPECS, sourceSources: new Map(sources), mode });
}

/**
 * The planner narrows the most expensive gate in the repository, so what matters
 * is not that it narrows but that every path it cannot justify escalates instead.
 * These tests pin the escalations first and the narrowing second.
 */
describe("browser test plan", () => {
  describe("fails closed", () => {
    it("escalates a UI file no spec can be shown to exercise", () => {
      const result = plan(
        ["src/components/clinical-dashboard/mystery-panel.tsx"],
        [["src/components/clinical-dashboard/mystery-panel.tsx", "export function MysteryPanel() { return null; }"]],
        { ui_changed: true },
      );
      expect(result.level).toBe("full");
      expect(result.unattributed).toEqual(["src/components/clinical-dashboard/mystery-panel.tsx"]);
    });

    it("escalates a shared foundation even when it carries an attributable testid", () => {
      // globals.css changes what every spec renders. An attribution here would be
      // true and useless: the file's blast radius is not the journeys that happen
      // to name one of its selectors.
      const result = plan(
        ["src/app/globals.css"],
        [["src/app/globals.css", '[data-testid="answer-evidence-gaps-trigger"] { color: red; }']],
        { ui_changed: true },
      );
      expect(result.level).toBe("full");
      expect(result.foundation).toEqual(["src/app/globals.css"]);
    });

    it("escalates a browser-lane file it cannot classify at all", () => {
      const result = plan(["public/manifest.webmanifest"], [], { ui_changed: true });
      expect(result.level).toBe("full");
      expect(result.unclassifiedBrowserFiles).toEqual(["public/manifest.webmanifest"]);
    });

    it("escalates a mixed change when any one file is unattributable", () => {
      const result = plan(
        ["src/components/clinical-dashboard/answer-result-surface.tsx", "public/manifest.webmanifest"],
        [
          [
            "src/components/clinical-dashboard/answer-result-surface.tsx",
            '<button data-testid="answer-evidence-gaps-trigger" />',
          ],
        ],
        { ui_changed: true },
      );
      expect(result.level).toBe("full");
    });

    it("treats a deleted file as unattributable rather than dropping it", () => {
      // The CLI records a missing file as empty contents. Empty yields no keys, so
      // the file lands in `unattributed` and the plan escalates — a deletion must
      // never be the reason a plan narrowed.
      const result = plan(
        ["src/components/clinical-dashboard/removed.tsx"],
        [["src/components/clinical-dashboard/removed.tsx", ""]],
        { ui_changed: true },
      );
      expect(result.level).toBe("full");
    });

    it("honours an explicit full request over any narrowing", () => {
      const result = plan(
        ["src/components/clinical-dashboard/answer-result-surface.tsx"],
        [
          [
            "src/components/clinical-dashboard/answer-result-surface.tsx",
            '<button data-testid="answer-evidence-gaps-trigger" />',
          ],
        ],
        { ui_changed: true },
        "full",
      );
      expect(result.level).toBe("full");
    });
  });

  describe("narrows only on evidence", () => {
    it("selects the spec that names a testid the changed file renders", () => {
      const result = plan(
        ["src/components/clinical-dashboard/answer-result-surface.tsx"],
        [
          [
            "src/components/clinical-dashboard/answer-result-surface.tsx",
            '<button data-testid="answer-evidence-gaps-trigger" />',
          ],
        ],
        { ui_changed: true },
      );
      expect(result.level).toBe("focused");
      expect(result.specs).toEqual(["tests/ui-smoke.spec.ts"]);
      expect(result.stages).toHaveLength(1);
      expect(result.stages[0].command.args).toContain("tests/ui-smoke.spec.ts");
      expect(result.stages[0].command.args).not.toContain("tests/ui-tools.spec.ts");
    });

    it("selects by route for a page the spec navigates to", () => {
      const result = plan(
        ["src/app/(search-app)/documents/page.tsx"],
        [["src/app/(search-app)/documents/page.tsx", "export default function Page() { return null; }"]],
        { ui_changed: true },
      );
      expect(result.level).toBe("focused");
      expect(result.specs).toEqual(["tests/ui-smoke.spec.ts"]);
    });

    it("runs a changed spec complete rather than grepping inside it", () => {
      const result = plan(["tests/ui-tools.spec.ts"], [], { ui_changed: true });
      expect(result.level).toBe("changed");
      expect(result.specs).toEqual(["tests/ui-tools.spec.ts"]);
      expect(result.stages[0].command.args).not.toContain("--grep");
    });

    it("runs a changed spec as well as the owner of a changed source in one stage", () => {
      const result = plan(
        ["tests/ui-tools.spec.ts", "src/components/clinical-dashboard/answer-result-surface.tsx"],
        [
          [
            "src/components/clinical-dashboard/answer-result-surface.tsx",
            '<button data-testid="answer-evidence-gaps-trigger" />',
          ],
        ],
        { ui_changed: true },
      );
      expect(result.level).toBe("focused");
      expect(result.specs).toEqual(["tests/ui-smoke.spec.ts", "tests/ui-tools.spec.ts"]);
    });

    it("plans nothing when no browser surface changed", () => {
      const result = plan(["docs/testing.md"], [["docs/testing.md", "# testing"]], { ui_changed: false });
      expect(result.level).toBe("none");
      expect(result.stages).toEqual([]);
    });
  });

  describe("attribution rests on strings the browser sees", () => {
    it("reads every quoting style a testid is written in", () => {
      const keys = ownershipKeys(
        "src/components/x.tsx",
        `<a data-testid="one" /><b data-testid={"two"} /><c data-testid='three' />`,
      );
      expect(keys.testIds).toEqual(["one", "three", "two"]);
    });

    it("does not attribute on a component name", () => {
      // A spec never names a component; matching one would match a comment.
      const keys = ownershipKeys(
        "src/components/clinical-dashboard/evidence-panels.tsx",
        "export function ToolsLauncher() {}",
      );
      expect(keys.testIds).toEqual([]);
      expect(specsReferencing(keys, SPECS)).toEqual([]);
    });

    it("strips route groups and refuses dynamic segments", () => {
      expect(ownershipKeys("src/app/(search-app)/documents/page.tsx", "").routes).toEqual(["/documents"]);
      expect(ownershipKeys("src/app/documents/[slug]/page.tsx", "").routes).toEqual([]);
    });

    it("does not treat API handlers as browser journeys", () => {
      // Same exclusion `ci-change-scope.mjs` makes for `ui_changed`.
      expect(isRenderingSource("src/app/api/answer/route.ts")).toBe(false);
      expect(isRenderingSource("src/components/clinical-dashboard/answer-content.tsx")).toBe(true);
      expect(isRenderingSource("src/lib/rag/rag.ts")).toBe(false);
    });
  });

  describe("stays in step with the repository it plans for", () => {
    it("recognises the browser specs that exist today", () => {
      const specs = execFileSync("git", ["ls-files", "tests/ui-*.spec.ts"], { cwd: root, encoding: "utf8" })
        .split("\n")
        .filter(Boolean);
      expect(specs.length).toBeGreaterThan(5);
      for (const spec of specs) expect(BROWSER_SPEC_PATTERN.test(spec), spec).toBe(true);
    });

    it("keeps every shared-foundation path pointing at a file that exists", () => {
      // A pattern that matches nothing is a silent hole: the file it was meant to
      // catch would be attributed instead of escalating.
      const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
      const unmatched = [];
      for (const pattern of [
        "src/app/globals.css",
        "playwright.config.ts",
        "src/components/ClinicalDashboard.tsx",
        "src/lib/app-modes.ts",
        "scripts/run-playwright.mjs",
      ]) {
        if (!tracked.includes(pattern)) unmatched.push(pattern);
        expect(isSharedFoundation(pattern), pattern).toBe(true);
      }
      expect(unmatched).toEqual([]);
    });

    /**
     * `isBrowserLanePath` restates `uiPatterns` from `ci-change-scope.mjs` because
     * that script answers for a CHANGE, not a FILE. A restated rule drifts, and the
     * drift is silent in both directions — too wide escalates every change, too
     * narrow lets a browser surface be narrowed away. So the two are compared
     * directly, against the real classifier, for one path per pattern family.
     */
    it.each([
      "src/components/clinical-dashboard/answer-content.tsx",
      "src/app/(search-app)/documents/page.tsx",
      "src/app/globals.css",
      "src/styles/tokens.css",
      "public/manifest.webmanifest",
      "data/therapies.json",
      "tests/ui-smoke.spec.ts",
      "tests/helpers/phone-scroll.ts",
      "playwright.config.ts",
      "scripts/run-playwright.mjs",
      "lighthouse-budget.json",
      "src/lib/app-modes.ts",
      "src/app/api/answer/route.ts",
      "src/lib/rag/rag.ts",
      "docs/testing.md",
      "package.json",
      "supabase/schema.sql",
      "worker/main.ts",
      ".claude/settings.json",
    ])("agrees with ci-change-scope about whether %s is in the browser lane", (file) => {
      const scope = JSON.parse(
        execFileSync(process.execPath, ["scripts/ci-change-scope.mjs", "--json", "--files", file], {
          cwd: root,
          encoding: "utf8",
        }),
      ) as { files: string[]; ui_changed: boolean };
      // Guard the guard: if the classifier ignored the file list it would answer
      // about the working tree and this comparison would prove nothing.
      expect(scope.files).toEqual([file]);
      expect(isBrowserLanePath(file), file).toBe(scope.ui_changed);
    });

    it("passes its own offline self-test", () => {
      const output = execFileSync(process.execPath, ["scripts/browser-test-plan.mjs", "--self-test"], {
        cwd: root,
        encoding: "utf8",
      });
      expect(output).toContain("self-test passed");
    });

    it("never advertises a narrowed run as the full gate", () => {
      const source = read("scripts/browser-test-plan.mjs");
      expect(source).toContain("this is focused browser proof, not the full UI gate");
      // The plan must state what CI does with the same change rather than assert it.
      expect(source).toContain("deriveCiCoverage");
    });

    it("is dry-run by default", () => {
      const source = read("scripts/browser-test-plan.mjs");
      expect(source).toContain('if (!argv.includes("--run"))');
      expect(source).toContain("(dry run — pass --run to execute)");
    });

    it("is what the arbiter points at for the browser gates", () => {
      // `ui` is in NEVER_DEFER_CLASSES and stays there, so asking the arbiter about
      // verify:ui used to return "nothing to weigh" — which reads as "no saving
      // available" for the gate with the largest saving on offer.
      const arbiter = read("scripts/gate-arbiter.mjs");
      expect(arbiter).toContain("NARROWED_GATES");
      for (const gate of ["verify:ui", "test:e2e", "test:e2e:pr"]) expect(arbiter).toContain(`"${gate}"`);
      expect(arbiter).toContain("npm run plan:browser");
    });
  });

  /**
   * The saving only happens if a session knows to ask. Cloud sessions start with no
   * local history, so the policy is stated to them once at SessionStart.
   */
  describe("cloud sessions are told the policy", () => {
    it("registers the hook with an explicit timeout and a bash-invoked path", () => {
      // A bare path would make the executable bit load-bearing, which is the trap
      // AGENTS.md records against session-start.sh.
      type HookCommand = { command: string; timeout?: number };
      const settings = JSON.parse(read(".claude/settings.json")) as {
        hooks: { SessionStart: Array<{ hooks: HookCommand[] }> };
      };
      const commands = settings.hooks.SessionStart.flatMap((entry) => entry.hooks);
      const policy = commands.find((hook: HookCommand) => hook.command.includes("testing-policy.sh"));
      expect(policy, "testing-policy.sh must be registered as a SessionStart hook").toBeTruthy();
      expect(policy!.command.startsWith("bash ")).toBe(true);
      expect(typeof policy!.timeout).toBe("number");
    });

    it("says nothing outside a cloud session", () => {
      const result = spawnSync("bash", [".claude/hooks/testing-policy.sh"], {
        cwd: root,
        encoding: "utf8",
        input: "{}",
        env: { ...process.env, CLAUDE_CODE_REMOTE: "" },
      });
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe("");
    });

    it("emits one valid SessionStart context block in a cloud session", () => {
      const result = spawnSync("bash", [".claude/hooks/testing-policy.sh"], {
        cwd: root,
        encoding: "utf8",
        input: "{}",
        env: { ...process.env, CLAUDE_CODE_REMOTE: "true", CLAUDE_PROJECT_DIR: root },
      });
      expect(result.status).toBe(0);
      const payload = JSON.parse(result.stdout);
      expect(payload.hookSpecificOutput.hookEventName).toBe("SessionStart");
      const context: string = payload.hookSpecificOutput.additionalContext;
      expect(context).toContain("npm run plan:browser");
      // The reporting rules are the half that keeps a narrowed run honest; without
      // them the saving is bought with a misleading claim.
      expect(context).toContain('never "verify:ui passed"');
      expect(context).toContain("GitHub remains the authoritative merge gate");
    });

    it("survives a malformed payload rather than failing the session", () => {
      const result = spawnSync("bash", [".claude/hooks/testing-policy.sh"], {
        cwd: root,
        encoding: "utf8",
        input: "not json at all",
        env: { ...process.env, CLAUDE_CODE_REMOTE: "true", CLAUDE_PROJECT_DIR: root },
      });
      expect(result.status).toBe(0);
    });
  });
});
