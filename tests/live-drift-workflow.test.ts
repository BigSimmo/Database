import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workflowPath = path.join(repoRoot, ".github", "workflows", "live-drift.yml");
const workflow = readFileSync(workflowPath, "utf8").replace(/\r\n/g, "\n");

type Issue = { number: number; title: string };
type RepositoryCoordinates = { owner: string; repo: string };

type ScriptFunction = (
  github: Record<string, unknown>,
  context: Record<string, unknown>,
  core: {
    info: (message: string) => void;
    warning: (message: string) => void;
  },
) => Promise<void>;

const AsyncFunction = Object.getPrototypeOf(async () => undefined).constructor as new (
  ...args: string[]
) => ScriptFunction;

// Same extraction shape as tests/codex-autofix-workflow.test.ts: the block is
// `script: |` at ten spaces, so its body is everything indented twelve or more.
function extractWorkflowScripts(source: string) {
  const scriptMarker = "          script: |\n";
  const scripts: string[] = [];
  let searchFrom = 0;

  while (true) {
    const scriptStart = source.indexOf(scriptMarker, searchFrom);
    if (scriptStart === -1) break;

    const scriptLines = source.slice(scriptStart + scriptMarker.length).split("\n");
    const extractedLines: string[] = [];

    for (const line of scriptLines) {
      if (line.length === 0) {
        extractedLines.push("");
        continue;
      }
      if (!line.startsWith("            ")) break;
      extractedLines.push(line.slice(12));
    }

    scripts.push(extractedLines.join("\n"));
    searchFrom = scriptStart + scriptMarker.length;
  }

  return scripts;
}

const [routingScriptSource, ...extraScripts] = extractWorkflowScripts(workflow);
if (!routingScriptSource) {
  throw new Error("Expected a github-script block for drift routing in .github/workflows/live-drift.yml.");
}
if (extraScripts.length > 0) {
  throw new Error("Expected exactly one github-script block in live-drift.yml; update this test if that changes.");
}

const routingScript = new AsyncFunction("github", "context", "core", routingScriptSource);

type Calls = {
  closed: Array<RepositoryCoordinates & { issue_number: number; state?: string; state_reason?: string }>;
  comments: Array<RepositoryCoordinates & { issue_number: number; body: string }>;
  created: Array<RepositoryCoordinates & { title: string; labels: string[]; body: string }>;
  listed: Array<RepositoryCoordinates & { labels: string; state: string }>;
  updatedBodies: Array<RepositoryCoordinates & { issue_number: number; body: string }>;
  warnings: string[];
};

async function runRoutingScript(options: { findings?: string; openIssues?: Issue[]; result: string }) {
  const calls: Calls = { closed: [], comments: [], created: [], listed: [], updatedBodies: [], warnings: [] };

  const github = {
    rest: {
      issues: {
        create: async (request: RepositoryCoordinates & { body: string; labels: string[]; title: string }) => {
          calls.created.push({
            body: request.body,
            labels: request.labels,
            owner: request.owner,
            repo: request.repo,
            title: request.title,
          });
          return { data: { number: 4242 } };
        },
        createComment: async (request: RepositoryCoordinates & { body: string; issue_number: number }) => {
          calls.comments.push({
            body: request.body,
            issue_number: request.issue_number,
            owner: request.owner,
            repo: request.repo,
          });
        },
        listForRepo: async (request: RepositoryCoordinates & { labels: string; state: string }) => {
          calls.listed.push({ labels: request.labels, owner: request.owner, repo: request.repo, state: request.state });
          return { data: options.openIssues ?? [] };
        },
        update: async (
          request: RepositoryCoordinates & {
            body?: string;
            issue_number: number;
            state?: string;
            state_reason?: string;
          },
        ) => {
          if (request.state) {
            calls.closed.push({
              issue_number: request.issue_number,
              owner: request.owner,
              repo: request.repo,
              state: request.state,
              state_reason: request.state_reason,
            });
          }
          if (typeof request.body === "string") {
            calls.updatedBodies.push({
              body: request.body,
              issue_number: request.issue_number,
              owner: request.owner,
              repo: request.repo,
            });
          }
        },
      },
    },
  };

  const context = {
    eventName: "schedule",
    repo: { owner: "BigSimmo", repo: "Database" },
    runId: 99,
    serverUrl: "https://github.com",
  };

  const core = {
    info: () => undefined,
    warning: (message: string) => {
      calls.warnings.push(message);
    },
  };

  const previous = { findings: process.env.DRIFT_FINDINGS, result: process.env.DRIFT_RESULT };
  process.env.DRIFT_RESULT = options.result;
  process.env.DRIFT_FINDINGS = options.findings ?? "";
  try {
    await routingScript(github, context, core);
  } finally {
    if (previous.result === undefined) delete process.env.DRIFT_RESULT;
    else process.env.DRIFT_RESULT = previous.result;
    if (previous.findings === undefined) delete process.env.DRIFT_FINDINGS;
    else process.env.DRIFT_FINDINGS = previous.findings;
  }

  return calls;
}

