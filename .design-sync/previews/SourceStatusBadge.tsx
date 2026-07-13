import { SourceStatusBadge } from "prompt-for-codex-medical-knowledge-base";

export const Current = () => <SourceStatusBadge metadata={{ document_status: "current" }} />;

export const ReviewDue = () => <SourceStatusBadge metadata={{ document_status: "review_due" }} />;

export const Outdated = () => <SourceStatusBadge metadata={{ document_status: "outdated" }} />;

export const Unknown = () => <SourceStatusBadge metadata={{}} />;
