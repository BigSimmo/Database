import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  IMMUTABLE_HISTORICAL_MIGRATION,
  RESERVED_HOSTED_ROLE,
  isGuardedMigrationRolePath,
  validateMigrationRoleEntries,
  validateRepository,
} from "../scripts/check-hosted-migration-role.mjs";

describe("hosted migration-role guard", () => {
  it("accepts the current repository state", () => {
    expect(validateRepository()).toEqual([]);
  });

  it("accepts the pinned immutable migration and rejects modifications or removal", () => {
    const historicalContent = readFileSync(IMMUTABLE_HISTORICAL_MIGRATION);

    expect(
      validateMigrationRoleEntries([{ path: IMMUTABLE_HISTORICAL_MIGRATION, content: historicalContent }]),
    ).toEqual([]);
    expect(
      validateMigrationRoleEntries([
        { path: IMMUTABLE_HISTORICAL_MIGRATION, content: Buffer.concat([historicalContent, Buffer.from("\n")]) },
      ]),
    ).toEqual([expect.stringContaining("immutable applied migration changed")]);
    expect(validateMigrationRoleEntries([])).toEqual([
      expect.stringContaining("immutable applied migration is missing"),
    ]);
  });

  it("rejects the reserved role token in active hosted content and file names", () => {
    const contentFailures = validateMigrationRoleEntries(
      [
        {
          path: "supabase/migrations/20990101000000_bad_default_privileges.sql",
          content: `alter default privileges for role ${RESERVED_HOSTED_ROLE.toUpperCase()} revoke all on tables from public;`,
        },
      ],
      { requireHistorical: false },
    );
    const pathFailures = validateMigrationRoleEntries(
      [
        {
          path: `supabase/migrations/20990101000000_${RESERVED_HOSTED_ROLE}_repair.sql`,
          content: "select 1;",
        },
      ],
      { requireHistorical: false },
    );

    expect(contentFailures).toEqual([expect.stringContaining("active content references")]);
    expect(pathFailures).toEqual([expect.stringContaining("active file name references")]);
  });

  it("limits enforcement to hosted SQL/tooling and does not confuse environment-variable names with SQL roles", () => {
    expect(isGuardedMigrationRolePath("scripts/generate-drift-manifest.ts")).toBe(true);
    expect(isGuardedMigrationRolePath("docs/disaster-recovery-runbook.md")).toBe(true);
    expect(isGuardedMigrationRolePath("docs/branch-review-ledger.md")).toBe(false);

    expect(
      validateMigrationRoleEntries(
        [
          {
            path: "scripts/set-site-administrator.ts",
            content: `process.env.ALLOW_${RESERVED_HOSTED_ROLE.toUpperCase()}_MUTATION`,
          },
          { path: "docs/branch-review-ledger.md", content: `Historical reference: ${RESERVED_HOSTED_ROLE}` },
        ],
        { requireHistorical: false },
      ),
    ).toEqual([]);
  });

  it("discovers the bare-image storage owner instead of hard-coding a hosted role", () => {
    const generator = readFileSync("scripts/generate-drift-manifest.ts", "utf8");
    const runbook = readFileSync("docs/disaster-recovery-runbook.md", "utf8");

    expect(generator).toContain("pg_catalog.pg_get_userbyid(nspowner)");
    expect(generator).toContain("psql(storageSchemaOwner, scaffoldSql)");
    expect(runbook).toContain("storage_owner=");
    expect(runbook).toContain('psql -U "${storage_owner}"');
    expect(generator).not.toContain(RESERVED_HOSTED_ROLE);
    expect(runbook).not.toContain(RESERVED_HOSTED_ROLE);
  });
});
