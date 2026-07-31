import { AsyncButton, primaryControl, controlBase } from "prompt-for-codex-medical-knowledge-base";
import { Upload } from "lucide-react";

// AsyncButton is colour-neutral by design: pass a control recipe via className so
// the busy contract (one label, spinner, disabled, aria-busy) can ride on any chrome.
export const Idle = () => (
  <AsyncButton busy={false} busyLabel="Uploading…" idleIcon={<Upload className="h-4 w-4" />} className={primaryControl}>
    Upload document
  </AsyncButton>
);

export const Busy = () => (
  <AsyncButton busy busyLabel="Uploading…" idleIcon={<Upload className="h-4 w-4" />} className={primaryControl}>
    Upload document
  </AsyncButton>
);

export const Secondary = () => (
  <AsyncButton busy={false} busyLabel="Reindexing…" className={`${controlBase} px-5`}>
    Reindex source
  </AsyncButton>
);

export const Disabled = () => (
  <AsyncButton busy={false} busyLabel="Uploading…" disabled className={primaryControl}>
    Upload document
  </AsyncButton>
);
