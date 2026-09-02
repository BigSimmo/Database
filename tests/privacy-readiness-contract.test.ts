import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validatePrivacyReadiness } from "../scripts/check-privacy-readiness.mjs";

const manifest = JSON.parse(
  readFileSync(new URL("../docs/governance/privacy-readiness.v1.json", import.meta.url), "utf8"),
);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const retentionParityMigration = readFileSync(
  new URL("../supabase/migrations/20260901033250_enable_staging_privacy_retention_schedules.sql", import.meta.url),
  "utf8",
);

describe("privacy readiness contract", () => {
  it("accepts the honest structural register", () => {
    expect(validatePrivacyReadiness(manifest)).toEqual([]);
  });

  it("keeps Railway processor evidence linked to the privacy impact assessment", () => {
    const railwayDpa = manifest.requirements.find((item: { id: string }) => item.id === "PRIV-LEGAL-RAILWAY-DPA");
    expect(railwayDpa.evidenceReferences).toContain("docs/privacy-impact-assessment.md");
  });

  it("fails release closed on the remaining human and environment blockers", () => {
    const releaseErrors = validatePrivacyReadiness(manifest, { release: true });
    expect(releaseErrors).toContain("PRIV-LEGAL-RAILWAY-DPA: release-blocking status pending");
    expect(releaseErrors.filter((error: string) => error.includes("release-blocking status"))).toHaveLength(6);
    expect(releaseErrors).not.toContain("PRIV-PROVIDER-PRODUCTION-HMAC-SECRET: release-blocking status partial");
    expect(releaseErrors).not.toContain("PRIV-PROVIDER-RETENTION-SCHEDULE-PARITY: release-blocking status partial");
    expect(packageJson.scripts["check:production-readiness"]).toContain("check:privacy-readiness:release");
    expect(packageJson.scripts["check:production-readiness:ci"]).toContain("check:privacy-readiness");
    expect(packageJson.scripts["check:production-readiness:ci"]).not.toContain("check:privacy-readiness:release");
  });

  it("records current provider evidence without promoting repository-only OpenAI claims", () => {
    const byId = new Map(manifest.requirements.map((item: { id: string }) => [item.id, item]));

    expect(byId.get("PRIV-PROVIDER-PRODUCTION-HMAC-SECRET")).toMatchObject({
      status: "verified",
      verifiedByRole: "Production platform owner",
    });
    expect(byId.get("PRIV-PROVIDER-OPENAI-ZDR")).toMatchObject({
      status: "pending",
      externalEvidenceReference: expect.stringContaining("API input/output sharing disabled"),
    });
    expect(byId.get("PRIV-PROVIDER-OPENAI-ZDR")).toMatchObject({
      externalEvidenceReference: expect.stringContaining("API call logging to Disabled"),
    });
    expect(byId.get("PRIV-PROVIDER-OPENAI-ZDR")).toMatchObject({
      externalEvidenceReference: expect.stringContaining("disabled hosted MCP, web search, file search"),
    });
    expect(byId.get("PRIV-PROVIDER-OPENAI-ZDR")).toMatchObject({
      externalEvidenceReference: expect.stringContaining("submitted and acknowledged by OpenAI"),
    });
    expect(byId.get("PRIV-LEGAL-OPENAI-DPA")).toMatchObject({ status: "pending" });
    expect(byId.get("PRIV-PROVIDER-RETENTION-SCHEDULE-PARITY")).toMatchObject({
      status: "verified",
      verifiedByRole: "Database operations owner",
    });
    expect(byId.get("PRIV-LEGAL-APP8-CROSS-BORDER-BASIS")).toMatchObject({ status: "pending" });
    expect(byId.get("PRIV-CLINICAL-PHI-MINIMISATION")).toMatchObject({ status: "partial" });
  });

  it("reconciles all four staging privacy-retention schedules after enabling pg_cron", () => {
    expect(retentionParityMigration).toContain("create extension if not exists pg_cron with schema pg_catalog");
    expect(retentionParityMigration).toContain("'purge-expired-rag-queries'");
    expect(retentionParityMigration).toContain("'purge-rag-retrieval-logs'");
    expect(retentionParityMigration).toContain("'purge-rag-query-misses'");
    expect(retentionParityMigration).toContain("'purge-rag-response-cache'");
    expect(retentionParityMigration).toContain("select public.purge_expired_rag_queries(30)");
    expect(retentionParityMigration).toContain("interval '90 days'");
    expect(retentionParityMigration).toContain("select public.purge_expired_rag_query_misses(90)");
    expect(retentionParityMigration).toContain("select public.purge_expired_rag_response_cache(1000)");
  });

  it("rejects contradictory external verification and forbidden accepted-decision rollback", () => {
    const changed = structuredClone(manifest);
    const requirement = changed.requirements.find((item: { id: string }) => item.id === "PRIV-LEGAL-OPENAI-DPA");
    requirement.status = "verified";
    requirement.statusHistory = [
      { status: "accepted_decision", date: "2026-08-22" },
      { status: "verified", date: "2026-08-23" },
    ];
    delete requirement.externalEvidenceReference;
    delete requirement.verifiedByRole;
    const errors = validatePrivacyReadiness(changed, { checkFiles: false });
    expect(errors).toContain("PRIV-LEGAL-OPENAI-DPA: transition accepted_decision -> verified is not allowed");
    expect(errors).toContain("PRIV-LEGAL-OPENAI-DPA: verified external evidence requires externalEvidenceReference");
    expect(errors).toContain("PRIV-LEGAL-OPENAI-DPA: verified external evidence requires verifiedByRole");
  });

  it("rejects expired reviews, fake commits, escaped evidence, and unauthorised accepted decisions", () => {
    const changed = structuredClone(manifest);
    changed.reviewedCommit = "f".repeat(40);
    changed.reviewExpiresAt = "2026-08-22";
    changed.requirements[0].evidenceReferences = ["C:/Windows/System32/drivers/etc/hosts"];
    const legal = changed.requirements.find((item: { id: string }) => item.id === "PRIV-LEGAL-OPENAI-DPA");
    legal.status = "accepted_decision";
    legal.statusHistory = [{ status: "accepted_decision", date: "2026-08-23" }];
    legal.acceptedByRole = "Application developer";
    legal.decisionReference = "docs/privacy-impact-assessment.md";
    const errors = validatePrivacyReadiness(changed, { now: new Date("2026-08-23T12:00:00Z") });
    expect(errors).toContain(`reviewedCommit does not exist: ${"f".repeat(40)}`);
    expect(errors).toContain("manifest review has expired");
    expect(errors).toContain("PRIV-CODE-QUERY-HASH: missing evidence C:/Windows/System32/drivers/etc/hosts");
    expect(errors).toContain("PRIV-LEGAL-OPENAI-DPA: acceptedByRole is not authorised for legal evidence");
    expect(errors).toContain("PRIV-LEGAL-OPENAI-DPA: decisionReference must be an existing docs/governance record");
  });

  it("rejects impossible calendar dates", () => {
    const changed = structuredClone(manifest);
    changed.reviewedAt = "2026-02-30";
    expect(validatePrivacyReadiness(changed, { checkFiles: false })).toContain(
      "manifest review dates must be ISO dates",
    );
  });
});
