import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  analyzeFile,
  ownerScopedTablesFromSchema,
  scanRepo,
  OWNER_SCOPE_ALLOWLIST,
} from "../scripts/check-owner-scope-api.mjs";

const OWNER_TABLES = new Set(["documents", "medication_records"]);

describe("owner-scope tenancy guard", () => {
  it("parses owner_id tables from schema.sql and skips owner-less ones", () => {
    const schema = [
      "create table public.documents (",
      "  id uuid primary key,",
      "  owner_id uuid",
      ");",
      "create table if not exists public.document_images (",
      "  id uuid primary key,",
      "  document_id uuid",
      ");",
    ].join("\n");
    const tables = ownerScopedTablesFromSchema(schema);
    expect(tables.has("documents")).toBe(true);
    expect(tables.has("document_images")).toBe(false);
  });

  it("flags an owner-scoped query with no owner filter in the handler", () => {
    const src = `export async function GET(request) {
      const supabase = createAdminClient();
      const { data } = await supabase.from("documents").select("*");
      return NextResponse.json({ data });
    }`;
    const violations = analyzeFile("x/route.ts", src, OWNER_TABLES);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ table: "documents" });
  });

  it("passes .eq(owner_id) and withOwnerReadScope handlers", () => {
    const eq = `export async function GET(request) {
      const user = await requireAuthenticatedUser(request, supabase);
      return supabase.from("documents").select("*").eq("owner_id", user.id);
    }`;
    const helper = `export async function GET() {
      return withOwnerReadScope(supabase.from("documents").select("*"), ownerId);
    }`;
    expect(analyzeFile("a/route.ts", eq, OWNER_TABLES)).toHaveLength(0);
    expect(analyzeFile("b/route.ts", helper, OWNER_TABLES)).toHaveLength(0);
  });

  it("checks each handler independently — a scoped sibling does not excuse an unscoped one", () => {
    const src = `export async function GET(request) {
      const user = await requireAuthenticatedUser(request, supabase);
      return supabase.from("documents").select("*").eq("owner_id", user.id);
    }
    export async function POST(request) {
      return supabase.from("medication_records").select("*");
    }`;
    const violations = analyzeFile("c/route.ts", src, OWNER_TABLES);
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({ table: "medication_records" });
  });

  it("treats an in-file helper as scoped when the file enforces ownership elsewhere (no false positive)", () => {
    // selectLabels-style: the query lives in a helper with no owner filter, but a
    // handler in the same file verifies ownership before calling it.
    const src = `async function selectDocs(supabase, id) {
      return supabase.from("documents").select("*").eq("document_id", id);
    }
    export async function GET(request) {
      const user = await requireAuthenticatedUser(request, supabase);
      await requireOwnedDocument(supabase, id, user.id);
      return selectDocs(supabase, id);
    }`;
    expect(analyzeFile("d/route.ts", src, OWNER_TABLES)).toHaveLength(0);
  });

  it("ignores tables without an owner_id column", () => {
    const src = `export async function GET() {
      return supabase.from("document_chunks").select("*");
    }`;
    expect(analyzeFile("e/route.ts", src, OWNER_TABLES)).toHaveLength(0);
  });

  it("regression lock: the real src/app/api surface is fully owner-scoped (0 violations)", () => {
    const schemaText = readFileSync("supabase/schema.sql", "utf8");
    const files = execSync("git ls-files src/app/api", { encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.tsx?$/.test(f))
      .map((path) => ({ path, text: readFileSync(path, "utf8") }));
    const { violations } = scanRepo({ schemaText, files });
    expect(violations, JSON.stringify(violations, null, 2)).toHaveLength(0);
  });

  it("keeps every allowlist exception documented against the tenancy review", () => {
    for (const entry of OWNER_SCOPE_ALLOWLIST) {
      expect(entry.file).toMatch(/^src\/app\/api\//);
      expect(entry.reason).toMatch(/tenancy-defense-in-depth-review/);
    }
  });
});
