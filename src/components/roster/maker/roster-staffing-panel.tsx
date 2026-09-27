"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useRosterRead } from "@/components/roster/use-roster-team";
import type { RosterDraft } from "@/lib/roster/maker/model";
import { coverSuggestions, staffingForDate, type StaffingNeed } from "@/lib/roster/maker/staffing";
import {
  rosterMakerActionSchema,
  rosterMakerStateSchema,
  type RosterMakerRules,
  type RosterMakerState,
} from "@/lib/roster/maker/workflow-model";
import { addDaysToDate, formatPerthDay, perthDateOf } from "@/lib/roster/shifts/perth-time";
import { ROSTER_OPEN_SHIFT_KINDS, type RosterOverview } from "@/lib/roster/team/model";

type EditableNeed = Omit<StaffingNeed, "id"> & { key: string };
type Status = "loading" | "ready" | "saving" | "conflict" | "error";
const emptyRules: RosterMakerRules = { minBreakHours: null, maxHours7d: null, source: null, reviewedOn: null };
const selectClass =
  "min-h-12 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm";
const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const GRADES = ["intern", "resident", "registrar", "fellow", "consultant"] as const;
const fromServer = (needs: RosterMakerState["needs"]): EditableNeed[] =>
  needs.map((need) => ({
    key: need.id,
    weekday: need.weekday,
    date: need.date,
    kind: need.kind,
    grade: need.grade,
    siteId: need.siteId,
    needed: need.needed,
  }));
const serialise = (needs: readonly EditableNeed[]) =>
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to drop the client-side key
  needs.map(({ key: _key, ...need }) => need);
function needLabel(need: StaffingNeed, overview: RosterOverview): string {
  const site = need.siteId
    ? (overview.sites.find((entry) => entry.id === need.siteId)?.name ?? "Unknown site")
    : "No site specified";
  return `${need.grade ?? "No grade specified"} ${need.kind} · ${site}`;
}
function errorMessage(value: unknown, fallback: string): string {
  return value && typeof value === "object" && "message" in value && typeof value.message === "string"
    ? value.message
    : fallback;
}
function sameSettings(state: RosterMakerState, needs: readonly EditableNeed[], rules: RosterMakerRules): boolean {
  const sorted = (items: readonly Omit<StaffingNeed, "id">[]) =>
    [...items].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- destructured only to drop the server id
  const current = state.needs.map(({ id: _id, ...need }) => need);
  return (
    JSON.stringify(sorted(serialise(needs))) === JSON.stringify(sorted(current)) &&
    JSON.stringify(rules) === JSON.stringify(state.rules)
  );
}

