"use client";

import { Clipboard, ClipboardCheck, Phone, Share2, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";

import { focusRing } from "@/components/card-recipes";
import { ModeActionButton } from "@/components/mode-kit/action-button";
import { spokenModeNumber } from "@/components/mode-kit/dates";
import {
  modeCallDiscShape,
  modeInsetHairline,
  modeModuleSurface,
  modeRowHeight,
  modeTapArea,
} from "@/components/mode-kit/recipes";
import { modeDisplayNumberText, modeNameText, modeNumberText } from "@/components/mode-kit/type";
import { ModeUpdatedLine, type ModeSource } from "@/components/mode-kit/updated-line";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/components/ui-primitives";
import { copyTextToClipboard } from "@/lib/copy-to-clipboard";

/**
 * A number as a mode has already resolved it. The kit never parses a number:
 * each mode owns its own rules (area codes, extensions, short codes) and hands
 * the kit what to show, what to dial and what to copy.
 */
export type ModeDialNumber = {
  /** What the reader sees, e.g. `(08) 9000 0000` or `ext 4412`. */
  readonly display: string;
  /** The `tel:` href, or null when this phone cannot ring it (a desk-only extension). */
  readonly tel: string | null;
  /** What Copy puts on the clipboard; defaults to `display`. */
  readonly copy?: string | null;
};

/** One other way to reach the same place, shown in the sheet ("From your mobile"). */
export type ModeDialRoute = {
  readonly label: string;
  /** Null shows "Not recorded" in muted grey. */
  readonly number: ModeDialNumber | null;
};

const noSubscription = () => () => {};
const canShareNow = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

function ModeCopyNumber({ value, label, testId }: { value: string; label: string; testId?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const copy = () => {
    // A failed copy says so, in words, so an old number is never pasted by mistake.
    void copyTextToClipboard(value).then(
      () => setState("copied"),
      () => setState("failed"),
    );
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 4000);
  };
  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <ModeActionButton
        icon={state === "copied" ? ClipboardCheck : state === "failed" ? TriangleAlert : Clipboard}
        label={label}
        onClick={copy}
        testId={testId}
      />
      <span role="status" className="text-xs text-[color:var(--text-muted)]">
        {state === "copied" ? "Copied" : state === "failed" ? `Not copied. The number is ${value}.` : ""}
      </span>
    </span>
  );
}

/**
 * "Dial from a desk phone": the sheet a dial row opens when its number is
 * tapped. It names the place, shows the number in large 300-weight digits, the
 * other routes (each with its own call link, or "Not recorded"), Copy and Share,
 * and the checked or updated line with its source. Sizes, colours and radii come
 * from the kit recipes, so a visual pass changes them in one place.
 */
export function ModeDialSheet({
  open,
  onClose,
  label,
  context,
  number,
  routes,
  source,
  checkedAt,
  now,
  onCall,
  testId,
  footer,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  /** The role or place, e.g. "Registrar". */
  readonly label: string;
  /** Where it is, e.g. the hospital's name. */
  readonly context?: string | null;
  readonly number: ModeDialNumber;
  readonly routes?: readonly ModeDialRoute[];
  readonly source?: ModeSource | null;
  /** When this number was last checked against `source`. */
  readonly checkedAt?: string | null;
  readonly now?: Date;
  /** Called when any call link in the sheet is tapped. */
  readonly onCall?: () => void;
  readonly testId?: string;
  /** Mode-owned actions; never contains patient context. */
  readonly footer?: ReactNode;
}) {
  const canShare = useSyncExternalStore(noSubscription, canShareNow, () => false);
  const copyValue = number.copy ?? number.display;
  const [shareStatus, setShareStatus] = useState("");
  useEffect(() => {
    if (!open) setShareStatus("");
  }, [open]);

  const share = async () => {
    const where = context ? `, ${context}` : "";
    const text = `${label}${where}: ${number.display}`;
    setShareStatus("");
    if (canShareNow()) {
      try {
        await navigator.share({ title: label, text });
        return;
      } catch (error) {
        if (typeof error === "object" && error !== null && "name" in error && error.name === "AbortError") return;
      }
    }
    try {
      await copyTextToClipboard(text);
      setShareStatus("Contact copied to share");
    } catch {
      setShareStatus(`Not copied. ${text}`);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={label} testId={testId}>
      <div className="grid min-w-0 gap-4" data-testid={testId ? `${testId}-body` : undefined}>
        {context ? (
          <p className={cn(modeNameText, "break-words text-base-minus text-[color:var(--text-muted)]")}>{context}</p>
        ) : null}

        <span
          data-testid={testId ? `${testId}-number` : undefined}
          className={cn(modeDisplayNumberText, "break-words text-hero text-[color:var(--text-heading)]")}
        >
          {number.display}
        </span>

        {routes?.length ? (
          <ul role="list" className={modeModuleSurface}>
            {routes.map((route) => (
              <li
                key={route.label}
                className={cn(
                  modeInsetHairline,
                  modeRowHeight.double,
                  "grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 pl-3 pr-1",
                )}
              >
                <span className="grid min-w-0 gap-0.5 py-1">
                  <span className="text-sm leading-5 text-[color:var(--text-muted)]">{route.label}</span>
                  {route.number ? (
                    <span
                      className={cn(modeNumberText, "break-words text-base-minus leading-5 text-[color:var(--text)]")}
                    >
                      {route.number.display}
                    </span>
                  ) : (
                    <span className="text-base-minus leading-5 text-[color:var(--text-muted)]">Not recorded</span>
                  )}
                </span>
                {route.number?.tel ? (
                  <a
                    href={route.number.tel}
                    onClick={onCall}
                    aria-label={`Call ${label} ${route.label.toLowerCase()}, ${spokenModeNumber(route.number.display)}`}
                    className={cn(modeTapArea, focusRing, "rounded-full")}
                  >
                    <span aria-hidden="true" className={modeCallDiscShape.neutral}>
                      <Phone aria-hidden="true" strokeWidth={1.5} className="size-icon-md" />
                    </span>
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {number.tel ? (
            <a
              href={number.tel}
              onClick={onCall}
              className={cn(
                focusRing,
                "inline-flex min-h-12 items-center gap-2 rounded-md bg-[color:var(--command)] px-4 text-sm-minus text-[color:var(--command-contrast)]",
              )}
            >
              <Phone aria-hidden="true" className="size-icon-md" /> Call {label}
            </a>
          ) : null}
          {copyValue ? (
            <ModeCopyNumber
              value={copyValue}
              label={`Copy number for ${label}`}
              testId={testId ? `${testId}-copy` : undefined}
            />
          ) : null}
          <>
            <ModeActionButton
              icon={Share2}
              label={canShare ? `Share ${label}` : `Copy ${label} to share`}
              onClick={() => {
                void share();
              }}
              testId={testId ? `${testId}-share` : undefined}
            />
            <span role="status" className="text-xs text-[color:var(--text-muted)]">
              {shareStatus}
            </span>
          </>
        </div>

        <ModeUpdatedLine
          updatedAt={checkedAt ?? null}
          verb="Checked"
          sources={source ? [source] : undefined}
          now={now}
          testId={testId ? `${testId}-checked` : undefined}
        />
        {footer}
      </div>
    </Sheet>
  );
}
