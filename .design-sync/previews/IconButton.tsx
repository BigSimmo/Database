import { IconButton, toolbarButton, floatingControl } from "prompt-for-codex-medical-knowledge-base";
import { Copy, Download, Trash2, X } from "lucide-react";

// The accessible name is a required prop, so an unlabelled icon button cannot be
// built at all. The base is colour-neutral — chrome comes from a recipe.
export const Toolbar = () => (
  <div className="flex items-center gap-1">
    <IconButton label="Copy answer" icon={Copy} className={toolbarButton} />
    <IconButton label="Download source" icon={Download} className={toolbarButton} />
    <IconButton label="Close" icon={X} className={toolbarButton} />
  </div>
);

export const Floating = () => <IconButton label="Delete document" icon={Trash2} className={floatingControl} />;

export const Disabled = () => <IconButton label="Copy answer" icon={Copy} disabled className={toolbarButton} />;
