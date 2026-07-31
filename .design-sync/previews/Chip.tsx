import { Chip } from "prompt-for-codex-medical-knowledge-base";
import { Filter } from "lucide-react";

export const Tones = () => (
  <div className="flex flex-wrap items-center gap-1.5">
    <Chip>Neutral</Chip>
    <Chip tone="info">Registry summary</Chip>
    <Chip tone="success">Current</Chip>
    <Chip tone="warning">Review due</Chip>
    <Chip tone="danger">Outdated</Chip>
  </div>
);

export const WithDot = () => (
  <div className="flex flex-wrap items-center gap-1.5">
    <Chip dot tone="success">
      Indexed
    </Chip>
    <Chip dot tone="warning">
      Partial extraction
    </Chip>
    <Chip dot tone="neutral">
      Not started
    </Chip>
  </div>
);

export const Removable = () => (
  <div className="flex flex-wrap items-center gap-1.5">
    <Chip icon={Filter} onRemove={() => {}} removeLabel="Remove filter: WA jurisdiction">
      WA
    </Chip>
    <Chip icon={Filter} onRemove={() => {}} removeLabel="Remove filter: current sources only">
      Current only
    </Chip>
  </div>
);
