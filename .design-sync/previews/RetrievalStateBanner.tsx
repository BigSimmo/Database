import { RetrievalStateBanner } from "prompt-for-codex-medical-knowledge-base";

export const SourceOnly = () => (
  <RetrievalStateBanner state={{ kind: "source_only", reason: "quality_gate" }} onOpenSource={() => {}} />
);

export const Unsupported = () => (
  <RetrievalStateBanner
    state={{ kind: "ungrounded", reason: "weak_evidence", sourceCount: 2 }}
    onOpenSource={() => {}}
  />
);
