import { Citation, CitationList } from "prompt-for-codex-medical-knowledge-base";

export const Sources = () => (
  <CitationList
    citations={[
      { id: "tg", citation: <Citation interactive={false} index={1} label="Therapeutic Guidelines" /> },
      { id: "local", citation: <Citation interactive={false} index={2} label="Local protocol" status="review_due" /> },
    ]}
  />
);

export const Unsupported = () => <CitationList citations={[]} />;
