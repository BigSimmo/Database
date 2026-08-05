import { StageList } from "prompt-for-codex-medical-knowledge-base";

export const Ingestion = () => (
  <StageList
    stages={[
      { id: "upload", label: "Upload", state: "done" },
      { id: "extract", label: "Extract text", state: "active", detail: "118 pages" },
      { id: "index", label: "Index", state: "pending" },
    ]}
  />
);
