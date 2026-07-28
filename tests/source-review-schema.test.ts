import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../supabase/migrations/20260727010000_bmj_third_party_source_attestation.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const historicalMigration = readFileSync(
  new URL("../supabase/migrations/20260711164441_domain_1_source_review_lifecycle.sql", import.meta.url),
  "utf8",
).replace(/\s+/g, " ");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8").replace(/\s+/g, " ");
const databaseTypes = readFileSync(new URL("../src/lib/supabase/database.types.ts", import.meta.url), "utf8").replace(
  /\s+/g,
  " ",
);
const publisherNormalizer =
  "btrim( regexp_replace( replace(lower(coalesce(v_metadata->>'publisher', '')), '&', ' and '), '[^a-z0-9/]+', ' ', 'g' ) )";
const jurisdictionNormalizer =
  "btrim( regexp_replace( replace(lower(coalesce(v_metadata->>'jurisdiction', '')), '&', ' and '), '[^a-z0-9/]+', ' ', 'g' ) )";

describe("BMJ third-party source-review schema", () => {
  it("adds immutable event evidence fields without rewriting the historical lifecycle migration", () => {
    expect(migration).toContain("add column if not exists policy_version text");
    expect(migration).toContain("add column if not exists reviewer_qualification text");
    expect(migration).toContain("third_party_reference_attested");
    expect(schema).toContain("policy_version text");
    expect(schema).toContain("reviewer_qualification text");
    expect(schema).toContain("before update or delete on public.source_review_events");
    expect(schema).toContain("raise exception 'source_review_events is append-only'");
    expect(historicalMigration).not.toContain("third_party_reference_attested");
    expect(historicalMigration).not.toContain("record_source_review_v2");
  });

  it("keeps the legacy seven-argument RPC and prevents it from selecting the attestation decision", () => {
    expect(schema).toContain(
      "grant execute on function public.record_source_review(uuid, uuid, text, text, text[], date, uuid) to service_role",
    );
    expect(historicalMigration).toContain(
      "if p_decision not in ('locally_reviewed', 'approved', 'rejected', 'decommissioned', 'superseded')",
    );
    expect(historicalMigration).not.toContain("third_party_reference_attested");
  });

  it("makes v2 service-role-only and limits targets to reviewer-owned or ownerless public documents", () => {
    for (const sql of [migration, schema]) {
      expect(sql).toContain("create or replace function public.record_source_review_v2");
      expect(sql).toContain("where id = p_document_id and (owner_id = p_reviewer_id or owner_id is null) for update");
      expect(sql).toContain(
        "revoke all on function public.record_source_review_v2(uuid, uuid, text, text, text[], date, uuid, text, text) from public, anon, authenticated",
      );
      expect(sql).toContain(
        "grant execute on function public.record_source_review_v2(uuid, uuid, text, text, text[], date, uuid, text, text) to service_role",
      );
    }
  });

  it("requires dated qualified review for ownerless public promotions and records the qualification", () => {
    for (const sql of [migration, schema]) {
      expect(sql).toContain("v_document.owner_id is null and p_decision in ('locally_reviewed', 'approved')");
      expect(sql).toContain("raise exception 'public source promotion review date is invalid'");
      expect(sql).toContain("raise exception 'public source promotion reviewer qualification is required'");
      expect(sql).toContain(
        "or (v_document.owner_id is null and p_decision in ('locally_reviewed', 'approved')) then trim(p_reviewer_qualification)",
      );
    }
  });

  it("keeps public supersession replacements public and rejects self-replacement", () => {
    for (const sql of [migration, schema]) {
      expect(sql).toContain("p_replacement_document_id = p_document_id");
      expect(sql).toContain("v_document.owner_id is null and replacement.owner_id is null");
      expect(sql).toContain(
        "v_document.owner_id = p_reviewer_id and (replacement.owner_id = p_reviewer_id or replacement.owner_id is null)",
      );
    }
  });

  it("validates BMJ identity, indexing, evidence, date, exact policy, and reviewer qualification in SQL", () => {
    for (const sql of [migration, schema]) {
      expect(sql).toContain("v_document.status <> 'indexed'");
      expect(sql).toContain("upper(trim(coalesce(v_metadata->>'publisher_code', ''))) <> 'BMJ'");
      expect(sql).toContain("'bmj best practice', 'bmj publishing group'");
      expect(sql).toContain("'international', 'global', 'united kingdom', 'uk'");
      expect(sql).toContain("cardinality(p_evidence_references)");
      expect(sql).toContain("p_review_date > (now() at time zone 'Australia/Perth')::date");
      expect(sql).toContain("p_policy_version is distinct from 'bmj-third-party-reference-attestation-v1'");
      expect(sql).toContain("char_length(trim(coalesce(p_reviewer_qualification, ''))) = 0");
    }
  });

  it("keeps migration and replay schema on the fail-closed TypeScript normalizer for punctuation and whitespace", () => {
    for (const sql of [migration, schema]) {
      for (const normalizer of [publisherNormalizer, jurisdictionNormalizer]) {
        const normalizerStart = sql.indexOf(normalizer);
        expect(normalizerStart).toBeGreaterThanOrEqual(0);
        expect(sql.slice(normalizerStart, normalizerStart + normalizer.length + 16)).toContain("not in");
      }
      expect(sql).not.toContain("lower(trim(coalesce(v_metadata->>'publisher', ''))) not in");
      expect(sql).not.toContain("lower(trim(coalesce(v_metadata->>'jurisdiction', ''))) not in");
    }
  });

  it("records structured evidence while preserving unverified validation, currentness, and metadata review date", () => {
    for (const sql of [migration, schema]) {
      const branchStart = sql.indexOf("if p_decision = 'third_party_reference_attested' then");
      const branchEnd = sql.indexOf("elsif p_decision in ('rejected', 'decommissioned', 'superseded')", branchStart);
      const branch = sql.slice(branchStart, branchEnd);
      expect(branchStart).toBeGreaterThanOrEqual(0);
      expect(branchEnd).toBeGreaterThan(branchStart);
      expect(branch).toContain("v_new_status := v_prior_status");
      expect(branch).toContain("v_new_validation := 'unverified'");
      expect(branch).toContain("'clinical_validation_status', 'unverified'");
      expect(branch).toContain("'evidence_type', 'structured_bmj_third_party_attestation'");
      expect(branch).toContain("'attested_at', now()");
      expect(branch).toContain("'attested_by', p_reviewer_id");
      expect(branch).not.toContain("'document_status', v_new_status");
      expect(branch).not.toContain("'review_date', to_jsonb(p_review_date), 'provenance_basis'");
    }
  });

  it("exposes the new event columns and v2 RPC in generated database types", () => {
    expect(databaseTypes).toContain("policy_version: string | null");
    expect(databaseTypes).toContain("reviewer_qualification: string | null");
    expect(databaseTypes).toContain("record_source_review_v2:");
    expect(databaseTypes).toContain("p_policy_version?: string | null");
    expect(databaseTypes).toContain("p_reviewer_qualification?: string | null");
  });
});
