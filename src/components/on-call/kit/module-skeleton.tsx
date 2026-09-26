import { onCallInsetHairline, onCallModuleSurface, onCallRowHeight } from "@/components/on-call/kit/recipes";
import { cn } from "@/components/ui-primitives";

/**
 * A module's reserved space while it waits on the network: static grey outline
 * rows, no shimmer and no motion (standard §7, review F7). It is exactly as tall
 * as the rows it stands in for, so nothing below moves when they arrive and
 * nothing is inserted above a row the reader can already tap.
 */
export function OnCallModuleSkeleton({
  rows,
  twoLine = false,
  eyebrow = false,
  testId,
}: {
  readonly rows: number;
  readonly twoLine?: boolean;
  /** Reserve the group eyebrow's line too. */
  readonly eyebrow?: boolean;
  readonly testId?: string;
}) {
  if (rows <= 0) return null;
  return (
    <div aria-hidden="true" className="grid min-w-0 gap-2" data-testid={testId}>
      {eyebrow ? <span className="mx-3 h-4 w-20 rounded-sm bg-[color:var(--surface-subtle)]" /> : null}
      <div className={onCallModuleSurface}>
        {Array.from({ length: rows }, (_, index) => (
          <div
            key={index}
            data-skeleton-row=""
            className={cn(
              onCallInsetHairline,
              twoLine ? onCallRowHeight.double : onCallRowHeight.single,
              "flex items-center gap-3 px-3",
            )}
          >
            <span className="h-3 w-2/5 rounded-sm bg-[color:var(--surface-subtle)]" />
            <span className="ml-auto h-3 w-1/5 rounded-sm bg-[color:var(--surface-subtle)]" />
          </div>
        ))}
      </div>
    </div>
  );
}
