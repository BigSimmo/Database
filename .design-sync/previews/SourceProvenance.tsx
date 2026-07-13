import { SourceProvenance } from "prompt-for-codex-medical-knowledge-base";

export const FullProvenance = () => (
  <SourceProvenance
    metadata={{
      clinical_validation_status: "approved",
      review_date: "2026-03-01",
      jurisdiction: "NSW Health",
      extraction_quality: "good",
    }}
  />
);

export const MinimalProvenance = () => (
  <SourceProvenance metadata={{ clinical_validation_status: "unverified", extraction_quality: "partial" }} />
);
