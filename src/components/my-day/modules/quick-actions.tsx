"use client";

import { ClipboardList, FileText, GraduationCap, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";

import { focusRing } from "@/components/card-recipes";
import { modeModuleSurface, modePressable } from "@/components/mode-kit/recipes";
import { cn } from "@/components/ui-primitives";

const ACTIONS: readonly { id: string; label: string; href: string; icon: LucideIcon }[] = [
  { id: "call", label: "Log a call", href: "/on-call/call#on-call-call-log-heading", icon: ClipboardList },
  { id: "handover", label: "Handover", href: "/on-call/call#on-call-handover-heading", icon: FileText },
  { id: "whos-on", label: "Who’s on", href: "/on-call/whos-on", icon: Users },
  { id: "cpd", label: "Log CPD", href: "/cme/new", icon: GraduationCap },
];

/**
 * Four quick actions, two across on a phone. The call log and handover builder
 * have no routes of their own, so those link to their headings on the Call page.
 * Static links; nothing is read or fetched.
 */
export function MyDayQuickActions() {
  return (
    <nav aria-label="Quick actions" data-testid="my-day-module-quick-actions">
      <ul role="list" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ACTIONS.map(({ id, label, href, icon: Icon }) => (
          <li key={id}>
            <Link
              href={href}
              data-testid={`my-day-quick-${id}`}
              className={cn(
                modeModuleSurface,
                modePressable,
                focusRing,
                "grid min-h-12 justify-items-center gap-1 px-2 py-3 text-center text-sm-minus font-medium text-[color:var(--text-heading)] no-underline",
              )}
            >
              <Icon aria-hidden="true" className="size-icon-md text-[color:var(--mode-identity)]" />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
