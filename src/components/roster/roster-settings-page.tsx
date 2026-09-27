"use client";

import { RefreshCw, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CalendarSubscribe } from "@/components/calendar/calendar-subscribe";
import { useAppPreferences } from "@/components/clinical-dashboard/use-app-preferences";
import { InformationPageShell } from "@/components/information-page-shell";
import { ModeActionButton } from "@/components/mode-kit/action-button";
import { formatModeDate, formatModeTime } from "@/components/mode-kit/dates";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import { ModeStateLabel } from "@/components/mode-kit/state-label";
import { ToggleSwitch } from "@/components/primitive-recipes/feedback";
import { Button } from "@/components/ui/button";
import { rosterWindow } from "@/lib/roster/shifts/diff";
import { updateReminderType, type ReminderLeadTime, type ReminderType } from "@/lib/reminders/settings-model";

import { describeLinkFailure, useRosterLinks } from "./use-roster-links";
import { useRosterSettings } from "./use-roster-settings";
import { useRosterShifts } from "./use-roster-shifts";

/**
 * Roster Settings: the calendar switch, the evening-before reminder,
 * workplaces, calendar links, and Delete my data.
 *
 * Delete asks no "Are you sure?". Everything is hidden at once and Undo shows
 * for 30 seconds; the delete request is sent only when those 30 seconds end,
 * or when the page is closed first (`pagehide`, with `keepalive` so the
 * request outlives the page). Undo cancels the timer, so nothing was deleted.
 */

export const ROSTER_DELETE_UNDO_MS = 30_000;

/*
 * The evening-before shift reminder is the "shifts" reminder type, added to
 * the shared reminder model by Roster's reminders change. Until that lands the
 * model does not know the type or its lead time, so these two names are cast
 * here, in one place, and the shared model normalises away what it does not
 * know.
 */
const SHIFTS_REMINDER = "shifts" as string as ReminderType;
const EVENING_BEFORE = "evening-before" as string as ReminderLeadTime;

type DeleteState = "idle" | "pending" | "deleted";

