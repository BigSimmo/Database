"use client";

import {
  useEffect,
  useId,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn, toolbarButton } from "@/components/ui-primitives";
import {
  canRestoreFocusTo,
  isTopmostSheet,
  popSheet,
  pushSheet,
  startSheetOpenFocus,
  type SheetFocusController,
} from "@/components/ui/sheet-focus";

export type SheetMobileSize = "content" | "viewport";

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
  headerClassName,
  titleClassName,
  closeButtonClassName,
  contentClassName,
  contentStyle,
  bodyClassName,
  placement = "default",
  mobilePlacement = "bottom",
  mobileSize = "content",
  portal = false,
  desktopBackdropClassName,
  testId,
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
  headerClassName?: string;
  titleClassName?: string;
  closeButtonClassName?: string;
  contentClassName?: string;
  contentStyle?: CSSProperties;
  bodyClassName?: string;
  placement?: "default" | "left";
  mobilePlacement?: "bottom" | "top" | "fullscreen";
  mobileSize?: SheetMobileSize;
  portal?: boolean;
  desktopBackdropClassName?: string;
  testId?: string;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const dragRef = useRef<{ startY: number; dragging: boolean }>({ startY: 0, dragging: false });
  // Backdrop dismiss must require the gesture to *start* on the dimmed area.
  // Otherwise a press that begins on the panel and ends on the backdrop would
  // synthesize a click on the common ancestor and accidentally close the sheet.
  const backdropPointerDownRef = useRef(false);
  // Pending focus-restore timers from the previous close. Cleared on the next
  // open and on unmount so a torn-down jsdom environment cannot throw from a
  // stale 50ms retry under Vitest coverage workers, and so a fast
  // close-then-reopen cannot restore focus to the opener mid-open.
  const restoreTimersRef = useRef<{ frame: number | null; timeout: number | null }>({
    frame: null,
    timeout: null,
  });
  const openFocusRef = useRef<SheetFocusController | null>(null);
  const unmountingRef = useRef(false);
  const titleId = useId();
  const descId = useId();
  const sheetId = useId();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    unmountingRef.current = false;
    const restoreTimers = restoreTimersRef.current;
    return () => {
      unmountingRef.current = true;
      if (restoreTimers.frame != null) {
        window.cancelAnimationFrame(restoreTimers.frame);
        restoreTimers.frame = null;
      }
      if (restoreTimers.timeout != null) {
        window.clearTimeout(restoreTimers.timeout);
        restoreTimers.timeout = null;
      }
      openFocusRef.current?.cancel();
      openFocusRef.current = null;
    };
  }, []);

  // Swipe-to-dismiss for the mobile bottom sheet: dragging the grip down past a
  // threshold closes the sheet; a shorter drag snaps back. Grip-initiated only,
  // so it never competes with scrolling the sheet body. Keyboard/backdrop/close
  // dismissal is unaffected.
  function handleGripPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const panel = panelRef.current;
    if (!panel) return;
    dragRef.current = { startY: event.clientY, dragging: true };
    panel.style.transition = "none";
    // Release the entry animation's `both` fill so the inline drag transform is
    // not overridden by the finished keyframes (CSS animations beat inline style).
    panel.style.animation = "none";
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleGripPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current.dragging) return;
    const delta = Math.max(0, event.clientY - dragRef.current.startY);
    if (panelRef.current) panelRef.current.style.transform = `translateY(${delta}px)`;
  }

  function handleGripPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragRef.current.dragging) return;
    const delta = Math.max(0, event.clientY - dragRef.current.startY);
    dragRef.current = { startY: 0, dragging: false };
    const panel = panelRef.current;
    if (panel) {
      // Restore the class-based transition so a non-dismiss snaps back smoothly.
      panel.style.transition = "";
      panel.style.transform = "";
    }
    if (delta > 96) onClose();
  }

  useEffect(() => {
    if (!open) return;

    const explicitReturnElement = returnFocusRef?.current ?? null;
    const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreTimers = restoreTimersRef.current;
    // A close-then-reopen inside one frame leaves this instance's own restore
    // scheduled; left pending it pulls focus back to the opener mid-open.
    if (restoreTimers.frame != null) {
      window.cancelAnimationFrame(restoreTimers.frame);
      restoreTimers.frame = null;
    }
    if (restoreTimers.timeout != null) {
      window.clearTimeout(restoreTimers.timeout);
      restoreTimers.timeout = null;
    }
    openFocusRef.current?.cancel();

    pushSheet(sheetId, backdropRef.current);
    openFocusRef.current = startSheetOpenFocus({
      sheetId,
      getPanel: () => panelRef.current,
      // The close button is only a fallback: the controller upgrades to a
      // deferred `data-sheet-autofocus` child (lazy DocumentDrawer Find field /
      // UtilityDrawer) as soon as it mounts.
      resolveTarget: () =>
        initialFocusRef?.current ??
        panelRef.current?.querySelector<HTMLElement>('[data-sheet-autofocus="true"]') ??
        closeRef.current,
    });

    function onKeyDown(event: KeyboardEvent) {
      // Only the top-most open Sheet reacts, so a stacked overlay (lightbox /
      // table dialog over the Evidence sheet) does not also close on one Escape
      // or fight over the Tab focus trap. Lower sheets registered their listener
      // earlier and fire first, so they self-suppress here without needing to
      // stop propagation.
      if (!isTopmostSheet(sheetId)) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          // Exclude tabindex="-1" buttons so roving-tabindex menus (e.g. Mode
          // options) do not dump every inactive item into the Tab cycle.
          'a[href], button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter(
        (element) =>
          !element.hasAttribute("disabled") &&
          element.getAttribute("aria-hidden") !== "true" &&
          !element.closest('[aria-hidden="true"], [inert]') &&
          element.getClientRects().length > 0,
      );
      if (focusable.length === 0) return;

      const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      const currentIndex = activeElement ? focusable.indexOf(activeElement) : -1;
      const nextIndex =
        currentIndex === -1
          ? event.shiftKey
            ? focusable.length - 1
            : 0
          : event.shiftKey
            ? (currentIndex - 1 + focusable.length) % focusable.length
            : (currentIndex + 1) % focusable.length;

      // Move focus explicitly instead of relying on platform Tab preferences.
      // Firefox can otherwise leave programmatically focused buttons out of the
      // native sequence, which makes the modal trap inconsistent by browser.
      event.preventDefault();
      focusable[nextIndex].focus();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      openFocusRef.current?.cancel();
      openFocusRef.current = null;
      popSheet(sheetId);
      const restoreTarget = explicitReturnElement ?? previousActiveElement;
      if (restoreTimers.frame != null) {
        window.cancelAnimationFrame(restoreTimers.frame);
        restoreTimers.frame = null;
      }
      if (restoreTimers.timeout != null) {
        window.clearTimeout(restoreTimers.timeout);
        restoreTimers.timeout = null;
      }
      if (unmountingRef.current) return;
      // Focus restore is best-effort. Under Vitest coverage workers the jsdom
      // `document` can be torn down before this rAF/setTimeout pair fires; bare
      // `document` access then becomes an unhandled ReferenceError that fails
      // the whole suite even when every test assertion passed.
      restoreTimers.frame = window.requestAnimationFrame(() => {
        restoreTimers.frame = null;
        if (typeof document === "undefined" || !restoreTarget?.isConnected) return;
        // A sheet opened while this one was closing (switching between two
        // sheets in one tick) now owns focus. Instances cannot cancel each
        // other's timers, so the stack is the only place this is knowable —
        // without it the new sheet has to fight the restore back. Handing
        // focus back down to a sheet this one was stacked on still restores.
        if (!canRestoreFocusTo(restoreTarget)) return;
        restoreTarget.focus({ preventScroll: true });
        restoreTimers.timeout = window.setTimeout(() => {
          restoreTimers.timeout = null;
          if (typeof document === "undefined") return;
          // Only retry when focus fell through to the document body. If another
          // surface (e.g. a Guide dialog opened from a phone menu sheet) already
          // took focus, do not steal it back.
          if (
            !restoreTarget.isConnected ||
            !canRestoreFocusTo(restoreTarget) ||
            document.activeElement === restoreTarget ||
            (document.activeElement !== document.body && document.activeElement != null)
          ) {
            return;
          }
          restoreTarget.focus({ preventScroll: true });
        }, 50);
      });
    };
  }, [open, initialFocusRef, returnFocusRef, sheetId]);

  if (!open) return null;

  const resolvedLabelledBy = labelledBy ?? (title ? titleId : undefined);
  const defaultSheetIsFullscreen = placement !== "left" && mobilePlacement === "fullscreen";
  const defaultSheetIsTopAligned = placement !== "left" && mobilePlacement === "top";
  const defaultSheetUsesViewportSize = placement !== "left" && mobileSize === "viewport";

  const sheet = (
    <div
      ref={backdropRef}
      className={cn(
        "fixed inset-0 z-[100] flex bg-[color:var(--overlay-backdrop)] backdrop-blur-[2px] motion-reduce:animate-none motion-reduce:transition-none",
        desktopBackdropClassName,
        placement !== "left" && "motion-safe:animate-overlay-in",
        placement === "left"
          ? "items-stretch justify-start"
          : defaultSheetIsFullscreen
            ? "items-stretch justify-center p-0 lg:items-center lg:p-6"
            : defaultSheetIsTopAligned
              ? "items-start justify-center px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:items-center sm:p-6"
              : "items-end justify-center sm:items-center sm:p-6",
      )}
      // Dismiss on click (not pointerdown) so the sheet stays mounted through
      // pointerup and the same gesture cannot click-through into content below.
      // Only honor the click when the pointerdown also began on the backdrop.
      onPointerDown={(event) => {
        backdropPointerDownRef.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || !backdropPointerDownRef.current) return;
        backdropPointerDownRef.current = false;
        onClose();
      }}
    >
      <div
        ref={panelRef}
        data-testid={testId}
        role="dialog"
        aria-modal="true"
        aria-labelledby={resolvedLabelledBy}
        aria-describedby={description || descriptionContent ? descId : undefined}
        onPointerDown={(event) => {
          backdropPointerDownRef.current = false;
          event.stopPropagation();
        }}
        style={contentStyle}
        className={cn(
          "flex min-w-0 w-full flex-col overflow-hidden border border-[color:var(--border-lux)] bg-[color:var(--surface-raised)] text-[color:var(--text)] shadow-[var(--shadow-elevated)] pb-safe",
          "transition duration-200 motion-reduce:transition-none sm:duration-150",
          placement === "left"
            ? "h-full max-h-full max-w-[min(22rem,calc(100vw-1rem))] rounded-r-2xl border-y-0 border-l-0 pt-safe sm:max-h-dvh sm:max-w-[22rem] sm:rounded-l-none sm:rounded-r-2xl sm:pb-0"
            : cn(
                defaultSheetIsFullscreen
                  ? // Fullscreen panels size from the inset-0 backdrop (h-full), not
                    // 100dvh: iOS Safari resolves dvh stale across toolbar
                    // collapse, which strands a dead band under the sheet.
                    "h-full max-h-full rounded-none border-0 motion-safe:animate-pop-in sm:max-w-none sm:rounded-none lg:h-auto lg:max-h-[calc(100dvh-3rem)] lg:rounded-2xl lg:border lg:border-[color:var(--border-lux)] lg:pb-0 lg:motion-safe:animate-dialog-rise"
                  : cn(
                      "sm:max-w-lg sm:rounded-2xl sm:pb-0 sm:motion-safe:animate-dialog-rise",
                      defaultSheetIsTopAligned
                        ? cn(
                            "max-h-[calc(100dvh-1.5rem)] rounded-2xl motion-safe:animate-pop-in",
                            defaultSheetUsesViewportSize && "min-h-[calc(100dvh-2rem)] sm:min-h-0",
                          )
                        : cn(
                            "rounded-t-2xl motion-safe:animate-sheet-up",
                            defaultSheetUsesViewportSize
                              ? "min-h-[calc(100dvh-2rem)] max-h-[calc(100dvh-1rem)] sm:min-h-0"
                              : // Skip a default max-h when the caller already caps height via
                                // contentClassName — cn() does not last-win Tailwind utilities,
                                // so two unprefixed max-h-* classes race in CSS source order.
                                /\bmax-h-/.test(contentClassName ?? "")
                                ? undefined
                                : "max-h-[calc(100dvh-2rem)] sm:max-h-[88dvh]",
                          ),
                    ),
              ),
          "motion-reduce:animate-none",
          contentClassName,
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full shrink-0 cursor-grab touch-none justify-center pb-1 pt-2 active:cursor-grabbing sm:hidden",
            placement === "left" && "hidden",
            defaultSheetIsFullscreen && "hidden",
            defaultSheetIsTopAligned && "hidden",
          )}
          aria-hidden
          onPointerDown={handleGripPointerDown}
          onPointerMove={handleGripPointerMove}
          onPointerUp={handleGripPointerUp}
          onPointerCancel={handleGripPointerUp}
        >
          <span className="h-1 w-9 rounded-full bg-[color:var(--border-strong)]" />
        </div>
        {title ? (
          <div
            className={cn(
              "flex items-center justify-between gap-3 border-b border-[color:var(--border)] p-4 sm:p-5",
              headerClassName,
            )}
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              {headerLeading ? <div className="shrink-0">{headerLeading}</div> : null}
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2
                    id={titleId}
                    className={cn("truncate text-lg font-semibold text-[color:var(--text-heading)]", titleClassName)}
                  >
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
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className={closeButtonClassName ?? toolbarButton}
              >
                <X aria-hidden="true" className="h-4 w-4" />
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
