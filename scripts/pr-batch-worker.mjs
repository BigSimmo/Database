import { execFileSync } from "node:child_process";
import { ACTIVE_BATCH, approvedPolicyHash, digest, protectedPath, transition, eligibility } from "./pr-batch-core.mjs";
import { controllerHash, GitHubBatch } from "./pr-batch-github.mjs";

export async function workerOwnership(api, { number, batchId = "", operationId = "", claim = false }) {
  const loaded = await api.load();
  const state = loaded.state;
  if (!batchId) {
    if (
      state &&
      ACTIVE_BATCH.has(state.status) &&
      state.entries.some((entry) => entry.number === number && !["merged", "excluded"].includes(entry.state))
    )
      throw new Error("PR is reserved by the batch runner");
    return null;
  }
  if (
    !state ||
    state.status !== "running" ||
    state.manifest.id !== batchId ||
    state.active !== number ||
    state.pending?.id !== operationId ||
    state.pending.kind !== "repair"
  )
    throw new Error("No active authorized repair operation");
  if (approvedPolicyHash(state) !== controllerHash())
    throw new Error("Worker policy differs from authorized controller");
  if (state.pending.runId && state.pending.runId !== api.runId)
    throw new Error("Repair operation already belongs to another run");
  const currentHead = (await api.gh.rest.pulls.get({ ...api.repo, pull_number: number })).data.head.sha;
  if (![state.pending.head, state.pending.resultHead].includes(currentHead))
    throw new Error("Repair head changed outside its sealed candidate");
  await api.assertMutation(state, state.pending, currentHead);
  if (claim && !state.pending.runId) {
    state.pending.runId = api.runId;
    transition(state, api.now(), "worker-claimed", { operationId, runId: api.runId });
    await api.save(loaded, state);
  }
  return {
    batch_id: batchId,
    operation_id: operationId,
    expected_head: state.pending.head,
    base_sha: state.pending.base,
    controller_hash: approvedPolicyHash(state),
    failure_fingerprint: state.pending.fingerprint,
    authorization: state.manifest.authorization,
  };
}

