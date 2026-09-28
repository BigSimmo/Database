"use client";

import { LifeBuoy } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { onCallCrisisLines, type OnCallExternalLine } from "@/components/on-call/call/external-lines";
import { OnCallDialRow } from "@/components/on-call/kit/dial-row";
import { OnCallGroupedList } from "@/components/on-call/kit/grouped-list";
import { OnCallUpdatedLine } from "@/components/on-call/kit/updated-line";

/**
 * Outside lines as dial rows, each followed by its source line: "Updated
 * 23 Sep 2026 · 3 days ago" and the publisher's https link (Global Constraint
 * 10). The source line sits in the list, not only in the dial sheet, because an
 * outside number with no visible source is exactly what the constraint forbids.
 *
 * The rows record by id only (`source="handbook"`): these are the app's public
 * lines, not the reader's own entries, so "Your usual" never names one from a
 * stored title and hides it when no handbook row resolves it.
 */
export function OnCallExternalLineRows({
  lines,
  emergencyTone = false,
  trailingAction,
  testIdPrefix,
  now,
}: {
  readonly now?: Date;
  readonly lines: readonly OnCallExternalLine[];
  /** 000 in quiet red: only on the crisis-lines module (signed-out, offline and failure screens). */
  readonly emergencyTone?: boolean;
  readonly trailingAction?: (line: OnCallExternalLine) => ReactNode;
  readonly testIdPrefix: string;
}) {
  return lines.map((line) => (
    <Fragment key={line.id}>
      <OnCallDialRow
        now={now}
        id={line.id}
        source="handbook"
        title={line.title}
        subtitle={line.area}
        dial={line.dial}
        updatedAt={line.updatedAt}
        sources={line.sources}
        tone={emergencyTone && line.dial.copy === "000" ? "emergency" : "default"}
        trailingAction={trailingAction?.(line)}
        testId={`${testIdPrefix}-${line.id}`}
      />
      <li className="min-w-0 px-3 pb-1.5" data-testid={`${testIdPrefix}-${line.id}-source`}>
        <OnCallUpdatedLine now={now} updatedAt={line.updatedAt} sources={line.sources} testId="on-call-updated-date" />
      </li>
    </Fragment>
  ));
}

/**
 * The public crisis lines — 000, MHERL (Perth) and Lifeline — shown under
 * every loading, signed-out and failure state on Call, Refer and Find (owner
 * decision). They are part of the app, so they never wait on the network.
 */
export function OnCallCrisisLines({
  now,
  testId = "on-call-crisis-lines",
}: {
  readonly now?: Date;
  readonly testId?: string;
}) {
  return (
    <OnCallGroupedList eyebrow="Crisis lines" headerIcon={LifeBuoy} testId={testId}>
      <OnCallExternalLineRows lines={onCallCrisisLines()} now={now} emergencyTone testIdPrefix="on-call-crisis-line" />
    </OnCallGroupedList>
  );
}
