"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactElement,
} from "react";
import { OverlayPortal } from "@/components/ui/overlay-root";
import { cn } from "@/components/ui-primitives";

export type TooltipProps = {
  children: ReactElement<Record<string, unknown>>;
  /** Plain supplementary text so the trigger always has a complete description. */
  content: string;
  placement?: "top" | "bottom";
  className?: string;
};

type Position = {
  left: number;
  top: number;
  placement: "top" | "bottom";
  maxWidth?: number;
  maxHeight?: number;
};

export function Tooltip({ children, content, placement = "top", className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  // Start off-viewport so the first paint cannot flash at (0, 0) before measure.
  const [position, setPosition] = useState<Position>({ left: -10_000, top: -10_000, placement });
  const triggerWrapRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerWrapRef.current;
    const tooltip = tooltipRef.current;
    if (!trigger || !tooltip) return;
    const triggerRect = trigger.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const gap = 6;
    const margin = 8;
    const horizontalMargin = Math.min(margin, Math.max(0, window.innerWidth / 2));
    const verticalMargin = Math.min(margin, Math.max(0, window.innerHeight / 2));
    const maxWidth = Math.max(0, Math.min(320, window.innerWidth - horizontalMargin * 2));
    const maxHeight = Math.max(0, window.innerHeight - verticalMargin * 2);
    const width = Math.min(tooltipRect.width, maxWidth);
    const height = Math.min(tooltipRect.height, maxHeight);
    const roomAbove = triggerRect.top - verticalMargin;
    const roomBelow = window.innerHeight - triggerRect.bottom - verticalMargin;
    const resolvedPlacement =
      placement === "top" && roomAbove < height + gap && roomBelow > roomAbove
        ? "bottom"
        : placement === "bottom" && roomBelow < height + gap && roomAbove > roomBelow
          ? "top"
          : placement;
    const unclampedLeft = triggerRect.left + triggerRect.width / 2 - width / 2;
    const maximumLeft = Math.max(horizontalMargin, window.innerWidth - width - horizontalMargin);
    const left = Math.max(horizontalMargin, Math.min(unclampedLeft, maximumLeft));
    const desiredTop = resolvedPlacement === "top" ? triggerRect.top - height - gap : triggerRect.bottom + gap;
    const maximumTop = Math.max(verticalMargin, window.innerHeight - height - verticalMargin);
    const top = Math.max(verticalMargin, Math.min(desiredTop, maximumTop));
    setPosition({ left, top, placement: resolvedPlacement, maxWidth, maxHeight });
  }, [placement]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  if (!isValidElement(children)) return <>{children}</>;

  const childProps = children.props as Record<string, unknown>;
  const compose =
    <E,>(ours: (event: E) => void, theirs?: unknown) =>
    (event: E) => {
      if (typeof theirs === "function") (theirs as (event: E) => void)(event);
      ours(event);
    };
  const describedBy = [childProps["aria-describedby"], open ? id : null].filter(Boolean).join(" ") || undefined;

  const trigger = cloneElement(children, {
    "aria-describedby": describedBy,
    onMouseEnter: compose(() => setOpen(true), childProps.onMouseEnter),
    onMouseLeave: compose(() => setOpen(false), childProps.onMouseLeave),
    onFocus: compose(() => setOpen(true), childProps.onFocus),
    onBlur: compose(() => setOpen(false), childProps.onBlur),
    onKeyDown: compose((event: React.KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    }, childProps.onKeyDown),
  });

  return (
    <span ref={triggerWrapRef} className="inline-flex">
      {trigger}
      {open ? (
        <OverlayPortal layer="popover" name="tooltip">
          <span
            ref={tooltipRef}
            role="tooltip"
            id={id}
            aria-label={content}
            data-testid="tooltip"
            data-placement={position.placement}
            style={{
              position: "fixed",
              left: position.left,
              top: position.top,
              maxWidth: position.maxWidth ?? "min(20rem, calc(100vw - 1rem))",
            }}
            className={cn(
              "pointer-events-none w-max max-w-xs rounded-md bg-[color:var(--surface-raised)] px-2 py-1 text-xs text-[color:var(--text)] shadow-[var(--shadow-hover)] ring-1 ring-[color:var(--border-lux)]",
              className,
            )}
          >
            <span
              aria-hidden="true"
              data-testid="tooltip-visual"
              className="block overflow-hidden"
              style={{ maxHeight: position.maxHeight ?? "calc(100vh - 1rem)" }}
            >
              {content}
            </span>
            <span data-testid="tooltip-description" className="sr-only">
              {content}
            </span>
          </span>
        </OverlayPortal>
      ) : null}
    </span>
  );
}
