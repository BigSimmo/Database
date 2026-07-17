import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const SCRIPT = "scripts/check-function-grants.mjs";
const workdir = mkdtempSync(join(tmpdir(), "fn-grants-"));

afterAll(() => rmSync(workdir, { recursive: true, force: true }));

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

describe("check:function-grants", () => {
  it("passes against the committed schema.sql", () => {
    const result = run("supabase/schema.sql");
    expect(result.out).toContain("OK");
    expect(result.code).toBe(0);
  });

  it("fails a SECURITY DEFINER function left anon-executable after the blanket revoke", () => {
    const file = fixture(
      "leaky.sql",
      [
        BLANKET,
        "create function public.leaky(p_owner uuid)",
        "returns jsonb language plpgsql security definer set search_path = '' as $$",
        "begin return '{}'::jsonb; end;",
        "$$;",
      ].join("\n"),
    );
    const result = run(file);
    expect(result.code).toBe(1);
    expect(result.out).toContain("public.leaky");
  });

  it("passes when the SECURITY DEFINER function is explicitly revoked (revoke all form)", () => {
    const file = fixture(
      "guarded.sql",
      [
        BLANKET,
        "create function public.guarded(p_owner uuid)",
        "returns jsonb language plpgsql security definer set search_path = '' as $$",
        "begin return '{}'::jsonb; end;",
        "$$;",
        "revoke all on function public.guarded(uuid) from public, anon, authenticated;",
        "grant execute on function public.guarded(uuid) to service_role;",
      ].join("\n"),
    );
    const result = run(file);
    expect(result.out).toContain("OK");
    expect(result.code).toBe(0);
  });

  it("fails a SECURITY DEFINER function explicitly granted EXECUTE to anon (even after a revoke)", () => {
    const file = fixture(
      "reopened.sql",
      [
        BLANKET,
        "create function public.reopened(p_owner uuid)",
        "returns jsonb language plpgsql security definer set search_path = '' as $$",
        "begin return '{}'::jsonb; end;",
        "$$;",
        "revoke all on function public.reopened(uuid) from public, anon, authenticated;",
        "grant execute on function public.reopened(uuid) to anon;",
      ].join("\n"),
    );
    const result = run(file);
    expect(result.code).toBe(1);
    expect(result.out).toContain("public.reopened");
  });

  it("ignores SECURITY INVOKER functions (bound by RLS, not an escalation surface)", () => {
    const file = fixture(
      "invoker.sql",
      [BLANKET, "create function public.plain() returns void language sql as $$ select 1 $$;"].join("\n"),
    );
    const result = run(file);
    expect(result.code).toBe(0);
  });

  it("treats a function defined before the blanket revoke as covered", () => {
    const file = fixture(
      "covered.sql",
      [
        "create function public.older(p_owner uuid)",
        "returns jsonb language plpgsql security definer set search_path = '' as $$",
        "begin return '{}'::jsonb; end;",
        "$$;",
        BLANKET,
      ].join("\n"),
    );
    const result = run(file);
    expect(result.code).toBe(0);
  });

  it("fails when the baseline blanket revoke is missing entirely", () => {
    const file = fixture("no-blanket.sql", "create function public.f() returns void language sql as $$ select 1 $$;\n");
    const result = run(file);
    expect(result.code).toBe(1);
    expect(result.out).toContain("no schema-wide");
  });
});