export function RosterStaffingPanel({
  serviceId,
  overview,
  snapshot,
}: {
  serviceId: string;
  overview: RosterOverview;
  snapshot: RosterDraft;
}) {
  const manager = overview.me.role === "manager";
  const [maker, setMaker] = useState<RosterMakerState | null>(null);
  const [needs, setNeeds] = useState<EditableNeed[]>([]);
  const [rules, setRules] = useState<RosterMakerRules>(emptyRules);
  const [status, setStatus] = useState<Status>("loading");
  const [conflictFresh, setConflictFresh] = useState(false);
  const [message, setMessage] = useState("");
  const [dayStart, setDayStart] = useState(snapshot.draft.periodStart);
  const [scope, setScope] = useState<"dated" | "recurring">("recurring");
  const [newDate, setNewDate] = useState("");
  const [newWeekday, setNewWeekday] = useState("1");
  const [newSite, setNewSite] = useState("");
  const [newGrade, setNewGrade] = useState("");
  const [newKind, setNewKind] = useState("day");
  const [newNeeded, setNewNeeded] = useState("1");
  const [vacancyId, setVacancyId] = useState("");
  const requestNumber = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const newKey = useRef(0);
  useEffect(() => {
    const requests = requestNumber;
    const requestController = controller;
    alive.current = true;
    return () => {
      alive.current = false;
      requests.current++;
      requestController.current?.abort();
    };
  }, []);

  const load = useCallback(
    async (preserveEdits: boolean) => {
      if (!manager) return;
      controller.current?.abort();
      const pending = new AbortController();
      controller.current = pending;
      const n = ++requestNumber.current;
      setStatus("loading");
      try {
        const response = await fetch(
          `/api/roster/team/${encodeURIComponent(serviceId)}/maker?draftId=${encodeURIComponent(snapshot.draft.id)}`,
          { cache: "no-store", signal: pending.signal },
        );
        const body: unknown = await response.json().catch(() => null);
        if (!alive.current || n !== requestNumber.current) return;
        if (!response.ok) throw new Error(errorMessage(body, "Staffing settings could not be loaded."));
        const parsed = rosterMakerStateSchema.safeParse(body);
        if (!parsed.success) throw new Error("Staffing settings could not be read.");
        setMaker(parsed.data);
        if (!preserveEdits) {
          setNeeds(fromServer(parsed.data.needs));
          setRules(parsed.data.rules);
        }
        setConflictFresh(preserveEdits);
        setStatus(preserveEdits ? "conflict" : "ready");
        setMessage(
          preserveEdits
            ? "Another manager changed staffing settings, or the save result was uncertain. Your edits remain. Compare them with current settings before choosing to save again."
            : "",
        );
      } catch (error) {
        if (!alive.current || n !== requestNumber.current || pending.signal.aborted) return;
        setStatus(preserveEdits ? "conflict" : "error");
        setConflictFresh(false);
        setMessage(error instanceof Error ? error.message : "Staffing settings could not be loaded.");
      }
    },
    [manager, serviceId, snapshot.draft.id],
  );
  useEffect(() => {
    // Deferred through a timer so the load's "loading" state is not set
    // synchronously inside the effect (react-hooks/set-state-in-effect).
    const requestController = controller;
    const timer = window.setTimeout(() => {
      void load(false);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      requestController.current?.abort();
    };
  }, [load]);

  const dirty = maker ? !sameSettings(maker, needs, rules) : false;
  function addNeed() {
    const needed = Number(newNeeded);
    const date = scope === "dated" ? newDate : null;
    const weekday = scope === "recurring" ? Number(newWeekday) : null;
    if (
      (date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(date)) ||
      (weekday !== null && (!Number.isInteger(weekday) || weekday < 1 || weekday > 7)) ||
      !Number.isInteger(needed) ||
      needed < 0 ||
      needed > 200 ||
      !ROSTER_OPEN_SHIFT_KINDS.includes(newKind as (typeof ROSTER_OPEN_SHIFT_KINDS)[number])
    ) {
      setMessage("Choose a valid date or weekday, shift kind and count from 0 to 200.");
      return;
    }
    const proposed: EditableNeed = {
      key: `new-${++newKey.current}`,
      weekday,
      date,
      siteId: newSite || null,
      grade: newGrade ? (newGrade as EditableNeed["grade"]) : null,
      kind: newKind as EditableNeed["kind"],
      needed,
    };
    if (
      needs.some(
        (need) =>
          need.date === proposed.date &&
          need.weekday === proposed.weekday &&
          need.siteId === proposed.siteId &&
          need.grade === proposed.grade &&
          need.kind === proposed.kind,
      )
    ) {
      setMessage("That exact staffing requirement already exists. Edit its count instead.");
      return;
    }
    setNeeds((current) => [...current, proposed]);
    setMessage("");
  }
  async function save() {
    if (!maker || status !== "ready" || !dirty) return;
    const body = { action: "settings.save", expectedToken: maker.settingsToken, needs: serialise(needs), rules };
    const valid = rosterMakerActionSchema.safeParse(body);
    if (!valid.success) {
      setMessage("Review the staffing counts and enter a source and review date for configured rules.");
      return;
    }
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    const n = ++requestNumber.current;
    setStatus("saving");
    setMessage("Saving staffing settings…");
    try {
      const response = await fetch(`/api/roster/team/${encodeURIComponent(serviceId)}/maker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        signal: pending.signal,
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!alive.current || n !== requestNumber.current) return;
      if (response.status === 409 || response.status >= 500) {
        void load(true);
        return;
      }
      if (!response.ok) {
        setStatus("error");
        setMessage(errorMessage(payload, "Staffing settings could not be saved."));
        return;
      }
      const parsed = rosterMakerStateSchema.safeParse(payload);
      if (!parsed.success) {
        void load(true);
        return;
      }
      setMaker(parsed.data);
      setNeeds(fromServer(parsed.data.needs));
      setRules(parsed.data.rules);
      setStatus("ready");
      setMessage("Staffing settings saved for this team.");
    } catch {
      if (alive.current && n === requestNumber.current && !pending.signal.aborted) void load(true);
    }
  }

  const days = useMemo(() => {
    const dates: string[] = [];
    const start =
      dayStart >= snapshot.draft.periodStart && dayStart <= snapshot.draft.periodEnd
        ? dayStart
        : snapshot.draft.periodStart;
    for (let date = start; date <= snapshot.draft.periodEnd && dates.length < 7; date = addDaysToDate(date, 1))
      dates.push(date);
    return dates;
  }, [dayStart, snapshot.draft.periodStart, snapshot.draft.periodEnd]);
  const staffing = days.map((date) => ({ date, result: staffingForDate(date, needs, snapshot.assignments) }));
  const vacancies = snapshot.assignments.filter((row) => !row.userId && !row.rosterName && row.kind !== "leave");
  const vacancy = vacancies.find((row) => row.id === vacancyId) ?? vacancies[0];
  const vacancyDate = vacancy ? perthDateOf(vacancy.startsAt) : null;
  const range = vacancyDate ? { from: addDaysToDate(vacancyDate, -8), to: addDaysToDate(vacancyDate, 8) } : null;
  const peopleRead = useRosterRead(manager && vacancy ? serviceId : null, "people");
  const publishedRead = useRosterRead(manager && vacancy ? serviceId : null, "assignments", range);
  const availabilityRead = useRosterRead(manager && vacancy ? serviceId : null, "unavailability", range);
  const leaveRead = useRosterRead(manager && vacancy ? serviceId : null, "team_leave", range);
  const matchingGap =
    vacancyDate && vacancy
      ? staffingForDate(vacancyDate, needs, snapshot.assignments).rows.find(
          (row) =>
            row.need.siteId === vacancy.siteId &&
            row.need.grade === vacancy.grade &&
            row.need.kind === vacancy.kind &&
            row.gap > 0,
        )
      : null;
  const coverReady =
    !!vacancy &&
    !!matchingGap &&
    !!maker &&
    status === "ready" &&
    !dirty &&
    peopleRead.status === "ready" &&
    publishedRead.status === "ready" &&
    availabilityRead.status === "ready" &&
    leaveRead.status === "ready";
  const cover = coverReady
    ? coverSuggestions({
        vacancy: vacancy!,
        requiredGrade: matchingGap!.need.grade,
        people: peopleRead.data!.people,
        published: publishedRead.data!.assignments,
        draft: snapshot.assignments,
        availability: availabilityRead.data!.unavailability,
        leave: leaveRead.data!.leave,
        rules: maker!.rules,
      })
    : null;

  if (!manager) return <p>Only your team&apos;s roster manager can configure staffing.</p>;
  return (
    <section aria-label="Staffing needs and cover" className="grid gap-5">
      <header>
        <h2 className="text-lg font-semibold">Staffing needs and team rules</h2>
        <p className="text-sm text-[color:var(--text-muted)]">
          These are this team&apos;s configured requirements. A dated value replaces the recurring value for the same
          site, grade and shift kind, including zero. Unspecified site and grade are separate scopes.
        </p>
      </header>
      {message ? <p role={status === "error" || status === "conflict" ? "alert" : "status"}>{message}</p> : null}
      {maker && status === "error" ? (
        <Button onClick={() => void load(true)}>Reload current settings before retry</Button>
      ) : null}
      {!maker ? (
        <div>
          <p>Staffing settings are {status === "loading" ? "loading…" : "unavailable."}</p>
          {status === "error" ? <Button onClick={() => void load(false)}>Try again</Button> : null}
        </div>
      ) : (
        <>
          {status === "conflict" ? (
            <div className="grid gap-2 rounded-xl border border-[color:var(--warning)] p-4">
              {conflictFresh ? (
                <>
                  <p>
                    Your unsaved values remain below. Current team settings now have {maker.needs.length} requirements;
                    break {maker.rules.minBreakHours ?? "unknown"} hours, seven-day limit{" "}
                    {maker.rules.maxHours7d ?? "unknown"} hours, source {maker.rules.source ?? "not recorded"}, reviewed{" "}
                    {maker.rules.reviewedOn ?? "not recorded"}.
                  </p>
                  <ul className="text-sm">
                    {maker.needs.map((need) => (
                      <li key={need.id}>
                        {need.date ?? WEEKDAYS[(need.weekday ?? 1) - 1]} · {needLabel(need, overview)} · need{" "}
                        {need.needed}
                      </li>
                    ))}
                  </ul>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        setNeeds(fromServer(maker.needs));
                        setRules(maker.rules);
                        setStatus("ready");
                        setMessage("Current staffing settings loaded.");
                      }}
                    >
                      Use current settings
                    </Button>
                    <Button
                      onClick={() => {
                        setStatus("ready");
                        setMessage("Review your values below, then save if they are still right.");
                      }}
                    >
                      Review my values against current
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p>Current settings could not be reloaded. Your values remain here; saving is disabled.</p>
                  <Button onClick={() => void load(true)}>Retry loading current settings</Button>
                </>
              )}
            </div>
          ) : null}
          <section className="grid gap-3 rounded-xl border border-[color:var(--border)] p-4">
            <h3 className="font-medium">Required shifts</h3>
            <p className="text-sm text-[color:var(--text-muted)]">
              Set one recurring weekday or one dated override per exact site, grade and kind. A count of zero explicitly
              overrides a recurring requirement.
            </p>
            {needs.length ? (
              <ul className="grid gap-2">
                {needs.map((need) => (
                  <li
                    key={need.key}
                    className="grid gap-2 rounded-lg border border-[color:var(--border)] p-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                  >
                    <span>
                      {need.date ? `Dated override · ${need.date}` : `Recurring · ${WEEKDAYS[(need.weekday ?? 1) - 1]}`}{" "}
                      · {needLabel(need, overview)}
                    </span>
                    <label className="grid gap-1 text-sm">
                      Needed
                      <input
                        className={`${selectClass} w-24`}
                        type="number"
                        min={0}
                        max={200}
                        value={need.needed}
                        onChange={(event) =>
                          setNeeds((current) =>
                            current.map((item) =>
                              item.key === need.key ? { ...item, needed: Number(event.target.value) } : item,
                            ),
                          )
                        }
                      />
                    </label>
                    <Button onClick={() => setNeeds((current) => current.filter((item) => item.key !== need.key))}>
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No staffing requirements configured.</p>
            )}
            <div className="grid gap-2 rounded-lg bg-[color:var(--surface-subtle)] p-3 sm:grid-cols-2">
              <label className="grid gap-1">
                Applies
                <select
                  className={selectClass}
                  value={scope}
                  onChange={(event) => setScope(event.target.value as "dated" | "recurring")}
                >
                  <option value="recurring">Recurring weekday</option>
                  <option value="dated">One date override</option>
                </select>
              </label>
              {scope === "dated" ? (
                <TextField
                  label="Override date"
                  type="date"
                  value={newDate}
                  onChange={(event) => setNewDate(event.target.value)}
                />
              ) : (
                <label className="grid gap-1">
                  Weekday
                  <select
                    className={selectClass}
                    value={newWeekday}
                    onChange={(event) => setNewWeekday(event.target.value)}
                  >
                    {WEEKDAYS.map((day, index) => (
                      <option key={day} value={index + 1}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="grid gap-1">
                Site
                <select className={selectClass} value={newSite} onChange={(event) => setNewSite(event.target.value)}>
                  <option value="">No site specified</option>
                  {overview.sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                Grade
                <select className={selectClass} value={newGrade} onChange={(event) => setNewGrade(event.target.value)}>
                  <option value="">No grade specified</option>
                  {GRADES.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                Shift kind
                <select className={selectClass} value={newKind} onChange={(event) => setNewKind(event.target.value)}>
                  {ROSTER_OPEN_SHIFT_KINDS.map((kind) => (
                    <option key={kind} value={kind}>
                      {kind}
                    </option>
                  ))}
                </select>
              </label>
              <TextField
                label="Required count"
                type="number"
                min={0}
                max={200}
                value={newNeeded}
                onChange={(event) => setNewNeeded(event.target.value)}
              />
            </div>
            <Button onClick={addNeed}>Add requirement</Button>
          </section>
          <section className="grid gap-3 rounded-xl border border-[color:var(--border)] p-4">
            <h3 className="font-medium">Team cover rules</h3>
            <p className="text-sm">
              These values come from the team&apos;s chosen source and review date. Unknown values block suggestions;
              they are not legal or award interpretations.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <TextField
                label="Minimum break hours"
                type="number"
                min={0}
                max={48}
                step="0.5"
                value={rules.minBreakHours ?? ""}
                onChange={(event) =>
                  setRules({ ...rules, minBreakHours: event.target.value === "" ? null : Number(event.target.value) })
                }
              />
              <TextField
                label="Maximum worked hours in any seven days"
                type="number"
                min={1}
                max={168}
                step="0.5"
                value={rules.maxHours7d ?? ""}
                onChange={(event) =>
                  setRules({ ...rules, maxHours7d: event.target.value === "" ? null : Number(event.target.value) })
                }
              />
              <TextField
                label="Rule source"
                value={rules.source ?? ""}
                maxLength={200}
                onChange={(event) => setRules({ ...rules, source: event.target.value || null })}
              />
              <TextField
                label="Rules reviewed on"
                type="date"
                value={rules.reviewedOn ?? ""}
                onChange={(event) => setRules({ ...rules, reviewedOn: event.target.value || null })}
              />
            </div>
            <Button variant="primary" disabled={!dirty || status !== "ready"} onClick={() => void save()}>
              {status === "saving" ? "Saving…" : "Save staffing settings"}
            </Button>
          </section>
          <section className="grid gap-3 rounded-xl border border-[color:var(--border)] p-4">
            <h3 className="font-medium">Draft coverage</h3>
            <p className="text-sm">
              Counts use this draft, including named rows; unfilled shifts do not count as rostered.{" "}
              {dirty ? "These counts preview unsaved staffing settings." : "These counts use saved staffing settings."}
            </p>
            <div className="flex items-center gap-2">
              <Button
                disabled={days[0] <= snapshot.draft.periodStart}
                onClick={() => setDayStart(addDaysToDate(days[0]!, -7))}
              >
                Previous dates
              </Button>
              <span>{days.length ? `${formatPerthDay(days[0]!)}–${formatPerthDay(days.at(-1)!)}` : "No dates"}</span>
              <Button
                disabled={!days.length || days.at(-1)! >= snapshot.draft.periodEnd}
                onClick={() => setDayStart(addDaysToDate(days[0]!, 7))}
              >
                Next dates
              </Button>
            </div>
            {staffing.map(({ date, result }) => (
              <div key={date} className="grid gap-1 border-t border-[color:var(--border)] pt-2">
                <h4 className="font-medium">{formatPerthDay(date)}</h4>
                {result.error ? (
                  <p role="alert">{result.error}</p>
                ) : result.rows.length ? (
                  result.rows.map((row) => (
                    <p key={`${row.need.siteId}-${row.need.grade}-${row.need.kind}`}>
                      {needLabel(row.need, overview)} · {row.rostered} rostered / {row.need.needed} needed ·{" "}
                      {row.source === "dated" ? "dated override" : "recurring"}.{" "}
                      {row.gap
                        ? `Gap: ${row.gap} more ${row.need.grade ?? "ungraded"} ${row.need.kind} shift${row.gap === 1 ? "" : "s"} needed on ${formatPerthDay(date)}; no time has been set for this requirement.`
                        : "No gap."}
                      {row.named ? ` Includes ${row.named} named unlinked duty${row.named === 1 ? "" : "ies"}.` : ""}
                    </p>
                  ))
                ) : (
                  <p>No requirement entered for this date.</p>
                )}
              </div>
            ))}
          </section>
          <section className="grid gap-3 rounded-xl border border-[color:var(--border)] p-4">
            <h3 className="font-medium">Possible cover for a timed vacancy</h3>
            <p className="text-sm">
              Suggestions are advisory and listed by name, without fairness ranking. They use only configured team
              rules, the published roster, draft duties, availability and leave dates. No private reasons are shown.
            </p>
            {vacancies.length ? (
              <label className="grid gap-1">
                Vacant draft shift
                <select
                  className={selectClass}
                  value={vacancy?.id ?? ""}
                  onChange={(event) => setVacancyId(event.target.value)}
                >
                  {vacancies.map((row) => (
                    <option key={row.id} value={row.id}>
                      {formatPerthDay(perthDateOf(row.startsAt))} · {row.shiftCode} · {row.grade ?? "grade missing"}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p>
                No timed vacant shift is in this draft. A staffing count alone has no start or end time, so no cover can
                be suggested for it.
              </p>
            )}
            {vacancy && !matchingGap ? (
              <p>This vacancy has no matching configured staffing gap for its exact site, grade and kind.</p>
            ) : null}
            {vacancy && matchingGap && !coverReady ? (
              <p>
                Cover suggestions need saved rules and complete published roster, availability and leave reads. They are
                unavailable until those checks load.
              </p>
            ) : null}
            {cover?.status === "rules_unknown" ? (
              <p>Cover rules are unknown or lack a source and review date. No suggestion is made.</p>
            ) : null}
            {cover?.status === "grade_unknown" ? (
              <p>This vacancy needs an exact configured grade before suggesting cover.</p>
            ) : null}
            {cover?.status === "on_call_unknown" ? (
              <p>On-call hours need a service-specific rule before cover can be suggested.</p>
            ) : null}
            {cover?.status === "ready" ? (
              cover.candidates.length ? (
                <ul className="grid gap-2">
                  {cover.candidates.map((candidate) => (
                    <li key={candidate.userId} className="rounded-lg border border-[color:var(--border)] p-3">
                      <strong>{candidate.name}</strong>
                      <p className="text-sm">{candidate.explanation}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No person passes all loaded checks for this timed shift.</p>
              )
            ) : null}
          </section>
        </>
      )}
    </section>
  );
}
