"use client";

import { useRef, useState } from "react";

import { CalendarSubscribe } from "@/components/calendar/calendar-subscribe";
import { ModeNotice } from "@/components/mode-kit/notice";
import type { TeamSummaryRead } from "@/components/teaching/teaching-reads";
import { teamInCalendar } from "@/components/teaching/teaching-view-model";
import { Checkbox } from "@/components/ui/choice";
import { Sheet } from "@/components/ui/sheet";
import { eyebrowText } from "@/components/ui-primitives";
import { teachingErrorMessage, teachingPost, teachingServiceUrl } from "@/lib/teaching/client";

/* The app's private calendar link, then one box per service (`calendar.set`). Refetches once, on close. */
export function TeachingCalendarSheet({
  open,
  onClose,
  teams,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  teams: readonly TeamSummaryRead[];
  onChanged: () => void;
}) {
  const [chosen, setChosen] = useState<Readonly<Record<string, boolean>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = useRef(false);

  async function choose(team: TeamSummaryRead, enabled: boolean) {
    setBusy(true);
    setError(null);
    try {
      await teachingPost(teachingServiceUrl(team.id), { action: "calendar.set", enabled });
      setChosen((current) => ({ ...current, [team.id]: enabled }));
      changed.current = true;
    } catch (cause) {
      setError(teachingErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  function close() {
    onClose();
    if (changed.current) {
      changed.current = false;
      onChanged();
    }
  }

  return (
    <Sheet open={open} onClose={close} title="Add to my calendar">
      <div className="grid gap-4">
        <CalendarSubscribe testId="teaching-calendar-subscribe" />
        <fieldset className="grid gap-1">
          <legend className={eyebrowText}>Services in your calendar</legend>
          {teams.map((team) => (
            <Checkbox
              key={team.id}
              label={team.name}
              checked={chosen[team.id] ?? teamInCalendar(team)}
              disabled={busy}
              onChange={(event) => void choose(team, event.target.checked)}
            />
          ))}
        </fieldset>
        {error ? <ModeNotice tone="warning">{error}</ModeNotice> : null}
      </div>
    </Sheet>
  );
}
