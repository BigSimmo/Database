import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const SCRIPT = "scripts/check-function-grants.mjs";
const workdir = mkdtempSync(join(tmpdir(), "fn-grants-"));

afterAll(() => rmSync(workdir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }));

function run(schemaPath: string): { code: number; out: string } {
  try {
    const stdout = execFileSync("node", [SCRIPT, schemaPath], { encoding: "utf8" });
    return { code: 0, out: stdout };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return { code: err.status ?? 1, out: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

function fixture(name: string, sql: string): string {
  const file = join(workdir, name);
  writeFileSync(file, sql);
  return file;
}

const BLANKET = "revoke execute on all functions in schema public from public, anon, authenticated;";
const DEFINER = (name: string) =>
  [
    `create function public.${name}(p_owner uuid)`,
    "returns jsonb language plpgsql security definer set search_path = '' as $$",
    "begin return '{}'::jsonb; end;",
    "$$;",
  ].join("\n");

describe("check:function-grants", () => {
  it("keeps governed retrieval v3 service-role-only with an internal postgres-owned helper", () => {
    const migration = readFileSync("supabase/migrations/20260830122000_add_corpus_scoped_retrieval_v3.sql", "utf8");
    for (const signature of [
      "match_document_chunks_text_v3(\n  text, integer, uuid[], uuid, boolean, text[], uuid, text, bigint, text[]\n)",
      "match_document_chunks_hybrid_v3(\n  extensions.vector, text, integer, double precision, uuid[], uuid, boolean, text[], uuid, text, bigint, text[]\n)",
      "match_document_chunks_v3(\n  extensions.vector, integer, double precision, uuid, uuid, boolean, text[], uuid, text, bigint, text[]\n)",
    ]) {
      expect(migration).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated, service_role`,
      );
      expect(migration).toContain(`grant execute on function public.${signature} to service_role`);
      expect(migration).toContain(`alter function public.${signature} owner to postgres`);
    }
    expect(migration).toContain(
      "revoke all on function public.match_governed_candidate_chunks_v3(\n  extensions.vector, text, integer, double precision, uuid[], uuid, boolean, text[], uuid, text, bigint, text[]\n) from public, anon, authenticated, service_role",
    );
    expect(migration).not.toContain("grant execute on function public.match_governed_candidate_chunks_v3");
  });

  it("preserves the corrected governed candidate helper as postgres-owned and non-executable", () => {
    const migration = readFileSync("supabase/migrations/20260831120000_correct_governed_retrieval_v3.sql", "utf8");
    const signature =
      "match_governed_candidate_chunks_v3(\n  extensions.vector, text, integer, double precision, uuid[], uuid, boolean, text[], uuid, text, bigint, text[]\n)";
    expect(migration).toContain(
      `revoke all on function public.${signature} from public, anon, authenticated, service_role`,
    );
    expect(migration).toContain(`alter function public.${signature} owner to postgres`);
    expect(migration).not.toContain(`grant execute on function public.${signature}`);
  });

  it("keeps the international fail-closed candidate helper postgres-owned and non-executable", () => {
    const migration = readFileSync(
      "supabase/migrations/20260901130000_fail_closed_unactivated_international_retrieval.sql",
      "utf8",
    );
    const signature =
      "match_governed_candidate_chunks_v3(\n  extensions.vector, text, integer, double precision, uuid[], uuid, boolean, text[], uuid, text, bigint, text[]\n)";
    expect(migration).toContain(
      `revoke all on function public.${signature} from public, anon, authenticated, service_role`,
    );
    expect(migration).toContain(`alter function public.${signature} owner to postgres`);
    expect(migration).not.toContain(`grant execute on function public.${signature}`);
  });

  it("keeps Task 4 health and invocation RPCs service-role-only and publication RPCs authenticated-only", () => {
    const migration = readFileSync("supabase/migrations/20260824123000_add_site_content_health_probe.sql", "utf8");
    for (const signature of [
      "record_site_content_sync_worker_invocation(uuid, uuid, text, text)",
      "read_site_content_health()",
    ]) {
      expect(migration).toContain(
        `revoke all on function public.${signature} from public, anon, authenticated, service_role`,
      );
      expect(migration).toContain(`grant execute on function public.${signature} to service_role`);
    }
    for (const signature of [
      "publish_site_content_record(text, uuid, text, bigint, text, text, text)",
      "retire_site_content_record(text, uuid, text, bigint, text, text, text)",
    ]) {
      expect(migration).toContain(`revoke all on function public.${signature} from public, anon, service_role`);
      expect(migration).toContain(`grant execute on function public.${signature} to authenticated`);
    }
  });

  it("passes against the committed schema.sql", () => {
    const result = run("supabase/schema.sql");
    expect(result.out).toContain("OK");
    expect(result.code).toBe(0);
  });

  it("keeps every public-source control-plane definer service-role-only", () => {
    const result = run(
      fixture(
        "public-source-control-plane.sql",
        [
          readFileSync("supabase/schema.sql", "utf8"),
          readFileSync("supabase/migrations/20260824121000_create_public_source_control_plane.sql", "utf8"),
        ].join("\n"),
      ),
    );
    expect(result.out).toContain("OK");
    expect(result.code).toBe(0);
  });

  it("keeps the public-source restoration helper internal to controlled postgres-owned callers", () => {
    const migration = readFileSync("supabase/migrations/20260824121000_create_public_source_control_plane.sql", "utf8");
    expect(migration).toContain(
      "revoke all on function public.restore_public_source_document_to_steward(uuid, uuid, text) from public, anon, authenticated, service_role;",
    );
    expect(migration).toContain("perform public.restore_public_source_document_to_steward(");
    expect(migration).not.toContain(
      "grant execute on function public.restore_public_source_document_to_steward(uuid, uuid, text) to service_role;",
    );
    expect(migration).toContain(
      "revoke all on function public.guard_public_source_cleanup_job_identity() from public, anon, authenticated, service_role;",
    );
    expect(migration).toContain(
      "revoke all on table public.public_source_cleanup_mutation_guards from public, anon, authenticated, service_role;",
    );
    expect(migration).toContain(
      "revoke all on function public.schedule_public_source_upload_attempt_cleanup(uuid) from public, anon, authenticated, service_role;",
    );
    expect(migration).not.toContain(
      "grant execute on function public.schedule_public_source_upload_attempt_cleanup(uuid) to service_role;",
    );
    for (const signature of [
      "bind_public_source_upload_authority(jsonb)",
      "reap_expired_public_source_upload_attempts(integer)",
      "claim_public_source_cleanup_job(integer)",
      "complete_public_source_cleanup_job(uuid, uuid, integer)",
      "release_public_source_cleanup_job(uuid, uuid, text)",
    ]) {
      expect(migration).toContain(`revoke all on function public.${signature} from public, anon, authenticated;`);
      expect(migration).toContain(`grant execute on function public.${signature} to service_role;`);
    }
  });

  it("revokes inherited service-role DML from core public-source control-plane tables", () => {
    const migration = readFileSync("supabase/migrations/20260824121000_create_public_source_control_plane.sql", "utf8");
    for (const table of ["public_source_policy_entries", "public_source_activation_events", "public_source_versions"]) {
      expect(migration).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role;`,
      );
      expect(migration).toContain(`grant select on table public.${table} to service_role;`);
      expect(migration).not.toMatch(
        new RegExp(`grant (insert|update|delete|all).*public\\.${table}.*service_role`, "i"),
      );
    }
  });

  it("keeps site-content tables inaccessible and exposes only named fixed-path RPCs", () => {
    const migration = readFileSync(
      "supabase/migrations/20260824122000_add_site_content_release_and_outbox.sql",
      "utf8",
    );
    const result = run(
      fixture("site-content-control-plane.sql", [readFileSync("supabase/schema.sql", "utf8")].join("\n")),
    );
    expect(result.code).toBe(0);
    for (const table of [
      "site_content_publications",
      "site_content_reconciliation_plans",
      "site_content_public_records",
      "site_content_sync_state",
      "site_content_sync_events",
      "site_content_sync_event_plans",
      "site_content_releases",
      "site_content_release_records",
      "site_content_release_receipts",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`);
      expect(migration).toContain(`alter table public.${table} force row level security;`);
      expect(migration).toContain(
        `revoke all on table public.${table} from public, anon, authenticated, service_role;`,
      );
      expect(migration).not.toMatch(
        new RegExp(`grant (?:all|select|insert|update|delete).*public\\.${table}.*service_role`, "i"),
      );
    }
    for (const name of [
      "publish_site_content_record",
      "retire_site_content_record",
      "claim_site_content_sync_events",
      "heartbeat_site_content_sync_event",
      "record_site_content_sync_event_plan",
      "read_site_content_sync_event_plan",
      "stage_site_content_sync_event",
      "fail_site_content_sync_event",
      "activate_site_content_release",
      "rollback_site_content_release",
    ]) {
      expect(migration).toMatch(
        new RegExp(
          `create or replace function public\\.${name}\\([\\s\\S]*?security definer[\\s\\S]*?set search_path = ''`,
          "i",
        ),
      );
      expect(migration).toMatch(
        new RegExp(`grant execute on function public\\.${name}\\([^;]+\\) to service_role;`, "i"),
      );
    }
    expect(migration).not.toContain(
      "grant execute on function public.guard_site_content_immutable_row() to service_role",
    );
  });

  it("fails a SECURITY DEFINER function left anon-executable after the blanket revoke", () => {
    const result = run(fixture("leaky.sql", [BLANKET, DEFINER("leaky")].join("\n")));
    expect(result.code).toBe(1);
    expect(result.out).toContain("public.leaky");
  });

  it("passes when the function is revoked FROM public (revoke all form)", () => {
    const result = run(
      fixture(
        "guarded.sql",
        [
          BLANKET,
          DEFINER("guarded"),
          "revoke all on function public.guarded(uuid) from public, anon, authenticated;",
        ].join("\n"),
      ),
    );
    expect(result.out).toContain("OK");
    expect(result.code).toBe(0);
  });

  it("fails when the revoke omits PUBLIC (revoke from anon only leaves the default PUBLIC grant)", () => {
    const result = run(
      fixture(
        "anon-only-revoke.sql",
        [BLANKET, DEFINER("anononly"), "revoke execute on function public.anononly(uuid) from anon;"].join("\n"),
      ),
    );
    expect(result.code).toBe(1);
    expect(result.out).toContain("public.anononly");
  });

  it("fails a function explicitly granted EXECUTE to anon (even after a revoke)", () => {
    const result = run(
      fixture(
        "reopened.sql",
        [
          BLANKET,
          DEFINER("reopened"),
          "revoke all on function public.reopened(uuid) from public, anon, authenticated;",
          "grant execute on function public.reopened(uuid) to anon;",
        ].join("\n"),
      ),
    );
    expect(result.code).toBe(1);
    expect(result.out).toContain("public.reopened");
  });

  it("fails on a schema-wide GRANT ... ON ALL FUNCTIONS ... TO anon that reopens everything", () => {
    const result = run(
      fixture(
        "schema-wide-grant.sql",
        [
          BLANKET,
          DEFINER("guarded"),
          "revoke all on function public.guarded(uuid) from public, anon, authenticated;",
          "grant execute on all functions in schema public to anon;",
        ].join("\n"),
      ),
    );
    expect(result.code).toBe(1);
    expect(result.out).toContain("all functions");
  });

  it("ignores SECURITY INVOKER functions (bound by RLS, not an escalation surface)", () => {
    const result = run(
      fixture(
        "invoker.sql",
        [BLANKET, "create function public.plain() returns void language sql as $$ select 1 $$;"].join("\n"),
      ),
    );
    expect(result.code).toBe(0);
  });

  it("treats a function defined before the blanket revoke as covered", () => {
    const result = run(fixture("covered.sql", [DEFINER("older"), BLANKET].join("\n")));
    expect(result.code).toBe(0);
  });

  it("fails when the baseline blanket revoke is missing entirely", () => {
    const result = run(
      fixture("no-blanket.sql", "create function public.f() returns void language sql as $$ select 1 $$;\n"),
    );
    expect(result.code).toBe(1);
    expect(result.out).toContain("no schema-wide");
  });
});
