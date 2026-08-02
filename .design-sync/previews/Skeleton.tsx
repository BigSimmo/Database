import { Skeleton } from "prompt-for-codex-medical-knowledge-base";

// Skeleton is a decorative placeholder only: it carries no role and no label.
// The announcement belongs to the surface that owns the load (see LoadingPanel),
// which is why every instance here is aria-hidden.
export const TextLines = () => (
  <div className="w-72 space-y-2.5">
    <Skeleton aria-hidden className="h-4 w-full" />
    <Skeleton aria-hidden className="h-4 w-full" animationDelay="80ms" />
    <Skeleton aria-hidden className="h-4 w-2/3" animationDelay="160ms" />
  </div>
);

export const SourceCard = () => (
  <div className="w-72 space-y-3 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-4">
    <Skeleton aria-hidden className="h-3 w-24" />
    <Skeleton aria-hidden className="h-5 w-full" animationDelay="80ms" />
    <Skeleton aria-hidden className="h-3 w-40" animationDelay="160ms" />
  </div>
);

export const Block = () => <Skeleton aria-hidden className="h-24 w-72" />;
