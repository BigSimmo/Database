"use client";

import type { ReactNode } from "react";

import { Sheet } from "@/components/ui/sheet";

export function ComparePickerShell({
  open,
  onClose,
  title,
  description,
  phone,
  id,
  testId,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  phone: boolean;
  id?: string;
  testId?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  if (phone) {
    return (
      <Sheet
        open={open}
        onClose={onClose}
        title={title}
        description={description}
        footer={footer}
        portal
        placement="responsive-right"
        id={id}
        testId={testId}
      >
        {children}
      </Sheet>
    );
  }

  if (!open) return null;

  return (
    <div
      id={id}
      data-testid={testId}
      className="mt-4 hidden rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[var(--e2)] sm:block"
    >
      <div className="mb-3">
        <p className="text-sm font-extrabold text-[color:var(--text-heading)]">{title}</p>
        <p className="mt-0.5 text-xs text-[color:var(--text-muted)]">{description}</p>
      </div>
      {children}
      {footer ? <div className="mt-4 border-t border-[color:var(--border)] pt-3">{footer}</div> : null}
    </div>
  );
}
