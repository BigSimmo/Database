import { Tooltip, IconButton, toolbarButton } from "prompt-for-codex-medical-knowledge-base";
import { Info } from "lucide-react";

// The tooltip supplements a control's accessible name via aria-describedby; it
// never replaces it. Opens on hover AND keyboard focus.
export const OnIconButton = () => (
  <Tooltip content="Provenance is read from the source document, not inferred.">
    <IconButton label="About provenance" icon={Info} className={toolbarButton} />
  </Tooltip>
);

export const OnText = () => (
  <Tooltip content="Official does not imply current or locally approved.">
    <button type="button" className="rounded-sm text-sm font-semibold underline decoration-dotted underline-offset-4">
      Official
    </button>
  </Tooltip>
);

export const Below = () => (
  <Tooltip placement="bottom" content="Last indexed 18/05/2026.">
    <button type="button" className="rounded-sm text-sm font-semibold underline decoration-dotted underline-offset-4">
      Indexed
    </button>
  </Tooltip>
);
