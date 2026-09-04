import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  acquireLease,
  assertCommonTransitionSourceSha,
  assertCheckoutMatchesSnapshot,
  assertDurableCheckpoint,
  assertFrozenVerifierCheckout,
  assertIntegratedRecord,
  assertTransitionEvidenceWindow,
  buildChatExportEnvelope,
  buildExpectedSourceInventory,
  buildHandoverRecord,
  buildRecreationPrompt,
  canonicalJson,
  certifyReset,
  durableDirtyArtifactManifest,
  handoverRelativePath,
  latestHandover,
  loadCommittedAssignment,
  pathsOverlap,
  publishHandover,
  sha256,
  loadCommittedCriterion,
  validateControlPlane,
  validateCurrentTruthManifest,
  validateHandoverDraft,
  validateHandoverRecord,
  validateRoleDiff,
  validateRolesContract,
  validateRunnerReceiptCandidate,
  validateSystemState,
  verifyRecoveryBundleGate,
  writeHandoverRecord,
} from "../scripts/ward-flow/chat-control.mjs";
import { receiptKey } from "../scripts/gate-receipts.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const controlRoot = path.join(projectRoot, "docs", "ward-flow", "control");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

function temporaryDirectory(prefix: string) {
  const directory = mkdtempSync(path.join(tmpdir(), prefix));
  temporaryDirectories.push(directory);
  return directory;
}

