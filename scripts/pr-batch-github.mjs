import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import {
  STATE_BRANCH,
  approvedPolicyHash,
  digest,
  eligibility,
  validateState,
  verifyCanaryResults,
} from "./pr-batch-core.mjs";

export const CONTROL_FILES = [
  "scripts/pr-batch-core.mjs",
  "scripts/pr-batch-github.mjs",
  "scripts/pr-batch-runner.mjs",
  "scripts/pr-batch-worker.mjs",
  "scripts/pr-batch-policy.mjs",
  "scripts/pr-policy.mjs",
  ".github/workflows/pr-batch-runner.yml",
  ".github/workflows/codex-run-pr-operator.yml",
  ".github/codex/prompts/run-pr-operator.md",
  ".github/codex/run-pr-result.schema.json",
];
export const controllerHash = () =>
  digest(
    CONTROL_FILES.map((file) => [
      file,
      readFileSync(new URL(`../${file}`, import.meta.url), "utf8").replaceAll("\r\n", "\n"),
    ]),
  );
const success = new Set(["success", "neutral", "skipped"]);
const failures = new Set(["failure", "timed_out", "cancelled", "action_required", "startup_failure", "stale"]);
const internal = /^(?:PR batch runner|PR batch review wake|Codex Run PR operator|Codex auto-resolve review comments)$/;
const provider =
  /^(?:eval-canary|authenticated-live-tests|live-drift|staging-tenancy|ingestion-autopilot|reindex-reaper|live-domain-monitor|live-web-vitals)\.yml$/;

export class GitHubBatch {
  constructor(github, { owner, repo, runId, actor, now = () => new Date().toISOString() }) {
    this.gh = github;
    this.repo = { owner, repo };
    this.runId = Number(runId);
    this.actor = actor;
    this.now = now;
    this.canaryCache = new Map();
    this.activeWorkers = null;
  }

  async enabled() {
    try {
      return (
        (await this.gh.rest.actions.getRepoVariable({ ...this.repo, name: "PR_BATCH_ENABLED" })).data.value === "true"
      );
    } catch (error) {
      if (error.status === 404) return false;
      throw error;
    }
  }

  async identity() {
    const user = (await this.gh.rest.users.getAuthenticated()).data;
    if (user.login !== "BigSimmo" || user.type !== "User")
      throw new Error("GH_TOKEN must authenticate BigSimmo as a human operator");
    return user.login;
  }

  async load() {
    let ref;
    try {
      ref = (await this.gh.rest.git.getRef({ ...this.repo, ref: `heads/${STATE_BRANCH}` })).data;
    } catch (error) {
      if (error.status === 404) return { sha: null, tree: null, state: null };
      throw error;
    }
    const commit = (await this.gh.rest.git.getCommit({ ...this.repo, commit_sha: ref.object.sha })).data;
    const tree = (await this.gh.rest.git.getTree({ ...this.repo, tree_sha: commit.tree.sha, recursive: "1" })).data;
    if (tree.truncated || tree.tree.some((item) => item.type === "blob" && !item.path.endsWith(".json")))
      throw new Error("Unsafe state branch tree");
    const entry = tree.tree.find((item) => item.path === "state.json" && item.type === "blob");
    if (!entry) throw new Error("Missing state.json on existing state branch");
    const blob = (await this.gh.rest.git.getBlob({ ...this.repo, file_sha: entry.sha })).data;
    const state = validateState(JSON.parse(Buffer.from(blob.content, "base64").toString("utf8")));
    return {
      sha: ref.object.sha,
      tree: commit.tree.sha,
      revision: state.revision,
      manifestId: state.manifest.id,
      state,
    };
  }

