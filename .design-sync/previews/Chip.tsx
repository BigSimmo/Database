import { Chip } from "prompt-for-codex-medical-knowledge-base";
import { Filter } from "lucide-react";

export const Appearances = () => (
  <div className="flex flex-wrap items-center gap-1.5">
    <Chip appearance={{ kind: "information", tone: "quiet" }}>Supporting detail</Chip>
    <Chip appearance={{ kind: "category", tone: "document" }}>Document</Chip>
    <Chip appearance={{ kind: "category", tone: "service" }}>Service</Chip>
    <Chip appearance={{ kind: "status", tone: "success" }} dot>
      Current
    </Chip>
    <Chip appearance={{ kind: "status", tone: "warning" }} dot>
      Review due
    </Chip>
    <Chip appearance={{ kind: "status", tone: "danger" }} dot>
      Outdated
    </Chip>
  </div>
);

export const Sizes = () => (
  <div className="flex flex-wrap items-center gap-1.5">
    <Chip size="compact" appearance={{ kind: "information", tone: "inset" }}>
      Compact
    </Chip>
    <Chip size="standard" appearance={{ kind: "information", tone: "accent" }}>
      Standard
    </Chip>
  </div>
);

export const Removable = () => (
  <div className="flex flex-wrap items-center gap-1.5">
    <Chip
      icon={Filter}
      appearance={{ kind: "information", tone: "accent" }}
      onRemove={() => {}}
      removeLabel="Remove filter: WA jurisdiction"
    >
      WA
    </Chip>
    <Chip
      icon={Filter}
      appearance={{ kind: "information", tone: "accent" }}
      onRemove={() => {}}
      removeLabel="Remove filter: current sources only"
    >
      Current only
    </Chip>
  </div>
);
