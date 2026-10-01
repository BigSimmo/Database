"use client";

import { RefreshCw, Settings2, Trash2 } from "lucide-react";
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
import { updateReminderType, type ReminderLeadTime, type ReminderType } from "@/lib/reminders/settings-model";

import { RosterAlertsSection } from "./alerts/roster-alerts-section";
import { describeLinkFailure, useRosterLinks } from "./use-roster-links";
import { useRosterSettings } from "./use-roster-settings";
import { useRosterShifts } from "./use-roster-shifts";
import { RosterPageHeader } from "./roster-ui";

/**
 * Roster Settings: the calendar switch, the evening-before reminder,
 * workplaces, calendar links, and Delete my data.
 *
 * Delete asks no "Are you sure?". Everything is hidden at once and Undo shows
 * for 30 seconds; the delete request is sent only when those 30 seconds end,
 * or when the page is left first: closed (`pagehide`) or navigated away from
 * inside the app (unmount), both with `keepalive` so the request outlives the
 * page. Undo cancels the timer, so nothing was deleted.
 */

export const ROSTER_DELETE_UNDO_MS = 30_000;

/* The evening-before shift reminder is the shared model's "shifts" type with its fixed 20:00 lead time. */
const SHIFTS_REMINDER: ReminderType = "shifts";
const EVENING_BEFORE: ReminderLeadTime = "evening-before";

type DeleteState = "idle" | "pending" | "deleting" | "deleted";

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
      setDeleteState("deleting");
      void deleteAll({ keepalive }).then((failure) => {
        if (failure) {
          setDeleteState("idle");
          setNotice({ tone: "warning", text: failure });
        } else setDeleteState("deleted");
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

  const latestDeleteAll = useRef(deleteAll);
  useEffect(() => {
    latestDeleteAll.current = deleteAll;
  }, [deleteAll]);

  useEffect(
    () => () => {
      if (timer.current === null) return;
      window.clearTimeout(timer.current);
      timer.current = null;
      // Leaving the page inside the app during the 30 seconds deletes, just as closing it does.
      void latestDeleteAll.current({ keepalive: true });
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
    // Its calendar links and imported shifts go together, so no refresh brings it back; then its codes.
    const removed = await shifts.removeWorkplace(name);
    if (removed) {
      setNotice({ tone: "warning", text: removed });
      return;
    }
    void links.reload();
    const failure = await settings.update({ codes: { [name]: null } });
    setNotice(failure ? { tone: "warning", text: failure } : { tone: "neutral", text: "Removed" });
  }

  async function linkAction(action: Promise<string | null>, done: string) {
    const failure = await action;
    setNotice(failure ? { tone: "warning", text: failure } : { tone: "neutral", text: done });
  }

  if (deleteState !== "idle") {
    return (
      <InformationPageShell testId="roster-settings-main" width="narrow">
        <RosterPageHeader icon={Settings2} title="Settings" subtitle="Calendar links, hours and your data." ask={false} />
        <div className="grid gap-3" data-testid="roster-settings-deleting">
          <ModeNotice>
            {deleteState === "pending"
              ? "Your Roster data will be deleted shortly."
              : deleteState === "deleting"
                ? "Deleting your own Roster data…"
                : "Your own Roster data is deleted. Team rostered shifts remain with the team."}
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
      <RosterPageHeader icon={Settings2} title="Settings" subtitle="Calendar links, hours and your data." ask={false} />
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
            <RosterAlertsSection />

            {shifts.status === "error" ? (
              <ModeNotice tone="warning" testId="roster-settings-error">
                Your shifts could not be loaded. Try again later.
              </ModeNotice>
            ) : (
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
            )}

            {links.status === "error" ? (
              <ModeNotice tone="warning" testId="roster-settings-links-error">
                Your calendar links could not be loaded. Try again later.
              </ModeNotice>
            ) : (
              <ModeGroupedList eyebrow="Calendar links" testId="roster-settings-links">
                {links.links.length === 0 ? (
                  <ModeRow title="None yet" />
                ) : (
                  links.links.map((link) => (
                    <ModeRow
                      key={link.id}
                      title={link.hostPreview}
                      subtitle={
                        describeLinkFailure(link.lastError) ??
                        (link.lastFetchedAt
                          ? `Updated ${formatModeDate(link.lastFetchedAt)} ${formatModeTime(link.lastFetchedAt)}`
                          : (link.workplace ?? undefined))
                      }
                      trailing={
                        <>
                          <ModeActionButton
                            icon={RefreshCw}
                            label={`Refresh ${link.hostPreview}`}
                            onClick={() => void linkAction(links.refresh(link.id), "Refreshed")}
                          />
                          <ModeActionButton
                            icon={Trash2}
                            label={`Remove ${link.hostPreview}`}
                            onClick={() => void linkAction(links.remove(link.id), "Removed")}
                          />
                        </>
                      }
                    />
                  ))
                )}
              </ModeGroupedList>
            )}

            <section className="grid gap-2" aria-label="Delete my data">
              <Button variant="danger" icon={Trash2} onClick={startDelete} disabled={shifts.demoMode}>
                Delete my data
              </Button>
              <p className="px-3 text-sm text-[color:var(--text-muted)]">
                Uploaded files are never kept. Your team retains its roster records for 12 months.
              </p>
              <p className="px-3 text-sm text-[color:var(--text-muted)]">
                Your shifts, requests, leave, alerts and settings. Your team&apos;s roster keeps your rostered shifts.
              </p>
            </section>
          </>
        )}
      </div>
    </InformationPageShell>
  );
}