export function RosterSettingsPage() {
  const shifts = useRosterShifts();
  const links = useRosterLinks();
  const settings = useRosterSettings();
  const { preferences, setPreference } = useAppPreferences();
  const [deleteState, setDeleteState] = useState<DeleteState>("idle");
  const [notice, setNotice] = useState<{ tone: "neutral" | "warning"; text: string } | null>(null);
  const timer = useRef<number | null>(null);

  const reminderOn = preferences.reminders.types[SHIFTS_REMINDER]?.calendarAlert === EVENING_BEFORE;
  const calendarShifts = settings.settings.calendarShifts;

  const workplaces = useMemo(() => {
    const names = new Set<string>();
    for (const shift of shifts.shifts) if (shift.workplace) names.add(shift.workplace);
    for (const name of Object.keys(settings.settings.codes)) if (name) names.add(name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [shifts.shifts, settings.settings.codes]);

  const { deleteAll } = shifts;
  const sendDelete = useCallback(
    (keepalive: boolean) => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
      setDeleteState("deleted");
      void deleteAll({ keepalive }).then((failure) => {
        if (failure) {
          setDeleteState("idle");
          setNotice({ tone: "warning", text: failure });
        }
      });
    },
    [deleteAll],
  );

  useEffect(() => {
    if (deleteState !== "pending") return;
    const onPageHide = () => sendDelete(true);
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [deleteState, sendDelete]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  function startDelete() {
    setNotice(null);
    setDeleteState("pending");
    timer.current = window.setTimeout(() => sendDelete(false), ROSTER_DELETE_UNDO_MS);
  }

  function undoDelete() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setDeleteState("idle");
  }

  async function toggleCalendarShifts() {
    const failure = await settings.update({ calendarShifts: !calendarShifts });
    if (failure) setNotice({ tone: "warning", text: failure });
  }

  function toggleReminder() {
    setPreference(
      "reminders",
      updateReminderType(preferences.reminders, SHIFTS_REMINDER, {
        calendarAlert: reminderOn ? "off" : EVENING_BEFORE,
      }),
    );
  }

  async function removeWorkplace(name: string) {
    const imported = shifts.shifts.filter((shift) => shift.source === "import" && shift.workplace === name);
    const span = rosterWindow(imported);
    if (span) {
      const failure = await shifts.save({
        format: "csv",
        workplace: name,
        fileName: null,
        windowStart: span.start,
        windowEnd: span.end,
        shifts: [],
      });
      if (failure) {
        setNotice({ tone: "warning", text: failure });
        return;
      }
    }
    const codes = { ...settings.settings.codes };
    delete codes[name];
    const failure = await settings.update({ codes });
    setNotice(failure ? { tone: "warning", text: failure } : { tone: "neutral", text: "Removed" });
  }

  async function linkAction(action: Promise<string | null>, done: string) {
    const failure = await action;
    setNotice(failure ? { tone: "warning", text: failure } : { tone: "neutral", text: done });
  }

  if (deleteState !== "idle") {
    return (
      <InformationPageShell testId="roster-settings-main" width="narrow">
        <h1 className="sr-only">Settings</h1>
        <div className="grid gap-3" data-testid="roster-settings-deleting">
          <ModeNotice>
            {deleteState === "pending" ? "Deleting your Roster data" : "Your Roster data is deleted."}
          </ModeNotice>
          {deleteState === "pending" ? (
            <Button variant="secondary" onClick={undoDelete}>
              Undo
            </Button>
          ) : null}
        </div>
      </InformationPageShell>
    );
  }

  return (
    <InformationPageShell testId="roster-settings-main" width="narrow">
      <h1 className="sr-only">Settings</h1>
      <div className="grid min-w-0 gap-5">
        {notice ? <ModeNotice tone={notice.tone}>{notice.text}</ModeNotice> : null}
        {shifts.status === "loading" ? (
          <ModeModuleSkeleton rows={4} eyebrow testId="roster-settings-loading" />
        ) : shifts.status === "signed-out" ? (
          <ModeNotice testId="roster-settings-signed-out">Sign in to change Roster settings.</ModeNotice>
        ) : (
          <>
            <ModeGroupedList eyebrow="Calendar" testId="roster-settings-calendar">
              <ModeRow
                title="Shifts on my calendar link"
                subtitle="Type and time only"
                trailing={
                  <ToggleSwitch
                    enabled={calendarShifts}
                    onToggle={() => void toggleCalendarShifts()}
                    aria-label="Shifts on my calendar link"
                    disabled={settings.status !== "ready"}
                  />
                }
              />
              <ModeRow
                title="Remind me the evening before"
                subtitle="20:00"
                meta={
                  calendarShifts ? undefined : <ModeStateLabel>Turn on Shifts on my calendar link first</ModeStateLabel>
                }
                trailing={
                  <ToggleSwitch
                    enabled={calendarShifts && reminderOn}
                    onToggle={toggleReminder}
                    aria-label="Remind me the evening before"
                    disabled={!calendarShifts}
                  />
                }
              />
            </ModeGroupedList>
            {calendarShifts ? <CalendarSubscribe testId="roster-settings-subscribe" /> : null}

            <ModeGroupedList eyebrow="Workplaces" testId="roster-settings-workplaces">
              {workplaces.length === 0 ? (
                <ModeRow title="None yet" />
              ) : (
                workplaces.map((name) => (
                  <ModeRow
                    key={name}
                    title={name}
                    trailing={
                      <ModeActionButton
                        icon={Trash2}
                        label={`Remove ${name}`}
                        onClick={() => void removeWorkplace(name)}
                        disabled={shifts.demoMode}
                      />
                    }
                  />
                ))
              )}
            </ModeGroupedList>

            <ModeGroupedList eyebrow="Calendar links" testId="roster-settings-links">
              {links.links.length === 0 ? (
                <ModeRow title="None yet" />
              ) : (
                links.links.map((link) => (
                  <ModeRow
                    key={link.id}
                    title={link.display}
                    subtitle={
                      describeLinkFailure(link.failure) ??
                      (link.refreshedAt
                        ? `Updated ${formatModeDate(link.refreshedAt)} ${formatModeTime(link.refreshedAt)}`
                        : (link.workplace ?? undefined))
                    }
                    trailing={
                      <>
                        <ModeActionButton
                          icon={RefreshCw}
                          label={`Refresh ${link.display}`}
                          onClick={() => void linkAction(links.refresh(link.id), "Refreshed")}
                        />
                        <ModeActionButton
                          icon={Trash2}
                          label={`Remove ${link.display}`}
                          onClick={() => void linkAction(links.remove(link.id), "Removed")}
                        />
                      </>
                    }
                  />
                ))
              )}
            </ModeGroupedList>

            <section className="grid gap-2" aria-label="Delete my data">
              <Button variant="danger" icon={Trash2} onClick={startDelete} disabled={shifts.demoMode}>
                Delete my data
              </Button>
              <p className="px-3 text-sm text-[color:var(--text-muted)]">
                Your shifts, calendar links and settings. Uploaded files are never kept.
              </p>
            </section>
          </>
        )}
      </div>
    </InformationPageShell>
  );
}
