import { ExternalLink } from "lucide-react";

import { focusRing } from "@/components/card-recipes";
import { formatModeDate, modeAgo } from "@/components/mode-kit/dates";
import { modeNumberText } from "@/components/mode-kit/type";
import { cn } from "@/components/ui-primitives";

export type ModeSource = { readonly label: string; readonly url: string };

/**
 * "Updated 12 Mar 2026 · 6 months ago": the date itself first, the age muted
 * after it (standard §2). Never a tick and never a green "up to date".
 *
 * `verb` says what the date is: "Updated" (the day it last changed, the
 * default) or "Checked" (the day someone compared it with its official source).
 * Use "Checked" only when that check really happened.
 *
 * Sources follow on one small line, each an https link that opens in a new tab
 * with no referrer. A second reviewer appears only here, as words ("Reviewed by
 * a second editor, 12 Aug 2026"), never as a tag.
 */
export function ModeUpdatedLine({
  updatedAt,
  verb = "Updated",
  sources,
  reviewedAt,
  now,
  testId,
}: {
  readonly updatedAt: string | null;
  readonly verb?: "Updated" | "Checked";
  readonly sources?: readonly ModeSource[];
  readonly reviewedAt?: string | null;
  readonly now?: Date;
  readonly testId?: string;
}) {
  const date = updatedAt ? formatModeDate(updatedAt) : "";
  const safeSources = sources?.filter((source) => source.url.startsWith("https://")) ?? [];
  if (!date && !safeSources.length && !reviewedAt) return null;
  return (
    <span className="grid min-w-0 gap-0.5 text-xs text-[color:var(--text-muted)]" data-testid={testId}>
      {date ? (
        <span className={cn(modeNumberText, "break-words")}>
          {verb} {date}
          <span className="text-[color:var(--text-muted)]">{` · ${modeAgo(updatedAt ?? "", now)}`}</span>
        </span>
      ) : null}
      {safeSources.length || reviewedAt ? (
        <span className="flex min-w-0 flex-wrap items-center gap-x-3 text-[color:var(--text-muted)]">
          {safeSources.map((source) => (
            <a
              key={`${source.url}:${source.label}`}
              href={source.url}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(
                focusRing,
                "inline-flex min-h-tap min-w-0 items-center gap-1 rounded-sm text-[color:var(--clinical-accent)]",
              )}
            >
              <ExternalLink aria-hidden="true" className="size-icon-xs shrink-0" />
              <span className="break-words">{source.label}</span>
            </a>
          ))}
          {reviewedAt ? <span>Reviewed by a second editor, {formatModeDate(reviewedAt)}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
