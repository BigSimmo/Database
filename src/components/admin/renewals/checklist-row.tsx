import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

import { focusRing } from "@/components/card-recipes";
import { modeInsetHairline, modePressable, modeRowHeight } from "@/components/mode-kit/recipes";
import { modeNameText, modeSecondaryText } from "@/components/mode-kit/type";
import { cn } from "@/components/ui-primitives";

/**
 * A row that opens a sheet rather than following a link — the one shape the
 * mode kit does not offer (`ModeRow` is `href`-or-plain only; see this lane's
 * report, "Integration asks"). Built from the kit's own recipe tokens so it
 * matches `ModeRow` exactly rather than becoming a second, drifting version of
 * a list row: same 48/52px height rule, same inset hairline, same weights.
 *
 * Two different trailing slots, because the final design uses trailing space
 * two different ways:
 *  - `statusTrailing` is a plain status word ("Date passed"), read as part of
 *    the row and followed by the chevron — tapping it still opens the sheet.
 *  - `actionTrailing` is a real control (the 34px "Add date" / "Move back"
 *    row action). It renders as a SIBLING of the pressable button, never
 *    nested inside it — a `<button>` inside a `<button>` is invalid, and the
 *    control needs its own tap target separate from "open the sheet". Its
 *    presence also drops the chevron, matching the final design's rows.
 */
export function ChecklistPressableRow({
  title,
  subtitle,
  meta,
  statusTrailing,
  actionTrailing,
  onOpen,
  testId,
}: {
  readonly title: ReactNode;
  readonly subtitle?: ReactNode;
  readonly meta?: ReactNode;
  readonly statusTrailing?: ReactNode;
  readonly actionTrailing?: ReactNode;
  readonly onOpen: () => void;
  readonly testId?: string;
}) {
  const twoLine = Boolean(subtitle) || Boolean(meta);
  const height = twoLine ? modeRowHeight.double : modeRowHeight.single;
  const text = (
    <span className="grid min-w-0 flex-1 basis-40 gap-0.5 py-1">
      <span className={cn(modeNameText, "break-words text-base-minus leading-5 text-[color:var(--text-heading)]")}>
        {title}
      </span>
      {subtitle ? <span className={cn(modeSecondaryText, "break-words leading-5")}>{subtitle}</span> : null}
      {meta}
    </span>
  );
  return (
    <li className={cn(modeInsetHairline, "flex min-w-0 items-center pr-1")}>
      <button
        type="button"
        onClick={onOpen}
        data-testid={testId}
        className={cn(
          height,
          modePressable,
          focusRing,
          "flex min-w-0 flex-1 flex-wrap items-center gap-x-3 pl-3 text-left",
          actionTrailing ? "pr-1" : "pr-2",
        )}
      >
        {text}
        {statusTrailing ? <span className="ml-auto flex shrink-0 items-center gap-1.5">{statusTrailing}</span> : null}
        {actionTrailing ? null : (
          <ChevronRight aria-hidden="true" className="ml-auto size-icon-md shrink-0 text-[color:var(--text-muted)]" />
        )}
      </button>
      {actionTrailing ? <span className="ml-auto flex shrink-0 items-center gap-1">{actionTrailing}</span> : null}
    </li>
  );
}

/**
 * The row action button ("Add date", "Move back"): a 34px outlined shape
 * inside a 48px tap area (mode design standard, "row actions are 34px
 * outlined shapes inside 48px tap areas"). Text, not an icon, so it is not
 * `ModeActionButton` (icon-only) — built from the same outlined-shape and
 * tap-area tokens instead of inventing new ones.
 */
export function ChecklistRowActionButton({
  label,
  onClick,
  testId,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly testId?: string;
}) {
  return (
    <span className="inline-flex min-h-12 items-center">
      <button
        type="button"
        onClick={onClick}
        data-testid={testId}
        className={cn(
          focusRing,
          "inline-flex h-8.5 shrink-0 items-center whitespace-nowrap rounded-md border border-[color:var(--border)]",
          "bg-[color:var(--surface-raised)] px-3 text-sm font-medium text-[color:var(--text)]",
          "transition-colors duration-[var(--duration-instant)] hover:border-[color:var(--border-strong)]",
        )}
      >
        {label}
      </button>
    </span>
  );
}
