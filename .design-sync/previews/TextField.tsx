import { TextField } from "prompt-for-codex-medical-knowledge-base";
import { Calendar } from "lucide-react";

export const WithHint = () => (
  <div className="w-80">
    <TextField
      label="Publisher"
      hint="As printed on the source document."
      placeholder="e.g. Sir Charles Gairdner Hospital"
    />
  </div>
);

export const WithIcon = () => (
  <div className="w-80">
    <TextField label="Review date" icon={Calendar} placeholder="DD/MM/YYYY" />
  </div>
);

export const Invalid = () => (
  <div className="w-80">
    <TextField label="Review date" defaultValue="31/02/2026" error="That date does not exist." />
  </div>
);

export const Disabled = () => (
  <div className="w-80">
    <TextField label="Indexed at" defaultValue="18/05/2026" disabled hint="Set by the ingestion worker." />
  </div>
);
