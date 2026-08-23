import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validatePrivacyReadiness } from "../scripts/check-privacy-readiness.mjs";

const manifest = JSON.parse(
  readFileSync(new URL("../docs/governance/privacy-readiness.v1.json", import.meta.url), "utf8"),
);
const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

describe("privacy readiness contract", () => {
  it("accepts the honest structural register", () => {
    expect(validatePrivacyReadiness(manifest)).toEqual([]);
  });

  it("fails release closed while provider, legal, or clinical evidence is pending", () => {
    expect(validatePrivacyReadiness(manifest, { release: true })).toContain(
      "PRIV-PROVIDER-OPENAI-ZDR: release-blocking status pending",
    );
    expect(packageJson.scripts["check:production-readiness"]).toContain("check:privacy-readiness:release");
    expect(packageJson.scripts["check:production-readiness:ci"]).toContain("check:privacy-readiness:release");
  });

  it("rejects contradictory external verification and forbidden accepted-decision rollback", () => {
    const changed = structuredClone(manifest);
    const requirement = changed.requirements.find((item: { id: string }) => item.id === "PRIV-LEGAL-OPENAI-DPA");
    requirement.status = "verified";
    requirement.statusHistory = [
      { status: "accepted_decision", date: "2026-08-22" },
      { status: "verified", date: "2026-08-23" },
    ];
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
