import { Progress } from "prompt-for-codex-medical-knowledge-base";

export const Determinate = () => <Progress value={64} label="Indexing documents" detail="64 of 100" />;
export const Indeterminate = () => <Progress label="Preparing source" />;
