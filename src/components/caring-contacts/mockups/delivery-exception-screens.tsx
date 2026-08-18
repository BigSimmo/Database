"use client";

import { AlertTriangle, ClipboardCheck, RefreshCcw, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

import { DefinitionRow, OperationalStatus } from "./mockup-primitives";

export function DeliveryExceptionScreens() {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(true);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setCompact(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <section className="min-w-0 rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-raised)] p-[var(--pad-panel)] shadow-[var(--rule-warning)]">
      <div className="grid min-w-0 gap-[var(--gap-stack)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex items-start gap-[var(--gap-inline)]">
          <AlertTriangle aria-hidden="true" className="mt-1 size-icon-lg shrink-0 text-[color:var(--warning)]" />
          <div>
            <h2 className="text-xl font-semibold">Permanent delivery exception</h2>
            <p className="mt-1 text-sm text-[color:var(--text-muted)]">
              Inspect bounded transport evidence without interpreting patient safety, wellbeing or engagement.
            </p>
          </div>
        </div>
        <Button ref={triggerRef} variant="primary" onClick={() => setOpen(true)}>
          Open permanent delivery exception
        </Button>
      </div>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Permanent delivery exception"
        description="Contextual right drawer on desktop; full-screen phone sheet on compact layouts."
        closeLabel="Close delivery exception"
        returnFocusRef={triggerRef}
        mobilePlacement="fullscreen"
        placement={compact ? "default" : "left"}
        desktopBackdropClassName="justify-end"
        contentStyle={compact ? undefined : { marginLeft: "auto" }}
        contentClassName={compact ? undefined : "sm:max-w-lg sm:rounded-l-2xl sm:rounded-r-none sm:border-r-0"}
        testId="caring-contact-delivery-exception-sheet"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Keep task open
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              Record operational review
            </Button>
          </div>
        }
      >
        <div className="space-y-[var(--gap-block)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">Contact 4 of 10 · fictional record</p>
            <OperationalStatus tone="danger">Not delivered</OperationalStatus>
          </div>
          <p className="rounded-[var(--radius-md)] border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] p-[var(--pad-card)] text-sm font-medium text-[color:var(--text)]">
            This is a transport exception. It does not indicate patient safety, receipt, wellbeing or response.
          </p>
          <dl className="text-sm">
            <DefinitionRow term="Attempt 1">5:00:05 pm AWST · transient carrier rejection</DefinitionRow>
            <DefinitionRow term="Attempt 2">5:02:05 pm AWST · transient carrier rejection</DefinitionRow>
            <DefinitionRow term="Attempt 3">5:04:05 pm AWST · permanent rejection</DefinitionRow>
            <DefinitionRow term="Retry boundary">
              3 attempts total; no more retries and never outside the original window
            </DefinitionRow>
            <DefinitionRow term="Plan effect">Future contacts paused pending operational review</DefinitionRow>
          </dl>
          <section className="border-t border-[color:var(--border)] pt-[var(--gap-stack)]">
            <div className="flex items-start gap-2">
              <ClipboardCheck
                aria-hidden="true"
                className="mt-0.5 size-icon-md shrink-0 text-[color:var(--clinical-accent)]"
              />
              <div>
                <h3 className="font-semibold">Same-day operational task</h3>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Owner: Alex Example. Review source mobile evidence and choose the appropriate operational remedy
                  today.
                </p>
              </div>
            </div>
          </section>
          <section className="border-t border-[color:var(--border)] pt-[var(--gap-stack)]">
            <div className="flex items-start gap-2">
              <ShieldAlert aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 text-[color:var(--warning)]" />
              <div>
                <h3 className="font-semibold">No automatic clinical follow-up</h3>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Transport failure creates no risk score, clinical priority, wellbeing inference or automated patient
                  contact.
                </p>
              </div>
            </div>
          </section>
          <section className="border-t border-[color:var(--border)] pt-[var(--gap-stack)]">
            <div className="flex items-start gap-2">
              <RefreshCcw aria-hidden="true" className="mt-0.5 size-icon-md shrink-0 text-[color:var(--text-muted)]" />
              <div>
                <h3 className="font-semibold">Source write-back and audit</h3>
                <p className="mt-1 text-sm text-[color:var(--text-muted)]">
                  Structured milestone: permanent transport failure recorded and plan paused. Complete attempt evidence
                  remains in Callback. Privacy-safe outcome: “Operational review recorded.”
                </p>
              </div>
            </div>
          </section>
        </div>
      </Sheet>
    </section>
  );
}
