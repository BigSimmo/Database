import { Breadcrumb } from "prompt-for-codex-medical-knowledge-base";

export const ThreeLevels = () => (
  <Breadcrumb
    items={[
      { label: "Documents", href: "/documents" },
      { label: "Protocols", href: "/documents" },
      { label: "Clozapine monitoring" },
    ]}
  />
);

export const TwoLevels = () => (
  <Breadcrumb items={[{ label: "Services", href: "/services" }, { label: "Community mental health" }]} />
);
