import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { yamlBlock } from "../scripts/yaml-contract.mjs";

const workflow = fs.readFileSync(new URL("../.github/workflows/organisation-weekly.yml", import.meta.url), "utf8");
const ciWorkflow = fs.readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");
const nodeSetup = fs.readFileSync(new URL("../.github/actions/setup-node-cached/action.yml", import.meta.url), "utf8");

// Comment lines explain the permission split in prose, so they are dropped before any text check.
const code = (text: string) =>
  text
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
const reportJob = code(yamlBlock(workflow, "report:", 2));
const publishJob = code(yamlBlock(workflow, "publish:", 2));
const dirs: string[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

describe("organisation weekly workflow: shape and permissions", () => {
  it("has exactly the two jobs, report then publish", () => {
    const jobs = [...code(yamlBlock(workflow, "jobs:", 0)).matchAll(/^ {2}([a-z][\w-]*):$/gm)].map((match) => match[1]);
    expect(jobs).toEqual(["report", "publish"]);
    expect(publishJob).toContain("needs: report");
  });

  it("runs weekly and on demand, never on a push or pull request", () => {
    const on = code(yamlBlock(workflow, "on:", 0));
    expect(on).toMatch(/schedule:\n\s+- cron: "\d+ \d+ \* \* \d"/);
    expect(on).toContain("workflow_dispatch:");
    expect(on).not.toMatch(/\b(push|pull_request|pull_request_target|merge_group):/);
  });

  it("runs on main only, on the pinned runner image", () => {
    for (const job of [reportJob, publishJob]) {
      expect(job).toMatch(/if: \$\{\{[^}]*github\.ref == 'refs\/heads\/main'[^}]*\}\}/);
      expect(job).toContain("runs-on: ubuntu-24.04");
    }
  });

  it("grants contents: read at the top and issues: write only to the job that runs no repository code", () => {
    expect(code(yamlBlock(workflow, "permissions:", 0)).trim()).toBe("permissions:\n  contents: read");
    expect(reportJob).toMatch(/permissions:\n\s+contents: read\n(?!\s+\w+: write)/);
    expect(reportJob).not.toContain("issues: write");
    expect(publishJob).toMatch(/permissions:\n\s+contents: read\n\s+issues: write\n/);
    expect(code(workflow)).not.toMatch(/statuses: write|write-all|actions: write|pull-requests: write|contents: write/);
    // The publishing job checks out nothing and runs nothing from the repository.
    expect(publishJob).not.toContain("actions/checkout");
    expect(publishJob).not.toMatch(/^\s+run:/m);
    expect(publishJob).not.toContain("uses: ./");
  });

  it("names no job after a required check", () => {
    expect(workflow).not.toMatch(/name:\s*["']?(PR policy|PR required)\b/i);
  });
});

describe("organisation weekly workflow: steps", () => {
  it("pins every action by full SHA, exactly as ci.yml pins it", () => {
    const uses = [...workflow.matchAll(/uses: (\S+)(.*)$/gm)].map((match) => ({ ref: match[1], rest: match[2] }));
    expect(uses.length).toBeGreaterThanOrEqual(5);
    for (const { ref, rest } of uses) {
      if (ref.startsWith("./")) continue;
      const [action, sha] = ref.split("@");
      expect(sha, ref).toMatch(/^[0-9a-f]{40}$/);
      const ciPin = new RegExp(`uses: ${action.replace("/", "\\/")}@([0-9a-f]{40})(.*)$`, "m").exec(ciWorkflow);
      expect(ciPin, `${action} is not used in ci.yml`).not.toBeNull();
      expect(`${sha}${rest}`, action).toBe(`${ciPin?.[1]}${ciPin?.[2]}`);
    }
  });

  it("checks out full history without persisting credentials, then installs the way CI does", () => {
    expect(reportJob).toMatch(
      /uses: actions\/checkout@[0-9a-f]{40} # v[\d.]+\n\s+with:\n\s+fetch-depth: 0\n\s+persist-credentials: false/,
    );
    expect(reportJob).toContain("uses: ./.github/actions/setup-node-cached");
    expect(nodeSetup).toContain('node-version-file: ".nvmrc"');
    expect(nodeSetup).toContain("run: npm ci --include=dev");
  });

  it("builds the report with the committed runner and hands the same file to the publishing job", () => {
    const run = /run: node (scripts\/organisation\/weekly-report\.mjs) --out (\S+)/.exec(reportJob);
    expect(run).not.toBeNull();
    expect(fs.existsSync(new URL(`../${run?.[1]}`, import.meta.url))).toBe(true);
    expect(reportJob).toContain(`path: ${run?.[2]}`);
    expect(reportJob).toContain("if-no-files-found: error");
    const artifact = /name: (organisation-weekly-report)/.exec(reportJob)?.[1];
    expect(publishJob).toContain(`name: ${artifact}`);
    expect(publishJob).toContain(`REPORT_FILE: weekly-report/${path.posix.basename(run?.[2] ?? "")}`);
    expect(publishJob).toMatch(/path: weekly-report\n/);
  });

  it("still publishes when the report job failed, so a broken report reaches the issue", () => {
    expect(publishJob).toMatch(/if: \$\{\{ !cancelled\(\) && /);
    expect(publishJob).toMatch(/Download the report\n(?:\s+#[^\n]*\n)*\s+continue-on-error: true/);
    expect(publishJob).toContain("REPORT_RESULT: ${{ needs.report.result }}");
  });
});

// The github-script body, compiled and run against a fake client: the update-or-create logic is the
// whole delivery path, so it is exercised rather than only pattern-matched.
function publishScript() {
  const lines = workflow.split("\n");
  const start = lines.findIndex((line) => /^\s+script: \|$/.test(line));
  const indent = (lines[start + 1].match(/^\s*/) ?? [""])[0].length;
  const body: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && (line.match(/^\s*/) ?? [""])[0].length < indent) break;
    body.push(line.slice(indent));
  }
  return body.join("\n");
}

type Issue = { number: number; body: string; user: { login: string }; pull_request?: object };
const MARKER = "<!-- organisation-weekly-report:v1 -->";
const BOT = { login: "github-actions[bot]" };

async function publish({
  issues = [] as Issue[],
  report = "# Organisation weekly report\n\nall well" as string | null,
  result = "success",
  failList = false,
} = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "organisation-publish-"));
  dirs.push(dir);
  const reportFile = path.join(dir, "weekly-report.md");
  if (report !== null) fs.writeFileSync(reportFile, report);
  const calls = { update: [] as Record<string, unknown>[], create: [] as Record<string, unknown>[] };
  const failures: string[] = [];
  const github = {
    paginate: async (_method: unknown, args: Record<string, unknown>) => {
      if (failList) throw new Error("rate limited");
      expect(args).toMatchObject({ state: "open" });
      return issues;
    },
    rest: {
      issues: {
        listForRepo: () => undefined,
        update: async (args: Record<string, unknown>) => void calls.update.push(args),
        create: async (args: Record<string, unknown>) => {
          calls.create.push(args);
          return { data: { number: 900 } };
        },
      },
    },
  };
  const context = { repo: { owner: "owner", repo: "repo" }, serverUrl: "https://github.example", runId: 7 };
  const core = {
    info: () => undefined,
    warning: () => undefined,
    setFailed: (message: string) => failures.push(message),
  };
  const fakeProcess = { env: { REPORT_RESULT: result, REPORT_FILE: reportFile } };
  const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor;
  const run = new AsyncFunction("require", "github", "context", "core", "process", publishScript());
  await run(createRequire(import.meta.url), github, context, core, fakeProcess);
  return { calls, failures };
}

describe("organisation weekly workflow: publishing the issue", () => {
  it("updates the one open issue this workflow's bot opened, found by its hidden marker", async () => {
    const { calls, failures } = await publish({
      issues: [
        { number: 3, body: `${MARKER}\nquoted by a person`, user: { login: "someone" } },
        { number: 4, body: `${MARKER}\nold`, user: BOT, pull_request: {} },
        { number: 5, body: "unrelated", user: BOT },
        { number: 8, body: `${MARKER}\nlast week`, user: BOT },
        { number: 12, body: `${MARKER}\nduplicate`, user: BOT },
      ],
    });
    expect(calls.create).toEqual([]);
    expect(calls.update).toHaveLength(1);
    expect(calls.update[0]).toMatchObject({ owner: "owner", repo: "repo", issue_number: 8 });
    expect(String(calls.update[0].body)).toMatch(new RegExp(`^${MARKER}\n# Organisation weekly report\n\nall well\n`));
    // A person's retitle survives: the update never sends a title.
    expect(calls.update[0]).not.toHaveProperty("title");
    expect(failures).toEqual([]);
  });

  it("creates the issue, with its label, when none of ours is open", async () => {
    const { calls, failures } = await publish({ issues: [{ number: 3, body: MARKER, user: { login: "someone" } }] });
    expect(calls.update).toEqual([]);
    expect(calls.create).toHaveLength(1);
    expect(calls.create[0]).toMatchObject({ title: "Organisation weekly report", labels: ["organisation-weekly"] });
    expect(String(calls.create[0].body).startsWith(MARKER)).toBe(true);
    expect(failures).toEqual([]);
  });

  it("says in the issue when the report could not be built, and fails the run", async () => {
    const { calls, failures } = await publish({ report: null, result: "failure" });
    expect(String(calls.create[0].body)).toContain("could not be built (report job: `failure`)");
    expect(String(calls.create[0].body)).toContain("https://github.example/owner/repo/actions/runs/7");
    expect(failures).toEqual([expect.stringContaining("was not published")]);
  });

  it("publishes a notice rather than a body GitHub would reject", async () => {
    const { calls, failures } = await publish({ report: "x".repeat(70_000) });
    expect(String(calls.create[0].body).length).toBeLessThan(2_000);
    expect(String(calls.create[0].body)).toContain("was too long to publish (70000 characters)");
    expect(failures).toEqual([expect.stringContaining("was not published")]);
  });

  it("fails the run when the issue cannot be updated", async () => {
    const { calls, failures } = await publish({ failList: true });
    expect(calls.create).toEqual([]);
    expect(failures).toEqual(["Could not update the organisation weekly issue: rate limited"]);
  });
});
