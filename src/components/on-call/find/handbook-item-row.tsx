"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { withHospitalPhone } from "@/components/on-call/call/call-device-stores";
import { OnCallActionButton } from "@/components/on-call/kit/action-button";
import { OnCallDialRow } from "@/components/on-call/kit/dial-row";
import { OnCallGroupedList } from "@/components/on-call/kit/grouped-list";
import { onCallInsetHairline, onCallPressable, onCallRowHeight } from "@/components/on-call/kit/recipes";
import { onCallNameText, onCallSecondaryText } from "@/components/on-call/kit/type";
import { OnCallUpdatedLine } from "@/components/on-call/kit/updated-line";
import { focusRing } from "@/components/card-recipes";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/components/ui-primitives";
import type { HandbookItem } from "@/lib/on-call/handbook-items";

const MACHINE_LINE = /^\s*(Also known as|From a mobile):/i;

/** The hospital's own words, without the two lines the app reads for itself. */
export function handbookBodyText(body: string): string {
  return body
    .split(/\r?\n/)
    .filter((line) => !MACHINE_LINE.test(line))
    .join("\n")
    .trim();
}

/** The first line of the hospital's own words, for a row's second line. */
export function handbookFirstLine(body: string): string | null {
  return (
    handbookBodyText(body)
      .split("\n")
      .map((line) => line.trim())
      .find(Boolean) ?? null
  );
}

/**
 * One handbook item as a row whose detail opens in a sheet (standard v8
 * modules 1 and 6), for Refer and Find. Nothing expands in place.
 *
 * - With no phone, the whole row is the button: the label at 500 and a 13px
 *   muted second line, with a chevron.
 * - With a phone, the row is the kit's dial row (number column, call disc,
 *   desk-only rule, the hospital-phone switch), and its last control opens the
 *   same detail sheet.
 *
 * The sheet holds the body in the hospital's own words (`whitespace-pre-line`,
 * never rewritten), the "Also known as" names, the number again, and the
 * Updated line with sources. Titles wrap and are never truncated (#8RWKA0).
 */
export function OnCallHandbookItemRow({
  item,
  secondary,
  hospitalName,
  hospitalPhone,
  detailTestId,
  testId,
}: {
  readonly item: HandbookItem;
  readonly secondary: string | null;
  readonly hospitalName: string | null;
  readonly hospitalPhone: boolean;
  readonly detailTestId: string;
  readonly testId: string;
}) {
  const [open, setOpen] = useState(false);
  const label = item.parsed.label;
  const body = handbookBodyText(item.body);
  const dial = withHospitalPhone(item.dial, hospitalPhone);
  const hasNumber = dial.kind !== "none";

  const detail = (
    <Sheet open={open} onClose={() => setOpen(false)} title={label} testId={detailTestId}>
      <div className="grid min-w-0 gap-4">
        {body ? (
          <p className="whitespace-pre-line break-words text-base-minus text-[color:var(--text)]">{body}</p>
        ) : null}
        {item.aliases.length > 0 ? (
          <p className={cn(onCallSecondaryText, "break-words")}>Also known as {item.aliases.join(", ")}</p>
        ) : null}
        {hasNumber ? (
          <OnCallGroupedList>
            <OnCallDialRow
              id={item.id}
              source="handbook"
              title={label}
              dial={dial}
              mobileDial={item.mobileDial}
              updatedAt={item.updatedAt}
              sources={item.sources}
              hospitalName={hospitalName}
              testId={`${testId}-detail-dial`}
            />
          </OnCallGroupedList>
        ) : null}
        <OnCallUpdatedLine updatedAt={item.updatedAt} sources={item.sources} testId="on-call-updated-date" />
      </div>
    </Sheet>
  );

  if (hasNumber) {
    return (
      <>
        <OnCallDialRow
          id={item.id}
          source="handbook"
          title={label}
          subtitle={secondary ?? undefined}
          dial={dial}
          mobileDial={item.mobileDial}
          updatedAt={item.updatedAt}
          sources={item.sources}
          hospitalName={hospitalName}
          trailingAction={
            <OnCallActionButton
              icon={ChevronRight}
              label={`Details: ${label}`}
              onClick={() => setOpen(true)}
              testId={`${testId}-details`}
            />
          }
          testId={testId}
        />
        {detail}
      </>
    );
  }

  return (
    <li className={cn(onCallInsetHairline, "min-w-0")} data-testid={testId}>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(
          secondary ? onCallRowHeight.double : onCallRowHeight.single,
          onCallPressable,
          focusRing,
          "flex w-full min-w-0 items-center gap-3 pl-3 pr-2 text-left",
        )}
      >
        <span className="grid min-w-0 flex-1 gap-0.5">
          <span className={cn(onCallNameText, "break-words text-base-minus text-[color:var(--text-heading)]")}>
            {label}
          </span>
          {secondary ? <span className={cn(onCallSecondaryText, "break-words")}>{secondary}</span> : null}
        </span>
        <ChevronRight aria-hidden="true" className="size-icon-md shrink-0 text-[color:var(--text-muted)]" />
      </button>
      {detail}
    </li>
  );
}
