"use client";

import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import type { AskAnswer } from "@/lib/roster/ask/answer";
import type { AskChoice, AskResult } from "@/lib/roster/ask/parse";

export function RosterAskAnswer({
  result,
  answer,
  reading,
  onChoice,
  onOpen,
}: {
  readonly result: AskResult;
  readonly answer: AskAnswer | null;
  readonly reading: string | null;
  readonly onChoice: (choice: AskChoice) => void;
  readonly onOpen: () => void;
}) {
  if (result.kind === "not_understood")
    return (
      <p role="status" className="px-3 text-sm text-[color:var(--text-muted)]">
        Roster couldn&apos;t read that. Try &apos;When am I next on nights?&apos; or tap a shift.
      </p>
    );
  if (result.kind === "clarify")
    return (
      <div className="grid gap-2" role="status">
        <p className="px-3 text-sm text-[color:var(--text-muted)]">{result.ask}</p>
        {result.options.length ? (
          <ModeGroupedList eyebrow="Choose one">
            {result.options.map((choice) => (
              <ModeRow
                key={`${choice.label}-${choice.userId ?? choice.date?.from ?? ""}`}
                title={choice.label}
                trailing={
                  <button
                    type="button"
                    onClick={() => onChoice(choice)}
                    className="min-h-12 rounded-md px-3 text-[color:var(--command)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--command)]"
                  >
                    Choose
                  </button>
                }
              />
            ))}
          </ModeGroupedList>
        ) : null}
      </div>
    );
  if (result.kind === "change")
    return (
      <ModeGroupedList eyebrow="Read this request">
        <ModeRow
          title={reading ?? "Open a request"}
          subtitle="Review and send it in Requests."
          trailing={
            <button
              type="button"
              onClick={onOpen}
              className="min-h-12 rounded-md px-3 font-medium text-[color:var(--command)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--command)]"
            >
              Open
            </button>
          }
        />
      </ModeGroupedList>
    );
  if (!answer) return null;
  return (
    <div className="grid gap-2" role="status">
      <ModeGroupedList eyebrow="Roster answer">
        {answer.lines.map((line, index) => (
          <ModeRow key={index} title={line} />
        ))}
        {answer.rows?.map((row, index) => (
          <ModeRow key={`row-${index}`} title={row.label} subtitle={row.detail} />
        ))}
      </ModeGroupedList>
      <p className="px-3 text-xs text-[color:var(--text-muted)]">{answer.source}</p>
    </div>
  );
}
