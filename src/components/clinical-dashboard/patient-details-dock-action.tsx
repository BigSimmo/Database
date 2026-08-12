"use client";

import { ChevronRight, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { PatientProfilePanel } from "@/components/clinical-dashboard/patient-profile-panel";
import { usePatientProfile } from "@/components/clinical-dashboard/patient-profile-context";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/components/ui-primitives";
import { patientDetailsAddonSlotId } from "@/lib/mode-home-composer";

/**
 * The phone "Patient details" pill, docked above the search composer on the
 * medication and prescribing surfaces.
 *
 * It is NOT independently fixed-positioned. Like the Differentials Compare bar
 * it portals into a slot *inside* the phone dock's form, so it inherits the
 * dock's `position: fixed`, z-index, safe-area padding and — the point of the
 * exercise — its scroll-hide transform. There is no bottom-offset arithmetic
 * here and no second scroll listener; the composer hides, this hides with it.
 *
 * The media query is 639px to match the dock (`.phone-footer-layer` is
 * `sm:fixed`), deliberately NOT the 1023px the two Compare bars use. Their
 * wider gate means that between 640px and 1023px they render into a slot on a
 * form that is not fixed — a latent bug this component does not copy.
 */
export function PatientDetailsDockAction() {
  const { profile, isEmpty } = usePatientProfile();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const phoneMediaQuery = window.matchMedia("(max-width: 639px)");
    let observer: MutationObserver | null = null;

    const syncHost = () => {
      setHost(document.getElementById(patientDetailsAddonSlotId));
    };

    const attachObserver = () => {
      if (observer) return;
      observer = new MutationObserver(syncHost);
      observer.observe(document.body, { childList: true, subtree: true });
    };

    const detachObserver = () => {
      observer?.disconnect();
      observer = null;
    };

    const onMediaChange = () => {
      if (phoneMediaQuery.matches) {
        syncHost();
        attachObserver();
      } else {
        setHost(null);
        detachObserver();
      }
    };

    // Initial state
    onMediaChange();
    phoneMediaQuery.addEventListener("change", onMediaChange);

    return () => {
      phoneMediaQuery.removeEventListener("change", onMediaChange);
      detachObserver();
    };
  }, []);

  // Count the entered dimensions, not just the medications, so the badge means
  // "how much context is loaded" rather than "how many drugs".
  const enteredCount = countEnteredFields(profile);

  const sheet = (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title="Patient details"
      description="Anonymous physiology and current medications. Cleared when the tab closes."
      mobilePlacement="bottom"
      testId="patient-details-sheet"
    >
      <PatientProfilePanel variant="compact" defaultOpen />
    </Sheet>
  );

  if (!host) {
    // Above the phone breakpoint the panel is already inline on these surfaces,
    // so there is nothing to render — but keep the sheet mounted if it is open
    // so a resize mid-edit does not drop the dialog and the focus with it.
    return open ? sheet : null;
  }

  return (
    <>
      {createPortal(
        <div className="patient-details-fab">
          <button
            type="button"
            onClick={() => setOpen(true)}
            data-testid="patient-details-dock-action"
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn("patient-details-fab__button", !isEmpty && "patient-details-fab__button--active")}
          >
            <UserRound className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="truncate">Patient details</span>
            {enteredCount > 0 ? (
              <span className="nums patient-details-fab__count" aria-hidden="true">
                {enteredCount}
              </span>
            ) : null}
            {/* The count is decorative; the real state goes to assistive tech here. */}
            <span className="sr-only">
              {isEmpty ? "No patient details entered" : `${enteredCount} details entered`}
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 opacity-70" aria-hidden="true" />
          </button>
        </div>,
        host,
      )}
      {sheet}
    </>
  );
}

/** How many profile dimensions carry a value. Drives the pill's count badge. */
function countEnteredFields(profile: {
  ageYears?: number | null;
  egfr?: number | null;
  crcl?: number | null;
  scr?: number | null;
  qtc?: number | null;
  hepatic?: string | null;
  pregnant?: boolean;
  breastfeeding?: boolean;
  allergies?: string[];
  medications?: string[];
}): number {
  let count = 0;
  for (const value of [profile.ageYears, profile.egfr, profile.crcl, profile.scr, profile.qtc]) {
    if (typeof value === "number" && Number.isFinite(value)) count += 1;
  }
  if (profile.hepatic && profile.hepatic !== "none") count += 1;
  if (profile.pregnant) count += 1;
  if (profile.breastfeeding) count += 1;
  count += profile.allergies?.length ?? 0;
  count += profile.medications?.length ?? 0;
  return count;
}
