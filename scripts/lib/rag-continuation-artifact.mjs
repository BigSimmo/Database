import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { join } from "node:path";

const sha = /^[a-f0-9]{40}$/;
const filename = /^\d{14}_[a-z0-9_]+\.sql$/;
const keys = ["schemaVersion", "evidenceKind", "programmeId", "phase", "plan", "task", "path", "commit", "blob"];

export function readTrackedMigrationNames(root, adapters = {}) {
  const git =
    adapters.git ??
    ((args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }));
  const head = git(["--literal-pathspecs", "ls-tree", "-r", "--name-only", "-z", "HEAD", "--", "supabase/migrations"]);
  const index = git(["--literal-pathspecs", "ls-files", "--stage", "-z", "--", "supabase/migrations"]);
  const paths = head.split("\0").filter(Boolean);
  for (const row of index.split("\0").filter(Boolean)) {
    const entry = row.match(/^\d{6} [a-f0-9]{40} [0-3]\t(.+)$/);
    if (!entry) throw new Error("malformed tracked migration index entry");
    paths.push(entry[1]);
  }
  return [
    ...new Set(paths.map((path) => path.match(/^supabase\/migrations\/(\d{14}_[^/]+\.sql)$/)?.[1]).filter(Boolean)),
  ];
}

export function continuationArtifactErrors({
  record,
  programmeId,
  reconciledBase,
  plannedName,
  existingNames,
  createOwners,
  evidence,
}) {
  const errors = [];
  const check = (ok, message) => {
    if (!ok) errors.push(message);
  };
  check(record && typeof record === "object" && !Array.isArray(record), "missing continuation artifact identity");
  if (errors.length) return errors;
  check(Object.keys(record).sort().join() === [...keys].sort().join(), "invalid continuation identity fields");
  check(
    record.schemaVersion === 1 && record.evidenceKind === "implemented-artifact-identity",
    "unsupported continuation identity kind/version",
  );
  check(record.programmeId === programmeId, "foreign programme identity");
  check(
    typeof plannedName === "string" &&
      filename.test(plannedName) &&
      record.path === `supabase/migrations/${plannedName}`,
    "identity must name the exact planned migration",
  );
  check(
    typeof record.commit === "string" &&
      sha.test(record.commit) &&
      typeof record.blob === "string" &&
      sha.test(record.blob),
    "commit/blob must be immutable full Git identities",
  );
  check(sha.test(reconciledBase ?? "") && record.commit !== reconciledBase, "identity must follow reconciledBase");
  check(
    Array.isArray(existingNames) && existingNames.length === 1 && existingNames[0] === plannedName,
    "same-version collision or missing exact migration",
  );
  const owners = Array.isArray(createOwners) ? createOwners.filter((owner) => owner.path === record.path) : [];
  check(
    owners.length === 1 &&
      owners[0].phase === record.phase &&
      owners[0].plan === record.plan &&
      owners[0].task === record.task,
    "identity must match the manifest task's actual Create owner",
  );
  check(evidence?.regularFile === true, "working migration must be a regular file");
  check(
    evidence?.baseIsAncestor === true && evidence?.commitIsAncestor === true,
    "pinned commit must be on current ancestry after reconciledBase",
  );
  check(evidence?.baseBlob === null, "base-existing migrations cannot use continuation identity");
  for (const field of ["pinnedBlob", "headTrackedBlob", "indexBlob", "workingBlob"]) {
    check(typeof evidence?.[field] === "string" && evidence[field] === record.blob, `${field} must equal pinned blob`);
  }
  return errors;
}

export function readContinuationArtifactEvidence(root, record, reconciledBase, adapters = {}) {
  const runGit =
    adapters.git ??
    ((args) => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }));
  const read = adapters.readFile ?? readFileSync;
  const stat = adapters.lstat ?? lstatSync;
  const result = {
    pinnedBlob: null,
    headTrackedBlob: null,
    indexBlob: null,
    workingBlob: null,
    baseBlob: undefined,
    baseIsAncestor: false,
    commitIsAncestor: false,
    regularFile: false,
  };
  if (
    !record ||
    !sha.test(record.commit ?? "") ||
    !sha.test(reconciledBase ?? "") ||
    !/^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/.test(record.path ?? "")
  )
    return result;
  const treeBlob = (ref) => {
    const line = runGit(["--literal-pathspecs", "ls-tree", ref, "--", record.path]).trim();
    if (!line) return null;
    const match = line.match(/^100(?:644|755) blob ([a-f0-9]{40})\t(.+)$/);
    if (!match || match[2] !== record.path) throw new Error("unexpected tracked migration identity");
    return match[1];
  };
  try {
    // Read-only Git plumbing; never hash with -w or enumerate untracked paths.
    result.baseBlob = treeBlob(reconciledBase);
    result.pinnedBlob = treeBlob(record.commit);
    result.headTrackedBlob = treeBlob("HEAD");
    const stage = runGit(["--literal-pathspecs", "ls-files", "--stage", "--", record.path]).trim();
    const index = stage.match(/^100(?:644|755) ([a-f0-9]{40}) 0\t(.+)$/);
    result.indexBlob = index?.[2] === record.path ? index[1] : null;
    runGit(["merge-base", "--is-ancestor", reconciledBase, record.commit]);
    result.baseIsAncestor = true;
    runGit(["merge-base", "--is-ancestor", record.commit, "HEAD"]);
    result.commitIsAncestor = true;
    const file = join(root, ...record.path.split("/"));
    result.regularFile = stat(file).isFile();
    if (!result.regularFile) return result;
    const bytes = read(file);
    result.workingBlob = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
  } catch {
    // Missing Git objects/files, conflicts and ancestry failures remain unproven.
  }
  return result;
}
