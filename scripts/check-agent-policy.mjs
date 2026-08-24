#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MAX_LINES = 400;
const MAX_WORDS = 5000;

function normalizeContract(value) {
  return String(value).trim().replace(/\s+/g, " ");
}

const shortcutContracts = [
  {
    key: "run",
    triggerCell: "Exact `run`",
    procedure: "`$run` in `.agents/skills/run/SKILL.md`",
    authority: "Start/verify the local app only.",
    ownerPath: ".agents/skills/run/SKILL.md",
    ownerMarker: "# Run 1. Run the task-start preflight",
  },
  {
    key: "dependency",
    triggerCell: "Exact `dependency`",
    procedure: "`$dependencies` in `.agents/skills/dependencies/SKILL.md`",
    authority: "Local dependency maintenance plus registry/docs reads; no commit/push/provider app call.",
    ownerPath: ".agents/skills/dependencies/SKILL.md",
    ownerMarker: "# Dependencies Sole procedure for exact `dependency`",
  },
  {
    key: "bug-hunter",
    triggerCell: "Exact `bug-hunter`",
    procedure: "`bug-hunter` skill + `docs/codex-review-protocol.md`",
    authority: "Read-only targeted defect discovery; no fixes unless asked.",
    ownerPath: "docs/codex-review-protocol.md",
    ownerMarker: "this document owns the detailed review procedure",
  },
  {
    key: "upload",
    triggerCell: "Exact `upload`",
    procedure: "`$upload` in `.agents/skills/upload/SKILL.md`",
    authority: "Scoped staging, commit, and ordinary feature-branch push.",
    ownerPath: ".agents/skills/upload/SKILL.md",
    ownerMarker: "# Upload and PR handoff 1. Inspect branch/HEAD/status/diff; isolate unsafe state.",
  },
  {
    key: "Run PR",
    triggerCell: "Exact `Run PR` (case-insensitive)",
    procedure: "`$run-pr` in `.agents/skills/run-pr/SKILL.md`",
    authority: "The bounded GitHub sweep actions listed in that skill.",
    ownerPath: ".agents/skills/run-pr/SKILL.md",
    ownerMarker: "# Run PR Trigger only from trimmed case-insensitive `Run PR`",
  },
  {
    key: "/issues",
    triggerCell: "Exact `/issues` family",
    procedure: "`$issues` in `.agents/skills/issues/SKILL.md`",
    authority: "Plain `/issues` is read-only; mutations follow the command-specific contract.",
    ownerPath: ".agents/skills/issues/SKILL.md",
    ownerMarker: "# Issues ## Plain `/issues` (read-only)",
  },
];

const cursorAgentContracts = [
  {
    relativePath: ".cursor/agents/design-review.md",
    digest: "451f2040eb6bd0bb69f840689248354cf053f64577b7c94360ede644fb285695",
    kind: "owner",
    label: "Cursor design review owner",
  },
  {
    relativePath: ".cursor/agents/pr-bugbot.md",
    digest: "2464c414b9446a125dff691b5687bb79d47f54fda568b1d07d844afacf805a55",
    kind: "owner",
    label: "Cursor Bugbot owner",
  },
  {
    relativePath: ".cursor/agents/pr-babysit.md",
    digest: "be32f90c9b0e88b0fdc2c942fd7dcf907becab2cb2b38cbc5e3652bb40386175",
    kind: "adapter",
    label: "Cursor Run PR adapter",
  },
];

const policyOwnerFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  ".agents/skills/catalog.json",
  ".agents/skills/dependencies/SKILL.md",
  ".agents/skills/handover/SKILL.md",
  ".agents/skills/issues/SKILL.md",
  ".agents/skills/review/SKILL.md",
  ".agents/skills/run/SKILL.md",
  ".agents/skills/upload/SKILL.md",
  ".agents/skills/run-pr/SKILL.md",
  ".agents/skills/ledger/SKILL.md",
  ".claude/skills/handoff/SKILL.md",
  ".claude/skills/gates/SKILL.md",
  ".claude/skills/issues/SKILL.md",
  ".claude/skills/ledger/SKILL.md",
  ".claude/skills/run-pr/SKILL.md",
  ...cursorAgentContracts.map(({ relativePath }) => relativePath),
  ".cursor/skills/design-review/SKILL.md",
  ".github/codex/prompts/run-pr-operator.md",
  ".github/codex/run-pr-result.schema.json",
  "docs/agents-guide.md",
  "docs/codex-cloud.md",
  "docs/codex-review-protocol.md",
  "docs/process-hardening.md",
];

const requiredCanonicalReferences = [
  ".agents/skills/catalog.json",
  "docs/agents-guide.md",
  "docs/codebase-index.md",
  "docs/codex-cloud.md",
  "docs/codex-review-protocol.md",
  "docs/database-drift-detection.md",
  "docs/deployment-architecture.md",
  "docs/outstanding-issues.md",
  "docs/process-hardening.md",
  "docs/production-readiness-checklist.md",
  "docs/rag-behaviour/",
  "docs/search-chrome-behaviour.md",
  "docs/site-map.md",
  "docs/testing.md",
  "docs/wiring-conventions.md",
];

export const AGENT_POLICY_INPUT_PATHS = [
  ...new Set(
    [
      "AGENTS.md",
      "scripts/check-agent-policy.mjs",
      ".cursor/agents",
      ...policyOwnerFiles,
      ...requiredCanonicalReferences,
    ].map((relativePath) => relativePath.replaceAll("\\", "/").replace(/\/+$/, "")),
  ),
];

const exactContractDigests = {
  // These fingerprints deliberately make each bounded safety contract immutable after whitespace normalization.
  precedence: "0241517a9ed1d53a6b60ea2800b9a4a095196acf86fc087b7d1fdbf5f1af6687",
  instructionBoundary: "85c634f5b34913d856ca5489badde74a79fd621317be44bce1ea1d7b1f0e7241",
  authorityMatrix: "39f512107130f61a388b6479e790a6513aea50fbc795c21ab02a599bc63ef926",
  shortcutRegistry: "f431ec6646ff2381486d0d96a69be481b8a954da2e9dd6cc034b8ea6a5474282",
  providersCloudTrustedExecution: "9e5305e97de7d297d5645d0c99c6f0205bef5244176fed8439655bece32865c0",
  dependencyProcedure: "e49da1afb899d2cd4706fe2625deaf83cab15c9155d4b11e10a428b430aa704a",
  cloudAuthenticatedLiveTesting: "26a4509fc9870c0761f61f3b91cdd2fe5e170b016d98241f59986f98a9521831",
  cloudConnectedProfile: "78f09f5e0b0c9d5efb65dec0e6c6c62463f68003125f9e4b94d0af2ad75bae51",
};

