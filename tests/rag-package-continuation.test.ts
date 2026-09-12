import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import {
  continuationArtifactErrors,
  readContinuationArtifactEvidence,
  readTrackedMigrationNames,
} from "../scripts/lib/rag-continuation-artifact.mjs";

const name = "20260822123000_govern_australian_source_activation.sql";
const path = `supabase/migrations/${name}`;
const base = "1".repeat(40);
const commit = "2".repeat(40);
const blob = "3".repeat(40);
const record = {
  schemaVersion: 1,
  evidenceKind: "implemented-artifact-identity",
  programmeId: "programme",
  phase: "P02",
  plan: "australian",
  task: 4,
  path,
  commit,
  blob,
};
const options = {
  record,
  programmeId: "programme",
  reconciledBase: base,
  plannedName: name,
  existingNames: [name],
  createOwners: [{ phase: "P02", plan: "australian", task: 4, path }],
  evidence: {
    headTrackedBlob: blob,
    indexBlob: blob,
    pinnedBlob: blob,
    workingBlob: blob,
    baseBlob: null,
    baseIsAncestor: true,
    commitIsAncestor: true,
    regularFile: true,
  },
};
describe("implemented migration continuation identity", () => {
  it.each(["HEAD", "index"])("rejects a tracked %s duplicate hidden from the working directory", (location) => {
    const duplicate = "20260822123000_hidden_duplicate.sql";
    const duplicatePath = `supabase/migrations/${duplicate}`;
    const calls: string[][] = [];
    const tracked = readTrackedMigrationNames("synthetic-root", {
      git: (args: string[]) => {
        calls.push(args);
        if (args[1] === "ls-tree") return `${path}\0${location === "HEAD" ? `${duplicatePath}\0` : ""}`;
        return `100644 ${blob} 0\t${path}\0${location === "index" ? `100644 ${blob} 0\t${duplicatePath}\0` : ""}`;
      },
    });
    const diskNames = [name];
    const existingNames = [...new Set([...diskNames, ...tracked])];
    expect(existingNames).toContain(duplicate);
    expect(continuationArtifactErrors({ ...options, existingNames })).toContain(
      "same-version collision or missing exact migration",
    );
    expect(calls).toEqual([
      ["--literal-pathspecs", "ls-tree", "-r", "--name-only", "-z", "HEAD", "--", "supabase/migrations"],
      ["--literal-pathspecs", "ls-files", "--stage", "-z", "--", "supabase/migrations"],
    ]);
  });
  it("fails closed when tracked migration names cannot be proven", () => {
    expect(() =>
      readTrackedMigrationNames("synthetic-root", {
        git: () => {
          throw new Error("Git unavailable");
        },
      }),
    ).toThrow();
    expect(() =>
      readTrackedMigrationNames("synthetic-root", {
        git: (args: string[]) => (args[1] === "ls-tree" ? "" : "malformed\0"),
      }),
    ).toThrow(/malformed/);
  });
  it("accepts only the exact owned committed artifact without making a receipt", () => {
    expect(continuationArtifactErrors(options)).toEqual([]);
  });
  it.each([
    { record: null },
    { record: { ...record, schemaVersion: 2 } },
    { record: { ...record, programmeId: "foreign" } },
    { record: { ...record, phase: "P03" } },
    { record: { ...record, plan: "ingestion" } },
    { record: { ...record, task: 3 } },
    { record: { ...record, path: "../secret" } },
    { record: { ...record, commit: "HEAD" } },
    { record: { ...record, commit: base } },
    { record: { ...record, blob: "bogus" } },
    { record: { ...record, accepted: true } },
    { createOwners: [] },
    { createOwners: [options.createOwners[0], options.createOwners[0]] },
    { existingNames: [name, "20260822123000_foreign.sql"] },
    { existingNames: ["20260822123000_renamed.sql"] },
  ])("rejects malformed, foreign, duplicate or ownerless metadata %j", (override) => {
    expect(continuationArtifactErrors({ ...options, ...override }).length).toBeGreaterThan(0);
  });
  it.each([
    { headTrackedBlob: null },
    { pinnedBlob: null },
    { pinnedBlob: "4".repeat(40) },
    { headTrackedBlob: "4".repeat(40) },
    { indexBlob: "4".repeat(40) },
    { indexBlob: null },
    { workingBlob: "4".repeat(40) },
    { baseBlob: blob },
    { baseIsAncestor: false },
    { commitIsAncestor: false },
    { regularFile: false },
  ])("rejects untracked, tampered, base-existing or foreign evidence %j", (evidence) => {
    expect(
      continuationArtifactErrors({ ...options, evidence: { ...options.evidence, ...evidence } }).length,
    ).toBeGreaterThan(0);
  });
  it("reads exact Git ancestry, HEAD and stage0 identity without enumerating untracked files", () => {
    const bytes = Buffer.from("-- synthetic migration\n");
    const digest = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    const calls: string[][] = [];
    const git = (args: string[]) => {
      calls.push(args);
      if (args[1] === "ls-tree") return args[2] === base ? "" : `100644 blob ${digest}\t${path}\n`;
      if (args[1] === "ls-files") return `100644 ${digest} 0\t${path}\n`;
      return "";
    };
    const evidence = readContinuationArtifactEvidence("synthetic-root", { ...record, blob: digest }, base, {
      git,
      readFile: () => bytes,
      lstat: () => ({ isFile: () => true }),
    });
    expect(continuationArtifactErrors({ ...options, record: { ...record, blob: digest }, evidence })).toEqual([]);
    expect(calls).toContainEqual(["--literal-pathspecs", "ls-tree", "HEAD", "--", path]);
    expect(calls).toContainEqual(["--literal-pathspecs", "ls-files", "--stage", "--", path]);
    expect(calls).toContainEqual(["merge-base", "--is-ancestor", base, commit]);
    expect(calls).toContainEqual(["merge-base", "--is-ancestor", commit, "HEAD"]);
    expect(calls.flat().join(" ")).not.toMatch(/--others|--untracked|hash-object|-w /);
  });
  it.each(["HEAD", "index", "ancestry", "missing", "conflicted-index"])(
    "fails closed for actual adapter %s evidence failures",
    (failure) => {
      const bytes = Buffer.from("-- restored prior bytes\n");
      const digest = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
      const git = (args: string[]) => {
        if (failure === "ancestry" && args[0] === "merge-base") throw new Error("not ancestor");
        if (args[1] === "ls-tree")
          return args[2] === base
            ? ""
            : `100644 blob ${failure === "HEAD" && args[2] === "HEAD" ? "4".repeat(40) : digest}\t${path}\n`;
        if (args[1] === "ls-files")
          return `100644 ${failure === "index" ? "4".repeat(40) : digest} ${failure === "conflicted-index" ? "2" : "0"}\t${path}\n`;
        return "";
      };
      const evidence = readContinuationArtifactEvidence("synthetic-root", record, base, {
        git,
        readFile: () => {
          if (failure === "missing") throw new Error("missing");
          return bytes;
        },
        lstat: () => ({ isFile: () => true }),
      });
      expect(
        continuationArtifactErrors({ ...options, record: { ...record, blob: digest }, evidence }).length,
      ).toBeGreaterThan(0);
    },
  );
});
