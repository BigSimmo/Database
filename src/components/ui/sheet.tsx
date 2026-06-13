"use client";

import { useEffect, useId, useRef, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";
import { cn, toolbarButton } from "@/components/ui-primitives";

/**
 * Responsive overlay: a bottom sheet on mobile (rises from the bottom, safe-area
 * aware, drag-grip) and a centred dialog from `sm:` up. CSS-only animation, no
 * portal/deps. Focus is trapped while open and returned to the opener on close;
 * Escape and backdrop click both dismiss. Mirrors the original GuideDialog
 * focus handling so behaviour is unchanged where it replaces a modal.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  closeLabel = "Close",
  labelledBy,
  initialFocusRef,
  contentClassName,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
  labelledBy?: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  contentClassName?: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;

    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => (initialFocusRef?.current ?? closeRef.current)?.focus());

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      previousActiveElement?.focus();
    };
  }, [open, onClose, initialFocusRef]);

  if (!open) return null;

  const resolvedLabelledBy = labelledBy ?? (title ? titleId : undefined);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 backdrop-blur-sm motion-safe:animate-overlay-in sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedLabelledBy}
        aria-describedby={description ? descId : undefined}
        onMouseDown={(event) => event.stopPropagation()}
        className={cn(
          "flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-elevated)] pb-safe motion-safe:animate-sheet-up",
          "sm:max-w-lg sm:rounded-2xl sm:pb-0 sm:motion-safe:animate-pop-in",
          contentClassName,
        )}
      >
        <div className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-[color:var(--border-strong)] sm:hidden" aria-hidden />
        {title ? (
          <div className="flex items-start justify-between gap-3 border-b border-[color:var(--border)] p-4 sm:p-5">
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-[color:var(--text-heading)]">
                {title}
              </h2>
              {description ? (
                <p id={descId} className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
                  {description}
                </p>
              ) : null}
            </div>
            <button ref={closeRef} type="button" onClick={onClose} aria-label={closeLabel} className={toolbarButton}>
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 polished-scroll sm:p-5">{children}</div>
        {footer ? <div className="shrink-0 border-t border-[color:var(--border)] p-3 sm:p-4">{footer}</div> : null}
      </div>
    </div>
  );
}