  async save(previous, state) {
    validateState(state);
    if (previous.state?.manifest.id === state.manifest.id && previous.state.manifestDigest !== state.manifestDigest)
      throw new Error("Immutable manifest changed");
    const content = (value) => `${JSON.stringify(value, null, 2)}\n`;
    const entries = [{ path: "state.json", mode: "100644", type: "blob", content: content(state) }];
    if (previous.state?.manifest.id !== state.manifest.id)
      entries.push({
        path: `manifests/${state.manifest.id}.json`,
        mode: "100644",
        type: "blob",
        content: content(state.manifest),
      });
    const lastRevision =
      (previous.manifestId ?? previous.state?.manifest.id) === state.manifest.id
        ? (previous.revision ?? previous.state.revision)
        : -1;
    for (const event of state.events.filter((item) => item.revision > lastRevision))
      entries.push({
        path: `events/${state.manifest.id}/${String(event.revision).padStart(6, "0")}.json`,
        mode: "100644",
        type: "blob",
        content: content(event),
      });
    const tree = (
      await this.gh.rest.git.createTree({
        ...this.repo,
        ...(previous.tree ? { base_tree: previous.tree } : {}),
        tree: entries,
      })
    ).data;
    const commit = (
      await this.gh.rest.git.createCommit({
        ...this.repo,
        message: `chore: record PR batch ${state.manifest.id} transition ${state.revision}`,
        tree: tree.sha,
        parents: previous.sha ? [previous.sha] : [],
      })
    ).data;
    if (previous.sha)
      await this.gh.rest.git.updateRef({ ...this.repo, ref: `heads/${STATE_BRANCH}`, sha: commit.sha, force: false });
    else await this.gh.rest.git.createRef({ ...this.repo, ref: `refs/heads/${STATE_BRANCH}`, sha: commit.sha });
    return {
      sha: commit.sha,
      tree: tree.sha,
      revision: state.revision,
      manifestId: state.manifest.id,
      state: structuredClone(state),
    };
  }

  async main() {
    return (await this.gh.rest.git.getRef({ ...this.repo, ref: "heads/main" })).data.object.sha;
  }

