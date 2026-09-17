import {
  ACTIVE_BATCH,
  approvedPolicyHash,
  CONFIRMATION,
  createBatch,
  decide,
  eligibility,
  report,
  transition,
} from "./pr-batch-core.mjs";
import { controllerHash, GitHubBatch } from "./pr-batch-github.mjs";

export async function runBatch(
  api,
  { operation = "wake", inputs = {}, repairAvailable = false, codeHash = controllerHash() } = {},
) {
  let loaded = await api.load();
  let state = loaded.state;
  const now = api.now();
  const persist = async (kind, detail = {}) => {
    transition(state, now, kind, detail);
    loaded = await api.save(loaded, state);
  };
  const pause = async (reason) => {
    state.status = "paused";
    state.reason = reason;
    await persist("paused", { reason });
    return report(state);
  };
  if (["start", "resume", "pause"].includes(operation) && api.actor !== "BigSimmo")
    throw new Error("Only BigSimmo may control a batch");
  if (["start", "resume"].includes(operation) && inputs.confirmation !== CONFIRMATION)
    throw new Error("Explicit batch authorization confirmation required");
  if (operation === "status") return state ? report(state) : { status: "no-batch" };
  if (operation === "pause")
    return state && ACTIVE_BATCH.has(state.status)
      ? pause("operator-paused; an existing merge request is not revoked")
      : { status: "no-active-batch" };
  if (operation !== "dry-run" && !(await api.enabled())) {
    if (["start", "resume"].includes(operation))
      throw new Error("PR_BATCH_ENABLED must be explicitly enabled before activation");
    return { status: "disabled", active: state?.active ?? null };
  }
  if (["start", "dry-run"].includes(operation)) {
    if (operation === "start" && state && ACTIVE_BATCH.has(state.status))
      throw new Error("An existing batch must finish before another starts");
    await api.identity();
    const protection = await api.protections();
    if (!protection.mergeMethod) throw new Error("No approved merge or squash method is available");
    const open = await api.listOpen();
    if (open.some((pr) => pr.armed || pr.enqueued))
      throw new Error("An existing armed/enqueued PR must settle before launch");
    const requested = String(inputs.pr_numbers ?? "").trim();
    const canaryEvidence = JSON.parse(inputs.canary_evidence || "{}");
    if (!canaryEvidence || Array.isArray(canaryEvidence) || typeof canaryEvidence !== "object")
      throw new Error("Canary evidence must be an object keyed by PR number");
    if (requested && !/^\d+(?:\s*,\s*\d+)*$/.test(requested))
      throw new Error("PR list must be comma-separated positive integers");
    const numbers = requested ? [...new Set(requested.split(",").map(Number))] : open.map((pr) => pr.number);
    if (numbers.length > 200 || numbers.some((number) => number < 1 || !open.some((pr) => pr.number === number)))
      throw new Error("Batch must contain at most 200 currently open main-target PRs");
    const prs = [];
    for (const number of numbers) prs.push(await api.inspect(number, { protection, canaryEvidence }));
    if (operation === "dry-run")
      return {
        status: "dry-run",
        mergeMethod: protection.mergeMethod,
        queue: protection.queue,
        entries: prs.map((pr) => ({ number: pr.number, exclusion: eligibility(pr), busy: pr.busy })),
        repairsAvailable: repairAvailable,
      };
    if (!repairAvailable)
      throw new Error("OPENAI_API_KEY must be configured before starting a repair-authorized batch");
    state = createBatch({
      prs,
      actor: api.actor,
      authorization: inputs.authorization,
      controllerHash: codeHash,
      mergeMethod: protection.mergeMethod,
      id: `batch-${api.runId}`,
      now,
      perPr: Number(inputs.per_pr_limit || 3),
      total: Number(inputs.batch_limit || 30),
      canaryEvidence,
    });
    await persist("launched");
  }
  if (!state || !ACTIVE_BATCH.has(state.status)) return state ? report(state) : { status: "no-batch" };
  if (approvedPolicyHash(state) !== codeHash && operation !== "resume")
    return state.status === "paused" ? report(state) : pause("trusted-controller-changed");
  if (operation === "resume") {
    await api.identity();
    if (approvedPolicyHash(state) !== codeHash) {
      // The original manifest remains immutable; an explicit owner resume can
      // authorize the newly installed trusted policy as a separate transition.
      state.approvedControllerHash = codeHash;
      await persist("policy-reauthorized", { controllerHash: codeHash, actor: api.actor });
    }
    // A paused ambiguous external effect cannot be cleared by a resume click.
    // Reconciliation retains the operation and expected identities.
    state.status = "running";
    state.reason = null;
    state.resumedAt = now;
    const entry = state.entries.find((item) => item.number === state.active);
    if (entry && !state.pending && entry.state !== "merge_requested") {
      const evidence = await api.inspect(entry.number, { protection: await api.protections(), state });
      if (eligibility(evidence) || evidence.busy || evidence.armed || evidence.enqueued)
        return pause("resume-ownership-or-eligibility-unproved");
      entry.head = evidence.head;
      entry.progressAt = now;
    }
    await persist("resumed");
  }
  if (state.status !== "running") return report(state);
  try {
    if (Date.parse(now) - Date.parse(state.resumedAt) >= 86400000) return pause("batch-deadline");
    const postFailure = await api.postMergeFailure(state);
    if (postFailure) return pause(postFailure);
    const protection = await api.protections();
    if (protection.mergeMethod !== state.manifest.mergeMethod) return pause("merge-policy-changed");
    if ((await api.listOpen()).some((pr) => pr.number !== state.active && (pr.armed || pr.enqueued)))
      return pause("external-merge-ownership");
    // A bounded loop may select/close metadata-only entries but emits at most one
    // GitHub work request per invocation. No runner sits waiting for CI.
    for (let step = 0; step < state.entries.length + 3; step++) {
      let entry = state.entries.find((item) => item.number === state.active);
      let evidence = entry ? await api.inspect(entry.number, { protection, state }) : null;
      if (state.pending) {
        const pending = state.pending;
        if (!entry || entry.number !== pending.number) return pause("pending-operation-owner-mismatch");
        if (evidence.externalArmed) return pause("external-merge-ownership");
        if (pending.kind === "sync") {
          if (evidence.head === pending.head && evidence.behind) {
            if (Date.parse(now) - Date.parse(pending.at) > 900000)
              return pause("branch-update-unobserved; reconcile manually before retry");
            return report(state);
          }
          if (!(await api.verifySync(pending, evidence))) return pause("branch-update-ancestry-unproved");
          entry.head = evidence.head;
          entry.state = "preparing";
          entry.progressAt = now;
          state.pending = null;
          await persist("branch-updated", { number: entry.number, head: entry.head });
          evidence = await api.inspect(entry.number, { protection, state });
        } else if (pending.kind === "merge") {
          if (evidence.merged || evidence.armed || evidence.enqueued) {
            entry.state = "merge_requested";
            state.pending = null;
            await persist("merge-request-observed", { number: entry.number });
          } else return pause("merge-request-unobserved; do not rearm automatically");
        }
      }
      const decision = decide(state, evidence, now);
      if (decision.action === "select") {
        state.active = decision.number;
        entry = state.entries.find((item) => item.number === decision.number);
        entry.state = "preparing";
        entry.progressAt = now;
        await persist("selected", { number: entry.number });
        continue;
      }
      if (decision.action === "pause") return pause(decision.reason);
      if (decision.action === "park") {
        entry.state = "parked";
        entry.reason = decision.reason;
        entry.retryCondition = evidence.base;
        state.active = null;
        await persist("parked", { number: entry.number, reason: decision.reason });
        continue;
      }
      if (decision.action === "merged") {
        entry.state = "merged";
        entry.mergeCommit = decision.commit;
        entry.mergedAt = evidence.mergedAt;
        entry.reason = null;
        state.active = null;
        await persist("merged", { number: entry.number, commit: decision.commit });
        continue;
      }
      if (decision.action === "finish-pass") {
        if (state.pass === 0) {
          state.pass = 1;
          const base = await api.main();
          for (const candidate of state.entries.filter(
            (item) =>
              item.state === "parked" &&
              !item.retried &&
              ["dependency-blocked", "no-progress-timeout"].includes(item.reason),
          )) {
            if (candidate.retryCondition !== base) {
              candidate.retried = true;
              candidate.state = "queued";
              candidate.reason = null;
            }
          }
          await persist("retry-pass");
          if (state.entries.some((item) => item.state === "queued")) continue;
        }
        state.status = state.entries.every((item) => item.state === "merged")
          ? "all_merged"
          : "completed_with_unresolved";
        await persist("completed");
        return report(state);
      }
      if (["sync", "merge"].includes(decision.action)) {
        // Re-read everything immediately before committing intent; after intent,
        // the adapter independently checks switch, ownership, head and base again.
        const current = await api.inspect(entry.number, { protection, state });
        if (current.evidenceKey !== evidence.evidenceKey || decide(state, current, now).action !== decision.action)
          return report(state);
        state.pending = {
          id: `${state.manifest.id}-${state.revision + 1}`,
          number: entry.number,
          kind: decision.action,
          head: evidence.head,
          base: evidence.base,
          at: now,
        };
        if (decision.action === "merge") entry.state = "ready";
        await persist("intent", { operation: state.pending });
        await api.execute(state, state.pending, { ...evidence, queue: protection.queue });
        await persist("request-sent", { operationId: state.pending.id });
        return report(state);
      }
      if (decision.action === "wait" && entry.reason !== decision.reason) {
        if (entry.state !== "merge_requested") entry.state = "waiting_ci";
        entry.reason = decision.reason;
        await persist("waiting", { number: entry.number, reason: decision.reason });
      }
      return report(state);
    }
    return report(state);
  } catch (error) {
    // Do not leak remote log or API payloads into the state branch.
    return pause(`controller-error:${error.status ?? error.name ?? "unknown"}; inspect Actions evidence before resume`);
  }
}

