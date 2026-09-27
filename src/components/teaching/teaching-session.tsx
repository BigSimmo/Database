"use client";

import { Clock, QrCode } from "lucide-react";
import { useState } from "react";

import { InformationPageShell } from "@/components/information-page-shell";
import { ModeFactTile, ModeFactTiles } from "@/components/mode-kit/fact-tile";
import { ModeGroupedList, ModeRow } from "@/components/mode-kit/grouped-list";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import { ModeStateLabel } from "@/components/mode-kit/state-label";
import { LogToCpdSheet } from "@/components/teaching/log-to-cpd-sheet";
import { sessionPhase } from "@/components/teaching/session-phase";
import {
  changeLine,
  checkinCloses,
  checkinOpens,
  formatTypedCode,
  isOccurrenceId,
  sessionWhen,
  typedCodeDigits,
} from "@/components/teaching/session-view-model";
import { ActionStrip, type TeachingAction } from "@/components/teaching/teaching-actions";
import { TeachingModule, TeachingSwitch } from "@/components/teaching/teaching-modules";
import { TeachingNavHeader } from "@/components/teaching/teaching-nav-header";
import type { SessionDetailRead } from "@/components/teaching/teaching-reads";
import { TeachingRow } from "@/components/teaching/teaching-row";
import { TeachingSignInNotice } from "@/components/teaching/teaching-sign-in";
import { TeachingStateNotice } from "@/components/teaching/teaching-states";
import { joinLabel, joinPlatform } from "@/components/teaching/teaching-view-model";
import { attendanceTiles, type AttendanceCounts } from "@/components/teaching/use-checkin-code";
import { useSessionDetail } from "@/components/teaching/use-session-detail";
import { useTeachingNow } from "@/components/teaching/use-teaching-now";
import { useTeachingResource } from "@/components/teaching/use-teaching-resource";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { teachingErrorMessage, teachingPost, teachingServiceUrl } from "@/lib/teaching/client";
import {
  attendanceLabels,
  memberLabel,
  type AttendanceMethod,
  type CheckinStream,
  type RegisterResult,
  type RegisterRow,
} from "@/lib/teaching/model";

/*
 * One session (spec §9, review focus 5): the phase module (Coming up; On now
 * with Scan to check in and Check in without code; then a quiet Log to CPD),
 * Details, Materials, and for the presenter and organisers the counts and the
 * check-in code. Organisers also get the named register, where a self-reported
 * mark can be removed. A cancelled, moved or removed session says so in words
 * and offers no Join and no check-in. A health-service visitor (master plan
 * R5 and R15) gets the read-only view and says "I was there" through What's
 * on, never through this service.
 */
const GONE = "This session is no longer in the programme.";

type Mark = { method: AttendanceMethod; recordedAt: string };
type Props = { occurrenceId: string; demoMode: boolean; initialSheet?: "scan"; embedded?: boolean };

export function TeachingSessionScreen({ occurrenceId, demoMode, initialSheet, embedded = false }: Props) {
  const now = useTeachingNow();
  const valid = isOccurrenceId(occurrenceId);
  const resource = useSessionDetail(valid ? occurrenceId : null, demoMode, now);
  const detail = resource.data;

  let body;
  if (!valid || resource.code === "teaching_not_found") body = <ModeNotice>{GONE}</ModeNotice>;
  else if (resource.status === "signed-out") body = <TeachingSignInNotice />;
  else if (resource.status === "offline" || resource.status === "error" || resource.status === "setup")
    body = <TeachingStateNotice state={resource.status} onRetry={resource.retry} />;
  else if (!now || !detail) body = <ModeModuleSkeleton rows={4} eyebrow />;
  else
    body = (
      <SessionBody
        key={detail.occurrenceId}
        detail={detail}
        now={now}
        live={!demoMode}
        initialSheet={initialSheet}
        embedded={embedded}
      />
    );

  const content = <div className="grid gap-3">{body}</div>;
  if (embedded) return content;
  return (
    <>
      <TeachingNavHeader
        title={detail?.title ?? "Session"}
        testIdPrefix="teaching-session"
        back={{ href: "/teaching/week", label: "Week" }}
      />
      <InformationPageShell width="narrow" gap={false} testId="teaching-session">
        {content}
      </InformationPageShell>
    </>
  );
}

function sessionCounts(counts: NonNullable<SessionDetailRead["counts"]>): AttendanceCounts {
  return { code: counts.code, self: counts.self, visitors: counts.visitors ?? 0 };
}

