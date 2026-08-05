import { OverlayRoot } from "prompt-for-codex-medical-knowledge-base";

export const Hosts = () => (
  <div className="relative h-28 overflow-hidden rounded-lg border border-[color:var(--border)]">
    <OverlayRoot />
    <p className="p-4 text-sm">Shared overlay, popover, modal and toast hosts.</p>
  </div>
);
