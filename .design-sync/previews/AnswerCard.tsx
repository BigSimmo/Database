import { AnswerCard } from "prompt-for-codex-medical-knowledge-base";

const readyState = { kind: "ready", sourceCount: 2 } as const;
const readyVerification = { state: "ready" } as const;
const openSource = (_sourceId: string, _locator?: string) => {};

export const WithFooter = () => (
  <div className="w-[40rem]">
    <AnswerCard
      state={readyState}
      verification={readyVerification}
      support="strong"
      provenance={{
        publisher: "Sir Charles Gairdner Hospital",
        version: "4.2",
        reviewDate: "2026-05-18",
        generatedAt: "2026-07-31T13:04:00+08:00",
      }}
    >
      <p>
        Start clozapine at a low dose and titrate against tolerability, with haematological monitoring weekly for the
        first 18 weeks.
      </p>
    </AnswerCard>
  </div>
);

export const PlainAnswer = () => (
  <div className="w-[40rem]">
    <AnswerCard state={readyState} verification={readyVerification} support="supported">
      <p>No local guideline covers this question. The linked sources are the closest available.</p>
    </AnswerCard>
  </div>
);

export const MissingReviewDate = () => (
  <div className="w-[40rem]">
    <AnswerCard
      state={readyState}
      verification={readyVerification}
      support="supported"
      provenance={{ publisher: "RANZCP", generatedAt: "2026-07-31T13:04:00+08:00" }}
    >
      <p>Review status is unknown for this source, so the footer says so rather than staying blank.</p>
    </AnswerCard>
  </div>
);

export const StaleEvidence = () => (
  <div className="w-[40rem]">
    <AnswerCard
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
      verification={{ state: "stale_evidence", sourceCount: 2 }}
      support="supported"
      onOpenSource={openSource}
    >
      <p>This answer uses a source whose scheduled review is overdue.</p>
    </AnswerCard>
  </div>
);

export const PartialRetrieval = () => (
  <div className="w-[40rem]">
    <AnswerCard
      state={{
        kind: "partial_retrieval",
        retrieved: 2,
        requested: 3,
        missing: [{ sourceId: "local-monitoring-addendum", title: "Local monitoring addendum", locator: "p. 4" }],
      }}
      verification={{ state: "partial_retrieval", sourceCount: 2 }}
      support="limited"
      onOpenSource={openSource}
    >
      <p>This answer may omit local guidance because one named source was unavailable.</p>
    </AnswerCard>
  </div>
);

export const Ungrounded = () => (
  <div className="w-[40rem]">
    <AnswerCard
      state={{ kind: "ungrounded", reason: "unverified_numeric", sourceCount: 2 }}
      verification={{ state: "ungrounded", sourceCount: 2 }}
      support="limited"
      onOpenSource={openSource}
    >
      <p>The cited passages did not verify every clinical number in this answer.</p>
    </AnswerCard>
  </div>
);

export const SourceOnly = () => (
  <div className="w-[40rem]">
    <AnswerCard
      state={{ kind: "source_only", reason: "quality_gate" }}
      verification={{ state: "source_only", attribution: "extractive", sourceCount: 2 }}
      support="unassessed"
      onOpenSource={openSource}
    >
      <p>This answer was assembled from source passages without model synthesis.</p>
    </AnswerCard>
  </div>
);
