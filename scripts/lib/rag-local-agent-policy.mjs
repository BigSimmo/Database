const models = ["gpt-5.6-terra", "gpt-5.6-sol", "gpt-6-astra"];
const roles = [
  "writer",
  "scout",
  "reviewer",
  "retrieval-review",
  "governance-review",
  "ui-review",
  "phase-review",
  "final-review",
];
const risks = ["mechanical", "routine", "integration", "clinical", "privacy", "security", "concurrency", "ambiguous"];
const inputKeys = new Set([
  "phase",
  "task",
  "role",
  "risk",
  "profile",
  "model",
  "effort",
  "forkTurns",
  "writerFrozen",
  "activeWriters",
  "activeReviewers",
  "activeScouts",
  "useSpareSlot",
  "correctionRound",
  "failureKind",
  "contextRepairCompleted",
  "previousModel",
  "previousEffort",
  "reuseAgentId",
  "writerAgentId",
  "unresolvedSeverities",
]);

function requireValue(condition, message) {
  if (!condition) throw new Error(`[rag-local-agent-policy] ${message}`);
}

function validRoute(route) {
  return (
    route &&
    models.includes(route.model) &&
    (route.model === "gpt-5.6-terra"
      ? route.reasoning_effort === "medium"
      : ["high", "xhigh"].includes(route.reasoning_effort))
  );
}

export function validateLocalAgentPolicy(manifest) {
  const p = manifest?.localAgentPolicy;
  requireValue(
    p?.schemaVersion === 1 && p.policyId === "rag-local-smart-agents-v1",
    "missing or unsupported local policy",
  );
  requireValue(
    p.controller?.model === "gpt-6-astra" && p.controller.reasoning_effort === "high",
    "controller must be Astra High",
  );
  const expectedProfiles = {
    mechanical: ["gpt-5.6-terra", "medium"],
    routine: ["gpt-5.6-sol", "high"],
    sensitive: ["gpt-6-astra", "high"],
  };
  requireValue(
    Object.keys(p.profiles ?? {})
      .sort()
      .join() === Object.keys(expectedProfiles).sort().join(),
    "unknown profile",
  );
  for (const [name, [model, effort]] of Object.entries(expectedProfiles)) {
    requireValue(
      p.profiles[name]?.model === model && p.profiles[name]?.reasoning_effort === effort,
      `invalid ${name} route`,
    );
  }
  requireValue(
    Object.keys(p.riskProfiles ?? {})
      .sort()
      .join() === [...risks].sort().join(),
    "unknown risk policy",
  );
  for (const risk of risks)
    requireValue(
      p.riskProfiles[risk] === (risk === "mechanical" ? "mechanical" : risk === "routine" ? "routine" : "sensitive"),
      `invalid ${risk} policy`,
    );
  const types = [
    "worker",
    "explorer",
    "default",
    "rag-retrieval-reviewer",
    "clinical-governance-reviewer",
    "frontend-ui-reviewer",
    "default",
    "default",
  ];
  requireValue(
    Object.keys(p.roles ?? {})
      .sort()
      .join() === [...roles].sort().join(),
    "unknown role policy",
  );
  roles.forEach((role, i) => requireValue(p.roles[role] === types[i], `invalid agent_type for ${role}`));
  requireValue(p.formalReviewRoles?.join() === roles.slice(2).join(), "formal review roles cannot be weakened");
  requireValue(p.sensitiveWriterTasks?.includes("P08B/6"), "P08B Task6 sensitive floor is required");
  for (const entry of p.sensitiveWriterTasks) {
    const [phase, task] = entry.split("/");
    requireValue(
      manifest.phases.some((item) => item.id === phase && item.tasks.includes(Number(task))),
      "unknown sensitive task",
    );
  }
  requireValue(
    JSON.stringify(p.phaseReviewOverrides) ===
      JSON.stringify({
        P08B: { "retrieval-review": "gpt-6-astra", "governance-review": "gpt-6-astra", "ui-review": "gpt-5.6-sol" },
      }),
    "P08B specialty routes cannot be weakened",
  );
  requireValue(
    p.finalReview?.phase === "P17" &&
      p.finalReview.model === "gpt-6-astra" &&
      p.finalReview.reasoning_effort === "xhigh",
    "invalid final review route",
  );
  requireValue(
    p.capacity?.childSlots === 3 && p.capacity.defaultChildLimit === 2 && p.capacity.maxWriters === 1,
    "invalid concurrency policy",
  );
  requireValue(
    p.childForkTurns === "none" && p.childSpawningAllowed === false && p.automaticLaunchAllowed === false,
    "local plans cannot launch agents or permit child spawning",
  );
  requireValue(
    p.correctionPolicy?.resumeThroughRound === 3 &&
      p.correctionPolicy.freshEscalationRounds?.join() === "4,5" &&
      p.correctionPolicy.breakerRound === 6 &&
      p.correctionPolicy.contextRepairRequiredBeforeEscalation === true &&
      p.correctionPolicy.environmentFailureIsModelFailure === false,
    "invalid correction policy",
  );
  return p;
}