const exactFileContracts = [
  ["AGENTS.md", "f2102316c2ca07914c76418e2eb6af04012bae150ba29e8c1fc2a5ad9baebb98", "Root policy"],
  ["CLAUDE.md", "cdaac9857d6aab4a00ad35a3a0d0fe89cd98be9322e96bf8de8ebbf07efc86a4", "CLAUDE orientation"],
  [".agents/skills/run/SKILL.md", "c73d9a69f95eea3ea16c2c1ee6fc664574ce34bd62c78a81eefae37b50d571af", "Run owner"],
  [
    ".agents/skills/dependencies/SKILL.md",
    "546e39bd3234a096dfe2a4cfb44e630cfa267df5cb9be99ee7528b277d936481",
    "Dependencies owner",
  ],
  [
    ".agents/skills/upload/SKILL.md",
    "5473ad1a4f8d560f633aa8879891bbe0a4cb943afaa387478762394fb0ef643f",
    "Upload owner",
  ],
  [
    ".agents/skills/run-pr/SKILL.md",
    "638f64787b6e64342467db3323279f09bc4ce05802b52a98c6c3e3061879ae23",
    "Run PR owner",
  ],
  [
    ".agents/skills/issues/SKILL.md",
    "62ec1874689942d6bfe422ec9f7f219296c2dd56d865b6db0f4a84b073131c0e",
    "Issues owner",
  ],
  [
    ".agents/skills/ledger/SKILL.md",
    "92a29872bda69515bc04dcb56e11628cd46a077fb64b8c29c1db335af53eb78e",
    "Ledger owner",
  ],
  [
    ".agents/skills/review/SKILL.md",
    "948fbbf8bc0def9779ca70caf158390cfe899f1caa266e1e420ee499d960296b",
    "Review skill owner",
  ],
  [
    ".agents/skills/handover/SKILL.md",
    "74bec06964b496999aee3decbc2aed2367aa0b4759a19c9bd19563928400ca1e",
    "Handover owner",
  ],
  [
    ".claude/skills/ledger/SKILL.md",
    "9f71224f48342e21bf2498d298f88121e4c087110a7941b7ae05fd19efe329dd",
    "Claude ledger owner",
  ],
  ["docs/agents-guide.md", "d57b3ed0320ccbcf1b82f0aaa5c7af7305bc346f624618ed24ce4846702deea9", "Agent guide owner"],
  [
    "docs/process-hardening.md",
    "e91f99564da42de5961b783858f8f52d30c609ec3a20af777e2fe7c982e59740",
    "Process hardening owner",
  ],
  [
    "docs/codex-review-protocol.md",
    "65a663658f32eb5b795eb3136d908eb34017574fee11b1037cce6b45e7f886d9",
    "Review protocol",
  ],
  ["docs/codex-cloud.md", "bf2dfed08934027d0ab570d4a9ea034dd5f7e565e3972dba13cdacd993167938", "Cloud owner"],
  [
    ".claude/skills/gates/SKILL.md",
    "9d30219c8a7e5ba22ba5d95827737062e11ced58c301d442aaa1673760cba332",
    "Claude gates owner",
  ],
  [
    ".cursor/skills/design-review/SKILL.md",
    "6921ba76e395c2699e62553d13174275d47881d2bb90c651e2c6396e67997934",
    "Cursor design review skill",
  ],
  [
    ".agents/skills/catalog.json",
    "5e3aa9295f56ce97336e1b153f4cf1c00f252188dc8743d22b9af84135d0f667",
    "Skill catalog owner",
  ],
  [
    ".github/codex/prompts/run-pr-operator.md",
    "388d9bd225cdd901b3418c46aa90e9d43dd246a37b18b4c7e713f8d9c4b29bf4",
    "Run PR operator prompt",
  ],
  [
    ".github/codex/run-pr-result.schema.json",
    "90ffd7da8b52867c9ca85b06c2c4aacfb3b219b27595f95c5b52f4c1c5ad1373",
    "Run PR operator schema",
  ],
];

const thinAdapterContracts = [
  [
    ".claude/skills/run-pr/SKILL.md",
    "5de0d81bbea0236dcd2c1f626ab3eba595594a06b8bc71c6a243bbecd0d035cc",
    "Claude Run PR adapter",
  ],
  [
    ".claude/skills/issues/SKILL.md",
    "8e4162e67f82f87337f265e30159183598934602dc01d132402ed67af3d27579",
    "Claude issues adapter",
  ],
  [
    ".claude/skills/handoff/SKILL.md",
    "bbdddf2cdb4026fbe816d331100df4f0841ede4b662f5e0e557b5bc8d73cf9cf",
    "Claude handoff adapter",
  ],
];