const pinnedIssue: Issue = { number: 1234, title: "Live drift check failing" };
const sampleFindings = "UNEXPECTED DRIFT (2):\n  ! [indexes] missing_live documents_title_trgm_idx";
const repositoryCoordinates = { owner: "BigSimmo", repo: "Database" };

function workflowJobPermissionMaps(source: string) {
  const jobsStart = source.indexOf("jobs:\n");
  if (jobsStart < 0) throw new Error("Expected a jobs map in .github/workflows/live-drift.yml.");

  const jobsSection = source.slice(jobsStart);
  const jobHeaders = [...jobsSection.matchAll(/^  ([a-z][\w-]*):$/gm)];
  const jobs = Object.fromEntries(
    jobHeaders.map((header, index) => {
      const bodyStart = (header.index ?? 0) + header[0].length + 1;
      const bodyEnd = jobHeaders[index + 1]?.index ?? jobsSection.length;
      const body = jobsSection.slice(bodyStart, bodyEnd);
      const permissions = Object.fromEntries(
        [...body.matchAll(/^    permissions:\n((?:      [^\n]+\n?)*)/gm)].flatMap((permissionsMatch) =>
          [...permissionsMatch[1].matchAll(/^      ([\w-]+): ([\w-]+)$/gm)].map((entry) => [entry[1], entry[2]]),
        ),
      );
      return [header[1], { permissions }];
    }),
  );

  return { jobs };
}

