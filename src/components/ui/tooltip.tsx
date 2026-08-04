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
  type ReactNode,
} from "react";
import { OverlayPortal } from "@/components/ui/overlay-root";
import { cn } from "@/components/ui-primitives";

export type TooltipProps = {
  children: ReactElement<Record<string, unknown>>;
  content: ReactNode;
  placement?: "top" | "bottom";
  className?: string;
};

type Position = { left: number; top: number; placement: "top" | "bottom" };

export function Tooltip({ children, content, placement = "top", className }: TooltipProps) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ left: 0, top: 0, placement });
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
    const roomAbove = triggerRect.top - margin;
    const roomBelow = window.innerHeight - triggerRect.bottom - margin;
    const resolvedPlacement =
      placement === "top" && roomAbove < tooltipRect.height + gap && roomBelow > roomAbove
        ? "bottom"
        : placement === "bottom" && roomBelow < tooltipRect.height + gap && roomAbove > roomBelow
          ? "top"
          : placement;
    const unclampedLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
    const left = Math.max(margin, Math.min(unclampedLeft, window.innerWidth - tooltipRect.width - margin));
    const top =
      resolvedPlacement === "top"
        ? Math.max(margin, triggerRect.top - tooltipRect.height - gap)
        : Math.min(window.innerHeight - tooltipRect.height - margin, triggerRect.bottom + gap);
    setPosition({ left, top, placement: resolvedPlacement });
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
            data-testid="tooltip"
            data-placement={position.placement}
            style={{ position: "fixed", left: position.left, top: position.top }}
            className={cn(
              "pointer-events-none w-max max-w-xs rounded-md bg-[color:var(--surface-raised)] px-2 py-1 text-xs text-[color:var(--text)] shadow-[var(--shadow-hover)] ring-1 ring-[color:var(--border-lux)]",
              className,
            )}
          >
            {content}
          </span>
        </OverlayPortal>
      ) : null}
    </span>
  );
}
