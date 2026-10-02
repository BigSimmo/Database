"use client";

import { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import type { CodeMeaning } from "@/lib/roster/import/grid";
import { SHIFT_KIND_LABEL, SHIFT_KINDS, type ShiftKind } from "@/lib/roster/shift-kind";

/** Choose what an unknown code means: a kind with times, or a day off. */
export function RosterCodeChooser({
  code,
  onClose,
  onChoose,
}: {
  readonly code: string | null;
  readonly onClose: () => void;
  readonly onChoose: (code: string, meaning: CodeMeaning) => void;
}) {
  const id = useId();
  const [kind, setKind] = useState<ShiftKind>("day");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("16:30");
  const field =
    "min-h-12 w-full min-w-0 rounded-md border border-[color:var(--border)] bg-[color:var(--surface-raised)] px-3 text-base-minus text-[color:var(--text)]";
  return (
    <Sheet
      open={code !== null}
      onClose={onClose}
      title={code ? `“${code}”` : "Code"}
      mobilePlacement="bottom"
      testId="roster-code-chooser"
    >
      {code ? (
        <div className="grid gap-3">
          <Button variant="secondary" onClick={() => onChoose(code, { kind: "off" })}>
            Day off
          </Button>
          <label className="grid gap-1 text-sm text-[color:var(--text-muted)]" htmlFor={`${id}-kind`}>
            Shift
            <select
              id={`${id}-kind`}
              value={kind}
              onChange={(event) => setKind(event.target.value as ShiftKind)}
              className={field}
            >
              {SHIFT_KINDS.map((option) => (
                <option key={option} value={option}>
                  {SHIFT_KIND_LABEL[option]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1 text-sm text-[color:var(--text-muted)]" htmlFor={`${id}-start`}>
              Starts
              <input
                id={`${id}-start`}
                type="time"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className={field}
              />
            </label>
            <label className="grid gap-1 text-sm text-[color:var(--text-muted)]" htmlFor={`${id}-end`}>
              Ends
              <input
                id={`${id}-end`}
                type="time"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className={field}
              />
            </label>
          </div>
          <Button
            variant="primary"
            disabled={!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)}
            onClick={() => onChoose(code, { kind, start, end })}
          >
            Use these times
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