describe("live-drift workflow triggers and privileges", () => {
  it("runs both drift diagnostics once and keeps migration history visible after a drift failure", () => {
    expect(workflow.match(/npm run check:drift/g)).toHaveLength(1);
    expect(workflow.match(/npm run check:migration-history/g)).toHaveLength(1);
    expect(workflow.indexOf("npm run check:drift")).toBeLessThan(workflow.indexOf("npm run check:migration-history"));
    expect(workflow).toMatch(/- name: Align migration history for Supabase Preview\n\s+if: \$\{\{ !cancelled\(\) \}\}/);
  });

  it("keeps the weekly schedule and manual dispatch", () => {
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain('- cron: "30 18 * * 0"');
  });

  it("also runs once a schema change reaches main, and never on pull requests", () => {
    expect(workflow).toContain("branches: [main]");
    expect(workflow).toContain('- "supabase/migrations/**"');
    expect(workflow).toContain('- "supabase/schema.sql"');
    expect(workflow).not.toMatch(/^on:[\s\S]*?^\s{2}pull_request/m);
  });

  it("never cancels an in-flight drift run", () => {
    expect(workflow).toContain("group: live-drift-check");
    expect(workflow).toContain("cancel-in-progress: false");
  });

  it("keeps the secret preflight so a missing key fails loudly rather than silently passing", () => {
    expect(workflow).toContain("Preflight required secrets");
    expect(workflow).toContain("Live drift check cannot run - missing repo secrets:");
  });

  it("grants issues: write only to the routing job", () => {
    // Workflow-level permissions stay read-only, so no job inherits issue writes.
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);

    const parsed = workflowJobPermissionMaps(workflow);
    expect(parsed.jobs["drift-routing"]?.permissions).toEqual({ contents: "read", issues: "write" });
    for (const [jobName, job] of Object.entries(parsed.jobs)) {
      if (jobName !== "drift-routing") expect(job.permissions.issues).toBeUndefined();
    }
  });

  it("keeps the service-role key out of the job that can write issues", () => {
    const routingStart = workflow.indexOf("  drift-routing:");
    expect(workflow.slice(routingStart)).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("pins github-script to the reviewed immutable commit", () => {
    expect(workflow).toContain("uses: actions/github-script@3a2844b7e9c422d3c10d287c895573f7108da1b3 # v9.0.0");
  });

  it("captures findings even when the drift step failed", () => {
    expect(workflow).toContain("set -o pipefail");
    expect(workflow).toMatch(/id: findings\n\s+if: always\(\)/);
  });

  it("still routes when the drift job fails", () => {
    expect(workflow).toContain("if: ${{ !cancelled() }}");
  });
});

describe("live-drift failure routing", () => {
  it("opens one labelled issue when the check fails and none is open", async () => {
    const calls = await runRoutingScript({ findings: sampleFindings, result: "failure" });

    expect(calls.listed).toEqual([{ ...repositoryCoordinates, labels: "live-drift-failure", state: "open" }]);
    expect(calls.created).toHaveLength(1);
    expect(calls.created[0].title).toBe("Live drift check failing");
    expect(calls.created[0].labels).toEqual(["live-drift-failure"]);
    expect(calls.created[0]).toMatchObject(repositoryCoordinates);
    expect(calls.created[0].body).toContain("https://github.com/BigSimmo/Database/actions/runs/99");
    expect(calls.created[0].body).toContain("documents_title_trgm_idx");
    expect(calls.closed).toHaveLength(0);
  });

  it("updates the same issue on a repeat failure instead of stacking a second one", async () => {
    const calls = await runRoutingScript({
      findings: sampleFindings,
      openIssues: [pinnedIssue],
      result: "failure",
    });

    expect(calls.created).toHaveLength(0);
    expect(calls.updatedBodies).toEqual([expect.objectContaining({ ...repositoryCoordinates, issue_number: 1234 })]);
    expect(calls.comments).toHaveLength(1);
    expect(calls.comments[0].issue_number).toBe(1234);
    expect(calls.comments[0]).toMatchObject(repositoryCoordinates);
    expect(calls.comments[0].body).toContain("Still failing");
    expect(calls.closed).toHaveLength(0);
    expect(calls.warnings.join(" ")).toContain("1234");
  });

  it("does not present a run that died before the comparison as a clean schema", async () => {
    const calls = await runRoutingScript({ findings: "", result: "failure" });

    expect(calls.created).toHaveLength(1);
    expect(calls.created[0]).toMatchObject(repositoryCoordinates);
    expect(calls.created[0].body).toContain("not** evidence of a clean schema");
    expect(calls.created[0].body).not.toContain("UNEXPECTED DRIFT");
  });

  it("comments the resolution and closes the issue on the next green run", async () => {
    const calls = await runRoutingScript({ openIssues: [pinnedIssue], result: "success" });

    expect(calls.comments).toHaveLength(1);
    expect(calls.comments[0].body).toContain("Resolved");
    expect(calls.comments[0].body).toContain("https://github.com/BigSimmo/Database/actions/runs/99");
    expect(calls.closed).toEqual([
      { ...repositoryCoordinates, issue_number: 1234, state: "closed", state_reason: "completed" },
    ]);
    expect(calls.created).toHaveLength(0);
    expect(calls.listed).toEqual([{ ...repositoryCoordinates, labels: "live-drift-failure", state: "open" }]);
  });

  it("writes nothing when the check is green and no issue is open", async () => {
    const calls = await runRoutingScript({ result: "success" });

    expect(calls.created).toHaveLength(0);
    expect(calls.comments).toHaveLength(0);
    expect(calls.closed).toHaveLength(0);
    expect(calls.updatedBodies).toHaveLength(0);
  });

  it("treats an unknown job result as a failure rather than closing the issue", async () => {
    const calls = await runRoutingScript({ openIssues: [pinnedIssue], result: "" });

    expect(calls.closed).toHaveLength(0);
    expect(calls.updatedBodies).toEqual([expect.objectContaining({ ...repositoryCoordinates, issue_number: 1234 })]);
  });
});