function git(root: string, args: string[], encoding: BufferEncoding | "buffer" = "utf8") {
  return execFileSync("git", args, {
    cwd: root,
    encoding: encoding as BufferEncoding,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function gitText(root: string, args: string[]) {
  return String(git(root, args)).trim();
}

function readJson(relative: string) {
  return JSON.parse(readFileSync(path.join(controlRoot, relative), "utf8"));
}

function validModelRouting(tier: "opus" | "sonnet" = "opus") {
  return {
    tier,
    reason:
      tier === "opus"
        ? "This is the first task of its shape and sets the implementation pattern."
        : "This is a repeated, fully specified mechanical task with a decisive test.",
    catcher: tier === "sonnet" ? { kind: "test", reference: "The focused test fails when the result is wrong." } : null,
    taskShape: "bounded Ward Flow implementation",
    firstOfShape: tier === "opus",
    priorSonnetReviewRejections: 0,
    vetoes: {
      clinicalLegalPrivacyOrPatientFacing: false,
      finalUncheckedOrJudgementCriterion: false,
      testStrengthOrMutation: false,
      unknownCauseDebugging: false,
      specPlanBriefOrDecisionRecord: false,
    },
  };
}

type SubagentDispatchFixture = {
  task: string;
  modelTier: "opus" | "sonnet";
  routingReason: string;
  outcome: "completed" | "blocked" | "rejected";
  decisiveEvidence: string;
  reviewedByParent: boolean;
  stopRuleIncluded: boolean;
  catcher: { kind: string; reference: string } | null;
};

function validDraft(role: "lead" | "builder" | "verifier" = "lead") {
  const evidence: {
    outcome: string;
    decisiveEvidence: string;
    targetSha?: string;
    acceptanceCriterion?: string;
    falsifier?: string;
    action?: string;
  }[] =
    role === "verifier"
      ? [
          {
            targetSha: "2".repeat(40),
            acceptanceCriterion: "The frozen target meets the stated contract.",
            falsifier: "Any observed contract breach falsifies acceptance.",
            action: "Run the named local verification against the frozen SHA.",
            outcome: "passed",
            decisiveEvidence: "The decisive assertion passed.",
          },
        ]
      : [{ outcome: "passed", decisiveEvidence: "The focused local check passed." }];
  return {
    schemaVersion: 1,
    role,
    sessionLabel: `Ward ${role}`,
    reason: "context-reset",
    task: {
      id: "WF-TEST-001",
      status: "complete",
      objective: "Prove the reset contract.",
      baseSha: "1".repeat(40),
      ownedPaths: role === "builder" ? ["feature.txt"] : role === "verifier" ? [] : ["docs/ward-flow/control/"],
      completionCommit: "2".repeat(40),
      assignmentPath:
        role === "builder" ? `docs/ward-flow/control/assignments/${"a".repeat(64)}.assignment.json` : null,
      verificationTarget: role === "verifier" ? "2".repeat(40) : null,
    },
    content: {
      summary: "All unique operational content is recorded.",
      decisions: [],
      completedWork: [{ summary: "Reset contract completed." }],
      pendingWork: [],
      questions: [],
      evidence,
      risks: [],
      subagentDispatches: [] as SubagentDispatchFixture[],
      nextAction: "Start from the committed recreation prompt.",
    },
    integration: {
      status: role === "builder" ? "integrated" : "not-required",
      commit: role === "builder" ? "3".repeat(40) : null,
      targetBranch: readJson("system-state.json").integrationBranch,
      durableCheckpoint: null,
    },
    contentAudit: {
      decisionsCaptured: true,
      workCaptured: true,
      questionsCaptured: true,
      evidenceCaptured: true,
      uncommittedWorkCaptured: true,
      noUniqueChatContentRemaining: true,
    },
    privacyAudit: {
      syntheticOnly: true,
      noSecrets: true,
      noPatientData: true,
    },
  };
}

/**
 * A criterion for fixtures whose subject is NOT criterion validation — handover publication and
 * reset. Shape-valid so readActiveLease accepts it; the real committed-and-hashed checks live in
 * their own describe block, so these tests stay about the thing they name.
 */
const FIXTURE_CRITERION = {
  relative: "docs/ward-flow/control/evidence/criteria/fixture.json",
  sha256: "c".repeat(64),
};

function fakeLease(role = "lead", instanceId = "ward-lead-test", generation = 1) {
  return {
    lease: { role, instanceId, generation, targetSha: role === "verifier" ? "2".repeat(40) : null },
    sha256: "b".repeat(64),
  };
}

function copyControlFixture(root: string) {
  writeFileSync(path.join(root, "AGENTS.md"), "# Fixture repository rules\n");
  writeFileSync(path.join(root, "CLAUDE.md"), "@AGENTS.md\n\n# Fixture orientation\n");
  const target = path.join(root, "docs", "ward-flow", "control");
  mkdirSync(path.join(target, "prompts"), { recursive: true });
  for (const relative of [
    "README.md",
    "roles.json",
    "system-state.json",
    "prompts/lead.md",
    "prompts/builder.md",
    "prompts/verifier.md",
  ]) {
    const destination = path.join(target, ...relative.split("/"));
    mkdirSync(path.dirname(destination), { recursive: true });
    writeFileSync(destination, readFileSync(path.join(controlRoot, ...relative.split("/"))));
  }
}

function createGitFixture() {
  const root = temporaryDirectory("ward-chat-control-");
  gitText(root, ["init", "-b", "main"]);
  gitText(root, ["config", "user.email", "ward-flow@example.test"]);
  gitText(root, ["config", "user.name", "Ward Flow Fixture"]);
  copyControlFixture(root);
  const statePath = path.join(root, "docs", "ward-flow", "control", "system-state.json");
  const state = JSON.parse(readFileSync(statePath, "utf8"));
  state.integrationBranch = "main";
  state.integrationBase = "0".repeat(40);
  // RESET TO THE RECOVERY BASELINE, and this is not tidying — it is what stops this fixture
  // inheriting the real project's activation. The copied file is the LIVE control state, so when
  // Ward Flow actually reached steady state on 2026-08-31 these synthetic repositories started
  // carrying a real activationSnapshot and three real receipt paths that exist in no temporary
  // repository, and six tests with nothing to do with activation failed on
  // "steady-state activationSnapshot must resolve". A fixture that changes meaning when the live
  // system moves is not a fixture. Tests that want steady state build it explicitly.
  state.mode = "recovery";
  state.activeRoles = ["lead", "verifier"];
  state.transitionEvidence = [];
  state.activationSnapshot = null;
  writeFileSync(statePath, canonicalJson(state));
  gitText(root, ["add", "AGENTS.md", "CLAUDE.md", "docs/ward-flow/control"]);
  gitText(root, ["commit", "-m", "add control fixture"]);
  const base = gitText(root, ["rev-parse", "HEAD"]);
  state.integrationBase = base;
  writeFileSync(statePath, canonicalJson(state));
  gitText(root, ["add", "docs/ward-flow/control/system-state.json"]);
  gitText(root, ["commit", "-m", "pin integration base"]);
  return root;
}

function snapshot(root: string) {
  return {
    branch: gitText(root, ["branch", "--show-current"]),
    head: gitText(root, ["rev-parse", "HEAD"]),
    status: [],
    worktree: path.resolve(root).replaceAll("\\", "/"),
  };
}

function waitForPath(target: string, timeoutMs = 5000) {
  const started = Date.now();
  return new Promise<void>((resolve, reject) => {
    const check = () => {
      if (existsSync(target)) return resolve();
      if (Date.now() - started > timeoutMs) return reject(new Error(`timed out waiting for ${target}`));
      setTimeout(check, 10);
    };
    check();
  });
}

function childExit(child: ReturnType<typeof spawn>) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => (stdout += String(chunk)));
    child.stderr?.on("data", (chunk) => (stderr += String(chunk)));
    child.once("error", reject);
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

/*
 * ⚠️ THE PER-TEST BUDGET IS RAISED BECAUSE OF LOAD, NOT BECAUSE THE WORK IS SLOW. Measured on a
 * quiet machine, 2026-09-04, whole file 64.16s for 39 tests:
 *
 *   slowest ordinary test   9195 ms   "mechanically inventories Git documents, chat logs and
 *                                      checkout sources"
 *   next                    4822 ms
 *   the 124 MB bundle test 13943 ms   and it already carries its own 300_000 override below
 *
 * So vitest's 5000 ms default was never matched to this file, and the 30_000 ms it was running
 * under was only ~3x the slowest ordinary test. With four subagents running, seven tests in this
 * file timed out at 30_000 ms — and A DIFFERENT SET FAILED ON EACH RUN, which is the signature of
 * a clock rather than a defect.
 *
 * 🔴 THAT FAILURE MODE IS WHY THIS IS RAISED RATHER THAN THE ASSERTIONS WEAKENED. A gate that is
 * red when the machine is busy and green when it is quiet teaches everyone to re-run it, and a
 * passing re-run is indistinguishable from a real pass. Nobody would ever again be able to tell a
 * genuine control-plane failure from a busy afternoon.
 *
 * 120_000 is ~13x the slowest ordinary test: ample headroom for load, while a genuinely hung test
 * still fails in two minutes rather than five. Do not raise it further without measuring again —
 * the number above is the justification, not the value.
 */
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

describe("Ward Flow compact chat control", () => {
  it("pins exactly three roles, one sole integrator and the activation gate the live state has reached", () => {
    const contract = validateRolesContract(readJson("roles.json"));
    const state = validateSystemState(readJson("system-state.json"), contract);

    expect(contract.roles.map((role: { id: string }) => role.id)).toEqual(["lead", "builder", "verifier"]);
    expect(
      contract.roles.filter((role: { integrationAuthority: string }) => role.integrationAuthority === "sole"),
    ).toHaveLength(1);
    // Reads the LIVE control state, so this assertion follows the project rather than pinning one
    // moment of it. It was ["lead", "verifier"] with no evidence through recovery; the transition on
    // 2026-08-31 committed the three receipts and opened Builder. What is pinned is the INVARIANT
    // that survives both: active roles match the mode exactly, and the evidence names each required
    // receipt once, in gate order — never that the project is still in recovery.
    expect(state.activeRoles).toEqual(contract.modes[state.mode]);
    expect(state.transitionEvidence.map((receipt: { id: string }) => receipt.id)).toEqual(
      state.mode === "steady-state" ? state.builderActivationGate.requiredEvidence : [],
    );
    expect(contract.roles.map((role: { persistentChatModel: string }) => role.persistentChatModel)).toEqual([
      "opus",
      "assignment-dependent",
      "opus",
    ]);
    expect(contract.subagentModelPolicy).toMatchObject({
      modelAliases: { judgment: "opus", mechanical: "sonnet" },
      default: "explicit-classification-required",
      adaptiveRules: {
        firstOfShape: "opus",
        thirdAttemptAfterTwoSonnetReviewRejections: "opus",
      },
    });

    const weakenedRouting = structuredClone(contract);
    weakenedRouting.subagentModelPolicy.modelAliases.judgment = "sonnet";
    expect(() => validateRolesContract(weakenedRouting)).toThrow(/judgement to Opus and mechanical work to Sonnet/);

    const unsafe = structuredClone(contract);
    unsafe.roles[2].integrationAuthority = "sole";
    expect(() => validateRolesContract(unsafe)).toThrow(/no integration authority|exactly one sole/);

    // transitionEvidence is emptied EXPLICITLY rather than inherited. Once the live project
    // reached steady state this object spread three real receipts into a case whose whole point is
    // that they are absent, so the assertion passed for the wrong reason and then failed outright.
    // The premature case is: steady-state declared with no evidence behind it.
    const premature = {
      ...state,
      mode: "steady-state",
      activeRoles: ["lead", "builder", "verifier"],
      transitionEvidence: [],
      activationSnapshot: "3".repeat(40),
    };
    expect(() => validateSystemState(premature, contract)).toThrow(/each required receipt exactly once/);
  });

  it("content-addresses handovers and requires an unbroken role generation", () => {
    const record = buildHandoverRecord({
      draft: validDraft(),
      snapshot: { branch: "main", head: "2".repeat(40), status: [], worktree: "C:/fixture" },
      lease: fakeLease(),
      now: () => new Date("2026-08-31T00:00:00.000Z"),
    });
    expect(record).toMatchObject({ roleGeneration: 1, instanceId: "ward-lead-test", previousHandover: null });
    expect(handoverRelativePath(record)).toMatch(/^docs\/ward-flow\/control\/handovers\/[0-9a-f]{64}\.handover\.json$/);
    expect(() => validateHandoverRecord({ ...record, roleGeneration: 0 })).toThrow(/positive integer/);
  });

  it("rejects incomplete, secret-bearing and evidence-free handovers", () => {
    const contract = validateRolesContract(readJson("roles.json"));
    const state = readJson("system-state.json");
    const missingEvidence = validDraft();
    missingEvidence.content.evidence = [];
    expect(() => validateHandoverDraft(missingEvidence, contract, state)).toThrow(/requires at least one evidence/);

    const incompleteVerifier = validDraft("verifier");
    delete incompleteVerifier.content.evidence[0].falsifier;
    expect(() => validateHandoverDraft(incompleteVerifier, contract, state)).toThrow(/falsifier/);

    const secret = validDraft();
    secret.content.summary = `OPENAI_API_KEY=${"sk-example-secret-1234567890"}`;
    expect(() => validateHandoverDraft(secret, contract, state)).toThrow(/secret or credential/);
  });

  it("keeps Verifier append-only and blocks control-policy rewrites", () => {
    const task = validDraft("verifier").task;
    expect(() =>
      validateRoleDiff("verifier", task, [{ status: "A", path: "docs/ward-flow/control/evidence/result.json" }]),
    ).not.toThrow();
    expect(() =>
      validateRoleDiff("verifier", task, [{ status: "M", path: "docs/ward-flow/control/evidence/result.json" }]),
    ).toThrow(/append-only additions/);
    expect(() =>
      validateRoleDiff("verifier", task, [{ status: "D", path: "docs/ward-flow/control/evidence/result.json" }]),
    ).toThrow(/append-only additions/);
    expect(() =>
      validateRoleDiff("verifier", task, [{ status: "A", path: "docs/ward-flow/control/roles.json" }]),
    ).toThrow(/changed non-control paths/);
    expect(() => validateRoleDiff("verifier", task, [{ status: "A", path: "src/ward-flow.ts" }])).toThrow(
      /changed non-control paths/,
    );
  });

  it("detects exact and parent-child ownership overlap", () => {
    expect(pathsOverlap("src/ward", "src/ward")).toBe(true);
    expect(pathsOverlap("src/ward/model.ts", "src/ward")).toBe(true);
    expect(pathsOverlap("src/ward", "src/referrals")).toBe(false);
    expect(pathsOverlap("src/ward/model.ts", "SRC/WARD/model.ts")).toBe(process.platform === "win32");
    expect(() => pathsOverlap("src/ward/../referrals", "src/referrals")).toThrow(/dot segments/);
  });

  it("rejects disappearance of recorded untracked source work", () => {
    const root = createGitFixture();
    const source = snapshot(root);
    expect(() =>
      assertCheckoutMatchesSnapshot(
        { checkout: root, branch: source.branch, head: source.head },
        { tracked: [], untrackedCount: 1 },
        "recorded-source",
      ),
    ).toThrow(/checkout status drifted/);
  });

  /*
   * 🔴 THE BRANCH IS THE INTEGRITY REQUIREMENT; THE PATH IS A CACHE. These three pin the rekey of
   * 2026-09-04, after THREE OF THE FIVE recorded checkouts were found pointing at folders wiped by
   * an unrelated cleanup session — while all five branches still resolved and every recorded head
   * was still on its branch. Nothing had been lost; the validator was reporting a folder, not the work.
   *
   * ⚠️ THESE CALL THE VALIDATOR DIRECTLY, ON PURPOSE, AND THAT IS THE WHOLE POINT OF THEM.
   * `validateControlPlane` reads the snapshot from a COMMITTED REF (`headFile(..., { ref: sourceSha })`),
   * not from the working tree — so editing `live-state.json` on disk to test this proves NOTHING.
   * The first attempt did exactly that, passed, and the mutant had never run.
   */
  it("treats a branch that no longer resolves as real loss, even with no worktree mounted", () => {
    const missingPath = path.join(temporaryDirectory("ward-unmounted-"), "never-created");
    expect(existsSync(missingPath), "this test needs a path that does NOT exist").toBe(false);
    expect(() =>
      assertCheckoutMatchesSnapshot(
        { checkout: missingPath, branch: "claude/no-such-branch-anywhere", head: "2".repeat(40) },
        { tracked: [], untrackedCount: 0 },
        "recorded-source",
      ),
    ).toThrow(/branch claude\/no-such-branch-anywhere no longer resolves/);
  });

  it("treats a recorded head that is not on its branch as real loss, not merely unreachable", () => {
    /*
     * ⚠️ THE HEAD USED HERE MUST EXIST AS AN OBJECT AND NOT BE ON THE BRANCH. My first version of
     * this test used a SHA of forty 2s, which exists nowhere — so it failed the ancestry check AND
     * a mere object-existence check identically, and could not tell them apart. Weakening the
     * validator to `cat-file -e` left it GREEN. Proved by mutation, not by reading it.
     *
     * So this walks the real branch graph for a commit that is genuinely present and genuinely not
     * an ancestor, and SKIPS rather than pretends if this checkout has no such commit.
     */
    const missingPath = path.join(temporaryDirectory("ward-unmounted-"), "never-created");
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
    /*
     * 🔴 SYNTHESISED, NOT SCAVENGED — AND THAT CHANGE CAME FROM CI, NOT FROM REVIEW.
     *
     * The first version walked `refs/heads/` for a branch head that is not an ancestor of the
     * current branch. That works in a development clone with many branches and FAILS IN CI, where
     * the checkout carries one branch and there is no such head to find. The test then hit its own
     * anti-vacuity assertion and went red — correctly. It refused to pass without being able to
     * discriminate, which is exactly what it was written to do; the defect was that it depended on
     * the ambient shape of the repository rather than on anything it controlled.
     *
     * `commit-tree` on the current tree with no parent produces a commit object that genuinely
     * EXISTS and is genuinely NOT an ancestor of any branch — the two properties this test needs,
     * in every checkout, deterministically. It is a dangling object and `gc` reclaims it.
     *
     * Both properties are asserted BEFORE use, because a fixture that silently lacks one of them
     * would make this test pass against a validator that only calls `cat-file -e` — the precise
     * weakening a SHA of forty 2s could not detect, recorded below.
     */
    const offBranch = execFileSync("git", ["commit-tree", `${branch}^{tree}`, "-m", "ward-flow ancestry fixture"], {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();

    expect(offBranch, "commit-tree produced no object, so there is no fixture to test with").toMatch(/^[0-9a-f]{40}$/u);
    expect(
      () => execFileSync("git", ["cat-file", "-e", `${offBranch}^{commit}`], { cwd: projectRoot, stdio: "ignore" }),
      "the fixture commit must EXIST, or this test cannot tell ancestry from mere existence",
    ).not.toThrow();
    expect(
      () =>
        execFileSync("git", ["merge-base", "--is-ancestor", offBranch, branch], { cwd: projectRoot, stdio: "ignore" }),
      "the fixture commit must NOT be an ancestor of the branch, or there is nothing to detect",
    ).toThrow();
    expect(() =>
      assertCheckoutMatchesSnapshot(
        { checkout: missingPath, branch, head: offBranch },
        { tracked: [], untrackedCount: 0 },
        "recorded-source",
      ),
    ).toThrow(/is not on/);
  });

  it("accepts an intact branch with no worktree mounted, and says so rather than failing", () => {
    const missingPath = path.join(temporaryDirectory("ward-unmounted-"), "never-created");
    const branch = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd: projectRoot,
      encoding: "utf8",
    }).trim();
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8" }).trim();
    const result = assertCheckoutMatchesSnapshot(
      { checkout: missingPath, branch, head },
      { tracked: [], untrackedCount: 0 },
      "recorded-source",
    );
    expect(result.mounted, "an unmounted checkout is an ordinary state, not an error").toBe(false);
    expect(result.branch).toBe(branch);
    expect(result.head).toBe(head);
  });

  it("requires the Verifier checkout itself to equal the frozen target", () => {
    const frozen = "2".repeat(40);
    expect(() =>
      assertFrozenVerifierCheckout({ branch: "verifier", head: frozen, status: [], worktree: "C:/verifier" }, frozen),
    ).not.toThrow();
    expect(() =>
      assertFrozenVerifierCheckout(
        { branch: "verifier", head: "1".repeat(40), status: [], worktree: "C:/verifier" },
        frozen,
      ),
    ).toThrow(/does not equal frozen target/);
  });

  it("rejects cross-role path overlap at lease acquisition", () => {
    const root = createGitFixture();
    acquireLease(
      {
        role: "builder",
        instanceId: "ward-builder-path-owner",
        generation: 1,
        snapshot: { ...snapshot(root), worktree: "C:/builder-worktree" },
        handover: null,
        assignment: { relative: `docs/ward-flow/control/assignments/${"a".repeat(64)}.assignment.json` },
        ownedPaths: ["src/ward-flow"],
      },
      root,
    );
    expect(() =>
      acquireLease(
        {
          role: "lead",
          instanceId: "ward-lead-overlap",
          generation: 1,
          snapshot: { ...snapshot(root), worktree: "C:/lead-worktree" },
          handover: null,
          ownedPaths: ["src/ward-flow/model.ts"],
        },
        root,
      ),
    ).toThrow(/paths already held by builder/);
  });

  it("allows only the exact hashed parked-artifact path outside Builder ownership", () => {
    const task = validDraft("builder").task;
    const parked = "docs/ward-flow/control/parked/task.patch";
    expect(() =>
      validateRoleDiff("builder", task, ["feature.txt", parked], { extraAllowedPaths: [parked] }),
    ).not.toThrow();
    expect(() =>
      validateRoleDiff("builder", task, ["docs/ward-flow/control/parked/other.patch"], {
        extraAllowedPaths: [parked],
      }),
    ).toThrow(/outside its task ownership/);
  });

  it("uses one atomic role lease and refuses a concurrent replacement", () => {
    const root = createGitFixture();
    const first = acquireLease(
      { role: "lead", instanceId: "ward-lead-one", generation: 1, snapshot: snapshot(root), handover: null },
      root,
    );
    expect(first.lease.instanceId).toBe("ward-lead-one");
    expect(() =>
      acquireLease(
        { role: "lead", instanceId: "ward-lead-two", generation: 1, snapshot: snapshot(root), handover: null },
        root,
      ),
    ).toThrow(/already leased/);
    expect(() =>
      acquireLease(
        { role: "lead", instanceId: "ward-lead-one", generation: 1, snapshot: snapshot(root), handover: null },
        root,
      ),
    ).toThrow(/even with the same session ID/);
    expect(() =>
      acquireLease(
        {
          role: "verifier",
          instanceId: "ward-verifier-one",
          generation: 1,
          snapshot: snapshot(root),
          handover: null,
          targetSha: snapshot(root).head,
        },
        root,
      ),
    ).toThrow(/worktree already held/);
  });

  it("serializes cross-role lease acquisition across processes", async () => {
    const root = createGitFixture();
    const coordination = temporaryDirectory("ward-chat-lease-race-");
    const start = path.join(coordination, "start");
    const moduleUrl = pathToFileURL(path.join(projectRoot, "scripts", "ward-flow", "chat-control.mjs")).href;
    const head = snapshot(root).head;
    const childProgram = `
      import { existsSync, writeFileSync } from "node:fs";
      const control = await import(process.env.MODULE_URL);
      writeFileSync(process.env.READY, "ready");
      while (!existsSync(process.env.START)) await new Promise((resolve) => setTimeout(resolve, 5));
      try {
        control.acquireLease({
          role: process.env.ROLE,
          instanceId: process.env.INSTANCE_ID,
          generation: 1,
          snapshot: { branch: "race", head: process.env.HEAD, status: [], worktree: "C:/same-concurrent-worktree" },
          handover: null,
          assignment: process.env.ROLE === "builder"
            ? { relative: "docs/ward-flow/control/assignments/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.assignment.json" }
            : null,
          ownedPaths: ["feature.txt"]
        }, process.env.ROOT);
        console.log("acquired");
      } catch (error) {
        console.error(error.message);
        process.exitCode = 2;
      }
    `;
    const launch = (role: string, instanceId: string, readyName: string) =>
      spawn(process.execPath, ["--input-type=module", "-e", childProgram], {
        env: {
          ...process.env,
          MODULE_URL: moduleUrl,
          ROOT: root,
          HEAD: head,
          START: start,
          READY: path.join(coordination, readyName),
          ROLE: role,
          INSTANCE_ID: instanceId,
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
    const lead = launch("lead", "ward-lead-race", "lead-ready");
    const builder = launch("builder", "ward-builder-race", "builder-ready");
    await Promise.all([
      waitForPath(path.join(coordination, "lead-ready")),
      waitForPath(path.join(coordination, "builder-ready")),
    ]);
    writeFileSync(start, "go");
    const outcomes = await Promise.all([childExit(lead), childExit(builder)]);
    expect(outcomes.map((outcome) => outcome.code).sort()).toEqual([0, 2]);
    expect(outcomes.filter((outcome) => outcome.code === 0)[0].stdout).toContain("acquired");
    expect(outcomes.filter((outcome) => outcome.code === 2)[0].stderr).toMatch(/already held|worktree already held/);
  });

  it("fails closed instead of deleting a stale-looking acquisition lock", () => {
    const root = createGitFixture();
    const lockPath = path.join(root, ".git", "ward-flow-chat-control", "acquire.lock.json");
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(
      lockPath,
      canonicalJson({
        schemaVersion: 1,
        kind: "ward-flow-lease-acquisition-lock",
        host: "stale-host",
        processId: 999999,
        token: "stale-token",
      }),
    );
    expect(() =>
      acquireLease(
        {
          role: "lead",
          instanceId: "ward-lead-stale-lock",
          generation: 1,
          snapshot: snapshot(root),
          handover: null,
          ownedPaths: ["feature.txt"],
        },
        root,
      ),
    ).toThrow(/tool never deletes a possibly replaced lock/);
    expect(existsSync(lockPath)).toBe(true);
  });

  it("never treats a staged handover as committed truth", () => {
    const root = createGitFixture();
    const lease = acquireLease(
      {
        role: "lead",
        instanceId: "ward-lead-stage",
        generation: 1,
        snapshot: snapshot(root),
        handover: null,
        ownedPaths: ["docs/ward-flow/control/"],
      },
      root,
    );
    const draft = validDraft();
    draft.task.baseSha = snapshot(root).head;
    draft.task.completionCommit = snapshot(root).head;
    const record = buildHandoverRecord({ draft, snapshot: snapshot(root), lease });
    const written = writeHandoverRecord(record, root);
    gitText(root, ["add", written.relative]);

    expect(latestHandover("lead", root)).toBeNull();
    expect(latestHandover("lead", root, { committedOnly: false })?.relative).toBe(written.relative);
  });

  it("derives role continuity from the integration ref rather than a worker branch", () => {
    const root = createGitFixture();
    const integrationHead = gitText(root, ["rev-parse", "main"]);
    gitText(root, ["switch", "-c", "worker"]);
    const draft = validDraft("builder");
    draft.task.baseSha = integrationHead;
    draft.task.completionCommit = integrationHead;
    draft.integration.targetBranch = "main";
    const record = buildHandoverRecord({
      draft,
      snapshot: { ...snapshot(root), head: integrationHead },
      lease: fakeLease("builder", "ward-builder-worker"),
    });
    const written = writeHandoverRecord(record, root);
    gitText(root, ["add", written.relative]);
    gitText(root, ["commit", "-m", "record worker handover"]);
    expect(latestHandover("builder", root, { ref: "main" })).toBeNull();

    gitText(root, ["switch", "main"]);
    writeHandoverRecord(record, root);
    gitText(root, ["add", written.relative]);
    gitText(root, ["commit", "-m", "publish worker handover"]);
    expect(latestHandover("builder", root, { ref: "main" })?.record.roleGeneration).toBe(1);
    gitText(root, ["switch", "-c", "replacement-worker"]);
    expect(latestHandover("builder", root, { ref: "main" })?.relative).toBe(written.relative);
  });

  it("lets Ward Lead publish exact Verifier handover bytes onto integration", () => {
    const root = createGitFixture();
    const leadSnapshot = snapshot(root);
    acquireLease(
      {
        role: "lead",
        instanceId: "ward-lead-publisher",
        generation: 1,
        snapshot: leadSnapshot,
        handover: null,
        ownedPaths: ["docs/ward-flow/control/"],
      },
      root,
    );
    const linkedParent = temporaryDirectory("ward-verifier-worktree-");
    const verifierRoot = path.join(linkedParent, "checkout");
    gitText(root, ["worktree", "add", "-b", "verifier-source", verifierRoot, "main"]);
    const verifierSnapshot = snapshot(verifierRoot);
    const verifierLease = acquireLease(
      {
        role: "verifier",
        instanceId: "ward-verifier-source",
        generation: 1,
        snapshot: verifierSnapshot,
        handover: null,
        targetSha: verifierSnapshot.head,
        criterion: FIXTURE_CRITERION,
        ownedPaths: [],
      },
      verifierRoot,
    );
    const draft = validDraft("verifier");
    draft.task.baseSha = verifierSnapshot.head;
    draft.task.completionCommit = verifierSnapshot.head;
    draft.task.verificationTarget = verifierSnapshot.head;
    draft.content.evidence[0].targetSha = verifierSnapshot.head;
    draft.integration.targetBranch = "main";
    const record = buildHandoverRecord({ draft, snapshot: verifierSnapshot, lease: verifierLease });
    const sourceRecord = writeHandoverRecord(record, verifierRoot);
    gitText(verifierRoot, ["add", sourceRecord.relative]);
    gitText(verifierRoot, ["commit", "-m", "record verifier handover"]);

    const published = publishHandover({
      source: "verifier-source",
      handover: sourceRecord.relative,
      issuerSession: "ward-lead-publisher",
      root,
    });
    expect(readFileSync(published.target, "utf8")).toBe(canonicalJson(record));
    gitText(root, ["add", published.relative]);
    gitText(root, ["commit", "-m", "publish verifier handover"]);
    expect(latestHandover("verifier", root, { ref: "main" })?.relative).toBe(published.relative);
  });

  it("proves a parked checkpoint exists and matches durable bytes", () => {
    const root = createGitFixture();
    writeFileSync(path.join(root, "parked.txt"), "unfinished bounded work\n");
    gitText(root, ["add", "parked.txt"]);
    gitText(root, ["commit", "-m", "park bounded work"]);
    const commit = gitText(root, ["rev-parse", "HEAD"]);
    const raw = git(root, ["cat-file", "commit", commit], "buffer") as unknown as Buffer;
    const record = {
      role: "builder",
      integration: {
        status: "parked",
        durableCheckpoint: {
          kind: "commit",
          ref: "refs/heads/main",
          commit,
          sha256: createHash("sha256").update(raw).digest("hex"),
        },
      },
    };
    expect(() => assertDurableCheckpoint(record, root)).not.toThrow();
    record.integration.durableCheckpoint.sha256 = "0".repeat(64);
    expect(() => assertDurableCheckpoint(record, root)).toThrow(/hash does not match/);
  });

  it("proves a parked artifact on the recorded Builder source instead of integration HEAD", () => {
    const root = createGitFixture();
    gitText(root, ["switch", "-c", "builder-artifact"]);
    const relative = "docs/ward-flow/control/parked/WF-ARTIFACT.patch";
    const bytes = "bounded parked artifact\n";
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), bytes);
    gitText(root, ["add", relative]);
    gitText(root, ["commit", "-m", "park bounded artifact"]);
    const sourceHead = gitText(root, ["rev-parse", "HEAD"]);
    gitText(root, ["switch", "main"]);
    expect(existsSync(path.join(root, relative))).toBe(false);
    const record = {
      role: "builder",
      source: { head: sourceHead },
      integration: {
        status: "parked",
        durableCheckpoint: { kind: "artifact", ref: relative, sha256: sha256(bytes) },
      },
    };
    expect(() => assertDurableCheckpoint(record, root)).not.toThrow();
    record.integration.durableCheckpoint.sha256 = "0".repeat(64);
    expect(() => assertDurableCheckpoint(record, root)).toThrow(/hash does not match/);
  });

  it("proves Builder integration on the configured target with exact changed-path contents", () => {
    const root = createGitFixture();
    const base = gitText(root, ["rev-parse", "HEAD"]);
    gitText(root, ["switch", "-c", "builder"]);
    writeFileSync(path.join(root, "feature.txt"), "bounded feature\n");
    gitText(root, ["add", "feature.txt"]);
    gitText(root, ["commit", "-m", "add bounded feature"]);
    const sourceCommit = gitText(root, ["rev-parse", "HEAD"]);

    gitText(root, ["switch", "-c", "integration", base]);
    writeFileSync(path.join(root, "integration.txt"), "integration base\n");
    gitText(root, ["add", "integration.txt"]);
    gitText(root, ["commit", "-m", "advance integration"]);
    const unrelatedCommit = gitText(root, ["rev-parse", "HEAD"]);
    gitText(root, ["cherry-pick", sourceCommit]);
    const integratedCommit = gitText(root, ["rev-parse", "HEAD"]);

    const record = {
      role: "builder",
      source: { head: sourceCommit },
      task: { baseSha: base, completionCommit: sourceCommit, ownedPaths: ["feature.txt"] },
      integration: { status: "integrated", commit: integratedCommit, targetBranch: "integration" },
    };
    expect(() => assertIntegratedRecord(record, { integrationBranch: "integration" }, root)).not.toThrow();
    expect(() =>
      assertIntegratedRecord(
        { ...record, integration: { ...record.integration, commit: unrelatedCommit } },
        { integrationBranch: "integration" },
        root,
      ),
    ).toThrow(/integration commit does not preserve source mode, type and content/);
    expect(() => assertIntegratedRecord(record, { integrationBranch: "main" }, root)).toThrow(/configured branch/);
    gitText(root, ["rm", "feature.txt"]);
    gitText(root, ["commit", "-m", "revert bounded feature"]);
    expect(() => assertIntegratedRecord(record, { integrationBranch: "integration" }, root)).toThrow(
      /absent from the current target tip/,
    );
  });

  it("treats an executable-bit change as part of Builder integration", () => {
    const root = createGitFixture();
    writeFileSync(path.join(root, "hook.sh"), "#!/usr/bin/env bash\nexit 0\n");
    gitText(root, ["add", "hook.sh"]);
    gitText(root, ["commit", "-m", "add non-executable hook"]);
    const base = gitText(root, ["rev-parse", "HEAD"]);
    gitText(root, ["switch", "-c", "builder-mode"]);
    gitText(root, ["update-index", "--chmod=+x", "hook.sh"]);
    gitText(root, ["commit", "-m", "make hook executable"]);
    const sourceCommit = gitText(root, ["rev-parse", "HEAD"]);
    gitText(root, ["branch", "integration-mode", base]);

    const record = {
      role: "builder",
      source: { head: sourceCommit },
      task: { baseSha: base, completionCommit: sourceCommit, ownedPaths: ["hook.sh"] },
      integration: { status: "integrated", commit: base, targetBranch: "integration-mode" },
    };
    expect(() => assertIntegratedRecord(record, { integrationBranch: "integration-mode" }, root)).toThrow(
      /integration commit does not preserve source mode, type and content/,
    );
  });

  it("requires a committed reset certificate before retiring the lease", () => {
    const root = createGitFixture();
    const source = snapshot(root);
    const lease = acquireLease(
      {
        role: "lead",
        instanceId: "ward-lead-reset",
        generation: 1,
        snapshot: source,
        handover: null,
        ownedPaths: ["docs/ward-flow/control/"],
      },
      root,
    );
    const draft = validDraft();
    draft.task.baseSha = source.head;
    draft.task.completionCommit = source.head;
    const record = buildHandoverRecord({ draft, snapshot: source, lease });
    const written = writeHandoverRecord(record, root);
    gitText(root, ["add", written.relative]);
    gitText(root, ["commit", "-m", "record handover"]);

    const first = certifyReset({ handover: written.relative, root });
    expect(first.safe).toBe(false);
    expect(first.certificate).toMatch(/\.reset\.json$/);
    gitText(root, ["add", first.certificate]);
    gitText(root, ["commit", "-m", "certify reset"]);
    expect(certifyReset({ handover: written.relative, root })).toMatchObject({ safe: true });
    expect(() =>
      acquireLease(
        {
          role: "lead",
          instanceId: "ward-lead-replacement",
          generation: 2,
          snapshot: snapshot(root),
          handover: { relative: written.relative },
        },
        root,
      ),
    ).not.toThrow();
  });

  it("refuses reset when a Verifier source worktree changes after handover", () => {
    const root = createGitFixture();
    const target = gitText(root, ["rev-parse", "HEAD"]);
    const verifierRoot = path.join(temporaryDirectory("ward-verifier-worktree-"), "checkout");
    gitText(root, ["worktree", "add", "-b", "verifier-source", verifierRoot, target]);
    const source = snapshot(verifierRoot);
    const lease = acquireLease(
      {
        role: "verifier",
        instanceId: "ward-verifier-reset",
        generation: 1,
        snapshot: source,
        handover: null,
        targetSha: target,
        criterion: FIXTURE_CRITERION,
        ownedPaths: [],
      },
      root,
    );
    const draft = validDraft("verifier");
    draft.task.baseSha = target;
    draft.task.completionCommit = target;
    draft.task.verificationTarget = target;
    draft.content.evidence[0].targetSha = target;
    draft.integration.targetBranch = "main";
    const record = buildHandoverRecord({ draft, snapshot: source, lease });
    const sourceHandover = writeHandoverRecord(record, verifierRoot);
    gitText(verifierRoot, ["add", sourceHandover.relative]);
    gitText(verifierRoot, ["commit", "-m", "record verifier handover"]);
    const integrationPath = path.join(root, ...sourceHandover.relative.split("/"));
    mkdirSync(path.dirname(integrationPath), { recursive: true });
    writeFileSync(integrationPath, readFileSync(path.join(verifierRoot, ...sourceHandover.relative.split("/"))));
    gitText(root, ["add", sourceHandover.relative]);
    gitText(root, ["commit", "-m", "publish verifier handover"]);

    const first = certifyReset({ handover: sourceHandover.relative, root });
    expect(first.safe).toBe(false);
    gitText(root, ["add", first.certificate]);
    gitText(root, ["commit", "-m", "certify verifier reset"]);
    writeFileSync(path.join(verifierRoot, "unrecorded-after-handover.txt"), "must not be lost\n");
    expect(() => certifyReset({ handover: sourceHandover.relative, root })).toThrow(
      /source worktree is no longer clean/,
    );
  });

  it("rejects a Builder assignment committed with unrelated work", () => {
    const root = createGitFixture();
    const base = gitText(root, ["rev-parse", "HEAD"]);
    const assignment = {
      schemaVersion: 1,
      kind: "ward-flow-builder-assignment",
      issuedByInstance: "ward-lead-assignment",
      issuedAtHead: base,
      taskId: "WF-ASSIGN-001",
      objective: "Assign one bounded file.",
      baseSha: base,
      branch: "builder-assignment",
      worktree: "C:/builder-assignment",
      ownedPaths: ["feature.txt"],
      symbols: ["assignedFeature"],
      steps: ["Create the assigned feature file."],
      acceptanceCriterion: "The bounded file exists.",
      falsifier: "The bounded file is absent.",
      focusedCheck: "test -f feature.txt",
      modelRouting: validModelRouting(),
    };
    const relative = `docs/ward-flow/control/assignments/${sha256(canonicalJson(assignment))}.assignment.json`;
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), canonicalJson(assignment));
    writeFileSync(path.join(root, "unrelated.txt"), "unrelated product work\n");
    gitText(root, ["add", relative, "unrelated.txt"]);
    gitText(root, ["commit", "-m", "mix assignment and unrelated work"]);
    expect(() => loadCommittedAssignment(relative, { integrationBranch: "main" }, root)).toThrow(
      /Builder assignment introduction must be exactly one commit changing only/,
    );
  });

  it("rejects Sonnet Builder routing when an Opus veto is present", () => {
    const root = createGitFixture();
    const base = gitText(root, ["rev-parse", "HEAD"]);
    const modelRouting = validModelRouting("sonnet");
    modelRouting.vetoes.clinicalLegalPrivacyOrPatientFacing = true;
    modelRouting.catcher!.reference = "Run the focused Ward Flow control test.";
    const assignment = {
      schemaVersion: 1,
      kind: "ward-flow-builder-assignment",
      issuedByInstance: "ward-lead-model-routing",
      issuedAtHead: base,
      taskId: "WF-ASSIGN-MODEL-001",
      objective: "Reject an unsafe cheap-model assignment.",
      baseSha: base,
      branch: "builder-model-routing",
      worktree: "C:/builder-model-routing",
      ownedPaths: ["feature.txt"],
      symbols: ["unsafeModelRouting"],
      steps: ["Attempt to load the unsafe assignment."],
      acceptanceCriterion: "Unsafe model routing is rejected.",
      falsifier: "The assignment loads despite an Opus veto.",
      focusedCheck: "Run the focused Ward Flow control test.",
      modelRouting,
    };
    const relative = `docs/ward-flow/control/assignments/${sha256(canonicalJson(assignment))}.assignment.json`;
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), canonicalJson(assignment));
    gitText(root, ["add", relative]);
    gitText(root, ["commit", "-m", "add unsafe model assignment"]);
    expect(() => loadCommittedAssignment(relative, { integrationBranch: "main" }, root)).toThrow(/Opus veto/);
  });

  it("rejects weak catchers and recorded Sonnet escalation violations", () => {
    const expectInvalidRouting = (
      modelRouting: ReturnType<typeof validModelRouting>,
      message: RegExp,
      alignCatcher = true,
    ) => {
      const root = createGitFixture();
      const base = gitText(root, ["rev-parse", "HEAD"]);
      const focusedCheck = "Run the focused Ward Flow control test.";
      if (alignCatcher && modelRouting.catcher) modelRouting.catcher.reference = focusedCheck;
      const assignment = {
        schemaVersion: 1,
        kind: "ward-flow-builder-assignment",
        issuedByInstance: "ward-lead-routing-evidence",
        issuedAtHead: base,
        taskId: "WF-ASSIGN-ROUTING-001",
        objective: "Reject invalid recorded Sonnet routing evidence.",
        baseSha: base,
        branch: "builder-routing-evidence",
        worktree: "C:/builder-routing-evidence",
        ownedPaths: ["feature.txt"],
        symbols: ["routingEvidence"],
        steps: ["Load the assignment and validate its routing evidence."],
        acceptanceCriterion: "Invalid routing evidence is rejected.",
        falsifier: "The unsafe Sonnet assignment loads.",
        focusedCheck,
        modelRouting,
      };
      const relative = `docs/ward-flow/control/assignments/${sha256(canonicalJson(assignment))}.assignment.json`;
      mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
      writeFileSync(path.join(root, relative), canonicalJson(assignment));
      gitText(root, ["add", relative]);
      gitText(root, ["commit", "-m", "add invalid Sonnet routing evidence"]);
      expect(() => loadCommittedAssignment(relative, { integrationBranch: "main" }, root)).toThrow(message);
    };

    const weakCatcher = validModelRouting("sonnet");
    weakCatcher.catcher = { kind: "reader", reference: "A careful reader notices the error." };
    expectInvalidRouting(weakCatcher, /catcher kind/);

    const mismatchedCatcher = validModelRouting("sonnet");
    mismatchedCatcher.catcher!.reference = "Run a different check.";
    expectInvalidRouting(mismatchedCatcher, /exactly match focusedCheck/, false);

    const firstOfShape = validModelRouting("sonnet");
    firstOfShape.firstOfShape = true;
    expectInvalidRouting(firstOfShape, /first Builder task of a shape/);

    const thirdAttempt = validModelRouting("sonnet");
    thirdAttempt.priorSonnetReviewRejections = 2;
    expectInvalidRouting(thirdAttempt, /third attempt after two Sonnet review rejections/);
  });

  it("rejects a Builder assignment without exact symbols or ordered steps", () => {
    const root = createGitFixture();
    const base = gitText(root, ["rev-parse", "HEAD"]);
    const assignment = {
      schemaVersion: 1,
      kind: "ward-flow-builder-assignment",
      issuedByInstance: "ward-lead-incomplete-brief",
      issuedAtHead: base,
      taskId: "WF-ASSIGN-BRIEF-001",
      objective: "Reject a mechanically incomplete implementation brief.",
      baseSha: base,
      branch: "builder-incomplete-brief",
      worktree: "C:/builder-incomplete-brief",
      ownedPaths: ["feature.txt"],
      symbols: [],
      steps: [],
      acceptanceCriterion: "Incomplete briefs are rejected.",
      falsifier: "The assignment loads without symbols or steps.",
      focusedCheck: "Run the focused Ward Flow control test.",
      modelRouting: validModelRouting("sonnet"),
    };
    const relative = `docs/ward-flow/control/assignments/${sha256(canonicalJson(assignment))}.assignment.json`;
    mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
    writeFileSync(path.join(root, relative), canonicalJson(assignment));
    gitText(root, ["add", relative]);
    gitText(root, ["commit", "-m", "add incomplete Builder brief"]);
    expect(() => loadCommittedAssignment(relative, { integrationBranch: "main" }, root)).toThrow(/exact symbol/);
  });

  it("requires durable parent-reviewed receipts for Sonnet subagent dispatches", () => {
    const contract = validateRolesContract(readJson("roles.json"));
    const state = readJson("system-state.json");
    const draft = validDraft();
    draft.content.subagentDispatches.push({
      task: "Extract exact Ward Flow source paths.",
      modelTier: "sonnet",
      routingReason: "Bounded read-only extraction with a named spot-check.",
      outcome: "completed",
      decisiveEvidence: "The parent compared the returned paths with git ls-tree.",
      reviewedByParent: false,
      stopRuleIncluded: true,
      catcher: { kind: "extraction-spot-check", reference: "Compare all paths with git ls-tree." },
    });
    expect(() => validateHandoverDraft(draft, contract, state)).toThrow(/reviewed by its parent/);
    draft.content.subagentDispatches[0].reviewedByParent = true;
    expect(() => validateHandoverDraft(draft, contract, state)).not.toThrow();
  });

  it("rejects handover or certificate commits that absorb unrelated files", () => {
    const mixedHandoverRoot = createGitFixture();
    const source = snapshot(mixedHandoverRoot);
    const lease = acquireLease(
      {
        role: "lead",
        instanceId: "ward-lead-mixed-handover",
        generation: 1,
        snapshot: source,
        handover: null,
        ownedPaths: ["docs/ward-flow/control/"],
      },
      mixedHandoverRoot,
    );
    const draft = validDraft();
    draft.task.baseSha = source.head;
    draft.task.completionCommit = source.head;
    const record = buildHandoverRecord({ draft, snapshot: source, lease });
    const written = writeHandoverRecord(record, mixedHandoverRoot);
    writeFileSync(path.join(mixedHandoverRoot, "unrelated.txt"), "late change\n");
    gitText(mixedHandoverRoot, ["add", written.relative, "unrelated.txt"]);
    gitText(mixedHandoverRoot, ["commit", "-m", "mix handover with unrelated change"]);
    expect(() => certifyReset({ handover: written.relative, root: mixedHandoverRoot })).toThrow(
      /handover introduction must be exactly one commit changing only/,
    );

    const mixedCertificateRoot = createGitFixture();
    const cleanSource = snapshot(mixedCertificateRoot);
    const cleanLease = acquireLease(
      {
        role: "lead",
        instanceId: "ward-lead-mixed-certificate",
        generation: 1,
        snapshot: cleanSource,
        handover: null,
        ownedPaths: ["docs/ward-flow/control/"],
      },
      mixedCertificateRoot,
    );
    const cleanDraft = validDraft();
    cleanDraft.task.baseSha = cleanSource.head;
    cleanDraft.task.completionCommit = cleanSource.head;
    const cleanRecord = buildHandoverRecord({ draft: cleanDraft, snapshot: cleanSource, lease: cleanLease });
    const cleanWritten = writeHandoverRecord(cleanRecord, mixedCertificateRoot);
    gitText(mixedCertificateRoot, ["add", cleanWritten.relative]);
    gitText(mixedCertificateRoot, ["commit", "-m", "record clean handover"]);
    const first = certifyReset({ handover: cleanWritten.relative, root: mixedCertificateRoot });
    writeFileSync(path.join(mixedCertificateRoot, "unrelated.txt"), "late certificate change\n");
    gitText(mixedCertificateRoot, ["add", first.certificate, "unrelated.txt"]);
    gitText(mixedCertificateRoot, ["commit", "-m", "mix certificate with unrelated change"]);
    expect(() => certifyReset({ handover: cleanWritten.relative, root: mixedCertificateRoot })).toThrow(
      /reset certificate commit must be exactly one commit changing only/,
    );
  });

  it("renders identity and certified continuity in the replacement prompt", () => {
    const contract = validateRolesContract(readJson("roles.json"));
    const state = validateSystemState(readJson("system-state.json"), contract);
    const lease = fakeLease();
    const record = buildHandoverRecord({
      draft: validDraft(),
      snapshot: { branch: "main", head: "2".repeat(40), status: [], worktree: "C:/fixture" },
      lease,
      now: () => new Date("2026-08-31T00:00:00.000Z"),
    });
    const prompt = buildRecreationPrompt({
      roleContract: contract.roles[0],
      state,
      template: readFileSync(path.join(controlRoot, "prompts", "lead.md"), "utf8"),
      handover: {
        relative: handoverRelativePath(record),
        record,
        certificate: { relative: `docs/ward-flow/control/certificates/${"c".repeat(64)}.reset.json` },
      },
      snapshot: { branch: "main", head: "3".repeat(40), status: [], worktree: "C:/fixture" },
      lease,
      assignment: null,
    });

    expect(prompt).toContain("You are **Ward Lead**");
    expect(prompt).toContain("Session ID: `ward-lead-test`");
    expect(prompt).toContain("Role generation: `1`");
    expect(prompt).toContain("Reset certificate:");
    expect(prompt).toContain(record.content.nextAction);
    expect(prompt).toContain("Run this persistent chat on Opus");
    expect(prompt).toContain("If you reach a decision this brief does not cover");

    const builderAssignment = {
      relative: `docs/ward-flow/control/assignments/${"a".repeat(64)}.assignment.json`,
      record: { modelRouting: validModelRouting("sonnet") },
    };
    const builderPrompt = buildRecreationPrompt({
      roleContract: contract.roles[1],
      state,
      template: readFileSync(path.join(controlRoot, "prompts", "builder.md"), "utf8"),
      handover: null,
      snapshot: { branch: "builder", head: "3".repeat(40), status: [], worktree: "C:/fixture-builder" },
      lease: fakeLease("builder", "ward-builder-test"),
      assignment: builderAssignment,
    });
    expect(builderPrompt).toContain("Builder model tier: `sonnet`");
    expect(builderPrompt).toContain(builderAssignment.record.modelRouting.reason);
    expect(builderPrompt).toContain(builderAssignment.record.modelRouting.catcher?.reference);
    expect(builderPrompt).toContain("Use the model tier recorded in the committed assignment");

    const verifierPrompt = buildRecreationPrompt({
      roleContract: contract.roles[2],
      state,
      template: readFileSync(path.join(controlRoot, "prompts", "verifier.md"), "utf8"),
      handover: null,
      snapshot: { branch: "verifier", head: "3".repeat(40), status: [], worktree: "C:/fixture-verifier" },
      lease: fakeLease("verifier", "ward-verifier-test"),
      assignment: null,
    });
    expect(verifierPrompt).toContain("Run this persistent chat on Opus");
    expect(verifierPrompt).toContain("they cannot assess");
  });

  it("verifies a real Git bundle in an independent restored checkout", () => {
    const root = createGitFixture();
    const sourceSha = gitText(root, ["rev-parse", "HEAD"]);
    const state = JSON.parse(readFileSync(path.join(root, "docs/ward-flow/control/system-state.json"), "utf8"));
    const external = temporaryDirectory("ward-recovery-bundle-");
    const bundlePath = path.join(external, "ward-flow.bundle");
    gitText(root, ["bundle", "create", bundlePath, "refs/heads/main"]);
    const restoreCheckout = path.join(external, "restore");
    // ⚠️ `--branch main` IS LOAD-BEARING AND ITS ABSENCE ONLY SHOWS ON SOMEBODY ELSE’S MACHINE.
    // The bundle carries `refs/heads/main` and no HEAD, so `clone` falls back to the CLONING
    // machine’s `init.defaultBranch`. On a checkout where that is `master` the clone lands with
    // an unborn HEAD and the gate dies on `git rev-parse --verify HEAD^{commit}` with
    // `fatal: Needed a single revision` — which reads as a broken recovery gate rather than as a
    // git default. Green here and red in CI, which is how it was found.
    gitText(external, ["clone", "--branch", "main", bundlePath, restoreCheckout]);
    const gate = {
      independentBundlePath: bundlePath,
      restoreCheckout,
      restoreHead: sourceSha,
      requiredObjects: [sourceSha, state.integrationBase],
      bundleRef: "refs/heads/main",
    };
    expect(() =>
      verifyRecoveryBundleGate({
        gate,
        evidence: { sourceSha },
        state,
        bundleBytes: readFileSync(bundlePath),
        root,
      }),
    ).not.toThrow();
    const siblingCheckout = path.join(external, "sibling-worktree");
    gitText(root, ["worktree", "add", "-b", "sibling", siblingCheckout]);
    const siblingBundle = path.join(siblingCheckout, "ward-flow.bundle");
    writeFileSync(siblingBundle, readFileSync(bundlePath));
    expect(() =>
      verifyRecoveryBundleGate({
        gate: { ...gate, independentBundlePath: siblingBundle },
        evidence: { sourceSha },
        state,
        bundleBytes: readFileSync(siblingBundle),
        root,
      }),
    ).toThrow(/resolves inside a repository checkout or the shared Git directory/);
    const linkedBundle = path.join(external, "linked.bundle");
    symlinkSync(bundlePath, linkedBundle, "file");
    expect(() =>
      verifyRecoveryBundleGate({
        gate: { ...gate, independentBundlePath: linkedBundle },
        evidence: { sourceSha },
        state,
        bundleBytes: readFileSync(bundlePath),
        root,
      }),
    ).toThrow(/regular file, not a symlink/);
    const thinBundlePath = path.join(external, "thin.bundle");
    gitText(root, ["bundle", "create", thinBundlePath, "refs/heads/main", `^${state.integrationBase}`]);
    const prepopulatedRestore = path.join(external, "prepopulated-restore");
    gitText(external, ["clone", root, prepopulatedRestore]);
    expect(() =>
      verifyRecoveryBundleGate({
        gate: { ...gate, independentBundlePath: thinBundlePath, restoreCheckout: prepopulatedRestore },
        evidence: { sourceSha },
        state,
        bundleBytes: readFileSync(thinBundlePath),
        root,
      }),
    ).toThrow(/cannot restore into an empty repository without external objects/);
    const invalidBundlePath = path.join(external, "invalid.bundle");
    writeFileSync(invalidBundlePath, "not a Git bundle");
    expect(() =>
      verifyRecoveryBundleGate({
        gate: { ...gate, independentBundlePath: invalidBundlePath },
        evidence: { sourceSha },
        state,
        bundleBytes: readFileSync(invalidBundlePath),
        root,
      }),
    ).toThrow(/failed git bundle verify/);
  });

  it("requires current-truth dispositions for every generated inventory source", () => {
    const inventory = {
      schemaVersion: 1,
      kind: "ward-flow-source-inventory",
      sourceSnapshot: "docs/ward-flow/live-state.json",
      sourceSnapshotSha256: "1".repeat(64),
      sources: [{ id: "a".repeat(64), kind: "chat-log", chat: "Ward Core", sessionId: "session-one" }],
    };
    const valid = {
      schemaVersion: 1,
      kind: "ward-flow-source-disposition-manifest",
      inventorySha256: sha256(canonicalJson(inventory)),
      unclassifiedSources: 0,
      sources: [
        {
          id: "a".repeat(64),
          disposition: "historical",
          canonicalPath: null,
          supersededBy: null,
          rationale: "Its unique content has been captured in the durable ledger.",
        },
      ],
    };
    expect(() => validateCurrentTruthManifest(valid, inventory)).not.toThrow();
    expect(() => validateCurrentTruthManifest({ ...valid, sources: [{}] }, inventory)).toThrow(/id/);
    expect(() => validateCurrentTruthManifest({ ...valid, sources: [] }, inventory)).toThrow(
      /classify every generated inventory source/,
    );
    const cyclicInventory = {
      ...inventory,
      sources: [
        { id: "a".repeat(64), kind: "chat-log-export" },
        { id: "b".repeat(64), kind: "chat-log-export" },
      ],
    };
    const cycle = {
      ...valid,
      inventorySha256: sha256(canonicalJson(cyclicInventory)),
      sources: [
        {
          id: "a".repeat(64),
          disposition: "superseded",
          canonicalPath: null,
          supersededBy: "b".repeat(64),
          rationale: "Replaced by B.",
        },
        {
          id: "b".repeat(64),
          disposition: "superseded",
          canonicalPath: null,
          supersededBy: "a".repeat(64),
          rationale: "Replaced by A.",
        },
      ],
    };
    expect(() => validateCurrentTruthManifest(cycle, cyclicInventory)).toThrow(/supersession cycle/);

    const root = createGitFixture();
    const activationSha = gitText(root, ["rev-parse", "HEAD"]);
    const objectId = gitText(root, ["rev-parse", `${activationSha}:AGENTS.md`]);
    const canonicalInventory = {
      ...inventory,
      sources: [{ id: "c".repeat(64), kind: "git-document", mode: "100644", type: "blob", objectId }],
    };
    const canonical = {
      ...valid,
      inventorySha256: sha256(canonicalJson(canonicalInventory)),
      sources: [
        {
          id: "c".repeat(64),
          disposition: "canonical",
          canonicalPath: "missing.md",
          supersededBy: null,
          rationale: "Current repository policy.",
        },
      ],
    };
    expect(() => validateCurrentTruthManifest(canonical, canonicalInventory, { activationSha, root })).toThrow(
      /does not exist/,
    );
    canonical.sources[0].canonicalPath = "AGENTS.md";
    expect(() => validateCurrentTruthManifest(canonical, canonicalInventory, { activationSha, root })).not.toThrow();
    canonicalInventory.sources[0].mode = "100755";
    canonical.inventorySha256 = sha256(canonicalJson(canonicalInventory));
    expect(() => validateCurrentTruthManifest(canonical, canonicalInventory, { activationSha, root })).toThrow(
      /does not match source/,
    );
  });

  it("rejects replaying transition evidence across a changed source snapshot", () => {
    const root = createGitFixture();
    const sourceSha = gitText(root, ["rev-parse", "HEAD"]);
    const evidencePath = "docs/ward-flow/control/evidence/receipt.json";
    mkdirSync(path.dirname(path.join(root, evidencePath)), { recursive: true });
    writeFileSync(path.join(root, evidencePath), "{}\n");
    gitText(root, ["add", evidencePath]);
    gitText(root, ["commit", "-m", "add transition evidence"]);
    const evidenceOnly = gitText(root, ["rev-parse", "HEAD"]);
    expect(() => assertTransitionEvidenceWindow(sourceSha, evidenceOnly, root)).not.toThrow();
    const liveStatePath = path.join(root, "docs", "ward-flow", "live-state.json");
    mkdirSync(path.dirname(liveStatePath), { recursive: true });
    writeFileSync(liveStatePath, '{"changed":true}\n');
    gitText(root, ["add", "docs/ward-flow/live-state.json"]);
    gitText(root, ["commit", "-m", "change source snapshot"]);
    expect(() => assertTransitionEvidenceWindow(sourceSha, gitText(root, ["rev-parse", "HEAD"]), root)).toThrow(
      /source-affecting changes/,
    );
  });

  it("requires one common source commit for all three transition receipts", () => {
    const sourceSha = "a".repeat(40);
    expect(assertCommonTransitionSourceSha([sourceSha, sourceSha, sourceSha])).toBe(sourceSha);
    expect(() => assertCommonTransitionSourceSha([sourceSha, sourceSha, "b".repeat(40)])).toThrow(
      /one common pre-receipt sourceSha/,
    );
  });

  it("accepts only complete gate-runner receipts with a recomputed key", () => {
    const args = ["run", "tests/ward-flow-chat-control.test.ts"];
    const inputHash = "a".repeat(64);
    const environmentHash = "b".repeat(64);
    const candidate = {
      key: receiptKey({ gate: "vitest", args, inputHash, environmentHash }),
      recordedAt: "2026-08-31T00:00:00.000Z",
      inputHash,
      environmentHash,
      args,
      fileCount: 123,
    };
    expect(validateRunnerReceiptCandidate(candidate, { gate: "vitest", args, inputHash, fileCount: 123 })).toBe(true);
    expect(() =>
      validateRunnerReceiptCandidate(
        { ...candidate, key: "c".repeat(64) },
        { gate: "vitest", args, inputHash, fileCount: 123 },
      ),
    ).toThrow(/key does not match/);
    expect(() =>
      validateRunnerReceiptCandidate(
        { ...candidate, recordedAt: "yesterday" },
        { gate: "vitest", args, inputHash, fileCount: 123 },
      ),
    ).toThrow(/canonical ISO timestamp/);
  });

  it("binds dirty artifact copies to unique paths and the original checkout bytes", () => {
    const root = createGitFixture();
    const sourceCheckout = temporaryDirectory("ward-artifact-source-");
    gitText(sourceCheckout, ["init", "-b", "main"]);
    gitText(sourceCheckout, ["config", "user.email", "ward-flow@example.test"]);
    gitText(sourceCheckout, ["config", "user.name", "Ward Flow Fixture"]);
    writeFileSync(path.join(sourceCheckout, "tracked.txt"), "before\n");
    gitText(sourceCheckout, ["add", "tracked.txt"]);
    gitText(sourceCheckout, ["commit", "-m", "add tracked source"]);
    const sourceHead = gitText(sourceCheckout, ["rev-parse", "HEAD"]);
    const sharedBytes = "captured bytes\n";
    writeFileSync(path.join(sourceCheckout, "tracked.txt"), sharedBytes);
    writeFileSync(path.join(sourceCheckout, "untracked.txt"), sharedBytes);
    const contentHash = sha256(sharedBytes);
    const artifactOne = "docs/ward-flow/control/evidence/artifacts/source/tracked.txt";
    const artifactTwo = "docs/ward-flow/control/evidence/artifacts/source/untracked.txt";
    const manifestPath = "docs/ward-flow/control/evidence/artifact-manifests/source.json";
    const manifest = {
      schemaVersion: 1,
      kind: "ward-flow-dirty-artifact-manifest",
      sourceId: "source",
      head: sourceHead,
      artifacts: [
        { sourcePath: "tracked.txt", status: " M", sourceSha256: contentHash, artifactPath: artifactOne },
        { sourcePath: "untracked.txt", status: "untracked", sourceSha256: contentHash, artifactPath: artifactTwo },
      ],
    };
    for (const relative of [artifactOne, artifactTwo]) {
      mkdirSync(path.dirname(path.join(root, relative)), { recursive: true });
      writeFileSync(path.join(root, relative), sharedBytes);
    }
    mkdirSync(path.dirname(path.join(root, manifestPath)), { recursive: true });
    writeFileSync(path.join(root, manifestPath), canonicalJson(manifest));
    gitText(root, ["add", "docs/ward-flow/control/evidence"]);
    gitText(root, ["commit", "-m", "preserve dirty source"]);
    const source = {
      checkout: sourceCheckout,
      head: sourceHead,
      artifactManifestPath: manifestPath,
      artifactManifestSha256: sha256(canonicalJson(manifest)),
    };
    const status = { tracked: [" M tracked.txt"], untrackedCount: 1 };
    const sourceSha = gitText(root, ["rev-parse", "HEAD"]);
    expect(() => durableDirtyArtifactManifest(source, status, sourceSha, "source", root)).not.toThrow();
    const globalEvidencePaths = new Set();
    expect(() =>
      durableDirtyArtifactManifest(source, status, sourceSha, "source", root, {
        artifactEvidencePaths: globalEvidencePaths,
      }),
    ).not.toThrow();
    expect(() =>
      durableDirtyArtifactManifest(source, status, sourceSha, "source", root, {
        artifactEvidencePaths: globalEvidencePaths,
      }),
    ).toThrow(/evidence already claimed by another source/);
    rmSync(path.join(sourceCheckout, "untracked.txt"));
    writeFileSync(path.join(sourceCheckout, "replacement.txt"), sharedBytes);
    expect(() => durableDirtyArtifactManifest(source, status, sourceSha, "source", root)).toThrow(
      /missing from the recorded checkout|statuses do not match the captured checkout status/,
    );
    rmSync(path.join(sourceCheckout, "replacement.txt"));
    writeFileSync(path.join(sourceCheckout, "untracked.txt"), sharedBytes);
    mkdirSync(path.join(sourceCheckout, "scratch"));
    writeFileSync(path.join(sourceCheckout, "scratch", "one.txt"), sharedBytes);
    writeFileSync(path.join(sourceCheckout, "scratch", "two.txt"), sharedBytes);
    expect(() => durableDirtyArtifactManifest(source, status, sourceSha, "source", root)).toThrow(
      /does not preserve every tracked and untracked item/,
    );
    rmSync(path.join(sourceCheckout, "scratch"), { recursive: true, maxRetries: 5, retryDelay: 100 });
    const outside = path.join(temporaryDirectory("ward-artifact-outside-"), "secret.txt");
    writeFileSync(outside, sharedBytes);
    rmSync(path.join(sourceCheckout, "untracked.txt"));
    symlinkSync(outside, path.join(sourceCheckout, "untracked.txt"), "file");
    expect(() => durableDirtyArtifactManifest(source, status, sourceSha, "source", root)).toThrow(
      /regular file, not a symlink/,
    );
    rmSync(path.join(sourceCheckout, "untracked.txt"));
    writeFileSync(path.join(sourceCheckout, "untracked.txt"), sharedBytes);
    writeFileSync(path.join(sourceCheckout, "untracked.txt"), "changed after capture\n");
    expect(() => durableDirtyArtifactManifest(source, status, sourceSha, "source", root)).toThrow(
      /does not match the original checkout bytes/,
    );
    writeFileSync(path.join(sourceCheckout, "untracked.txt"), sharedBytes);
    const duplicateManifest = structuredClone(manifest);
    duplicateManifest.artifacts[1].artifactPath = artifactOne;
    const duplicatePath = "docs/ward-flow/control/evidence/artifact-manifests/source-duplicate.json";
    writeFileSync(path.join(root, duplicatePath), canonicalJson(duplicateManifest));
    gitText(root, ["add", duplicatePath]);
    gitText(root, ["commit", "-m", "add invalid duplicate manifest"]);
    const duplicateSource = {
      ...source,
      artifactManifestPath: duplicatePath,
      artifactManifestSha256: sha256(canonicalJson(duplicateManifest)),
    };
    expect(() =>
      durableDirtyArtifactManifest(duplicateSource, status, gitText(root, ["rev-parse", "HEAD"]), "source", root),
    ).toThrow(/reuses preserved artifact/);
  });

  it("mechanically inventories Git documents, chat logs and checkout sources", () => {
    const root = createGitFixture();
    const workingCheckout = path.join(temporaryDirectory("ward-working-line-"), "checkout");
    gitText(root, ["worktree", "add", "-b", "working-line", workingCheckout]);
    writeFileSync(path.join(workingCheckout, "feature.txt"), "captured source\n");
    gitText(workingCheckout, ["add", "feature.txt"]);
    gitText(workingCheckout, ["commit", "-m", "add source feature"]);
    const workingHead = gitText(workingCheckout, ["rev-parse", "HEAD"]);
    const auditPath = "docs/ward-flow/evidence/audit.txt";
    const auditBytes = "durable audit\n";
    const sessionId = "23c91695-f037-49fb-ac67-80b7c640afa0";
    const externalChat = temporaryDirectory("ward-chat-export-");
    const sourceLogPath = path.join(externalChat, "source", `${sessionId}.jsonl`);
    const archivedLogPath = path.join(externalChat, "archive", `${sessionId}.jsonl`);
    const sourceLogBytes = Buffer.from(
      `{"type":"user","sessionId":"${sessionId}","uuid":"11111111-1111-4111-8111-111111111111","timestamp":"2026-08-31T00:00:00.000Z","message":"first"}\n` +
        `{"type":"assistant","sessionId":"${sessionId}","uuid":"22222222-2222-4222-8222-222222222222","timestamp":"2026-08-31T00:00:01.000Z","message":"second"}\n`,
    );
    mkdirSync(path.dirname(sourceLogPath), { recursive: true });
    mkdirSync(path.dirname(archivedLogPath), { recursive: true });
    writeFileSync(sourceLogPath, sourceLogBytes);
    writeFileSync(archivedLogPath, sourceLogBytes);
    expect(() =>
      buildChatExportEnvelope({
        chat: "Ward Core",
        sessionId,
        sourceLogPath,
        archivedLogPath,
        sourceBytes: Buffer.from('{"type":"user","message":"invented"}\n'),
      }),
    ).toThrow(/not bound to session/);
    const chatEnvelope = buildChatExportEnvelope({
      chat: "Ward Core",
      sessionId,
      sourceLogPath,
      archivedLogPath,
      sourceBytes: sourceLogBytes,
    });
    const chatExportPath = "docs/ward-flow/control/evidence/chat-exports/ward-core.json";
    const chatExportBytes = canonicalJson(chatEnvelope);
    const ownerDecisionPath = "docs/ward-flow/control/evidence/owner-decisions/ward-core.json";
    const ownerDecision = {
      schemaVersion: 1,
      kind: "ward-flow-owner-provenance-decision",
      decisionId: "owner-confirmation-test-001",
      decision: "owner-confirmed",
      chat: "Ward Core",
      sessionId,
      decidedAt: "2026-08-31T00:00:02.000Z",
    };
    const ownerDecisionBytes = canonicalJson(ownerDecision);
    const liveState = {
      workingLine: {
        branch: "working-line",
        head: workingHead,
        checkout: workingCheckout,
        status: { tracked: [] as string[], untrackedCount: 0 },
      },
      checkouts: [],
      sourceDocuments: [],
      chatLogs: [
        {
          chat: "Ward Core",
          sessionId,
          provenanceDecision: "owner-confirmed",
          ownerDecisionId: "owner-confirmation-test-001",
          ownerDecisionPath,
          ownerDecisionSha256: sha256(ownerDecisionBytes),
          exportPath: chatExportPath,
          exportSha256: sha256(chatExportBytes),
        },
      ],
      priorProcessAudit: { path: auditPath, sha256: sha256(auditBytes) },
    };
    const liveStatePath = path.join(root, "docs", "ward-flow", "live-state.json");
    mkdirSync(path.dirname(liveStatePath), { recursive: true });
    mkdirSync(path.dirname(path.join(root, auditPath)), { recursive: true });
    mkdirSync(path.dirname(path.join(root, chatExportPath)), { recursive: true });
    mkdirSync(path.dirname(path.join(root, ownerDecisionPath)), { recursive: true });
    writeFileSync(path.join(root, auditPath), auditBytes);
    writeFileSync(path.join(root, chatExportPath), chatExportBytes);
    writeFileSync(path.join(root, ownerDecisionPath), ownerDecisionBytes);
    writeFileSync(liveStatePath, JSON.stringify(liveState, null, 2) + "\n");
    gitText(root, ["add", "docs/ward-flow/live-state.json", auditPath, chatExportPath, ownerDecisionPath]);
    gitText(root, ["commit", "-m", "add source snapshot"]);
    const sourceSha = gitText(root, ["rev-parse", "HEAD"]);
    const state = {
      sourceSnapshot: "docs/ward-flow/live-state.json",
      integrationBase: liveState.workingLine.head,
    };
    const buildInventory = (sha: string) =>
      buildExpectedSourceInventory({
        state,
        sourceSha: sha,
        root,
        chatLogRoot: path.dirname(sourceLogPath),
      });
    const inventory = buildInventory(sourceSha);
    expect(inventory.sources.some((source: { kind: string }) => source.kind === "git-document")).toBe(true);
    expect(inventory.sources.some((source: { kind: string }) => source.kind === "chat-log-export")).toBe(true);
    expect(inventory.sources.some((source: { kind: string }) => source.kind === "working-line")).toBe(true);
    expect(inventory.sources.some((source: { kind: string }) => source.kind === "process-audit")).toBe(true);
    writeFileSync(path.join(workingCheckout, "new-untracked.txt"), "drift\n");
    expect(() => buildInventory(sourceSha)).toThrow(/checkout status drifted/);
    rmSync(path.join(workingCheckout, "new-untracked.txt"));
    writeFileSync(archivedLogPath, '{"type":"user","message":"invented"}\n');
    expect(() => buildInventory(sourceSha)).toThrow(/does not match the source log/);
    writeFileSync(archivedLogPath, sourceLogBytes);
    rmSync(sourceLogPath);
    expect(() => buildInventory(sourceSha)).toThrow(/does not exist during activation/);
    writeFileSync(sourceLogPath, sourceLogBytes);
    liveState.chatLogs.push(structuredClone(liveState.chatLogs[0]));
    writeFileSync(liveStatePath, JSON.stringify(liveState, null, 2) + "\n");
    gitText(root, ["add", "docs/ward-flow/live-state.json"]);
    gitText(root, ["commit", "-m", "record duplicate chat session"]);
    expect(() => buildInventory(gitText(root, ["rev-parse", "HEAD"]))).toThrow(/sessionId .* listed more than once/);
    liveState.chatLogs.pop();
    writeFileSync(liveStatePath, JSON.stringify(liveState, null, 2) + "\n");
    gitText(root, ["add", "docs/ward-flow/live-state.json"]);
    gitText(root, ["commit", "-m", "remove duplicate chat session"]);
    writeFileSync(path.join(workingCheckout, "feature.txt"), "dirty but uncaptured\n");
    liveState.workingLine.status.tracked = [" M feature.txt"];
    writeFileSync(liveStatePath, JSON.stringify(liveState, null, 2) + "\n");
    gitText(root, ["add", "docs/ward-flow/live-state.json"]);
    gitText(root, ["commit", "-m", "record uncaptured dirty source"]);
    expect(() => buildInventory(gitText(root, ["rev-parse", "HEAD"]))).toThrow(/artifactManifestPath/);
    writeFileSync(path.join(workingCheckout, "feature.txt"), "captured source\n");
    liveState.workingLine.status.tracked = [];
    delete (liveState.chatLogs[0] as { exportSha256?: string }).exportSha256;
    writeFileSync(liveStatePath, JSON.stringify(liveState, null, 2) + "\n");
    gitText(root, ["add", "docs/ward-flow/live-state.json"]);
    gitText(root, ["commit", "-m", "break chat export evidence"]);
    expect(() => buildInventory(gitText(root, ["rev-parse", "HEAD"]))).toThrow(/exportSha256/);
    writeFileSync(path.join(workingCheckout, "feature.txt"), "advanced source\n");
    gitText(workingCheckout, ["add", "feature.txt"]);
    gitText(workingCheckout, ["commit", "-m", "advance source after snapshot"]);
    expect(() => buildInventory(gitText(root, ["rev-parse", "HEAD"]))).toThrow(/checkout HEAD drifted/);
  });

  describe("a Ward Verifier is given a criterion, not just a commit", () => {
    /**
     * ⚠️ THE ASYMMETRY THIS CLOSES, recorded because it was lived rather than reasoned about.
     *
     * Ward Builder has always received a committed assignment naming its acceptance condition and
     * falsifier. Ward Verifier received a target SHA and nothing else — so the one role whose whole
     * purpose is refusing to take claims on trust was the only role whose own task could reach it
     * exclusively through a chat message, the one channel this control plane declares untrustworthy.
     *
     * The Verifier of 2026-08-31 could produce no verdict for the first half of its life for exactly
     * that reason, while `validate` reported 0 assignments and Ward Lead reasonably believed it was
     * tasked, because SendMessage had returned success. A successful send is not evidence of receipt.
     */
    function writeCriterion(root: string, body: Record<string, unknown>, relative: string): string {
      const absolute = path.join(root, ...relative.split("/"));
      mkdirSync(path.dirname(absolute), { recursive: true });
      writeFileSync(absolute, canonicalJson(body));
      gitText(root, ["add", relative]);
      gitText(root, ["commit", "-m", "add criterion"]);
      return relative;
    }

    const validBody = {
      schemaVersion: 1,
      kind: "ward-flow-verification-criterion",
      acceptanceCriterion: "Every preserved artifact is byte-identical to its live original.",
      falsifier: "Any hash mismatch, or any artifact absent at the target.",
      focusedCheck: "git plumbing and hashing only.",
    };

    it("accepts a committed criterion and content-addresses it", () => {
      const root = createGitFixture();
      const relative = writeCriterion(root, validBody, "docs/ward-flow/control/evidence/criteria/r1.json");
      const loaded = loadCommittedCriterion(relative, { integrationBranch: "main" }, root);
      expect(loaded.relative).toBe(relative);
      // The hash is over the COMMITTED bytes, so an edit after the lease is taken invalidates it
      // rather than silently retargeting the Verifier.
      expect(loaded.sha256).toBe(sha256(canonicalJson(validBody)));
    });

    it("refuses a criterion that states no falsifier — a criterion with no falsifier is a wish", () => {
      const root = createGitFixture();
      const noFalsifier: Record<string, unknown> = { ...validBody };
      delete noFalsifier.falsifier;
      const relative = writeCriterion(root, noFalsifier, "docs/ward-flow/control/evidence/criteria/weak.json");
      expect(() => loadCommittedCriterion(relative, { integrationBranch: "main" }, root)).toThrow(/falsifier/);
    });

    it("refuses one that is not committed, and one outside the control evidence path", () => {
      const root = createGitFixture();
      expect(() =>
        loadCommittedCriterion(
          "docs/ward-flow/control/evidence/criteria/absent.json",
          { integrationBranch: "main" },
          root,
        ),
      ).toThrow(/not committed/);
      // A criterion anywhere else could be edited without the control plane noticing.
      const outside = path.join(root, "criterion.json");
      writeFileSync(outside, canonicalJson(validBody));
      gitText(root, ["add", "criterion.json"]);
      gitText(root, ["commit", "-m", "add stray criterion"]);
      expect(() => loadCommittedCriterion("criterion.json", { integrationBranch: "main" }, root)).toThrow(
        /must be committed under/,
      );
    });
  });

  /**
   * WHY THIS EXISTS, AND WHY IT IS NOT A SKIP.
   *
   * `validateControlPlane` resolves `system-state.json`'s `integrationBranch` as a real git ref, and
   * from that ref it reads and hashes the committed recovery bundle. Both are properties of THIS
   * machine's clone: the integration branch is never pushed, and CI checks out a single published
   * branch, shallow. So the gate below cannot run on CI, and until 2026-09-03 it did not know that —
   * it simply went red there while passing here, which is the worst shape a check can have.
   *
   * The stand-aside is deliberately narrow. It admits exactly ONE reason, an unresolvable integration
   * branch, and asserts that reason rather than trusting it. A malformed `system-state.json`, a
   * missing bundle, a corrupted contract or any other failure still fails the test, on CI as here.
   */
  function controlPlaneEnvironment(): { available: true } | { available: false; reason: string } {
    const state = readJson("system-state.json") as { integrationBranch?: unknown };
    const branch = state.integrationBranch;
    if (typeof branch !== "string" || branch.length === 0) {
      return { available: false, reason: "system-state.json names no integrationBranch" };
    }
    try {
      execFileSync("git", ["rev-parse", "--verify", `${branch}^{commit}`], {
        cwd: projectRoot,
        stdio: "ignore",
      });
    } catch {
      return { available: false, reason: `integration branch ${branch} does not resolve in this checkout` };
    }
    return { available: true };
  }

  // THE TIMEOUT IS THE POINT OF THIS COMMENT, not a flake being papered over. In recovery mode
  // this validated a handful of JSON files in milliseconds. From 2026-08-31 the live state is
  // steady-state, so validateControlPlane now runs the recovery-bundle gate for real: it hashes a
  // 124 MB committed bundle, compares it byte-for-byte with an independent copy, runs
  // git bundle verify, and CLONES IT INTO A NEWLY CREATED EMPTY REPOSITORY. That is the gate doing
  // exactly what it promises rather than trusting a recorded outcome, and it costs real seconds
  // every time anything calls validate. Worth knowing before adding another caller.
  it("validates the checked-in control plane without assuming it will stay empty", () => {
    const environment = controlPlaneEnvironment();
    if (!environment.available) {
      expect(environment.reason).toMatch(/^integration branch .+ does not resolve in this checkout$/);
      return;
    }
    const result = validateControlPlane(projectRoot);
    expect(result.contract.roles).toHaveLength(3);
    expect(result.recordCount).toBeGreaterThanOrEqual(0);
    expect(result.certificateCount).toBeGreaterThanOrEqual(0);
    expect(sha256("stable")).toHaveLength(64);
  }, 300_000);
});