const allowedRootHeadings = new Map([
  [
    2,
    new Set([
      "Purpose",
      "Precedence",
      "Instruction and data boundary",
      "Authority matrix",
      "Evidence vocabulary",
      "Repository preflight",
      "Execution lifecycle",
      "Mutable state and race safety",
      "Shortcut registry",
      "Local application and browser work",
      "Proportionate verification",
      "Git, publication, and review",
      "High-risk domain invariants",
      "Canonical references",
    ]),
  ],
  [
    3,
    new Set([
      "Next.js and toolchain",
      "Clinical, privacy, auth, and public contracts",
      "Supabase, migrations, and production",
      "RAG, retrieval, sources, and ingestion",
      "UI, accessibility, and phone chrome",
      "Providers, Cloud, and trusted execution",
      "Portability and destructive operations",
    ]),
  ],
]);

function parseArgs(args) {
  let root = scriptRoot;
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === "--root") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--root requires a repository path.");
      root = path.resolve(value);
      index += 1;
      continue;
    }
    throw new Error(`Unknown option: ${token}`);
  }
  return { root };
}

function section(text, heading, level = 2) {
  const lines = text.split(/\r?\n/);
  const marker = `${"#".repeat(level)} ${heading}`;
  const start = lines.findIndex((line) => line.trim() === marker);
  if (start === -1) return "";
  const closingHeading = new RegExp(`^#{1,${level}}\\s`);
  const end = lines.findIndex((line, index) => index > start && closingHeading.test(line));
  return lines.slice(start + 1, end === -1 ? lines.length : end).join("\n");
}

function normalizedDigest(value) {
  return createHash("sha256").update(normalizeContract(value)).digest("hex");
}

function requireExactNormalizedContract(value, expectedDigest, label, failures) {
  if (normalizedDigest(value) !== expectedDigest) {
    failures.push(`${label} must match its exact normalized contract.`);
  }
}

