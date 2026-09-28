"use client";

import { useState } from "react";

import { InformationPageShell } from "@/components/information-page-shell";
import { ModeFactTile, ModeFactTiles } from "@/components/mode-kit/fact-tile";
import { ModeGroupedList } from "@/components/mode-kit/grouped-list";
import { ModeModuleSkeleton } from "@/components/mode-kit/module-skeleton";
import { ModeNotice } from "@/components/mode-kit/notice";
import { CheckinQr } from "@/components/teaching/checkin-qr";
import { checkinCloses, checkinOpens, formatTypedCode, isOccurrenceId } from "@/components/teaching/session-view-model";
import { perthTime } from "@/components/teaching/teaching-dates";
import { DrainingHairline, TeachingSwitch } from "@/components/teaching/teaching-modules";
import { TeachingNavHeader } from "@/components/teaching/teaching-nav-header";
import type { SessionDetailRead } from "@/components/teaching/teaching-reads";
import { TeachingRow } from "@/components/teaching/teaching-row";
import { TeachingSignInNotice } from "@/components/teaching/teaching-sign-in";
import { TeachingStateNotice } from "@/components/teaching/teaching-states";
import {
  attendanceTiles,
  CHECKIN_WINDOW_MS,
  useCheckinCode,
  useRegisterCounts,
} from "@/components/teaching/use-checkin-code";
import { useSessionDetail } from "@/components/teaching/use-session-detail";
import { useTeachingNow } from "@/components/teaching/use-teaching-now";
import { cn, textMuted } from "@/components/ui-primitives";
import { checkinScanPath } from "@/lib/teaching/checkin-token";
import { teachingErrorMessage, teachingPost, teachingServiceUrl } from "@/lib/teaching/client";
import type { CheckinCode, CheckinStream } from "@/lib/teaching/model";

/*
 * The presenter's code screen (spec §9, review focus 3): the QR and its six
 * digits for the chosen stream, a draining hairline for the window, the counts
 * so far, and a shared-screen link for a projector. There is no manual "Close
 * check-in" (master plan R11): the window closes by itself 15 minutes after the
 * end. Only the check-in token reaches this page, never the occurrence secret.
 */
const MINUTE = 60_000;

type SharedScreen = { token: string; path: string; expiresAt: string };

export function TeachingCheckinScreen({ occurrenceId, demoMode }: { occurrenceId: string; demoMode: boolean }) {
  const now = useTeachingNow(1000);
  const valid = isOccurrenceId(occurrenceId);
  const resource = useSessionDetail(valid && !demoMode ? occurrenceId : null, false, now);
  const detail = resource.data;

  let body;
  if (!valid || resource.code === "teaching_not_found")
    body = <ModeNotice>This session is no longer in the programme.</ModeNotice>;
  else if (demoMode) body = <ModeNotice>The demo has no check-in code.</ModeNotice>;
  else if (resource.status === "signed-out") body = <TeachingSignInNotice />;
  else if (resource.status === "offline" || resource.status === "error" || resource.status === "setup")
    body = <TeachingStateNotice state={resource.status} onRetry={resource.retry} />;
  else if (!now || !detail) body = <ModeModuleSkeleton rows={2} twoLine eyebrow />;
  else if (detail.visitor || !detail.canShowCode)
    body = <ModeNotice>Only the presenter and your service&apos;s organisers can show this code.</ModeNotice>;
  else if (detail.status === "cancelled")
    body = <ModeNotice>This session is cancelled, so it has no check-in code.</ModeNotice>;
  else if (now.getTime() < Date.parse(detail.startsAt) - 15 * MINUTE)
    body = <ModeNotice>{`Check-in opens at ${checkinOpens(detail)}. The code shows here then.`}</ModeNotice>;
  else if (now.getTime() > Date.parse(detail.endsAt) + 15 * MINUTE)
    body = <ModeNotice>Check-in for this session has closed.</ModeNotice>;
  else body = <CodePanel detail={detail} nowMs={now.getTime()} />;

  return (
    <>
      <TeachingNavHeader
        title="Check-in code"
        testIdPrefix="teaching-checkin"
        back={{ href: `/teaching/session/${occurrenceId}`, label: "Session" }}
      />
      <InformationPageShell width="narrow" gap={false} testId="teaching-checkin">
        <div className="grid gap-3">
          <h1 className="text-xl font-semibold text-[color:var(--text-heading)]">{detail?.title ?? "Check-in code"}</h1>
          {body}
        </div>
      </InformationPageShell>
    </>
  );
}