  async listOpen() {
    const prs = [];
    let cursor = null;
    do {
      const result = await this.gh.graphql(
        `query BatchOpen($owner:String!,$repo:String!,$cursor:String) {
        repository(owner:$owner,name:$repo) { pullRequests(first:100,after:$cursor,states:OPEN,baseRefName:"main") {
          nodes { number autoMergeRequest { enabledAt } mergeQueueEntry { id } }
          pageInfo { hasNextPage endCursor }
        } }
      }`,
        { ...this.repo, cursor },
      );
      const page = result.repository.pullRequests;
      prs.push(
        ...page.nodes.map((pr) => ({
          number: pr.number,
          armed: !!pr.autoMergeRequest,
          enqueued: !!pr.mergeQueueEntry,
        })),
      );
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (cursor);
    return prs;
  }

  async protections() {
    const repository = (await this.gh.rest.repos.get(this.repo)).data;
    const rules = await this.gh.paginate("GET /repos/{owner}/{repo}/rules/branches/main", {
      ...this.repo,
      per_page: 100,
    });
    let classic = null;
    try {
      classic = (await this.gh.rest.repos.getBranchProtection({ ...this.repo, branch: "main" })).data;
    } catch (error) {
      if (error.status !== 404) throw error;
    }
    const required = [];
    for (const check of classic?.required_status_checks?.checks ?? [])
      required.push({ name: check.context, appId: check.app_id });
    for (const name of classic?.required_status_checks?.contexts ?? [])
      if (!required.some((item) => item.name === name)) required.push({ name, appId: null });
    for (const rule of rules.filter((item) => item.type === "required_status_checks"))
      for (const check of rule.parameters.required_status_checks)
        required.push({ name: check.context, appId: check.integration_id });
    const queue = rules.some((rule) => rule.type === "merge_queue");
    const strict =
      classic?.required_status_checks?.strict ||
      rules.some(
        (rule) => rule.type === "required_status_checks" && rule.parameters.strict_required_status_checks_policy,
      );
    const reviews = !!classic?.required_pull_request_reviews || rules.some((rule) => rule.type === "pull_request");
    const approvals = Math.max(
      classic?.required_pull_request_reviews?.required_approving_review_count ?? 0,
      ...rules
        .filter((rule) => rule.type === "pull_request")
        .map((rule) => rule.parameters.required_approving_review_count ?? 0),
    );
    const conversations =
      classic?.required_conversation_resolution?.enabled ||
      rules.some((rule) => rule.type === "pull_request" && rule.parameters.required_review_thread_resolution);
    if (!required.length || !reviews || !conversations || (!strict && !queue))
      throw new Error("Protection must enforce checks, PR reviews, resolved threads and current-base validation");
    for (const name of ["Gitleaks", "PR policy", "PR required"])
      if (!required.some((check) => check.name === name)) throw new Error(`Required protection missing: ${name}`);
    if (!queue && !repository.allow_auto_merge) throw new Error("Repository auto-merge is disabled");
    return {
      required,
      approvals,
      queue,
      mergeMethod: repository.allow_merge_commit ? "merge" : repository.allow_squash_merge ? "squash" : null,
    };
  }

  async inspect(number, { protection, state, canaryEvidence = state?.manifest.canaryEvidence ?? {} } = {}) {
    const raw = (await this.gh.rest.pulls.get({ ...this.repo, pull_number: number })).data;
    const base = await this.main();
    const fileRows = await this.gh.paginate(this.gh.rest.pulls.listFiles, {
      ...this.repo,
      pull_number: number,
      per_page: 100,
    });
    const files = [
      ...new Set(
        fileRows.flatMap((file) => [file.filename, ...(file.previous_filename ? [file.previous_filename] : [])]),
      ),
    ];
    const info = await this.gh.graphql(
      `query BatchPR($owner:String!,$repo:String!,$number:Int!) {
      repository(owner:$owner,name:$repo) { pullRequest(number:$number) {
        id headRefOid reviewDecision mergeStateStatus autoMergeRequest { enabledAt } mergeQueueEntry { id }
      } }
    }`,
      { ...this.repo, number },
    );
    const pr = info.repository.pullRequest;
    const threads = [];
    let cursor = null;
    do {
      const result = await this.gh.graphql(
        `query BatchThreads($owner:String!,$repo:String!,$number:Int!,$cursor:String) {
        repository(owner:$owner,name:$repo) { pullRequest(number:$number) {
          reviewThreads(first:100,after:$cursor) { nodes { id isResolved comments(last:1) { totalCount nodes { id updatedAt } } }
          pageInfo { hasNextPage endCursor } }
        } }
      }`,
        { ...this.repo, number, cursor },
      );
      const page = result.repository.pullRequest.reviewThreads;
      threads.push(
        ...page.nodes
          .filter((thread) => !thread.isResolved)
          .map((thread) => ({ id: thread.id, revision: digest(thread.comments) })),
      );
      cursor = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
    } while (cursor);
    const compare = (
      await this.gh.rest.repos.compareCommitsWithBasehead({ ...this.repo, basehead: `${raw.head.sha}...${base}` })
    ).data;
    let conflictPaths = [];
    let conflicting = false;
    if (raw.mergeable === false && !raw.merged) {
      // GitHub's DIRTY label can be stale. Prove a conflict without checking out
      // or executing the PR before spending a repair session on it.
      execFileSync("gh", ["auth", "setup-git", "--hostname", "github.com"], { stdio: "pipe" });
      const shallow =
        execFileSync("git", ["rev-parse", "--is-shallow-repository"], { encoding: "utf8" }).trim() === "true";
      execFileSync("git", ["fetch", "--no-tags", ...(shallow ? ["--unshallow"] : []), "origin", raw.head.sha, base], {
        stdio: "pipe",
        timeout: 120000,
      });
      const merge = spawnSync("git", ["merge-tree", "--write-tree", "--name-only", raw.head.sha, base], {
        encoding: "utf8",
        timeout: 60000,
      });
      if (![0, 1].includes(merge.status)) throw new Error("Local merge-tree proof unavailable");
      conflicting = merge.status === 1;
      conflictPaths = conflicting
        ? merge.stdout
            .split(/\r?\n/)
            .slice(1)
            .filter((line) => line && !line.includes("CONFLICT") && !line.startsWith("Auto-merging"))
        : [];
    }
    const runs = await this.gh.paginate(this.gh.rest.actions.listWorkflowRunsForRepo, {
      ...this.repo,
      head_sha: raw.head.sha,
      per_page: 100,
    });
    const checks = await this.gh.paginate(this.gh.rest.checks.listForRef, {
      ...this.repo,
      ref: raw.head.sha,
      per_page: 100,
      filter: "latest",
    });
    const statuses = await this.gh.paginate(this.gh.rest.repos.listCommitStatusesForRef, {
      ...this.repo,
      ref: raw.head.sha,
      per_page: 100,
    });
    const latestStatuses = [...new Map([...statuses].reverse().map((status) => [status.context, status])).values()];
    // Only the latest run of each workflow/event is relevant; cancelled obsolete
    // attempts must not be interpreted as new repair work.
    const latestRuns = [
      ...new Map([...runs].sort((a, b) => a.id - b.id).map((run) => [`${run.workflow_id}:${run.event}`, run])).values(),
    ];
    const lanes = latestRuns.filter((run) => !internal.test(run.name) && !provider.test(run.path.split("/").at(-1)));
    const ignoredSuites = new Set(
      latestRuns
        .filter((run) => internal.test(run.name) || provider.test(run.path.split("/").at(-1)))
        .map((run) => run.check_suite_id)
        .filter(Boolean),
    );
    const relevantChecks = checks.filter(
      (check) =>
        !ignoredSuites.has(check.check_suite?.id) &&
        !/^(?:Batch |Validate request and collect bounded PR evidence|Repair locally without GitHub credentials|Verify and publish an ordinary fast-forward update|Reply, resolve, rerun, and verify bounded mutations|Request Codex auto-resolve|Resolve Codex)/.test(
          check.name,
        ),
    );
    const failed = relevantChecks
      .filter((check) => failures.has(check.conclusion))
      .map((check) => ({
        name: check.name,
        conclusion: check.conclusion,
        signature: digest([check.name, check.conclusion, check.output?.title ?? ""]),
        id: check.id,
      }));
    for (const status of latestStatuses.filter((item) => ["failure", "error"].includes(item.state)))
      failed.push({ name: status.context, conclusion: status.state });
    for (const run of lanes.filter((item) => failures.has(item.conclusion)))
      failed.push({ name: `workflow:${run.name}`, conclusion: run.conclusion });
    const required = protection?.required ?? [];
    const requiredGreen =
      required.length > 0 &&
      required.every((requirement) => {
        const matches = checks.filter(
          (check) =>
            check.name === requirement.name &&
            (requirement.appId == null || requirement.appId === -1 || check.app?.id === requirement.appId),
        );
        if (matches.length)
          return matches.every((check) => check.status === "completed" && success.has(check.conclusion));
        return (
          requirement.appId == null &&
          latestStatuses.some((status) => status.context === requirement.name && status.state === "success")
        );
      });
    const workerRuns = latestRuns.filter(
      (run) => internal.test(run.name) && run.status !== "completed" && run.id !== this.runId,
    );
    if (!this.activeWorkers) {
      this.activeWorkers = [];
      for (const status of ["in_progress", "queued", "waiting", "pending"]) {
        this.activeWorkers.push(
          ...(await this.gh.paginate(this.gh.rest.actions.listWorkflowRuns, {
            ...this.repo,
            workflow_id: "codex-run-pr-operator.yml",
            status,
            per_page: 100,
          })),
        );
      }
    }
    const standaloneOutstanding = this.activeWorkers.some(
      (run) => run.display_title === `PR operator #${number}` || run.display_title === "Codex Run PR operator",
    );
    let connectorRepairOutstanding = false;
    if (threads.length) {
      const comments = await this.gh.paginate(this.gh.rest.issues.listComments, {
        ...this.repo,
        issue_number: number,
        per_page: 100,
      });
      connectorRepairOutstanding = comments.some(
        (comment) =>
          comment.user?.type === "User" &&
          comment.body?.includes(`<!-- codex-autoresolve-pr:${number} -->`) &&
          comment.body.includes(`starting commit ${raw.head.sha}`),
      );
    }
    let mergeVerified = false;
    if (raw.merged && raw.merge_commit_sha) {
      const mergedCompare = (
        await this.gh.rest.repos.compareCommitsWithBasehead({
          ...this.repo,
          basehead: `${raw.merge_commit_sha}...${base}`,
        })
      ).data;
      mergeVerified = ["ahead", "identical"].includes(mergedCompare.status);
    }
    const foreign = (await this.listOpen()).some((item) => item.number !== number && (item.armed || item.enqueued));
    return {
      number,
      nodeId: pr.id,
      title: raw.title,
      body: raw.body ?? "",
      createdAt: raw.created_at,
      state: raw.state,
      draft: raw.draft,
      fork: raw.head.repo?.full_name?.toLowerCase() !== `${this.repo.owner}/${this.repo.repo}`.toLowerCase(),
      headRef: raw.head.ref,
      head: raw.head.sha,
      baseRef: raw.base.ref,
      base,
      labels: raw.labels.map((label) => label.name),
      files,
      filesComplete: fileRows.length === raw.changed_files,
      complete: pr.headRefOid === raw.head.sha && fileRows.length === raw.changed_files,
      threads,
      failures: failed,
      inFlight:
        lanes.some((run) => run.status !== "completed") ||
        relevantChecks.some((check) => check.status !== "completed") ||
        latestStatuses.some((status) => status.state === "pending"),
      busy: workerRuns.length > 0 || connectorRepairOutstanding || standaloneOutstanding,
      behind: compare.ahead_by > 0,
      conflicting,
      conflictPaths,
      requiredGreen,
      reviewsSatisfied: pr.reviewDecision === "APPROVED" || (pr.reviewDecision === null && protection?.approvals === 0),
      mergeable: raw.mergeable === true && ["CLEAN", "HAS_HOOKS", "UNSTABLE"].includes(pr.mergeStateStatus),
      armed: !!pr.autoMergeRequest,
      enqueued: !!pr.mergeQueueEntry,
      merged: raw.merged,
      mergedAt: raw.merged_at,
      mergeCommit: raw.merge_commit_sha,
      mergeVerified,
      externalArmed: foreign,
      canaryVerified: await this.canaryProof(canaryEvidence[number], raw.head.sha, base),
      dependencyBlocked: state
        ? state.manifest.prs
            .find((item) => item.number === number)
            ?.dependencies.some((id) => state.entries.find((entry) => entry.number === id)?.state !== "merged")
        : false,
      evidenceKey: digest([
        raw.head.sha,
        base,
        threads,
        lanes.map((run) => [run.id, run.run_attempt, run.status, run.conclusion]),
      ]),
    };
  }

  async assertMutation(state, pending, expectedHead = pending?.head) {
    if (!(await this.enabled())) throw new Error("Batch switch is disabled");
    const loaded = await this.load();
    if (
      loaded.state?.status !== "running" ||
      loaded.state.manifest.id !== state.manifest.id ||
      loaded.state.pending?.id !== pending?.id
    )
      throw new Error("Batch paused or operation ownership changed");
    if (controllerHash() !== approvedPolicyHash(state))
      throw new Error("Controller policy changed; explicit new batch required");
    await this.identity();
    const pr = (await this.gh.rest.pulls.get({ ...this.repo, pull_number: pending.number })).data;
    if (
      pr.state !== "open" ||
      pr.base.ref !== "main" ||
      pr.head.sha !== expectedHead ||
      (await this.main()) !== pending.base
    )
      throw new Error("PR head/base changed before mutation");
    const rows = await this.gh.paginate(this.gh.rest.pulls.listFiles, {
      ...this.repo,
      pull_number: pending.number,
      per_page: 100,
    });
    const risk = eligibility({
      state: pr.state,
      draft: pr.draft,
      fork: pr.head.repo?.full_name?.toLowerCase() !== `${this.repo.owner}/${this.repo.repo}`.toLowerCase(),
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      title: pr.title,
      body: pr.body ?? "",
      labels: pr.labels.map((label) => label.name),
      files: rows.flatMap((file) => [file.filename, ...(file.previous_filename ? [file.previous_filename] : [])]),
      filesComplete: rows.length === pr.changed_files,
      canaryVerified: await this.canaryProof(
        state.manifest.canaryEvidence?.[pending.number],
        pr.head.sha,
        pending.base,
      ),
    });
    if (risk) throw new Error(`PR eligibility changed before mutation: ${risk}`);
    if ((await this.listOpen()).some((item) => item.number !== pending.number && (item.armed || item.enqueued)))
      throw new Error("External merge ownership appeared");
    return loaded;
  }

  async execute(state, pending, evidence) {
    await this.assertMutation(state, pending);
    if (pending.kind === "sync") {
      await this.gh.rest.pulls.updateBranch({
        ...this.repo,
        pull_number: pending.number,
        expected_head_sha: pending.head,
      });
    } else if (pending.kind === "repair") {
      await this.gh.rest.actions.createWorkflowDispatch({
        ...this.repo,
        workflow_id: "codex-run-pr-operator.yml",
        ref: "main",
        inputs: {
          pr_number: String(pending.number),
          codex_task_url: state.manifest.authorization,
          confirmation: "I authorized this PR in the linked Codex task",
          batch_id: state.manifest.id,
          batch_operation: pending.id,
        },
      });
    } else if (pending.kind === "merge") {
      const protection = await this.protections();
      const latest = await this.inspect(pending.number, { protection, state });
      if (
        !latest.complete ||
        !latest.requiredGreen ||
        !latest.reviewsSatisfied ||
        !latest.mergeable ||
        latest.behind ||
        latest.inFlight ||
        latest.failures.length ||
        latest.threads.length ||
        latest.armed ||
        latest.enqueued ||
        latest.head !== pending.head ||
        latest.base !== pending.base
      )
        throw new Error("Readiness changed before protected merge");
      // gh respects native queue requirements. --admin and branch deletion are
      // deliberately absent; --match-head-commit binds this request to the proof.
      const args = [
        "pr",
        "merge",
        String(pending.number),
        "--repo",
        `${this.repo.owner}/${this.repo.repo}`,
        "--auto",
        "--match-head-commit",
        pending.head,
      ];
      if (!evidence.queue) args.push(state.manifest.mergeMethod === "squash" ? "--squash" : "--merge");
      const result = spawnSync("gh", args, { encoding: "utf8", timeout: 60000, env: process.env });
      if (result.status !== 0)
        throw new Error(`Protected merge request failed (${result.status}); reconcile before retry`);
    } else throw new Error(`Unsupported batch mutation: ${pending.kind}`);
  }

  async findRepair(pending) {
    const runs = await this.gh.paginate(this.gh.rest.actions.listWorkflowRuns, {
      ...this.repo,
      workflow_id: "codex-run-pr-operator.yml",
      event: "workflow_dispatch",
      created: `>=${pending.at}`,
      per_page: 100,
    });
    const matches = runs.filter((run) => run.display_title === `PR batch repair ${pending.id}`);
    if (matches.length > 1) throw new Error("Duplicate repair dispatches detected");
    return matches[0] ?? null;
  }

  async verifySync(pending, evidence) {
    if (evidence.head === pending.head) return !evidence.behind;
    const commit = (await this.gh.rest.git.getCommit({ ...this.repo, commit_sha: evidence.head })).data;
    // The update-branch operation creates one normal merge commit. Merely being
    // a descendant is insufficient: an unrelated writer could have added code.
    return (
      commit.parents.length === 2 && commit.parents[0].sha === pending.head && commit.parents[1].sha === pending.base
    );
  }

  async recoverWorker(state, pending, run) {
    const pr = (await this.gh.rest.pulls.get({ ...this.repo, pull_number: pending.number })).data;
    if (![pending.head, pending.resultHead].includes(pr.head.sha))
      throw new Error("Recovery head is outside the sealed operation");
    await this.assertMutation(state, pending, pr.head.sha);
    const jobs = await this.gh.paginate(this.gh.rest.actions.listJobsForWorkflowRun, {
      ...this.repo,
      run_id: run.id,
      filter: "latest",
      per_page: 100,
    });
    const failed = jobs.filter((job) => failures.has(job.conclusion));
    if (
      !failed.length ||
      failed.some(
        (job) =>
          ![
            "Verify and publish an ordinary fast-forward update",
            "Reply, resolve, rerun, and verify bounded mutations",
          ].includes(job.name),
      )
    )
      throw new Error("Recovery would repeat an unbudgeted repair stage");
    await this.gh.request("POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs", {
      ...this.repo,
      run_id: run.id,
    });
  }

  async postMergeFailure(state) {
    for (const entry of state.entries.filter((item) => item.state === "merged")) {
      const runs = await this.gh.paginate(this.gh.rest.actions.listWorkflowRunsForRepo, {
        ...this.repo,
        head_sha: entry.mergeCommit,
        event: "push",
        per_page: 100,
      });
      if (runs.some((run) => run.name === "CI" && failures.has(run.conclusion)))
        return `post-merge-ci-failure:#${entry.number}`;
    }
    return null;
  }

  async canaryProof(pair, head, base) {
    if (!pair) return false;
    if (
      pair.head !== head ||
      pair.base !== base ||
      !Number.isSafeInteger(pair.baseline_run) ||
      !Number.isSafeInteger(pair.post_run) ||
      pair.baseline_run === pair.post_run
    )
      return false;
    const key = digest(pair);
    if (this.canaryCache.has(key)) return this.canaryCache.get(key);
    const readRun = async (id, sha) => {
      const run = (await this.gh.rest.actions.getWorkflowRun({ ...this.repo, run_id: id })).data;
      if (
        run.path !== ".github/workflows/eval-canary.yml" ||
        run.status !== "completed" ||
        run.conclusion !== "success" ||
        run.head_sha !== sha ||
        !["workflow_dispatch", "schedule"].includes(run.event)
      )
        throw new Error("Canary run provenance mismatch");
      // A candidate must not redefine the workflow that vouches for its proof.
      const workflow = (await this.gh.rest.repos.getContent({ ...this.repo, path: run.path, ref: sha })).data;
      const trusted = readFileSync(new URL("../.github/workflows/eval-canary.yml", import.meta.url), "utf8").replaceAll(
        "\r\n",
        "\n",
      );
      if (Buffer.from(workflow.content, "base64").toString("utf8").replaceAll("\r\n", "\n") !== trusted)
        throw new Error("Canary workflow was modified");
      const artifacts = await this.gh.paginate(this.gh.rest.actions.listWorkflowRunArtifacts, {
        ...this.repo,
        run_id: id,
        per_page: 100,
      });
      const candidates = artifacts.filter((item) => item.name === "eval-canary-output" && !item.expired);
      if (candidates.length !== 1 || candidates[0].size_in_bytes > 10 * 1024 * 1024)
        throw new Error("Canary artifact unavailable or oversized");
      const response = await this.gh.rest.actions.downloadArtifact({
        ...this.repo,
        artifact_id: candidates[0].id,
        archive_format: "zip",
      });
      const bytes = Buffer.from(response.data);
      if (bytes.length > 10 * 1024 * 1024) throw new Error("Canary download too large");
      const dir = mkdtempSync(join(tmpdir(), "pr-batch-canary-"));
      try {
        const archive = join(dir, "evidence.zip");
        writeFileSync(archive, bytes);
        // Read one fixed member to stdout; never extract or execute artifact paths.
        return JSON.parse(
          execFileSync("unzip", ["-p", archive, "golden-retrieval.json"], {
            encoding: "utf8",
            maxBuffer: 2 * 1024 * 1024,
            timeout: 10000,
          }),
        );
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    };
    const verified = verifyCanaryResults(await readRun(pair.baseline_run, base), await readRun(pair.post_run, head));
    this.canaryCache.set(key, verified);
    return verified;
  }
}