export async function checkpointCandidate(api, context, resultHead) {
  const batch = context.batch;
  await workerOwnership(api, {
    number: context.pull_request.number,
    batchId: batch?.batch_id,
    operationId: batch?.operation_id,
  });
  if (!batch) return;
  if (!/^[a-f0-9]{40}$/.test(resultHead)) throw new Error("Invalid candidate identity");
  const files = execFileSync("git", ["diff", "--name-only", "--no-renames", `${batch.base_sha}...${resultHead}`], {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
  const candidate = {
    ...context.pull_request,
    state: "open",
    draft: false,
    fork: false,
    headRef: context.pull_request.head_ref,
    baseRef: "main",
    files,
    filesComplete: true,
    canaryVerified: false,
  };
  const excluded = eligibility(candidate);
  if (excluded) throw new Error(`Candidate became ineligible: ${excluded}`);
  const loaded = await api.load();
  loaded.state.pending.resultHead = resultHead;
  transition(loaded.state, api.now(), "candidate-sealed", { operationId: batch.operation_id, resultHead });
  await api.save(loaded, loaded.state);
}

export async function assertWorker(api, context, publishedHead) {
  if (!context.batch) return workerOwnership(api, { number: context.pull_request.number });
  const loaded = await api.load();
  const state = loaded.state;
  if (state?.pending?.id !== context.batch.operation_id || state.pending.runId !== api.runId)
    throw new Error("Worker lease changed");
  await api.assertMutation(state, state.pending, publishedHead);
  return loaded;
}

const sanitize = (text) => String(text).replaceAll("@", "@\u200b").replaceAll("<!--", "<\u200b!--");
const secret =
  /(?:github_pat_|gh[pousr]_|sk-[A-Za-z0-9_-]{16,}|Bearer\s+[A-Za-z0-9._-]{16,}|-----BEGIN [A-Z ]+PRIVATE KEY-----)/i;

export async function applyBatchResult(api, context, result, publishedHead) {
  if (!context.batch || !Array.isArray(result.thread_dispositions) || result.thread_dispositions.length > 50)
    throw new Error("Invalid batch result");
  if (
    !Array.isArray(result.checks) ||
    result.checks.length > 50 ||
    result.checks.some((check) => typeof check !== "string" || check.length > 500) ||
    !["progress", "blocked", "no_change"].includes(result.progress_outcome)
  )
    throw new Error("Missing repair progress and verification evidence");
  if (secret.test(JSON.stringify(result))) throw new Error("Repair output resembles credential material");
  const known = new Map(context.unresolved_review_threads.map((thread) => [thread.id, thread]));
  const seen = new Set();
  for (const disposition of result.thread_dispositions) {
    if (
      !known.has(disposition.thread_id) ||
      seen.has(disposition.thread_id) ||
      !["resolve_fixed", "resolve_no_change", "leave_open"].includes(disposition.action) ||
      typeof disposition.reply !== "string" ||
      !disposition.reply.trim() ||
      disposition.reply.length > 4000 ||
      secret.test(disposition.reply)
    )
      throw new Error("Unsafe review disposition");
    if (
      disposition.action === "resolve_fixed" &&
      (publishedHead === context.pull_request.head_sha || !result.checks.length)
    )
      throw new Error("Fixed disposition lacks published change or verification");
    if (disposition.action !== "leave_open" && known.get(disposition.thread_id).evidence_complete === false)
      throw new Error("Truncated thread evidence cannot authorize resolution");
    seen.add(disposition.thread_id);
  }
  const reruns = result.rerun_failed_run_ids;
  if (!Array.isArray(reruns) || reruns.length > 1 || (reruns.length && publishedHead !== context.pull_request.head_sha))
    throw new Error("Invalid failed-job rerun plan");
  const effect = async (key, action) => {
    const loaded = await assertWorker(api, context, publishedHead);
    const pending = loaded.state.pending;
    pending.effects ??= {};
    if (pending.effects[key]?.done) return;
    const replaying = Boolean(pending.effects[key]);
    if (!pending.effects[key]) {
      if (key.startsWith("rerun:")) {
        const entry = loaded.state.entries.find((item) => item.number === pending.number);
        entry.reruns ??= {};
        if (entry.reruns[key] && entry.reruns[key] !== pending.id)
          throw new Error("This workflow has already used its PR rerun allowance");
        entry.reruns[key] = pending.id;
      }
      pending.effects[key] = { started: api.now(), done: false };
      transition(loaded.state, api.now(), "effect-intent", { operationId: pending.id, effect: key });
      await api.save(loaded, loaded.state);
    }
    // Each action reconciles remote identity before emitting a write. No blind
    // retry after a lost acknowledgement, including replies and rerun requests.
    await action(replaying);
    const after = await assertWorker(api, context, publishedHead);
    after.state.pending.effects[key].done = true;
    transition(after.state, api.now(), "effect-observed", { operationId: pending.id, effect: key });
    await api.save(after, after.state);
  };
  const currentThread = async (id) =>
    (
      await api.gh.graphql(
        `query BatchCurrentThread($id:ID!) { node(id:$id) { ... on PullRequestReviewThread {
    id isResolved comments(last:1) { totalCount nodes { databaseId } }
  } } }`,
        { id },
      )
    ).node;
  for (const disposition of result.thread_dispositions) {
    const thread = known.get(disposition.thread_id);
    const marker = `<!-- pr-batch:${context.batch.operation_id}:${digest(disposition).slice(0, 20)} -->`;
    await effect(`reply:${thread.id}`, async (replaying) => {
      const comments = await api.gh.paginate(api.gh.rest.pulls.listReviewComments, {
        ...api.repo,
        pull_number: context.pull_request.number,
        per_page: 100,
      });
      const existing = comments.find(
        (comment) =>
          comment.user?.login === "BigSimmo" &&
          comment.in_reply_to_id === thread.root_comment_id &&
          comment.body.endsWith(marker),
      );
      if (existing) return;
      if (replaying)
        throw new Error("Earlier reply intent has no observable acknowledgement; refusing duplicate reply");
      const current = await currentThread(thread.id);
      if (current.isResolved) return;
      if (
        current.comments.totalCount !== thread.comment_count ||
        current.comments.nodes[0]?.databaseId !== thread.latest_comment_id
      )
        throw new Error("Review thread changed after repair evidence");
      await assertWorker(api, context, publishedHead);
      await api.gh.request("POST /repos/{owner}/{repo}/pulls/{pull_number}/comments/{comment_id}/replies", {
        ...api.repo,
        pull_number: context.pull_request.number,
        comment_id: thread.root_comment_id,
        body: `${sanitize(disposition.reply)}\n\nVerified head: ${publishedHead}\n${marker}`,
      });
    });
    if (disposition.action === "leave_open") continue;
    await effect(`resolve:${thread.id}`, async () => {
      const current = await currentThread(thread.id);
      if (current.isResolved) return;
      const comments = await api.gh.paginate(api.gh.rest.pulls.listReviewComments, {
        ...api.repo,
        pull_number: context.pull_request.number,
        per_page: 100,
      });
      const reply = comments.find(
        (comment) =>
          comment.user?.login === "BigSimmo" &&
          comment.in_reply_to_id === thread.root_comment_id &&
          comment.body.endsWith(marker),
      );
      if (
        !reply ||
        current.comments.nodes[0]?.databaseId !== reply.id ||
        current.comments.totalCount !== thread.comment_count + 1
      )
        throw new Error("New review activity appeared before resolution");
      await assertWorker(api, context, publishedHead);
      await api.gh.graphql(
        "mutation BatchResolve($id:ID!) { resolveReviewThread(input:{threadId:$id}) { thread { isResolved } } }",
        { id: thread.id },
      );
    });
  }
  for (const runId of reruns) {
    const original = context.failed_workflow_runs.find((run) => run.id === runId);
    if (!original || !Number.isInteger(original.run_attempt))
      throw new Error("Rerun lacks an exact recorded workflow attempt");
    await effect(`rerun:${runId}`, async (replaying) => {
      const run = (await api.gh.rest.actions.getWorkflowRun({ ...api.repo, run_id: runId })).data;
      if (run.head_sha !== publishedHead) throw new Error("Rerun head mismatch");
      if (run.run_attempt > original.run_attempt || run.status !== "completed") return;
      if (replaying) throw new Error("Earlier rerun intent has no observable new attempt; refusing duplicate rerun");
      if (run.conclusion !== "failure") throw new Error("Requested workflow is no longer failed");
      await assertWorker(api, context, publishedHead);
      await api.gh.request("POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs", {
        ...api.repo,
        run_id: runId,
      });
    });
  }
  const loaded = await assertWorker(api, context, publishedHead);
  loaded.state.pending.completed = true;
  loaded.state.pending.outcome = result.progress_outcome;
  loaded.state.pending.verification = result.checks;
  transition(loaded.state, api.now(), "worker-completed", {
    operationId: context.batch.operation_id,
    outcome: result.progress_outcome,
  });
  await api.save(loaded, loaded.state);
}

export { GitHubBatch, protectedPath };
