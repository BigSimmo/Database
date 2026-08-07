import { Citation } from "prompt-for-codex-medical-knowledge-base";

export const CurrentSource = () => (
  <Citation interactive={false} index={1} label="Therapeutic Guidelines" locator="p. 14" status="current" />
);

export const ReviewDue = () => (
  <Citation interactive={false} index={2} label="Local clozapine protocol" locator="§3.2" status="review_due" />
);