export async function workflowMain({ github, context, core, inputs, repairAvailable }) {
  const api = new GitHubBatch(github, { ...context.repo, runId: context.runId, actor: context.actor });
  if (context.eventName !== "workflow_dispatch" && context.eventName !== "schedule") {
    const { state } = await api.load();
    if (!state || state.status !== "running") return { status: "no-active-batch" };
    const pr = context.payload.pull_request;
    if (
      pr &&
      pr.number !== state.active &&
      !["auto_merge_enabled", "auto_merge_disabled"].includes(context.payload.action)
    )
      return { status: "unrelated-event" };
    const run = context.payload.workflow_run;
    const active = state.manifest.prs.find((entry) => entry.number === state.active);
    if (
      run &&
      active &&
      run.head_branch !== active.headRef &&
      !run.head_branch?.startsWith("gh-readonly-queue/main/") &&
      !run.pull_requests?.some((item) => item.number === state.active) &&
      !state.entries.some((entry) => entry.mergeCommit === run.head_sha)
    )
      return { status: "unrelated-event" };
  }
  const result = await runBatch(api, {
    operation: context.eventName === "workflow_dispatch" ? inputs.operation : "wake",
    inputs,
    repairAvailable,
  });
  core.setOutput("status", result.status);
  await core.summary
    .addHeading("PR batch runner")
    .addCodeBlock(JSON.stringify(result, null, 2), "json")
    .write();
  if (result.status === "paused") core.warning(`PR batch paused: ${result.reason}`);
  return result;
}
