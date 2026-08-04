import { Select } from "prompt-for-codex-medical-knowledge-base";

export const Jurisdiction = () => (
  <Select
    label="Jurisdiction"
    defaultValue="wa"
    options={[
      { value: "wa", label: "Western Australia" },
      { value: "national", label: "National" },
    ]}
  />
);
