"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";

interface SourcePreviewPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
}

/**
 * Controlled popover for the NaturalLanguageAnswer source capsule preview.
 * Renders inline (flow-position) below the anchor, matching the pre-refactor
 * <div> style. Closes on click-outside or Escape.
 *
 * The anchorRef (capsule button) is excluded from the click-outside handler so
 * that the button's own onClick toggle runs without racing with onClose.
 */
export function SourcePreviewPopover({ open, onClose, anchorRef, children }: SourcePreviewPopoverProps) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const anchorEl = anchorRef.current;
      const target = event.target as Node;
      // Exclude clicks on the anchor (capsule button) — its own onClick toggle
      // handles open/close. Only close when truly clicking outside both.
      const outsidePopover = popoverRef.current && !popoverRef.current.contains(target);
      const outsideAnchor = !anchorEl || !anchorEl.contains(target);
      if (outsidePopover && outsideAnchor) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return (
    <div
      ref={popoverRef}
      data-testid="source-capsule-preview"
      role="dialog"
      aria-label="Answer sources"
      className="max-h-[22rem] max-w-xl overflow-y-auto overscroll-contain rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-lux)] p-3 shadow-[var(--shadow-elevated)] motion-safe:animate-pop-in"
    >
      {children}
    </div>
  );
}
