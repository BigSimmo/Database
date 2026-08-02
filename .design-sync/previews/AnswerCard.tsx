import { AnswerCard, AnswerFooter, DoseLine, Chip } from "prompt-for-codex-medical-knowledge-base";

export const WithFooter = () => (
  <div className="w-[40rem]">
    <AnswerCard
      header={
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone="success">Current</Chip>
          <Chip tone="info">WA</Chip>
        </div>
      }
      footer={
        <AnswerFooter
          publisher="Sir Charles Gairdner Hospital"
          version="4.2"
          reviewDate="18/05/2026"
          generatedAt="31/07/2026 13:04"
        />
      }
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
    <AnswerCard>
      <p>No local guideline covers this question. The linked sources are the closest available.</p>
    </AnswerCard>
  </div>
);

export const MissingReviewDate = () => (
  <div className="w-[40rem]">
    <AnswerCard footer={<AnswerFooter publisher="RANZCP" generatedAt="31/07/2026 13:04" />}>
      <p>Review status is unknown for this source, so the footer says so rather than staying blank.</p>
    </AnswerCard>
  </div>
);