function SessionBody({
  detail,
  now,
  live,
  initialSheet,
  embedded,
}: {
  detail: SessionDetailRead;
  now: Date;
  live: boolean;
  initialSheet?: "scan";
  embedded: boolean;
}) {
  // Beside Week the page already has its heading, so the session's title is a section heading there.
  const Title = embedded ? "h2" : "h1";
  const visitor = detail.visitor === true;
  const cancelled = detail.status === "cancelled";
  const staff = detail.canShowCode && !cancelled && !visitor;
  const [mark, setMark] = useState<Mark | null>(detail.myAttendance ?? null);
  // `?check-in=scan` (Today's hero) opens the scan sheet on arrival; it only shows while a code can be scanned.
  const [sheet, setSheet] = useState<"scan" | "cpd" | "register" | null>(initialSheet ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // `register.read` answers an organiser with names and a presenter with counts only (plan-contracts §4).
  const register = useTeachingResource<RegisterResult>(
    live && staff
      ? teachingServiceUrl(detail.serviceId, { action: "register.read", occurrenceId: detail.occurrenceId })
      : null,
  );
  const phase = sessionPhase(detail, now);
  const change = changeLine(detail);
  const started = now.getTime() >= Date.parse(detail.startsAt);
  const ended = now.getTime() >= Date.parse(detail.endsAt);
  // The server's windows: a code from 15 minutes before the start, without a code from the start to 7 days after the end.
  const canSelfReport = !mark && started && (phase === "checkin" || phase === "self");
  const canScan = !mark && !visitor && phase === "checkin";
  const rows = register.data && "rows" in register.data ? register.data.rows : null;

  async function selfCheckIn() {
    if (!live) {
      setError("The demo doesn't save check-ins.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // A visitor is not a member of this service, so What's on records it (master plan R15).
      const saved = visitor
        ? await teachingPost<Mark>("/api/teaching/whats-on", {
            action: "whats_on.attend",
            occurrenceId: detail.occurrenceId,
          })
        : await teachingPost<Mark>(teachingServiceUrl(detail.serviceId), {
            action: "attendance.self",
            occurrenceId: detail.occurrenceId,
          });
      setMark({ method: saved.method, recordedAt: saved.recordedAt });
    } catch (cause) {
      setError(teachingErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  const actions: TeachingAction[] = [];
  if (canScan)
    actions.push({
      id: "scan",
      label: "Scan to check in",
      icon: QrCode,
      onClick: () => setSheet("scan"),
      emphasis: "primary",
    });
  if (canSelfReport)
    actions.push({
      id: "self",
      label: visitor ? "I was there" : "Check in without code",
      onClick: () => void selfCheckIn(),
      busy,
      busyLabel: "Saving",
      emphasis: canScan ? "text" : "secondary",
    });
  if (detail.joinUrl && !ended)
    actions.push({
      id: "join",
      label: joinLabel(detail.joinUrl),
      href: detail.joinUrl,
      external: true,
      emphasis: actions.some((action) => action.emphasis === "primary") ? "secondary" : "primary",
    });
  if (mark && ended && live)
    actions.push({ id: "cpd", label: "Log to CPD", onClick: () => setSheet("cpd"), emphasis: "text" });

  const moduleTitle =
    phase === "checkin" && started && !ended
      ? "On now"
      : ended
        ? "Finished"
        : phase === "checkin"
          ? "Check-in open"
          : "Coming up";
  const aside =
    phase === "checkin"
      ? `Check-in open until ${checkinCloses(detail)}`
      : phase === "upcoming"
        ? `Check-in opens ${checkinOpens(detail)}`
        : null;
  const platform = detail.joinUrl ? (joinPlatform(detail.joinUrl) ?? "Online") : "Online";
  const onlineLine = visitor ? platform : `${platform} · Members only`;

  return (
    <>
      <div className="grid gap-1">
        <Title className="text-xl font-semibold text-[color:var(--text-heading)]">{detail.title}</Title>
        <p className="nums text-sm font-normal text-[color:var(--text-muted)]">{sessionWhen(detail)}</p>
      </div>
      {change ? <ModeNotice tone="warning">{change}</ModeNotice> : null}
      {!cancelled ? (
        <TeachingModule
          testId="teaching-session-phase"
          title={moduleTitle}
          icon={Clock}
          live={moduleTitle === "On now"}
          freshKey={moduleTitle}
          aside={aside}
        >
          <div className="grid gap-2 p-3">
            {mark ? <ModeStateLabel tone="muted">{attendanceLabels[mark.method]}</ModeStateLabel> : null}
            <ActionStrip actions={actions} layout="stack" />
            {error ? <ModeNotice tone="warning">{error}</ModeNotice> : null}
          </div>
        </TeachingModule>
      ) : null}
      <ModeGroupedList mode="teaching" eyebrow="Details" testId="teaching-session-details">
        {detail.venue ? <ModeRow title="Where" subtitle={detail.venue} /> : null}
        {detail.hasJoinLink ? (
          detail.joinUrl && !cancelled ? (
            <TeachingRow title="Online" subtitle={onlineLine} externalHref={detail.joinUrl} />
          ) : (
            <ModeRow title="Online" subtitle={onlineLine} />
          )
        ) : null}
        {detail.presenterName ? <ModeRow title="Presenter" subtitle={detail.presenterName} /> : null}
      </ModeGroupedList>
      {detail.materials.length > 0 ? (
        <ModeGroupedList
          mode="teaching"
          eyebrow="Materials · chosen by the presenter"
          testId="teaching-session-materials"
        >
          {detail.materials.map((item) => (
            <TeachingRow key={item.url} title={item.label} externalHref={item.url} />
          ))}
        </ModeGroupedList>
      ) : null}
      {staff ? (
        <>
          {detail.counts ? (
            <div role="group" aria-label="Attendance">
              <ModeFactTiles>
                {attendanceTiles(sessionCounts(detail.counts), detail.counts.expected).map((tile) => (
                  <ModeFactTile key={tile.id} label={tile.label} value={tile.value} />
                ))}
              </ModeFactTiles>
            </div>
          ) : null}
          {phase === "checkin" || rows ? (
            <ModeGroupedList mode="teaching">
              {phase === "checkin" ? (
                <ModeRow
                  title="Show check-in code"
                  subtitle={`Open until ${checkinCloses(detail)}`}
                  href={`/teaching/session/${detail.occurrenceId}/check-in`}
                  testId="teaching-session-show-code"
                />
              ) : null}
              {rows ? <TeachingRow title="Register" onClick={() => setSheet("register")} /> : null}
            </ModeGroupedList>
          ) : null}
        </>
      ) : null}
      {canScan ? (
        <ScanSheet
          open={sheet === "scan"}
          onClose={() => setSheet(null)}
          detail={detail}
          live={live}
          onDone={setMark}
        />
      ) : null}
      {mark && ended ? (
        <LogToCpdSheet
          open={sheet === "cpd"}
          onClose={() => setSheet(null)}
          occurrenceId={detail.occurrenceId}
          startsAt={detail.startsAt}
          endsAt={detail.endsAt}
        />
      ) : null}
      {rows ? (
        <RegisterSheet
          open={sheet === "register"}
          onClose={() => setSheet(null)}
          detail={detail}
          rows={rows}
          onChanged={register.retry}
        />
      ) : null}
    </>
  );
}

function ScanSheet({
  open,
  onClose,
  detail,
  live,
  onDone,
}: {
  open: boolean;
  onClose: () => void;
  detail: SessionDetailRead;
  live: boolean;
  onDone: (mark: Mark) => void;
}) {
  const [stream, setStream] = useState<CheckinStream>("room");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const code = typedCodeDigits(typed);
    if (!code) {
      setError("Enter the 6-digit code.");
      return;
    }
    if (!live) {
      setError("The demo doesn't save check-ins.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await teachingPost<Mark>(teachingServiceUrl(detail.serviceId), {
        action: "checkin.typed",
        occurrenceId: detail.occurrenceId,
        stream,
        code,
      });
      onDone({ method: saved.method, recordedAt: saved.recordedAt });
      onClose();
    } catch (cause) {
      setError(teachingErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Scan to check in">
      <div className="grid gap-3">
        <p className="text-sm text-[color:var(--text-heading)]">
          Open your phone&apos;s camera and point it at the code on screen.
        </p>
        {detail.hasJoinLink ? (
          <TeachingSwitch
            value={stream}
            onChange={setStream}
            label="Where you are"
            options={[
              { value: "room", label: "Room" },
              { value: "teams", label: "Teams" },
            ]}
          />
        ) : null}
        <TextField
          label="Or type the six digits"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={formatTypedCode("000000")}
          error={error ?? undefined}
        />
        <Button variant="primary" block busy={busy} busyLabel="Checking in" onClick={() => void submit()}>
          Check in
        </Button>
      </div>
    </Sheet>
  );
}

function RegisterSheet({
  open,
  onClose,
  detail,
  rows,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  detail: SessionDetailRead;
  rows: readonly RegisterRow[];
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(userId: string) {
    setError(null);
    setRemoving(userId);
    try {
      await teachingPost(teachingServiceUrl(detail.serviceId), {
        action: "attendance.remove",
        occurrenceId: detail.occurrenceId,
        userId,
      });
      onChanged();
    } catch (cause) {
      setError(teachingErrorMessage(cause));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Register">
      <div className="grid gap-3">
        {rows.length === 0 ? (
          <ModeNotice>No one has checked in yet.</ModeNotice>
        ) : (
          <ModeGroupedList mode="teaching">
            {rows.map((row) => {
              const name = memberLabel(row);
              // Only a self-reported mark can be removed; part 1's `attendance.remove` refuses a code mark.
              const userId = row.method === "self" ? row.userId : null;
              return (
                <ModeRow
                  key={`${row.userId ?? "former"}-${row.recordedAt}`}
                  title={name}
                  subtitle={attendanceLabels[row.method]}
                  trailing={
                    userId ? (
                      <Button
                        variant="ghost"
                        aria-label={`Remove ${name}`}
                        busy={removing === userId}
                        busyLabel="Removing"
                        onClick={() => void remove(userId)}
                      >
                        Remove
                      </Button>
                    ) : undefined
                  }
                />
              );
            })}
          </ModeGroupedList>
        )}
        {error ? <ModeNotice tone="warning">{error}</ModeNotice> : null}
      </div>
    </Sheet>
  );
}