export function planLocalAgent(manifest, input) {
  const p = validateLocalAgentPolicy(manifest);
  requireValue(input && typeof input === "object" && !Array.isArray(input), "input must be an object");
  for (const key of Object.keys(input)) requireValue(inputKeys.has(key), `unknown input ${key}`);
  const phase = manifest.phases.find((item) => item.id === input.phase);
  requireValue(phase && Number.isInteger(input.task) && phase.tasks.includes(input.task), "unknown phase/task");
  requireValue(
    roles.includes(input.role) && risks.includes(input.risk),
    "explicit supported role and risk are required",
  );
  requireValue(["high", "xhigh"].includes(phase.reviewReasoning), "unknown phase review floor");
  for (const key of ["writerFrozen", "useSpareSlot", "contextRepairCompleted"])
    requireValue(input[key] === undefined || typeof input[key] === "boolean", `${key} must be boolean`);
  for (const key of ["reuseAgentId", "writerAgentId"])
    requireValue(
      input[key] === undefined || (typeof input[key] === "string" && /^[A-Za-z0-9._:/-]+$/.test(input[key])),
      `${key} must be a bounded identity`,
    );
  const counts = ["activeWriters", "activeReviewers", "activeScouts"].map((key) => {
    const count = input[key] ?? 0;
    requireValue(Number.isInteger(count) && count >= 0 && count <= 3, `invalid ${key}`);
    return count;
  });
  const [writers, reviewers] = counts;
  requireValue(writers <= 1, "only one writer is permitted");
  const formal = p.formalReviewRoles.includes(input.role);
  requireValue(
    input.role !== "writer" || (writers === 0 && reviewers === 0),
    "writer cannot overlap another writer or reviewer",
  );
  requireValue(
    !formal || (input.writerFrozen === true && writers === 0 && !input.reuseAgentId),
    "review requires writer freeze and a fresh independent identity",
  );
  requireValue(!(writers && reviewers), "active writer and reviewers cannot overlap");
  const active = counts.reduce((sum, count) => sum + count, 0);
  requireValue(active + 1 <= p.capacity.childSlots, "child capacity exceeded");
  requireValue(
    input.useSpareSlot === true || active + 1 <= p.capacity.defaultChildLimit,
    "retain one spare slot or explicitly request its use",
  );
  let profile = p.riskProfiles[input.risk];
  if (input.role === "writer" && p.sensitiveWriterTasks.includes(`${phase.id}/${input.task}`)) profile = "sensitive";
  requireValue(input.profile === undefined || input.profile === profile, "profile conflicts with task/risk floor");
  let route = { ...p.profiles[profile] };
  if (formal) {
    // Mechanical implementers do not imply mechanical formal reviews.
    if (route.model === "gpt-5.6-terra") route = { ...p.profiles.routine };
    route.model = p.phaseReviewOverrides[phase.id]?.[input.role] ?? route.model;
    route.reasoning_effort = phase.reviewReasoning;
  }
  if (input.role === "final-review") {
    requireValue(phase.id === p.finalReview.phase, "final programme review requires P17");
    route = { model: p.finalReview.model, reasoning_effort: p.finalReview.reasoning_effort };
  }
  const round = input.correctionRound ?? 0;
  requireValue(
    Number.isInteger(round) && round >= 0 && round <= p.correctionPolicy.breakerRound,
    "invalid correction round",
  );
  requireValue(
    input.failureKind === undefined || ["context", "substantive", "environment"].includes(input.failureKind),
    "unknown failure kind",
  );
  const severities = input.unresolvedSeverities ?? [];
  requireValue(
    Array.isArray(severities) && severities.every((value) => ["Critical", "Important", "Minor"].includes(value)),
    "unknown unresolved severity",
  );
  requireValue(round === 0 || input.role === "writer", "corrections belong to the writer");
  const hasPrevious = input.previousModel !== undefined || input.previousEffort !== undefined;
  requireValue(
    !hasPrevious || validRoute({ model: input.previousModel, reasoning_effort: input.previousEffort }),
    "invalid previous model/effort",
  );
  let continuation = "fresh";
  let escalation = null;
  if (round > 0 && round <= p.correctionPolicy.resumeThroughRound) {
    requireValue(
      Boolean(input.writerAgentId) && input.reuseAgentId === input.writerAgentId,
      "rounds 1-3 require matching declared writer and reuse identities",
    );
    requireValue(hasPrevious, "resume requires the existing writer's explicit previous model/effort");
    const efforts = ["medium", "high", "xhigh"];
    requireValue(
      models.indexOf(input.previousModel) >= models.indexOf(route.model) &&
        efforts.indexOf(input.previousEffort) >= efforts.indexOf(route.reasoning_effort),
      "existing writer is below the current route floor; require fresh controlled escalation",
    );
    // A follow-up cannot change an existing agent's model or reasoning effort.
    route = { model: input.previousModel, reasoning_effort: input.previousEffort };
    continuation = "resume-writer";
  }
  if (p.correctionPolicy.freshEscalationRounds.includes(round)) {
    requireValue(input.contextRepairCompleted === true, "repair context before model escalation");
    requireValue(input.failureKind === "substantive", "environment/context failure is not a model escalation");
    requireValue(hasPrevious && !input.reuseAgentId, "fresh escalation requires the previous route and a new identity");
    const index = models.indexOf(input.previousModel);
    const upgraded = models[Math.min(index + 1, models.length - 1)];
    const model = models[Math.max(models.indexOf(route.model), models.indexOf(upgraded))];
    route = {
      model,
      reasoning_effort: input.previousModel === "gpt-6-astra" || route.reasoning_effort === "xhigh" ? "xhigh" : "high",
    };
    continuation = "fresh-escalation";
    escalation = {
      previousModel: input.previousModel,
      previousEffort: input.previousEffort,
      reason: input.failureKind,
      round,
      contextRepairCompleted: true,
    };
  }
  requireValue(input.model === undefined || input.model === route.model, "selected model conflicts with planned route");
  requireValue(
    input.effort === undefined || input.effort === route.reasoning_effort,
    "selected effort conflicts with planned route",
  );
  requireValue(input.forkTurns === undefined || input.forkTurns === "none", "child dispatch requires fork_turns none");
  requireValue(validRoute(route), "unsupported route; no fallback is permitted");
  const blocked = round === p.correctionPolicy.breakerRound;
  return {
    schemaVersion: 1,
    policyId: p.policyId,
    evidenceKind: "intended-local-dispatch",
    status: blocked ? "BLOCKED_CORRECTION_BREAKER" : "PREPARED",
    executionAuthorized: false,
    runtimeVerified: false,
    acceptanceAllowed: false,
    formalReview: formal,
    controller: { ...p.controller },
    phase: phase.id,
    task: input.task,
    role: input.role,
    risk: input.risk,
    profile,
    dispatch: blocked ? null : { ...route, fork_turns: "none", agent_type: p.roles[input.role] },
    continuation,
    reuseAgentId: continuation === "resume-writer" ? input.reuseAgentId : null,
    escalation,
    unresolvedSeverities: severities,
    capacity: { childSlots: p.capacity.childSlots, remaining: p.capacity.childSlots - active - (blocked ? 0 : 1) },
    constraints: [
      "No automatic launch or child spawning",
      "Controller supplies task_name and the exact owned brief message",
      "Dispatch configuration is not runtime evidence or permission",
      "Unresolved Critical/Important findings cannot be accepted",
    ],
    requiredBrief:
      phase.id === "P08B" && input.task === 6 ? ".superpowers/sdd/P08B-task-6-correction-r3-brief.md" : null,
  };
}

