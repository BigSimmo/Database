"use client";

import { CircleCheck, Trash2 } from "lucide-react";
import { useState } from "react";

import { ON_CALL_SECTION_TITLES } from "@/components/on-call/on-call-nav-header";
import { OnCallFreshnessBadge } from "@/components/on-call/on-call-freshness-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormField } from "@/components/ui/form-field";
import { Select, type SelectOption } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { TextField } from "@/components/ui/text-field";
import { cn, fieldControlPlain, InlineNotice, textMuted } from "@/components/ui-primitives";
import { parseApiErrorResponse } from "@/lib/api-client-error";
import {
  onCallDetailsSchemaFor,
  onCallEntryFreshness,
  onCallEntrySchema,
  type OnCallEntry,
  type OnCallSection,
} from "@/lib/on-call/entry-model";

/**
 * The owner's only way to add, correct, or retire an On Call entry. Without
 * this a stale phone extension has no path back to correct except a coding
 * task — see docs/superpowers/sdd/2026-09-04-on-call-mode/task-11-brief.md.
 *
 * PATCH is a full replace, not a partial update (src/app/api/on-call/entries/[id]/route.ts,
 * `updateOnCallEntrySchema`): a body missing a field is rejected with 400
 * rather than silently defaulting it — the worst case of that default was
 * `lastVerifiedAt`, the record that an entry was ever confirmed correct.
 * `buildSavePayload` below always sends every field of the entry it holds,
 * carrying `lastVerifiedAt`, `sortOrder` and `linkedDocumentIds` through
 * unchanged, so an ordinary edit can never reset them.
 */

type DetailFieldKind = "text" | "textarea" | "list" | "select";

type DetailFieldSpec = {
  key: string;
  label: string;
  kind: DetailFieldKind;
  required?: boolean;
  hint?: string;
  /** Native input type, "text" fields only (e.g. "tel", "url"). */
  type?: string;
  options?: SelectOption[];
};

const LOGISTICS_CATEGORY_OPTIONS: SelectOption[] = [
  { value: "Parking", label: "Parking" },
  { value: "After-hours food", label: "After-hours food" },
  { value: "Call rooms", label: "Call rooms" },
  { value: "IT & equipment", label: "IT & equipment" },
  { value: "Rostering", label: "Rostering" },
  { value: "Payroll", label: "Payroll" },
  { value: "Leave", label: "Leave" },
  { value: "Other", label: "Other" },
];

/** Mirrors `onCallDetailsSchemaFor` (src/lib/on-call/entry-model.ts) field for field. Orientation
 *  carries no owner-editable detail field — its schema is a fixed literal — so it renders none. */
const SECTION_DETAIL_FIELDS: Record<OnCallSection, DetailFieldSpec[]> = {
  contacts: [
    {
      key: "role",
      label: "Role",
      kind: "text",
      required: true,
      hint: 'e.g. "ED registrar", "Ward 4B nurse in charge".',
    },
    { key: "contactName", label: "Contact name", kind: "text" },
    { key: "phone", label: "Direct phone", kind: "text", type: "tel" },
    { key: "afterHoursPhone", label: "After-hours phone", kind: "text", type: "tel" },
    { key: "pager", label: "Pager", kind: "text", type: "tel" },
    { key: "extension", label: "Extension", kind: "text" },
    { key: "availability", label: "Availability", kind: "text", hint: 'e.g. "24/7", "Business hours".' },
  ],
  playbook: [
    { key: "trigger", label: "Trigger", kind: "text", required: true, hint: "When this escalation applies." },
    {
      key: "escalationSteps",
      label: "Escalation steps",
      kind: "textarea",
      hint: "One step per line: who to call | when | phone (optional).",
    },
  ],
  referrals: [
    { key: "accepts", label: "Accepts", kind: "list", hint: "Comma-separated." },
    { key: "exclusions", label: "Exclusions", kind: "list", hint: "Comma-separated." },
    { key: "catchment", label: "Catchment", kind: "text" },
    { key: "hours", label: "Hours", kind: "text" },
    { key: "howToRefer", label: "How to refer", kind: "text" },
    { key: "phone", label: "Phone", kind: "text", type: "tel" },
    { key: "fax", label: "Fax", kind: "text", type: "tel" },
    { key: "referralFormUrl", label: "Referral form URL", kind: "text", type: "url" },
  ],
  orientation: [],
  education: [
    { key: "recurrence", label: "Recurrence", kind: "text" },
    { key: "nextOccurrence", label: "Next occurrence", kind: "text" },
    { key: "presenter", label: "Presenter", kind: "text" },
    { key: "location", label: "Location", kind: "text" },
    { key: "recordingUrl", label: "Recording URL", kind: "text", type: "url" },
    { key: "topics", label: "Topics", kind: "list", hint: "Comma-separated." },
  ],
  logistics: [
    { key: "category", label: "Category", kind: "select", required: true, options: LOGISTICS_CATEGORY_OPTIONS },
    { key: "location", label: "Location", kind: "text" },
    { key: "hours", label: "Hours", kind: "text" },
    { key: "phone", label: "Phone", kind: "text", type: "tel" },
    { key: "url", label: "URL", kind: "text", type: "url" },
  ],
};

