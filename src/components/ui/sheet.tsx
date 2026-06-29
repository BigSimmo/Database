"use client";

import { useEffect, useId, useRef, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
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
  returnFocusRef,
  headerLeading,
  titleAccessory,
  descriptionContent,
  headerActions,
  contentClassName,
  contentStyle,
  bodyClassName,
  placement = "default",
  portal = false,
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
  returnFocusRef?: RefObject<HTMLElement | null>;
  headerLeading?: ReactNode;
  titleAccessory?: ReactNode;
  descriptionContent?: ReactNode;
  headerActions?: ReactNode;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  bodyClassName?: string;
  placement?: "default" | "left";
  portal?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    if (!open) return;

    const explicitReturnElement = returnFocusRef?.current ?? null;
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
      if (panelRef.current && !panelRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
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
      const restoreTarget = explicitReturnElement ?? previousActiveElement;
      window.requestAnimationFrame(() => {
        if (restoreTarget?.isConnected) restoreTarget.focus({ preventScroll: true });
      });
    };
  }, [open, onClose, initialFocusRef, returnFocusRef]);

  if (!open) return null;

  const resolvedLabelledBy = labelledBy ?? (title ? titleId : undefined);

  const sheet = (
    <div
      className={cn(
        "fixed inset-0 z-[100] flex bg-black/45 backdrop-blur-[2px] motion-reduce:animate-none motion-reduce:transition-none",
        placement !== "left" && "motion-safe:animate-overlay-in",
        placement === "left" ? "items-stretch justify-start" : "items-end justify-center sm:items-center sm:p-6",
      )}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedLabelledBy}
        aria-describedby={description || descriptionContent ? descId : undefined}
        onPointerDown={(event) => event.stopPropagation()}
        style={contentStyle}
        className={cn(
          "flex min-w-0 w-full flex-col overflow-hidden border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-elevated)] pb-safe",
          "transition duration-200 motion-reduce:transition-none sm:duration-150",
          placement === "left"
            ? "h-full max-h-dvh max-w-[min(22rem,calc(100vw-1rem))] rounded-r-2xl border-y-0 border-l-0 sm:max-h-dvh sm:max-w-[22rem] sm:rounded-l-none sm:rounded-r-2xl sm:pb-0"
            : "max-h-[88dvh] rounded-t-2xl motion-safe:animate-sheet-up sm:max-w-lg sm:rounded-2xl sm:pb-0 sm:motion-safe:animate-pop-in",
          "motion-reduce:animate-none",
          contentClassName,
        )}
      >
        <div
          className={cn(
            "mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-[color:var(--border-strong)] sm:hidden",
            placement === "left" && "hidden",
          )}
          aria-hidden
        />
        {title ? (
          <div className="flex items-center justify-between gap-3 border-b border-[color:var(--border)] p-4 sm:p-5">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {headerLeading ? <div className="shrink-0">{headerLeading}</div> : null}
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2 id={titleId} className="truncate text-lg font-semibold text-[color:var(--text-heading)]">
                    {title}
                  </h2>
                  {titleAccessory}
                </div>
                {descriptionContent ? (
                  <div id={descId} className="mt-1">
                    {descriptionContent}
                  </div>
                ) : description ? (
                  <p id={descId} className="mt-1 text-sm leading-6 text-[color:var(--text-muted)]">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {headerActions}
              <button ref={closeRef} type="button" onClick={onClose} aria-label={closeLabel} className={toolbarButton}>
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
        <div className={cn("min-h-0 min-w-0 flex-1 overflow-y-auto p-4 polished-scroll sm:p-5", bodyClassName)}>
          {children}
        </div>
        {footer ? <div className="shrink-0 border-t border-[color:var(--border)] p-3 sm:p-4">{footer}</div> : null}
      </div>
    </div>
  );

  if (portal) {
    if (typeof document === "undefined") return null;
    return createPortal(sheet, document.body);
  }

  return sheet;
}