export function parseLocalAgentOptions(argv, extraValueFlags = []) {
  const valueMap = {
    "--target": "phase",
    "--phase": "phase",
    "--task": "task",
    "--role": "role",
    "--risk": "risk",
    "--profile": "profile",
    "--model": "model",
    "--effort": "effort",
    "--fork-turns": "forkTurns",
    "--active-writers": "activeWriters",
    "--active-reviewers": "activeReviewers",
    "--active-scouts": "activeScouts",
    "--correction-round": "correctionRound",
    "--failure-kind": "failureKind",
    "--previous-model": "previousModel",
    "--previous-effort": "previousEffort",
    "--reuse-agent-id": "reuseAgentId",
    "--writer-agent-id": "writerAgentId",
    "--unresolved": "unresolvedSeverities",
  };
  const booleans = {
    "--writer-frozen": "writerFrozen",
    "--context-repaired": "contextRepairCompleted",
    "--use-spare-slot": "useSpareSlot",
  };
  const numeric = new Set(["task", "activeWriters", "activeReviewers", "activeScouts", "correctionRound"]);
  const input = {};
  const seen = new Set();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    requireValue(!seen.has(flag), `duplicate flag ${flag}`);
    seen.add(flag);
    if (booleans[flag]) {
      input[booleans[flag]] = true;
      continue;
    }
    requireValue(Boolean(valueMap[flag]) || extraValueFlags.includes(flag), `unknown flag ${flag}`);
    const raw = argv[++i];
    requireValue(raw && !raw.startsWith("--"), `${flag} requires a value`);
    const key = valueMap[flag];
    if (!key) continue;
    requireValue(input[key] === undefined, `duplicate selector ${key}`);
    if (numeric.has(key)) requireValue(/^\d+$/.test(raw), `${flag} must be an integer`);
    input[key] = numeric.has(key) ? Number(raw) : key === "unresolvedSeverities" ? raw.split(",") : raw;
  }
  return input;
}
