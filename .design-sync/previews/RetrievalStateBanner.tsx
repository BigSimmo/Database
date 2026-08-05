import { RetrievalStateBanner } from "prompt-for-codex-medical-knowledge-base";

const openSource = (_sourceId: string, _locator?: string) => {};

export const StaleEvidence = () => (
  <RetrievalStateBanner
    state={{
      kind: "stale_evidence",
      sourceCount: 2,
      overdue: [
        {
          sourceId: "wa-clozapine-protocol",
          title: "WA Clozapine Protocol",
          locator: "p. 18",
          reviewDueOn: "2025-11-01",
          status: "review_due",
        },
      ],
    }}
    onOpenSource={openSource}
  />
);

export const PartialRetrieval = () => (
  <RetrievalStateBanner
    state={{
      kind: "partial_retrieval",
      retrieved: 2,
      requested: 3,
      missing: [{ sourceId: "local-monitoring-addendum", title: "Local monitoring addendum", locator: "p. 4" }],
    }}
    onOpenSource={openSource}
  />
);

export const SourceOnly = () => (
  <RetrievalStateBanner state={{ kind: "source_only", reason: "quality_gate" }} onOpenSource={openSource} />
);

export const Unsupported = () => (
  <RetrievalStateBanner
    state={{ kind: "ungrounded", reason: "weak_evidence", sourceCount: 2 }}
    onOpenSource={openSource}
  />
);
