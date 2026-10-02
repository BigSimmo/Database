"use client";

import { useMemo, useState } from "react";
import { TeachingAccountPage } from "@/components/teaching/teaching-depth-page";
import Link from "next/link";
import { TeachingSupervisionAdmin } from "@/components/teaching/teaching-supervision-admin";

import { focusRing } from "@/components/card-recipes";
import { InformationPageShell } from "@/components/information-page-shell";
import { ModeFactTile, ModeFactTiles } from "@/components/mode-kit/fact-tile";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import {
  AUDIENCE_LABELS,
  changeBody,
  csvHref,
  csvText,
  expectedMemberCount,
  sessionRisks,
  type GroupRow,
  type OrganiseRead,
  type SeriesRow,
} from "@/components/teaching/organise-model";
import {
  ChangeSheet,
  CheckedLine,
  GroupSheet,
  InviteSheet,
  MembersSheet,
  membersWord,
  REPEAT_LABELS,
  SeriesSheet,
} from "@/components/teaching/organise-sheets";
import { addDays, perthDateKey, perthTime } from "@/components/teaching/teaching-dates";
import { SessionTimeline } from "@/components/teaching/teaching-modules";
import { withUnit } from "@/components/teaching/teaching-number";
import { TeachingRow, TeachingUndoBar } from "@/components/teaching/teaching-row";
import { TeachingSignInNotice } from "@/components/teaching/teaching-sign-in";
import { TeachingStateNotice } from "@/components/teaching/teaching-states";
import { sessionRow } from "@/components/teaching/teaching-view-model";
import { useDelayedPost } from "@/components/teaching/use-delayed-post";
import { useSessionDetail } from "@/components/teaching/use-session-detail";
import { useTeachingNow } from "@/components/teaching/use-teaching-now";
import { useTeachingResource } from "@/components/teaching/use-teaching-resource";
import { useTeachingWeek } from "@/components/teaching/use-teaching-week";
import { Select } from "@/components/ui/select";
import { cn, eyebrowText, textMuted } from "@/components/ui-primitives";
import { teachingErrorMessage, teachingGet, teachingServiceUrl } from "@/lib/teaching/client";
import {
  attendanceLabels,
  memberLabel,
  type ExportRow,
  type SessionSummary,
  type TeamSummary,
} from "@/lib/teaching/model";

/*
 * Organise, for a service's organisers and admins (the server refuses anyone
 * else regardless). Only services the reader organises are offered, and
 * `organise.read` is asked only for the chosen one of those, so an organiser
 * at one hospital never opens an editor against another (review focus 4).
 * A posted change waits 10 seconds under Undo, then goes with `keepalive`.
 */
type Open =
  | { kind: "change"; session: SessionSummary }
  | { kind: "series"; series: SeriesRow | null }
  | { kind: "group"; group: GroupRow | null }
  | { kind: "members" }
  | { kind: "invite" }
  | null;

const HOUR = 3_600_000;
const organises = (team: TeamSummary) => team.role === "organiser" || team.role === "admin";

