import { Checkbox } from "prompt-for-codex-medical-knowledge-base";

export const States = () => (
  <div className="space-y-3">
    <Checkbox label="Current guidelines only" defaultChecked />
    <Checkbox label="Include archived sources" description="Archived sources remain visibly marked." />
    <Checkbox label="Some selected" indeterminate />
  </div>
);
