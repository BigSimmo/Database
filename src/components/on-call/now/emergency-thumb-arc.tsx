"use client";

import { AlertTriangle, ChevronDown, Phone, ShieldAlert, Stethoscope, UserCheck, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { focusRing } from "@/components/card-recipes";
import { cn } from "@/components/ui-primitives";
import type { HandbookItem } from "@/lib/on-call/handbook-items";
import { onCallTelHref } from "@/lib/on-call/home-modules";

export type EmergencyThumbAction = {
  readonly id: string;
  readonly label: string;
  readonly role: string;
  readonly number: string;
  readonly icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  readonly urgent?: boolean;
};

export function EmergencyThumbArc({
  pins = [],
  switchboardNumber,
  consultantNumber,
  medRegNumber,
  isNightShift = false,
  testId = "on-call-emergency-thumb-arc",
}: {
  readonly pins?: readonly HandbookItem[];
  readonly switchboardNumber?: string | null;
  readonly consultantNumber?: string | null;
  readonly medRegNumber?: string | null;
  readonly isNightShift?: boolean;
  readonly testId?: string;
}) {
  const [open, setOpen] = useState(false);

  const triggerHaptic = useCallback(() => {
    if (typeof window !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(15);
      } catch {
        // Ignored if browser restricts vibration
      }
    }
  }, []);

  const toggle = useCallback(() => {
    triggerHaptic();
    setOpen((prev) => !prev);
  }, [triggerHaptic]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const emergencyDial = pins[0]?.mobileDial ?? pins[0]?.dial;
  const emergencyNumber = (emergencyDial && "display" in emergencyDial ? emergencyDial.display : null) ?? "55";

  // Priority contacts: Code Black / Emergency Pin -> Switchboard -> Consultant -> Med Reg -> Security
  const defaultActions: EmergencyThumbAction[] = [
    {
      id: "emergency-code-black",
      label: "Code Black / Emergency",
      role: "Immediate Emergency",
      number: emergencyNumber,
      icon: ShieldAlert,
      urgent: true,
    },
    {
      id: "switchboard",
      label: "Switchboard",
      role: "Hospital Operator",
      number: switchboardNumber ?? "08 9224 2244",
      icon: Phone,
    },
    {
      id: "on-call-consultant",
      label: "On-Call Consultant",
      role: "Psychiatry Escalation",
      number: consultantNumber ?? "08 9224 2244",
      icon: UserCheck,
    },
    {
      id: "med-reg",
      label: "Medical Registrar",
      role: "Medical Deterioration",
      number: medRegNumber ?? "08 9224 2244",
      icon: Stethoscope,
    },
  ];

  return (
    <div
      data-testid={testId}
      className={cn("fixed bottom-4 right-4 z-40 sm:bottom-6 sm:right-6", isNightShift && "dark")}
    >
      {/* Backdrop when expanded */}
      {open && (
        <div
          data-testid={`${testId}-backdrop`}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
          aria-hidden="true"
        />
      )}

      {/* Radial Fan / List of Emergency Actions */}
      {open && (
        <div
          id={`${testId}-tray`}
          role="region"
          aria-label="Emergency Speed Dial Contacts"
          data-testid={`${testId}-tray`}
          className="absolute bottom-16 right-0 z-40 mb-2 flex w-72 flex-col gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-raised)]/95 p-3 shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-4 fade-in duration-200"
        >
          <div className="flex items-center justify-between border-b border-[color:var(--border-subtle)] pb-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--text-muted)]">
              Emergency Speed-Dial
            </span>
            <span className="text-2xs text-[color:var(--text-muted)]">Tap to call</span>
          </div>

          <div className="flex flex-col gap-1.5" role="list">
            {defaultActions.map((action) => {
              const Icon = action.icon;
              const tel =
                onCallTelHref(action.number) ??
                (action.number.startsWith("tel:") ? action.number : `tel:${action.number.replace(/\s+/g, "")}`);
              return (
                <a
                  key={action.id}
                  href={tel}
                  role="listitem"
                  onClick={triggerHaptic}
                  data-testid={`${testId}-action-${action.id}`}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors active:scale-98",
                    action.urgent
                      ? "bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 dark:bg-rose-950/40 dark:text-rose-300"
                      : "bg-[color:var(--surface-subtle)] text-[color:var(--text-heading)] hover:bg-[color:var(--surface-inset)]",
                    focusRing,
                  )}
                >
                  <span
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-full",
                      action.urgent
                        ? "bg-rose-600 text-white"
                        : "bg-[color:var(--surface-inset)] text-[color:var(--text)]",
                    )}
                    aria-hidden="true"
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium leading-tight">{action.label}</span>
                    <span className="truncate text-2xs text-[color:var(--text-muted)]">
                      {action.role} · {action.number}
                    </span>
                  </div>
                  <Phone className="size-4 shrink-0 text-[color:var(--text-muted)]" aria-hidden="true" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Floating Action Trigger Disc */}
      <button
        type="button"
        data-testid={`${testId}-trigger`}
        aria-expanded={open}
        aria-controls={`${testId}-tray`}
        aria-label={open ? "Close emergency speed-dial" : "Open emergency speed-dial"}
        onClick={toggle}
        className={cn(
          "relative grid size-14 place-items-center rounded-full shadow-lg transition-transform active:scale-95",
          open
            ? "bg-[color:var(--surface-raised)] text-[color:var(--text-heading)] border border-[color:var(--border)]"
            : "bg-rose-600 text-white hover:bg-rose-700",
          focusRing,
        )}
      >
        {open ? (
          <X className="size-6" aria-hidden="true" />
        ) : (
          <div className="grid place-items-center">
            <ShieldAlert className="size-6" aria-hidden="true" />
            <span className="sr-only">Emergency speed dial</span>
          </div>
        )}
      </button>
    </div>
  );
}
