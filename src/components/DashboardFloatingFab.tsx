"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, ClipboardCopy, Plus, Search, Wrench, X } from "lucide-react";
import { cn, floatingControl } from "@/components/ui-primitives";
import { useDismissableLayer } from "@/components/use-dismissable-layer";

export function DashboardFloatingFab() {
  const [open, setOpen] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const clearNotice = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
  }, []);

  const handleCopyLink = useCallback(() => {
    void navigator.clipboard.writeText(window.location.href).then(
      () => {
        setCopyNotice("Copied page link");
        clearNotice();
        timeoutRef.current = window.setTimeout(() => {
          setCopyNotice(null);
        }, 1700);
      },
      () => {
        setCopyNotice("Clipboard blocked, copy manually");
        clearNotice();
        timeoutRef.current = window.setTimeout(() => {
          setCopyNotice(null);
        }, 1700);
      },
    );
    setOpen(false);
  }, [clearNotice]);

  const handleFocusSearch = useCallback(() => {
    const candidates = document.querySelectorAll<HTMLInputElement>(
      'input[aria-label*="search" i], input[aria-label*="Search" i], input[placeholder*="search" i], input[type=\'search\']',
    );
    const target = candidates[0];
    if (target) {
      target.focus({ preventScroll: true });
    }
    setOpen(false);
  }, []);

  const handleScrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setOpen(false);
  }, []);

  // Clear any pending copy-notice timeout on unmount so it can't fire after the
  // component is gone (leaked timer / stray setState).
  useEffect(() => clearNotice, [clearNotice]);

  const dismissQuickActions = useCallback(() => setOpen(false), []);

  useDismissableLayer({
    enabled: open,
    refs: [rootRef],
    restoreFocusRef: triggerRef,
    onDismiss: dismissQuickActions,
  });

  return (
    <div ref={rootRef} className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-6">
      <div className="mx-auto flex w-full max-w-7xl justify-end">
        <div
          id="dashboard-fab-panel"
          className={cn(
            "pointer-events-auto relative mb-16 flex flex-col items-end gap-2 transition",
            open ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={!open}
        >
          <button
            type="button"
            onClick={handleFocusSearch}
            className={cn(floatingControl, "h-9 min-h-9 px-3 text-xs", !open && "hidden")}
          >
            <Search className="h-3.5 w-3.5" />
            Focus search
          </button>
          <button
            type="button"
            onClick={handleScrollTop}
            className={cn(floatingControl, "h-9 min-h-9 px-3 text-xs", !open && "hidden")}
          >
            <ArrowUp className="h-3.5 w-3.5" />
            Scroll top
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className={cn(floatingControl, "h-9 min-h-9 px-3 text-xs", !open && "hidden")}
          >
            <ClipboardCopy className="h-3.5 w-3.5" />
            Copy link
          </button>
          <Link
            href="/?mode=tools"
            onClick={() => setOpen(false)}
            className={cn(floatingControl, "h-9 min-h-9 px-3 text-xs", !open && "hidden")}
          >
            <Wrench className="h-3.5 w-3.5" />
            Tools
          </Link>
          {copyNotice && (
            <p className="rounded-md border border-white/20 bg-[color:var(--surface-raised)] px-3 py-2 text-xs text-[color:var(--text-muted)] shadow-[var(--shadow-soft)]">
              {copyNotice}
            </p>
          )}
        </div>
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls="dashboard-fab-panel"
          onClick={() => setOpen((current) => !current)}
          className={cn(
            floatingControl,
            "fixed right-5 bottom-5 z-50 h-12 min-h-12 w-12 rounded-full p-0 text-base shadow-[var(--shadow-lux)] bg-[color:var(--primary)] text-[color:var(--primary-contrast)] hover:bg-[color:var(--primary-strong)]",
          )}
        >
          {open ? <X className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
          <span className="sr-only">{open ? "Close quick actions" : "Open quick actions"}</span>
        </button>
      </div>
      {copyNotice && (
        <p className="sr-only" aria-live="polite">
          {copyNotice}
        </p>
      )}
    </div>
  );
}
