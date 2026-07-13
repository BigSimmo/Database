import { EmptyState } from "prompt-for-codex-medical-knowledge-base";
import { Inbox, SearchX } from "lucide-react";

export const NoDocuments = () => (
  <EmptyState
    icon={Inbox}
    title="No documents yet"
    body="Upload a guideline or protocol to make it searchable across the workspace."
  />
);

export const NoIcon = () => (
  <EmptyState title="Nothing pinned yet" body="Pin an answer or document to keep it one tap away." />
);

export const NoResults = () => (
  <EmptyState
    icon={SearchX}
    title="No matches"
    body="Try a broader term — searches cover titles, content and clinical synonyms."
  />
);
