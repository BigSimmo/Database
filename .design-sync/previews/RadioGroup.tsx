import { RadioGroup } from "prompt-for-codex-medical-knowledge-base";

export const Jurisdiction = () => (
  <RadioGroup
    label="Jurisdiction"
    name="jurisdiction"
    defaultValue="wa"
    hint="Choose the jurisdiction that governs this decision."
    options={[
      { value: "wa", label: "Western Australia" },
      { value: "national", label: "National" },
      { value: "other", label: "Other", disabled: true },
    ]}
  />
);