function CodePanel({ detail, nowMs }: { detail: SessionDetailRead; nowMs: number }) {
  const [stream, setStream] = useState<CheckinStream>("room");
  const [shared, setShared] = useState<SharedScreen | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const serviceUrl = teachingServiceUrl(detail.serviceId);
  const code = useCheckinCode<CheckinCode>(
    teachingServiceUrl(detail.serviceId, { action: "checkin.code", occurrenceId: detail.occurrenceId, stream }),
    nowMs,
  );
  const counts = useRegisterCounts(
    teachingServiceUrl(detail.serviceId, { action: "register.read", occurrenceId: detail.occurrenceId }),
  );
  const expected = detail.counts?.expected ?? null;
  const closes = checkinCloses(detail);

  async function toggleShared() {
    // One request at a time: a double tap must not open two links or revoke a link twice.
    if (sharing) return;
    setError(null);
    setSharing(true);
    try {
      if (shared) {
        await teachingPost(serviceUrl, { action: "display.revoke", token: shared.token });
        setShared(null);
      } else {
        // Master plan R2: `display.create` answers `{ token, path, expiresAt }`; the path shows codes only.
        setShared(
          await teachingPost<SharedScreen>(serviceUrl, {
            action: "display.create",
            occurrenceId: detail.occurrenceId,
            stream,
          }),
        );
      }
    } catch (cause) {
      setError(teachingErrorMessage(cause));
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      {detail.hasJoinLink ? (
        <TeachingSwitch
          value={stream}
          onChange={setStream}
          label="Code for"
          options={[
            { value: "room", label: "Room" },
            { value: "teams", label: "Teams" },
          ]}
        />
      ) : null}
      <section aria-label="Check-in code" className="grid justify-items-center gap-3 p-4">
        {code.phase === "live" && code.code ? (
          <>
            <CheckinQr
              value={`${window.location.origin}${checkinScanPath(code.code.payload.token)}`}
              label="Check-in QR code. Scan it with your phone's camera."
              className="max-w-72"
            />
            <p
              data-testid="teaching-typed-code"
              className="nums text-3xl-minus font-normal tracking-widest text-[color:var(--text-heading)]"
            >
              {formatTypedCode(code.code.payload.typedCode)}
            </p>
            <div className="w-full max-w-72">
              <DrainingHairline windowStartMs={code.code.windowStartMs} windowMs={CHECKIN_WINDOW_MS} nowMs={nowMs} />
            </div>
            <p className={cn("text-center text-sm", textMuted)}>{`Members only · open until ${closes}`}</p>
          </>
        ) : code.phase === "ended" ? (
          <ModeNotice>{code.message ?? "Check-in for this session has closed."}</ModeNotice>
        ) : code.phase === "reconnecting" ? (
          <p
            role="status"
            data-testid="teaching-checkin-reconnecting"
            className="text-center text-sm text-[color:var(--text-heading)]"
          >
            Reconnecting. The code shows again when the connection is back.
          </p>
        ) : (
          <ModeModuleSkeleton rows={2} twoLine eyebrow />
        )}
      </section>
      {counts ? (
        <div role="group" aria-label="Attendance so far">
          <ModeFactTiles>
            {attendanceTiles(counts, expected).map((tile) => (
              <ModeFactTile key={tile.id} label={tile.label} value={tile.value} />
            ))}
          </ModeFactTiles>
        </div>
      ) : null}
      <ModeGroupedList mode="teaching">
        <TeachingRow
          title={shared ? "Stop sharing" : "Show on a shared screen"}
          subtitle={shared ? "The shared screen's link stops working" : "No sign-in needed. It shows the code only."}
          onClick={() => void toggleShared()}
          testId="teaching-checkin-share"
        />
        {shared ? (
          <TeachingRow
            title="Open the shared screen"
            subtitle={`Link works until ${perthTime(shared.expiresAt)}`}
            externalHref={shared.path}
          />
        ) : null}
      </ModeGroupedList>
      {error ? <ModeNotice tone="warning">{error}</ModeNotice> : null}
      <p className={cn("text-sm", textMuted)}>Presenters see counts only. Organisers see the named register.</p>
    </>
  );
}
