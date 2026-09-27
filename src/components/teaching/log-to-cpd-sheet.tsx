"use client";

import Link from "next/link";
import { useState } from "react";

import { focusRing } from "@/components/card-recipes";
import { durationMinutes } from "@/components/teaching/teaching-dates";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { cn } from "@/components/ui-primitives";
import { teachingErrorMessage, teachingPost } from "@/lib/teaching/client";
import { teachingCpdBodySchema, teachingCpdEntryHref } from "@/lib/teaching/model";

/** The scheduled length in quarter hours, the unit `POST /api/teaching/cpd` accepts. */
export function defaultCpdHours(session: { startsAt: string; endsAt: string }): string {
  return String(Math.max(1, Math.round(durationMinutes(session.startsAt, session.endsAt) / 15)) / 4);
}

export function parseCpdHours(raw: string): number | null {
  const hours = Number(raw.trim());
  if (!teachingCpdBodySchema.shape.hours.safeParse(hours).success) return null;
  return hours;
}

/**
 * Log one attended session to CPD (spec §9). One request id per mount, so a
 * double tap or a retry cannot log it twice. Links run one way, into CPD.
 */
export function LogToCpdSheet({
  open,
  onClose,
  occurrenceId,
  startsAt,
  endsAt,
  onLogged,
}: {
  open: boolean;
  onClose: () => void;
  occurrenceId: string;
  startsAt: string;
  endsAt: string;
  onLogged?: (entryId: string) => void;
}) {
  const [hours, setHours] = useState(() => defaultCpdHours({ startsAt, endsAt }));
  const [requestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ entryId: string; created: boolean } | null>(null);

  async function save() {
    const value = parseCpdHours(hours);
    if (value === null) {
      setError("Use quarter hours between 0.25 and 8, for example 1.25.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await teachingPost<{ entryId: string; created: boolean }>("/api/teaching/cpd", {
        occurrenceId,
        hours: value,
        requestId,
      });
      setSaved(result);
      onLogged?.(result.entryId);
    } catch (failure) {
      setError(teachingErrorMessage(failure, "cpd"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Log to CPD"
      footer={
        saved ? (
          <Button block onClick={onClose}>
            Done
          </Button>
        ) : (
          <Button variant="primary" block busy={busy} busyLabel="Saving" onClick={() => void save()}>
            Save to CPD
          </Button>
        )
      }
    >
      {saved ? (
        <div className="grid gap-2">
          <p className="text-base-minus text-[color:var(--text-heading)]">
            {saved.created ? "Logged to CPD." : "Already in your CPD record."}
          </p>
          <Link
            href={teachingCpdEntryHref(saved.entryId)}
            className={cn("inline-flex min-h-12 items-center text-sm text-[color:var(--primary)]", focusRing)}
          >
            Add a reflection in CPD
          </Link>
        </div>
      ) : (
        <TextField
          label="Hours"
          type="number"
          inputMode="decimal"
          step={0.25}
          min={0.25}
          max={8}
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          error={error ?? undefined}
        />
      )}
    </Sheet>
  );
}