/** The service picker: a plain line for one service, a select for two or more. Never "All services". */
function ServicePicker({
  teams,
  value,
  onChange,
}: {
  teams: readonly TeamSummary[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex min-h-12 items-center border-b border-[color:var(--border)]">
      {teams.length === 1 ? (
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-[color:var(--text-heading)]">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-[color:var(--mode-identity)]" />
          <span className="truncate">{teams[0].name}</span>
        </span>
      ) : (
        <Select
          label="Service you organise"
          hideLabel
          value={value}
          onChange={(event) => onChange(event.target.value)}
          options={teams.map((team) => ({ value: team.id, label: team.name }))}
          fieldClassName="min-w-0 max-w-full"
        />
      )}
    </div>
  );
}

function TeachingOrganiseContent({ demoMode }: { demoMode: boolean }) {
  const now = useTeachingNow();
  const today = now ? perthDateKey(now) : null;
  const range = useMemo(() => (today ? { from: today, to: addDays(today, 6) } : null), [today]);
  const view = useTeachingWeek(range, { demoMode }, now);
  const teams = useMemo(() => (view.week?.teams ?? []).filter(organises), [view.week]);
  const [chosen, setChosen] = useState<string | null>(null);
  const serviceId = teams.some((t) => t.id === chosen) ? chosen : (teams[0]?.id ?? null);
  const organise = useTeachingResource<OrganiseRead>(
    serviceId && !demoMode ? teachingServiceUrl(serviceId, { action: "organise.read" }) : null,
  );
  const [open, setOpen] = useState<Open>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const delayed = useDelayedPost();
  // R9: the change reaches the session's series' groups, and the occurrence read names its series.
  const changing = open?.kind === "change" ? open.session : null;
  const changingDetail = useSessionDetail(changing?.occurrenceId ?? null, demoMode, now);

  let body;
  if (view.status === "signed-out") body = <TeachingSignInNotice />;
  else if (view.status === "offline" || view.status === "error" || view.status === "setup")
    body = <TeachingStateNotice state={view.status} onRetry={view.retry} />;
  else if (!now || !view.week) body = <ModeModuleSkeleton rows={4} eyebrow />;
  else if (demoMode)
    body = (
      <>
        <ModeNotice>
          Made-up demo service. Explore the programme and roles; no real invitations, membership changes or records are
          sent.
        </ModeNotice>
        <ModeGroupedList eyebrow="Demo programme" testId="teaching-organise-demo">
          {view.week.sessions.map((session) => (
            <ModeRow
              key={session.occurrenceId}
              title={session.title}
              subtitle={`${perthDateKey(session.startsAt)} · ${perthTime(session.startsAt)}`}
              href={`/teaching/session/${session.occurrenceId}`}
            />
          ))}
        </ModeGroupedList>
        <ModeGroupedList eyebrow="Explore the roles">
          <ModeRow title="Learner" subtitle="Choose attendance and personal CPD actions" href="/teaching/logbook" />
          <ModeRow title="Presenter" subtitle="Readiness, de-identification and feedback" href="/teaching/teach" />
          <ModeRow
            title="Registrar and supervisor"
            subtitle="Log, review and confirm synthetic supervision"
            href="/teaching/supervision"
          />
          <ModeRow title="Organiser" subtitle="Preview a timetable without saving it" href="/teaching/import" />
        </ModeGroupedList>
        <ModeNotice>
          In an approved service, organisers manage series, groups, invitations and supervision pairings. Service admins
          manage programme access. Neither role can read a doctor&apos;s private CPD figures.
        </ModeNotice>
      </>
    );
  else if (teams.length === 0 || !serviceId)
    body = <ModeNotice>Organise is for your service&apos;s organisers.</ModeNotice>;
  else if (organise.status === "loading" || organise.status === "idle") body = <ModeModuleSkeleton rows={4} eyebrow />;
  else if (organise.status !== "ready" || !organise.data)
    body = (
      <TeachingStateNotice
        state={organise.status === "offline" || organise.status === "setup" ? organise.status : "error"}
        onRetry={organise.retry}
      />
    );
  else {
    const data = organise.data;
    const service = serviceId;
    const mine = view.week.sessions.filter((s) => s.serviceId === service);
    const soon = mine.filter(
      (s) => Date.parse(s.startsAt) < now.getTime() + 48 * HOUR && Date.parse(s.endsAt) > now.getTime(),
    );
    const soonIds = new Set(soon.map((s) => s.occurrenceId));
    const risks = sessionRisks(mine).filter((r) => soonIds.has(r.occurrenceId));
    // At most one amber mark in the list: the first risk, in time order.
    const firstRisk = soon.flatMap((s) => risks.filter((r) => r.occurrenceId === s.occurrenceId))[0] ?? null;
    const context = { teams: view.week.teams, attendance: [], showTeam: false };
    const rows = soon.map((s) => ({
      ...sessionRow(s, context),
      href: null,
      onSelect:
        delayed.pending || s.status === "cancelled" || s.source !== "teaching"
          ? undefined
          : () => setOpen({ kind: "change", session: s }),
      status: firstRisk?.occurrenceId === s.occurrenceId ? { tone: "warning" as const, text: firstRisk.text } : null,
    }));
    const refresh = () => {
      view.retry();
      organise.retry();
    };
    const saved = () => {
      setOpen(null);
      refresh();
    };
    const reach =
      changing && changingDetail.status === "ready"
        ? expectedMemberCount(data, changingDetail.data?.seriesId ?? null)
        : data.members.length;

    async function download() {
      if (downloading) return;
      const to = perthDateKey(now!);
      const from = addDays(to, -83);
      setNotice(null);
      setDownloading(true);
      try {
        const result = await teachingGet<{ rows: ExportRow[] }>(
          teachingServiceUrl(service, { action: "export.attendance", from, to }),
        );
        const link = document.createElement("a");
        link.href = csvHref(
          csvText(
            ["Date", "Time", "Session", "Name", "How"],
            result.rows.map((r) => [
              perthDateKey(r.startsAt),
              perthTime(r.startsAt),
              r.title,
              memberLabel(r),
              attendanceLabels[r.method],
            ]),
          ),
        );
        link.download = "teaching-attendance-export.csv";
        link.click();
      } catch (cause) {
        setNotice(teachingErrorMessage(cause));
      } finally {
        setDownloading(false);
      }
    }

    body = (
      <>
        <section aria-label="Next 48 hours" className="grid gap-2">
          {rows.length > 0 ? (
            <SessionTimeline
              groups={[{ id: "soon", label: "Next 48 hours", count: null, rows }]}
              testId="teaching-organise-soon"
            />
          ) : (
            <>
              <h2 className={cn(eyebrowText, "px-1")}>Next 48 hours</h2>
              <p className={cn("px-1 text-sm", textMuted)}>Nothing in the next 48 hours.</p>
            </>
          )}
          <div className="px-1">
            <CheckedLine at={now} count={risks.length} />
          </div>
        </section>
        <div role="group" aria-label="This service">
          <ModeFactTiles testId="teaching-organise-counts">
            <ModeFactTile
              label="Sessions this week"
              value={String(mine.filter((s) => s.status !== "cancelled").length)}
            />
            <ModeFactTile label="Members" value={String(data.members.length)} />
            <ModeFactTile label="Groups" value={String(data.groups.length)} />
            <ModeFactTile label="Series" value={String(data.series.length)} />
          </ModeFactTiles>
        </div>
        <ModeGroupedList eyebrow="Series" testId="teaching-organise-series">
          {data.series.map((s) => (
            <TeachingRow
              key={s.seriesId}
              title={s.title}
              subtitle={[
                REPEAT_LABELS[s.repeat as keyof typeof REPEAT_LABELS] ?? null,
                s.startTime,
                s.venue ?? "Room not set",
                s.audience ? AUDIENCE_LABELS[s.audience] : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              onClick={() => setOpen({ kind: "series", series: s })}
            />
          ))}
          <TeachingRow title="New series" onClick={() => setOpen({ kind: "series", series: null })} />
        </ModeGroupedList>
        <ModeGroupedList eyebrow="People" testId="teaching-organise-people">
          {data.groups.map((g) => (
            <TeachingRow
              key={g.groupId}
              title={g.name}
              subtitle={membersWord(g.userIds.length)}
              onClick={() => setOpen({ kind: "group", group: g })}
            />
          ))}
          <TeachingRow title="New group" onClick={() => setOpen({ kind: "group", group: null })} />
          <TeachingRow
            title="Members"
            subtitle={String(data.members.length)}
            onClick={() => setOpen({ kind: "members" })}
          />
          <TeachingRow
            title="Invite"
            subtitle="By work email, with a one-time code"
            onClick={() => setOpen({ kind: "invite" })}
          />
          <TeachingRow
            title="Download attendance"
            subtitle={downloading ? "Preparing the spreadsheet…" : `Last ${withUnit(12, "weeks")}, as a spreadsheet`}
            busy={downloading}
            onClick={() => void download()}
          />
        </ModeGroupedList>
        {notice ? <ModeNotice tone="warning">{notice}</ModeNotice> : null}
        <TeachingSupervisionAdmin
          key={service}
          serviceId={service}
          data={data}
          today={perthDateKey(now)}
          isAdmin={teams.find((team) => team.id === service)?.role === "admin"}
          onSaved={refresh}
        />
        {open?.kind === "change" ? (
          <ChangeSheet
            session={open.session}
            others={mine}
            memberCount={reach}
            now={now}
            onClose={() => setOpen(null)}
            onPost={(draft, count) => {
              const session = open.session;
              setOpen(null);
              setNotice(null);
              delayed.schedule({
                label: `Posting to ${membersWord(count)}`,
                url: teachingServiceUrl(service),
                body: changeBody(session, draft),
                onPosted: refresh,
                onFailed: (cause) => setNotice(teachingErrorMessage(cause)),
              });
            }}
          />
        ) : null}
        {open?.kind === "series" ? (
          <SeriesSheet
            serviceId={service}
            series={open.series}
            organise={data}
            onClose={() => setOpen(null)}
            onSaved={saved}
          />
        ) : null}
        {open?.kind === "group" ? (
          <GroupSheet
            serviceId={service}
            group={open.group}
            organise={data}
            onClose={() => setOpen(null)}
            onSaved={saved}
          />
        ) : null}
        {open?.kind === "members" ? <MembersSheet organise={data} onClose={() => setOpen(null)} /> : null}
        {open?.kind === "invite" ? <InviteSheet serviceId={service} onClose={() => setOpen(null)} /> : null}
      </>
    );
  }

  return (
    <InformationPageShell width="narrow" gap={false} testId="teaching-organise">
      <div className="grid gap-3">
        <h1 className="sr-only">Organise</h1>
        {teams.length > 0 && !demoMode ? (
          <Link
            href="/teaching/import"
            className={cn(
              "inline-flex min-h-tap items-center self-start px-1 text-sm font-medium text-[color:var(--primary)]",
              focusRing,
            )}
          >
            Import a timetable
          </Link>
        ) : null}
        {teams.length > 0 && serviceId && !demoMode ? (
          <ServicePicker teams={teams} value={serviceId} onChange={setChosen} />
        ) : null}
        {body}
      </div>
      {delayed.pending ? (
        <TeachingUndoBar testId="teaching-organise-pending" onUndo={delayed.undo}>
          {delayed.pending}. Leaving this page cancels the unsent change.
        </TeachingUndoBar>
      ) : null}
    </InformationPageShell>
  );
}

export function TeachingOrganise(props: { demoMode: boolean }) {
  return <TeachingAccountPage component={TeachingOrganiseContent} {...props} />;
}
