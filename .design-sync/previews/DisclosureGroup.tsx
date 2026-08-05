import { DisclosureGroup } from "prompt-for-codex-medical-knowledge-base";

export const Sections = () => (
  <DisclosureGroup
    items={[
      { id: "assessment", title: "Assessment", meta: "2 items", content: <p>Baseline observations.</p> },
      { id: "monitoring", title: "Monitoring", meta: "4 items", content: <p>Review intervals.</p> },
    ]}
  />
);
