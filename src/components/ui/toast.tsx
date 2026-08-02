"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/components/ui-primitives";

export type ToastTone = "success" | "info" | "warning" | "danger";

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  /** ms before auto-dismiss. Pass 0 to require an explicit dismiss. */
  duration?: number;
};

type ToastInput = Omit<Toast, "id">;

type ToastContextValue = {
  toasts: Toast[];
  push: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON = {
  success: CheckCircle2,
  info: Info,
  warning: TriangleAlert,
  danger: TriangleAlert,
} as const;

const TONE_ACCENT: Record<ToastTone, string> = {
  success: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

const TONE_TEXT: Record<ToastTone, string> = {
  success: "text-[color:var(--success)]",
  info: "text-[color:var(--info)]",
  warning: "text-[color:var(--warning)]",
  danger: "text-[color:var(--danger)]",
};

const DEFAULT_DURATION = 6000;

/**
 * Nothing in the system announced async outcomes: an upload that failed in the
 * background left no trace once its panel scrolled away. Wrap the surface (or the
 * app shell) in `ToastProvider` and call `useToast().push(...)` from the handler.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback((toast: ToastInput) => {
    counter.current += 1;
    const id = `toast-${counter.current}`;
    setToasts((current) => [...current, { ...toast, id }]);
    return id;
  }, []);

  const value = useMemo(() => ({ toasts, push, dismiss }), [toasts, push, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastRegion />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside a <ToastProvider>");
  return { push: context.push, dismiss: context.dismiss };
}

function ToastCard({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const duration = toast.duration ?? DEFAULT_DURATION;

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss, toast.id]);

  const Icon = TONE_ICON[toast.tone];

  return (
    <div
      data-testid="toast"
      data-tone={toast.tone}
      // Borderless floating surface: a hairline ring is its edge and the shadow is
      // its lift — never a border AND a shadow on one element (register #39/#40).
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg bg-[color:var(--surface-raised)] p-3 shadow-[var(--shadow-elevated)] ring-1 ring-[color:var(--border-lux)]"
    >
      <span
        aria-hidden
        className="mt-0.5 block h-[1.125rem] w-[3px] shrink-0 rounded-full"
        style={{ background: TONE_ACCENT[toast.tone] }}
      />
      <Icon aria-hidden="true" className={cn("mt-0.5 size-icon-md shrink-0", TONE_TEXT[toast.tone])} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[color:var(--text-heading)]">{toast.title}</p>
        {toast.body ? <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">{toast.body}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={`Dismiss: ${toast.title}`}
        className="grid size-tap shrink-0 place-items-center rounded-lg text-[color:var(--text-muted)] transition hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
      >
        <X aria-hidden="true" className="size-icon-md" />
      </button>
    </div>
  );
}

/**
 * The live region itself. Rendered automatically by `ToastProvider`; exported so a
 * surface that owns its own portal can place it. `role="status"` + `aria-live="polite"`
 * so an outcome is announced without interrupting whatever the user is reading —
 * a failed upload is important, but it is not a reason to cut off a dose sentence.
 */
export function ToastRegion() {
  const context = useContext(ToastContext);
  if (!context) return null;
  const { toasts, dismiss } = context;

  return (
    <div
      data-testid="toast-region"
      role="status"
      aria-live="polite"
      aria-relevant="additions text"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[110] flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-0 sm:items-end"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
      ))}
    </div>
  );
}