function parseShortcutRegistry(policy, failures) {
  const registry = section(policy, "Shortcut registry");
  if (!registry) {
    failures.push("Shortcut registry is missing or empty.");
    return [];
  }

  const tableLines = registry.split(/\r?\n/).filter((line) => line.trim().startsWith("|"));
  const header = tableLines.shift();
  if (!header || !/^\|\s*User trigger\s*\|\s*Canonical procedure\s*\|\s*Authority added\s*\|$/i.test(header)) {
    failures.push(
      "Shortcut registry must use the structured User trigger / Canonical procedure / Authority added table.",
    );
    return [];
  }
  if (tableLines[0] && /^\|(?:\s*:?-+:?\s*\|){3}$/.test(tableLines[0])) tableLines.shift();

  const rows = [];
  for (const line of tableLines) {
    const cells = line
      .trim()
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
    if (cells.length !== 3) {
      failures.push(`Shortcut registry row must have exactly three cells: ${line.trim()}`);
      continue;
    }
    const [triggerCell, procedure, authority] = cells.map(normalizeContract);
    const codeTrigger = triggerCell.match(/`([^`]+)`/)?.[1] ?? triggerCell;
    const exactContract = shortcutContracts.find((contract) => contract.triggerCell === triggerCell);
    const conceptualContract = shortcutContracts.find(
      (contract) => contract.key.toLowerCase() === codeTrigger.toLowerCase(),
    );
    if (!exactContract) {
      if (conceptualContract) {
        failures.push(
          `Shortcut must declare exact trigger semantics using exact canonical trigger cell ${conceptualContract.triggerCell}; received ${triggerCell}.`,
        );
      } else {
        failures.push(`Unmanaged shortcut trigger: ${codeTrigger}.`);
      }
    }
    rows.push({ key: conceptualContract?.key ?? codeTrigger, triggerCell, procedure, authority, exactContract });
  }

  const seen = new Set();
  for (const row of rows) {
    const key = row.key.toLowerCase();
    if (seen.has(key)) failures.push(`Duplicate shortcut trigger: ${row.key}.`);
    seen.add(key);
    if (!row.procedure) failures.push(`Shortcut ${row.key} must name one canonical procedure.`);
    if (!row.authority) failures.push(`Shortcut ${row.key} must declare bounded authority.`);
  }

  for (const contract of shortcutContracts) {
    const row = rows.find((candidate) => candidate.triggerCell === contract.triggerCell);
    if (!row) {
      failures.push(`Shortcut registry is missing exact canonical trigger cell ${contract.triggerCell}.`);
      continue;
    }
    if (row.procedure !== normalizeContract(contract.procedure)) {
      failures.push(`Shortcut ${contract.key} must use its exact normalized canonical procedure contract.`);
    }
    if (row.authority !== normalizeContract(contract.authority)) {
      failures.push(
        `Shortcut authority for ${contract.key} must match its exact normalized grant and exclusion contract.`,
      );
    }
  }

  return rows;
}

function validateManagedSections(policy, failures) {
  const headingMatches = [...policy.matchAll(/^(#{2,3})\s+(.+?)\s*$/gm)];
  const headings = headingMatches.filter((match) => match[1].length === 2).map((match) => match[2].trim());
  const seenHeadings = new Set();
  for (const heading of headings) {
    const key = heading.toLowerCase();
    if (seenHeadings.has(key)) failures.push(`Duplicate managed section heading: ${heading}.`);
    seenHeadings.add(key);
  }

  for (const match of headingMatches) {
    const level = match[1].length;
    const heading = match[2].trim();
    if (!allowedRootHeadings.get(level)?.has(heading)) {
      failures.push(`Unmanaged root policy heading at level ${level}: ${heading}.`);
    }
  }
  for (const [level, allowed] of allowedRootHeadings) {
    for (const heading of allowed) {
      if (!headingMatches.some((match) => match[1].length === level && match[2].trim() === heading)) {
        failures.push(`Required root policy heading at level ${level} is missing: ${heading}.`);
      }
    }
  }

  const markers = [...policy.matchAll(/<!--\s*(BEGIN|END):([a-z0-9-]+)\s*-->/gi)].map((match) => ({
    kind: match[1].toUpperCase(),
    name: match[2].toLowerCase(),
    index: match.index,
  }));
  const names = new Set(markers.map((marker) => marker.name));
  names.add("nextjs-agent-rules");
  for (const name of names) {
    const begins = markers.filter((marker) => marker.name === name && marker.kind === "BEGIN");
    const ends = markers.filter((marker) => marker.name === name && marker.kind === "END");
    if (begins.length !== 1 || ends.length !== 1 || begins[0].index >= ends[0].index) {
      failures.push(`Generated block ${name} must have exactly one ordered BEGIN/END marker pair.`);
    }
  }
}

function validateExactFileContracts(root, failures) {
  for (const [relativePath, expectedDigest, label] of exactFileContracts) {
    const absolutePath = path.join(root, relativePath);
    if (!existsSync(absolutePath)) {
      failures.push(`${label} ${relativePath} does not exist.`);
      continue;
    }
    requireExactNormalizedContract(readFileSync(absolutePath, "utf8"), expectedDigest, label, failures);
  }
}

function validateThinAdapters(root, failures) {
  for (const [relativePath, expectedDigest, label] of thinAdapterContracts) {
    const absolutePath = path.join(root, relativePath);
    if (!existsSync(absolutePath)) {
      failures.push(`${label} ${relativePath} does not exist.`);
      continue;
    }
    if (normalizedDigest(readFileSync(absolutePath, "utf8")) !== expectedDigest) {
      failures.push(`${label} must match its thin adapter contract.`);
    }
  }
}

function validateCursorAgentInventory(root, failures) {
  const cursorAgentsDirectory = path.join(root, ".cursor", "agents");
  const registeredContracts = new Map(cursorAgentContracts.map((contract) => [contract.relativePath, contract]));
  let activeAgentPaths = [];

  if (existsSync(cursorAgentsDirectory)) {
    activeAgentPaths = readdirSync(cursorAgentsDirectory, { withFileTypes: true })
      .filter((entry) => (entry.isFile() || entry.isSymbolicLink()) && entry.name.endsWith(".md"))
      .map((entry) => `.cursor/agents/${entry.name}`)
      .sort();
  }

  for (const relativePath of activeAgentPaths) {
    if (!registeredContracts.has(relativePath)) {
      failures.push(
        `Unregistered active Cursor agent ${relativePath}; every .cursor/agents/*.md file must be an exact owner or thin adapter.`,
      );
    }
  }

  const activeAgentSet = new Set(activeAgentPaths);
  for (const contract of cursorAgentContracts) {
    if (!activeAgentSet.has(contract.relativePath)) {
      failures.push(`${contract.label} ${contract.relativePath} does not exist.`);
      continue;
    }
    const source = readFileSync(path.join(root, contract.relativePath), "utf8");
    if (normalizedDigest(source) !== contract.digest) {
      const contractKind = contract.kind === "adapter" ? "thin adapter" : "exact normalized";
      failures.push(`${contract.label} must match its ${contractKind} contract.`);
    }
  }
}

function validateCanonicalReferences(root, policy, failures) {
  const references = section(policy, "Canonical references");
  if (!references) {
    failures.push("Canonical references section is missing or empty.");
    return;
  }
  const paths = [...references.matchAll(/`((?:docs|\.agents)\/[^`]+)`/g)].map((match) => match[1]);
  if (paths.length === 0) failures.push("Canonical references section names no repository paths.");
  const uniquePaths = new Set(paths);
  for (const requiredPath of requiredCanonicalReferences) {
    if (!uniquePaths.has(requiredPath)) failures.push(`Required canonical reference ${requiredPath} is missing.`);
  }
  for (const relativePath of uniquePaths) {
    if (!existsSync(path.join(root, relativePath))) {
      failures.push(`Canonical reference ${relativePath} does not exist.`);
    }
  }
}

function validateDetailedOwners(root, failures) {
  const readableOwners = policyOwnerFiles
    .filter((relativePath) => existsSync(path.join(root, relativePath)))
    .map((relativePath) => ({
      relativePath,
      normalized: normalizeContract(readFileSync(path.join(root, relativePath), "utf8")),
    }));

  for (const contract of shortcutContracts) {
    const expectedOwner = path.join(root, contract.ownerPath);
    if (!existsSync(expectedOwner)) {
      failures.push(`${contract.key} canonical owner ${contract.ownerPath} does not exist.`);
      continue;
    }
    const marker = normalizeContract(contract.ownerMarker);
    const occurrences = readableOwners.map((candidate) => ({
      relativePath: candidate.relativePath,
      count: candidate.normalized.split(marker).length - 1,
    }));
    const totalOccurrences = occurrences.reduce((total, candidate) => total + candidate.count, 0);
    const expectedOccurrences =
      occurrences.find((candidate) => candidate.relativePath === contract.ownerPath)?.count ?? 0;
    if (totalOccurrences !== 1 || expectedOccurrences !== 1) {
      const found = occurrences
        .filter((candidate) => candidate.count > 0)
        .map((candidate) => `${candidate.relativePath} (${candidate.count})`)
        .join(", ");
      failures.push(
        `${contract.key} must have exactly one detailed owner marker at ${contract.ownerPath}; found ${totalOccurrences} occurrence(s)${found ? ` in ${found}` : ""}.`,
      );
    }
  }
}

export function validateAgentPolicy(root) {
  const failures = [];
  const policyPath = path.join(root, "AGENTS.md");
  if (!existsSync(policyPath)) return { failures: ["AGENTS.md does not exist."], lineCount: 0, wordCount: 0 };
  const policy = readFileSync(policyPath, "utf8");
  const lineCount = policy.split(/\r?\n/).length - (policy.endsWith("\n") ? 1 : 0);
  const wordCount = policy.trim().split(/\s+/).filter(Boolean).length;

  if (lineCount > MAX_LINES) failures.push(`AGENTS.md has ${lineCount} lines, more than 400 lines.`);
  if (wordCount > MAX_WORDS) failures.push(`AGENTS.md has ${wordCount} words, more than 5,000 words.`);

  validateManagedSections(policy, failures);
  parseShortcutRegistry(policy, failures);
  validateCursorAgentInventory(root, failures);
  validateExactFileContracts(root, failures);
  validateThinAdapters(root, failures);

  const precedence = section(policy, "Precedence");
  const instructionBoundary = section(policy, "Instruction and data boundary");
  const authorityMatrix = section(policy, "Authority matrix");
  const shortcutRegistry = section(policy, "Shortcut registry");
  const providersCloudTrustedExecution = section(policy, "Providers, Cloud, and trusted execution", 3);

  requireExactNormalizedContract(precedence, exactContractDigests.precedence, "Precedence", failures);
  requireExactNormalizedContract(
    instructionBoundary,
    exactContractDigests.instructionBoundary,
    "Instruction and data boundary",
    failures,
  );
  requireExactNormalizedContract(authorityMatrix, exactContractDigests.authorityMatrix, "Authority matrix", failures);
  requireExactNormalizedContract(
    shortcutRegistry,
    exactContractDigests.shortcutRegistry,
    "Shortcut registry",
    failures,
  );
  requireExactNormalizedContract(
    providersCloudTrustedExecution,
    exactContractDigests.providersCloudTrustedExecution,
    "Providers, Cloud, and trusted execution",
    failures,
  );

  const dependencyPath = path.join(root, ".agents/skills/dependencies/SKILL.md");
  if (!existsSync(dependencyPath)) {
    failures.push("Dependency canonical skill does not exist.");
  } else {
    const dependency = readFileSync(dependencyPath, "utf8");
    requireExactNormalizedContract(
      section(dependency, "Dependencies", 1),
      exactContractDigests.dependencyProcedure,
      "Dependency procedure",
      failures,
    );
  }

  const cloudPath = path.join(root, "docs/codex-cloud.md");
  if (!existsSync(cloudPath)) {
    failures.push("Cloud credential isolation owner docs/codex-cloud.md does not exist.");
  } else {
    const cloud = readFileSync(cloudPath, "utf8");
    requireExactNormalizedContract(
      section(cloud, "Connected (explicit opt-in)", 3),
      exactContractDigests.cloudConnectedProfile,
      "Cloud connected profile",
      failures,
    );
    requireExactNormalizedContract(
      section(cloud, "Authenticated live testing"),
      exactContractDigests.cloudAuthenticatedLiveTesting,
      "Cloud credential isolation authenticated live testing",
      failures,
    );
  }

  const volatilePatterns = [
    /\b20\d{2}-\d{2}-\d{2}\b/,
    /\b[0-9a-f]{40}\b/i,
    /\bPR\s+#\d+\b/i,
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  ];
  if (volatilePatterns.some((pattern) => pattern.test(policy))) {
    failures.push("Volatile state (dates, SHAs, PR snapshots, or provider UUIDs) must not live in stable root policy.");
  }

  validateCanonicalReferences(root, policy, failures);
  validateDetailedOwners(root, failures);

  return { failures, lineCount, wordCount };
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  try {
    const { root } = parseArgs(process.argv.slice(2));
    const result = validateAgentPolicy(root);
    if (result.failures.length > 0) {
      console.error("Agent policy invalid:");
      for (const failure of result.failures) console.error(`- ${failure}`);
      process.exit(1);
    }
    console.log(`Agent policy OK: AGENTS.md has ${result.lineCount} lines and ${result.wordCount} words.`);
  } catch (error) {
    console.error(`Agent policy check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
