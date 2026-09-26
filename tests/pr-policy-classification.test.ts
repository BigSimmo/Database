// tests/pr-policy-classification.test.ts
//
// `classifyPullRequestFiles` decides which governance a pull request has to satisfy. Nothing
// pinned it, and the failure mode is silent in the worst possible direction: a path that matches
// no token is classified as carrying no clinical risk, so the PR merges with no preflight. It does
// not fail, warn, or look different -- the review simply does not happen.
//
// That is not hypothetical. The owner ruling of 2026-09-17 added caring-contacts, the Supabase
// clients and on-call/repository.ts after exactly this: "None of those names matched the token
// set, so these changes could merge without review." Verifying the 2026-09-17 external audit
// turned up one more the ruling missed, and this file exists so the next one is caught by a test
// rather than by an audit.
//
// These cases are deliberately about paths whose NAMES do not announce what they hold. A test
// asserting that `src/lib/clinical-safety.ts` is clinical proves nothing about the mechanism; a
// test asserting it of `public-api-access.ts` is the whole point.
import { describe, expect, it } from "vitest";

import {
  classifyPullRequestFiles,
  evaluatePullRequestPolicy,
  retrievalFunctionMigrationPaths,
} from "../scripts/pr-policy.mjs";

function isClinicalRisk(path: string): boolean {
  return classifyPullRequestFiles([path]).clinicalRisk;
}

describe("pull-request classification of tenancy and privacy paths", () => {
  it("treats the public read predicate as clinical risk", () => {
    // src/lib/public-api-access.ts holds `withOwnerReadScope`, the single definition of what an
    // unauthenticated caller may read: a null owner AND the `public_corpus` publication marker,
    // both required. The document list route and every signed-URL route read through it, so
    // weakening that one predicate republishes the corpus to the internet.
    //
    // It matched no token in the library-layer set -- not auth, not privacy, not document -- so
    // before 2026-09-17 a change to it carried no clinical governance preflight at all.
    expect(isClinicalRisk("src/lib/public-api-access.ts")).toBe(true);
  });

  it.each([
    ["src/lib/caring-contacts/db/postgres-repository.ts", "patient records and retention"],
    ["src/lib/caring-contacts-server/session.ts", "who the workspace believes you are"],
    ["src/lib/supabase/admin.ts", "holds the service-role key"],
    ["src/lib/on-call/repository.ts", "hides personal entries from other users"],
  ])("keeps %s clinical risk (%s)", (path) => {
    // The 2026-09-17 owner ruling. Pinned so a tidy-up of the pattern list cannot quietly undo it.
    expect(isClinicalRisk(path)).toBe(true);
  });

  it("keeps the scope resolver and the retrieval library clinical risk", () => {
    // These match on their names alone. Included so the suite says what the boundary IS, not only
    // where it was patched -- a reader should be able to tell the deliberate set from the
    // accidental one.
    expect(isClinicalRisk("src/lib/search-scope.ts")).toBe(true);
    expect(isClinicalRisk("src/lib/rag/rag.ts")).toBe(true);
    expect(isClinicalRisk("src/lib/clinical-safety.ts")).toBe(true);
    expect(isClinicalRisk("src/lib/medication-patient-alerts.ts")).toBe(true);
  });

  it("does not classify every library file as clinical risk", () => {
    // The guard against fixing this by widening the net until it catches everything. A
    // classifier that says yes to all paths routes every pull request through a clinical
    // preflight, which is how a preflight stops being a review -- the same reasoning the
    // 2026-09-17 ruling used to narrow the owner-approval hold.
    expect(isClinicalRisk("src/lib/brand.ts")).toBe(false);
    expect(isClinicalRisk("src/lib/client-store-factory.ts")).toBe(false);
  });

  it("classifies a mixed pull request by its riskiest file", () => {
    expect(classifyPullRequestFiles(["README.md", "src/lib/public-api-access.ts"]).clinicalRisk).toBe(true);
    expect(classifyPullRequestFiles(["README.md", "src/lib/brand.ts"]).clinicalRisk).toBe(false);
  });
});

describe("retrieval functions changed by an added migration", () => {
  // The retrieval RPCs rank results, but they live in SQL under supabase/migrations/, which no
  // ragRankingPatterns path names. These cases pin the SQL check that closes that gap.
  const migration = "supabase/migrations/20261001000000_example.sql";

  function evaluate(sql: string) {
    return evaluatePullRequestPolicy({
      title: "db: example retrieval change",
      body: "",
      headRef: "claude/example",
      files: [migration],
      fileStatuses: undefined,
      baseMigrationVersions: undefined,
      addedMigrationContents: { [migration]: sql },
      changedWorkflowContents: undefined,
    });
  }

  function ragRanking(sql: string): boolean {
    return evaluate(sql).classification.ragRanking;
  }

  it.each([
    ["create or replace function public.match_document_chunks_hybrid_v3(q text) returns int as $$ select 1 $$;"],
    ["CREATE FUNCTION match_document_chunks_hybrid_v4 (q text) RETURNS int AS $$ SELECT 1 $$;"],
    ['drop function if exists "public"."match_governed_candidate_chunks_v3"(uuid);'],
    ["alter function public.retrieval_owner_matches_v2(uuid, uuid) set search_path = '';"],
    ["create or replace function public.correct_clinical_query_terms(t text, r real) returns text as $$ select t $$;"],
    ["drop function public.search_document_chunks;"],
    [
      "do $$ declare ddl text; begin select pg_get_functiondef('public.match_document_chunks(extensions.vector)'::regprocedure) into ddl; execute ddl; end $$;",
    ],
  ])("flags %s", (sql) => {
    expect(ragRanking(sql)).toBe(true);
  });

  it.each([
    ["-- create or replace function public.match_document_chunks_hybrid(q text)\ncreate table t (id int);"],
    ["/* drop function public.match_document_chunks_text(uuid); */ select 1;"],
    ["revoke execute on function public.match_document_chunks_hybrid(uuid) from anon;"],
    ["create or replace function public.search_schema_health() returns jsonb as $$ select '{}'::jsonb $$;"],
  ])("does not flag %s", (sql) => {
    // Comments, grants and the schema-health report are not ranking changes.
    expect(ragRanking(sql)).toBe(false);
  });

  it("names the migration in the RAG impact nudge and leaves it advisory", () => {
    const result = evaluate(
      "create or replace function public.match_documents_for_query_v3(q text) returns int as $$ select 1 $$;",
    );
    expect(result.ok).toBe(true);
    expect(result.warnings.join(" ")).toContain(`${migration} changes a retrieval function`);
  });

  it("leaves a migration that touches no retrieval function unclassified", () => {
    expect(ragRanking("create table public.example (id int);")).toBe(false);
    expect(retrievalFunctionMigrationPaths(undefined)).toEqual([]);
  });
});