type EscalationStep = { order: number; whoToCall: string; when: string; phone?: string };

function detailStringValue(details: unknown, key: string): string {
  if (!details || typeof details !== "object") return "";
  const value = (details as Record<string, unknown>)[key];
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string").join(", ");
  return typeof value === "string" ? value : "";
}

function escalationStepsToText(details: unknown): string {
  const steps = (details as { escalationSteps?: unknown } | null)?.escalationSteps;
  if (!Array.isArray(steps)) return "";
  return steps
    .map((step) => {
      if (!step || typeof step !== "object") return "";
      const record = step as { whoToCall?: unknown; when?: unknown; phone?: unknown };
      const who = typeof record.whoToCall === "string" ? record.whoToCall : "";
      const when = typeof record.when === "string" ? record.when : "";
      const phone = typeof record.phone === "string" && record.phone ? ` | ${record.phone}` : "";
      return who || when ? `${who} | ${when}${phone}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

/** Returns `null` on a malformed line so the caller can surface one FieldError
 *  rather than silently dropping the step. */
function parseEscalationSteps(raw: string): EscalationStep[] | null {
  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const steps: EscalationStep[] = [];
  for (const line of lines) {
    const [whoToCall, when, phone] = line.split("|").map((part) => part.trim());
    if (!whoToCall || !when) return null;
    steps.push({ order: steps.length + 1, whoToCall, when, ...(phone ? { phone } : {}) });
  }
  return steps;
}

function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "entry";
}

/** Not cryptographic — just enough entropy that two entries sharing a title do
 *  not collide on the table's `unique (owner_id, section, slug)` constraint. */
function randomSlugSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

type DraftState = {
  title: string;
  subtitle: string;
  body: string;
  tags: string;
  isPersonal: boolean;
  includeOnCard: boolean;
  details: Record<string, string>;
};

function buildInitialDraft(section: OnCallSection, entry: OnCallEntry | null | undefined): DraftState {
  const details: Record<string, string> = {};
  for (const field of SECTION_DETAIL_FIELDS[section]) {
    details[field.key] =
      field.key === "escalationSteps"
        ? escalationStepsToText(entry?.details)
        : detailStringValue(entry?.details, field.key);
  }
  return {
    title: entry?.title ?? "",
    subtitle: entry?.subtitle ?? "",
    body: entry?.body ?? "",
    tags: entry?.tags.join(", ") ?? "",
    isPersonal: entry?.isPersonal ?? false,
    includeOnCard: entry?.includeOnCard ?? false,
    details,
  };
}

function TextAreaField({
  label,
  hint,
  error,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  hint?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <FormField label={label} hint={hint} error={error}>
      {(field) => (
        <textarea
          id={field.id}
          aria-invalid={field.invalid || undefined}
          aria-describedby={field.describedBy}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={rows}
          className={cn(fieldControlPlain, "h-auto min-h-24 resize-y py-2 leading-6")}
        />
      )}
    </FormField>
  );
}

function DetailField({
  field,
  value,
  error,
  onChange,
}: {
  field: DetailFieldSpec;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) {
  if (field.kind === "textarea") {
    return <TextAreaField label={field.label} hint={field.hint} error={error} value={value} onChange={onChange} />;
  }
  if (field.kind === "select") {
    const options = field.options ?? [];
    // A stored value from outside this preset (an older or hand-entered row)
    // still has to render as itself rather than silently falling back to the
    // first option, so it is offered as an extra choice rather than dropped.
    const resolvedOptions =
      !value || options.some((option) => option.value === value) ? options : [...options, { value, label: value }];
    return (
      <Select
        label={field.label}
        required={field.required}
        hint={field.hint}
        error={error}
        options={resolvedOptions}
        placeholder="Choose one"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    );
  }
  return (
    <TextField
      label={field.label}
      required={field.required}
      hint={field.hint}
      error={error}
      type={field.type ?? "text"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

export interface OnCallEntryEditorProps {
  open: boolean;
  onClose: () => void;
  /** Which section's field shape to render (`onCallDetailsSchemaFor`). */
  section: OnCallSection;
  /** The entry being edited; `null`/omitted creates a new one in `section`. */
  entry?: OnCallEntry | null;
  /** Called with the saved (created, edited, or verified) entry. The caller owns
   *  where entries live — see `src/lib/on-call/entry-store.ts` `cacheOnCallEntries`. */
  onSaved: (entry: OnCallEntry) => void;
  /** Called with the deleted entry's id. Omit to disable delete (create-only use). */
  onDeleted?: (id: string) => void;
}

export function OnCallEntryEditor({
  open,
  onClose,
  section,
  entry = null,
  onSaved,
  onDeleted,
}: OnCallEntryEditorProps) {
  const [draft, setDraft] = useState<DraftState>(() => buildInitialDraft(section, entry));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"saving" | "deleting" | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  // React's supported "adjust state during render" pattern (also used by
  // SettingsDialog) rather than a reset effect: this component stays mounted
  // while the Sheet hides it, so the draft has to re-seed the moment `open`,
  // `entry`, or `section` actually changes — not on every render.
  const nextOpenKey = open ? `${section}:${entry?.id ?? "new"}` : null;
  if (nextOpenKey !== openKey) {
    setOpenKey(nextOpenKey);
    if (nextOpenKey) {
      setDraft(buildInitialDraft(section, entry));
      setFieldErrors({});
      setFormError(null);
      setConfirmDeleteOpen(false);
    }
  }

  const fieldSpecs = SECTION_DETAIL_FIELDS[section];
  const freshness = entry ? onCallEntryFreshness(entry) : null;

  function setDetailValue(key: string, value: string) {
    setDraft((current) => ({ ...current, details: { ...current.details, [key]: value } }));
  }

  async function handleSave() {
    if (busy) return;
    setFormError(null);

    const nextErrors: Record<string, string> = {};
    const trimmedTitle = draft.title.trim();
    if (!trimmedTitle) nextErrors.title = "Title is required.";

    const detailsInput: Record<string, unknown> = section === "orientation" ? { pinnedSummaryIsOwnerNote: true } : {};
    for (const field of fieldSpecs) {
      const raw = draft.details[field.key] ?? "";
      if (field.key === "escalationSteps") {
        const steps = parseEscalationSteps(raw);
        if (steps === null) {
          nextErrors[field.key] = "Each step needs at least a who and a when, separated by |.";
        } else if (steps.length > 0) {
          detailsInput[field.key] = steps;
        }
        continue;
      }
      if (field.kind === "list") {
        const items = raw
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
        if (items.length > 0) detailsInput[field.key] = items;
        continue;
      }
      const trimmedValue = raw.trim();
      if (trimmedValue) detailsInput[field.key] = trimmedValue;
    }

    const parsedDetails = onCallDetailsSchemaFor(section).safeParse(detailsInput);
    if (!parsedDetails.success) {
      for (const issue of parsedDetails.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !nextErrors[key]) nextErrors[key] = issue.message;
      }
    }

    if (Object.keys(nextErrors).length > 0 || !parsedDetails.success) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});

    const tagsArray = draft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    // Every field of the entry, always — the PATCH route requires a complete
    // body and rejects a partial one with 400 (see the file banner above).
    const payload = {
      section,
      slug: entry ? entry.slug : `${slugifyTitle(trimmedTitle)}-${randomSlugSuffix()}`,
      title: trimmedTitle,
      subtitle: draft.subtitle.trim() || null,
      body: draft.body.trim() || null,
      details: parsedDetails.data,
      linkedDocumentIds: entry?.linkedDocumentIds ?? [],
      tags: tagsArray,
      isPersonal: draft.isPersonal,
      includeOnCard: draft.includeOnCard,
      sortOrder: entry?.sortOrder ?? 0,
      lastVerifiedAt: entry?.lastVerifiedAt ?? null,
    };

    setBusy("saving");
    try {
      const response = await fetch(entry ? `/api/on-call/entries/${entry.id}` : "/api/on-call/entries", {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw await parseApiErrorResponse(response);
      const body: unknown = await response.json();
      const parsedEntry = onCallEntrySchema.safeParse((body as { entry?: unknown } | null)?.entry);
      if (!parsedEntry.success) throw new Error("Save response was invalid.");
      onSaved(parsedEntry.data);
      onClose();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save this entry.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete() {
    if (!entry) return;
    setBusy("deleting");
    setFormError(null);
    try {
      const response = await fetch(`/api/on-call/entries/${entry.id}`, { method: "DELETE" });
      if (!response.ok) throw await parseApiErrorResponse(response);
      setConfirmDeleteOpen(false);
      onDeleted?.(entry.id);
      onClose();
    } catch (error) {
      setConfirmDeleteOpen(false);
      setFormError(error instanceof Error ? error.message : "Could not delete this entry.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={entry ? `Edit ${entry.title}` : `Add to ${ON_CALL_SECTION_TITLES[section]}`}
        mobilePlacement="bottom"
        testId="on-call-entry-editor"
        footer={
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            {entry && onDeleted ? (
              <Button
                variant="danger"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={busy !== null}
                icon={Trash2}
                testId="on-call-entry-editor-delete"
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={onClose} disabled={busy !== null}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => void handleSave()}
                busy={busy === "saving"}
                busyLabel="Saving…"
                disabled={busy !== null}
                testId="on-call-entry-editor-save"
              >
                Save
              </Button>
            </div>
          </div>
        }
      >
        <div className="grid gap-4">
          {formError ? <InlineNotice tone="danger">{formError}</InlineNotice> : null}

          {entry && freshness?.state === "stale" ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--warning-border)] bg-[color:var(--warning-soft)] px-3 py-2">
              <OnCallFreshnessBadge freshness={freshness} />
              <OnCallVerifyButton
                entry={entry}
                onVerified={(verified) => {
                  onSaved(verified);
                  onClose();
                }}
              />
            </div>
          ) : null}

          <TextField
            label="Title"
            required
            hint="Shown as the row's heading."
            error={fieldErrors.title}
            value={draft.title}
            onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
          />

          {fieldSpecs.length === 0 ? (
            <p className={cn("text-sm", textMuted)}>
              This section only carries a document link and, optionally, your own pinned note — there is nothing else to
              enter here.
            </p>
          ) : (
            fieldSpecs.map((field) => (
              <DetailField
                key={field.key}
                field={field}
                value={draft.details[field.key] ?? ""}
                error={fieldErrors[field.key]}
                onChange={(value) => setDetailValue(field.key, value)}
              />
            ))
          )}

          <TextField
            label="Tags"
            hint={
              section === "contacts"
                ? 'Comma-separated. The first tag groups this entry, e.g. "Ward 4B".'
                : "Comma-separated."
            }
            value={draft.tags}
            onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))}
          />

          <TextField
            label="Subtitle"
            value={draft.subtitle}
            onChange={(event) => setDraft((current) => ({ ...current, subtitle: event.target.value }))}
          />

          <TextAreaField
            label="Notes"
            hint="Administrative notes only. Clinical guidance belongs in a linked document, not here."
            value={draft.body}
            onChange={(value) => setDraft((current) => ({ ...current, body: value }))}
          />

          <div className="grid gap-1">
            <Checkbox
              label="Personal number"
              description="Excluded from the printable card and any export."
              checked={draft.isPersonal}
              onChange={(event) => setDraft((current) => ({ ...current, isPersonal: event.target.checked }))}
            />
            <Checkbox
              label="Include on printable card"
              checked={draft.includeOnCard}
              onChange={(event) => setDraft((current) => ({ ...current, includeOnCard: event.target.checked }))}
            />
          </div>
        </div>
      </Sheet>

      {entry ? (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onCancel={() => setConfirmDeleteOpen(false)}
          onConfirm={() => void handleDelete()}
          title="Delete entry"
          description={`This permanently removes "${entry.title}" from On Call. This cannot be undone.`}
          confirmLabel={`Delete ${entry.title}`}
          busy={busy === "deleting"}
          busyLabel="Deleting…"
        />
      ) : null}
    </>
  );
}

export interface OnCallVerifyButtonProps {
  entry: OnCallEntry;
  /** Called with the entry after the server stamps a fresh `lastVerifiedAt`. */
  onVerified: (entry: OnCallEntry) => void;
  className?: string;
}

/**
 * The one-tap "still correct" action (task brief item 3): confirms an entry
 * with no trip through the full editor, so clearing a stale flag costs the
 * same one tap as ringing the number did.
 */
export function OnCallVerifyButton({ entry, onVerified, className }: OnCallVerifyButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/on-call/entries/${entry.id}/verify`, { method: "POST" });
      if (!response.ok) throw await parseApiErrorResponse(response);
      const body: unknown = await response.json();
      const parsed = onCallEntrySchema.safeParse((body as { entry?: unknown } | null)?.entry);
      if (!parsed.success) throw new Error("Verify response was invalid.");
      onVerified(parsed.data);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Could not verify this entry.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => void handleVerify()}
        disabled={busy}
        busy={busy}
        busyLabel="Verifying…"
        icon={CircleCheck}
        testId={`on-call-verify-${entry.slug}`}
      >
        Still correct
      </Button>
      {error ? (
        <span role="alert" className="text-xs font-semibold text-[color:var(--danger)]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
