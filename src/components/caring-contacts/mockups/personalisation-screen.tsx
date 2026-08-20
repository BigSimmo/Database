"use client";

import { Eye, LockKeyhole, MessageSquareText } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";

import { OperationalStatus } from "./prototype-primitives";
import { FICTIONAL_CONTACTS_BY_ROLE, type SyntheticPathway, type SyntheticTemplate } from "./types";

export const PATIENT_VISIBLE_NO_REPLY_NOTICE = "Replies are not received, stored, analysed or monitored";

export const EXACT_PATIENT_VISIBLE_MESSAGE = `Hi Rowan, Alex from Example Aftercare Team is thinking of you. This is a one-way message. ${PATIENT_VISIBLE_NO_REPLY_NOTICE}. For timing changes call ${FICTIONAL_CONTACTS_BY_ROLE.programmeStaffedLine}, 9 am-6 pm. In an emergency call 000. Fictional Support Line: ${FICTIONAL_CONTACTS_BY_ROLE.crisisSupportContact}. - Alex`;

const GSM_7_BASIC_CHARACTERS = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
);
const GSM_7_EXTENSION_CHARACTERS = new Set("\f^{}\\[~]|€");

export type Gsm7Evidence = {
  valid: boolean;
  septets: number;
  segments: number;
  invalidCharacters: string[];
};

export function calculateGsm7(value: string): Gsm7Evidence {
  let septets = 0;
  const invalidCharacters: string[] = [];

  for (const character of value) {
    if (GSM_7_BASIC_CHARACTERS.has(character)) septets += 1;
    else if (GSM_7_EXTENSION_CHARACTERS.has(character)) septets += 2;
    else if (!invalidCharacters.includes(character)) invalidCharacters.push(character);
  }

  if (invalidCharacters.length > 0) return { valid: false, septets, segments: 0, invalidCharacters };
  const segments = septets === 0 ? 0 : septets <= 160 ? 1 : Math.ceil(septets / 153);
  return { valid: true, septets, segments, invalidCharacters };
}

export const EXACT_MESSAGE_GSM7 = calculateGsm7(EXACT_PATIENT_VISIBLE_MESSAGE);

export type ActivationGovernanceState = {
  pathway: SyntheticPathway;
  template: SyntheticTemplate;
};

export type ActivationBlocker = { reason: string; remedy: string };

function blockersForVersion(label: "Pathway" | "Message", version: SyntheticPathway | SyntheticTemplate) {
  const blockers: ActivationBlocker[] = [];
  if (version.lifecycle !== "Current") {
    blockers.push({
      reason: `${label} version is not current. Lifecycle: ${version.lifecycle}.`,
      remedy: `Select a current, locally approved ${label.toLowerCase()} version with complete two-person approval evidence.`,
    });
  }
  if (version.approvalState !== "Locally approved") {
    blockers.push({
      reason: `${label} version is awaiting two-person approval.`,
      remedy: `Select a current, locally approved ${label.toLowerCase()} version with complete two-person approval evidence.`,
    });
  } else if (!version.approvalEvidence) {
    blockers.push({
      reason: `${label} version has incomplete two-person approval evidence.`,
      remedy: `Select a current, locally approved ${label.toLowerCase()} version with complete two-person approval evidence.`,
    });
  }
  return blockers;
}

export function getActivationBlockers({ pathway, template }: ActivationGovernanceState) {
  return [...blockersForVersion("Pathway", pathway), ...blockersForVersion("Message", template)];
}

export function canActivateGovernedVersions(governance: ActivationGovernanceState) {
  return getActivationBlockers(governance).length === 0;
}

export function MessagePreview({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={
        compact
          ? "space-y-[var(--gap-stack)]"
          : "space-y-[var(--gap-stack)] rounded-[var(--radius-xl)] border border-[color:var(--border)] bg-[color:var(--surface-inset)] p-[var(--pad-card)]"
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-[var(--gap-tight)]">
        <p className="text-xs font-semibold uppercase tracking-[var(--tracking-eyebrow)] text-[color:var(--text-muted)]">
          Exact patient-visible message
        </p>
        <OperationalStatus tone="info">
          {EXACT_MESSAGE_GSM7.septets} septets · {EXACT_MESSAGE_GSM7.segments} of 2 SMS segments
        </OperationalStatus>
      </div>
      <blockquote className="break-words rounded-[var(--radius-lg)] bg-[color:var(--surface-raised)] p-[var(--pad-card)] text-sm leading-6 text-[color:var(--text)] shadow-[var(--shadow-inset)]">
        {EXACT_PATIENT_VISIBLE_MESSAGE}
      </blockquote>
      <p className="flex items-start gap-2 text-xs text-[color:var(--text-muted)]">
        <LockKeyhole aria-hidden="true" className="mt-0.5 size-icon-sm shrink-0" />
        GSM-7 encoding · non-receiving sender · discreet lock-screen wording · maximum two segments.
      </p>
    </div>
  );
}

export function CompactMessagePreview({ stageName }: { stageName: string }) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewTriggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={previewTriggerRef}
        variant="secondary"
        icon={Eye}
        onClick={() => setPreviewOpen(true)}
        className="lg:hidden"
      >
        Open exact message preview
      </Button>
      <Sheet
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Exact patient-visible message"
        description={`Fully substituted fictional text for ${stageName}.`}
        closeLabel="Close exact message preview"
        returnFocusRef={previewTriggerRef}
        mobileSize="viewport"
        testId="caring-contact-message-preview-sheet"
      >
        <MessagePreview compact />
        <div className="mt-[var(--gap-block)] rounded-[var(--radius-lg)] border border-[color:var(--border)] p-[var(--pad-card)] text-sm text-[color:var(--text-muted)]">
          <p className="flex items-start gap-2 font-medium text-[color:var(--text)]">
            <MessageSquareText aria-hidden="true" className="mt-0.5 size-icon-md shrink-0" />
            One-way programme boundary
          </p>
          <p className="mt-2">{PATIENT_VISIBLE_NO_REPLY_NOTICE}. Caring contacts supplement usual care.</p>
        </div>
      </Sheet>
    </>
  );
}
