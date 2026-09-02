"use client";

import { Eraser, Plus, UserRound, X } from "lucide-react";
import { useId, useState } from "react";

import { usePatientProfile } from "@/components/clinical-dashboard/patient-profile-context";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { ChoiceChip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/text-field";
import { cn, fieldLabel, ToggleSwitch } from "@/components/ui-primitives";
import { catalogueMedicationOptions, medicationDisplayName } from "@/lib/medication-interactions";
import { SCR_UMOL_PER_MGDL } from "@/lib/medication-patient-alerts";
import type { AllergyClass, HepaticSeverity, ScrUnit } from "@/lib/medication-patient-alerts";
import { PATIENT_PROFILE_NUMERIC_BOUNDS, PATIENT_PROFILE_SCR_UMOL_BOUNDS } from "@/lib/patient-profile-storage";

/**
 * "Not recorded" is a real segment, not the absence of a selection.
 *
 * The engine already treats `hepatic: "none"` as present-and-non-firing (it
 * tests `hepatic !== "none"` rather than falsiness), so "assessed, no
 * impairment" clears a hepatic gate while a null leaves it unassessed. Storing
 * "None" as null collapsed those two states into one: selecting None was
 * indistinguishable from never touching the field, and the control then
 * displayed "None" for a profile that recorded nothing at all. The sentinel is
 * a display-only value — it is written through as `null`, never stored.
 */
const HEPATIC_UNRECORDED = "unrecorded" as const;

type HepaticSegment = HepaticSeverity | typeof HEPATIC_UNRECORDED;

const HEPATIC_OPTIONS: { value: HepaticSegment; label: string }[] = [
  { value: HEPATIC_UNRECORDED, label: "Not recorded" },
  { value: "none", label: "None" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

const SCR_UNIT_OPTIONS: { value: ScrUnit; label: string }[] = [
  { value: "umol/L", label: "µmol/L" },
  { value: "mg/dL", label: "mg/dL" },
];

const ALLERGY_OPTIONS: { value: AllergyClass; label: string }[] = [
  { value: "penicillin", label: "Penicillin" },
  { value: "sulfa", label: "Sulfa" },
  { value: "nsaid", label: "NSAID" },
  { value: "cephalosporin", label: "Cephalosporin" },
  { value: "macrolide", label: "Macrolide" },
  { value: "fluoroquinolone", label: "Fluoroquinolone" },
];

function parseNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

const segmentBase =
  "min-h-tap rounded-lg border px-2.5 text-2xs font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] sm:text-xs";
const segmentActive =
  "border-[color:var(--clinical-accent)] bg-[color:var(--clinical-accent-soft)] text-[color:var(--clinical-accent)]";
const segmentIdle =
  "border-[color:var(--border)] bg-[color:var(--surface-raised)] text-[color:var(--text-muted)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)]";

function NumberField({
  label,
  unit,
  value,
  onChange,
  testId,
  min,
  max,
}: {
  label: string;
  unit?: string;
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  testId?: string;
  min: number;
  max: number;
}) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [syncedValue, setSyncedValue] = useState<number | null>(value ?? null);

  const parsed = parseNumber(text);
  const outOfRange = parsed !== null && (parsed < min || parsed > max);
  if ((value ?? null) !== syncedValue) {
    setSyncedValue(value ?? null);
    if (!outOfRange) setText(value == null ? "" : String(value));
  }

  return (
    <TextField
      label={unit ? `${label} (${unit})` : label}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      value={text}
      onChange={(event) => {
        const raw = event.target.value;
        setText(raw);
        const next = parseNumber(raw);
        onChange(next !== null && next >= min && next <= max ? next : null);
      }}
      error={outOfRange ? `Enter ${min}–${max}${unit ? ` ${unit}` : ""}.` : undefined}
      className="nums"
      data-testid={testId}
    />
  );
}

function MedicationPicker({
  selected,
  onToggle,
  resetNonce,
}: {
  selected: string[];
  onToggle: (slug: string) => void;
  resetNonce: number;
}) {
  const [term, setTerm] = useState("");
  const listId = useId();

  // Clearing the profile empties the search box too. Done as React's sanctioned
  // "adjust state during render" reconciliation rather than an effect: a
  // setState inside useEffect renders once with the stale value and trips
  // `react-hooks/set-state-in-effect`.
  const [syncedNonce, setSyncedNonce] = useState(resetNonce);
  if (syncedNonce !== resetNonce) {
    setSyncedNonce(resetNonce);
    setTerm("");
  }

  const options = catalogueMedicationOptions();
  const selectedSet = new Set(selected);
  const query = term.trim().toLowerCase();
  const matches = query
    ? options.filter((option) => option.name.toLowerCase().includes(query) && !selectedSet.has(option.slug)).slice(0, 8)
    : [];

  return (
    <fieldset className="min-w-0">
      <legend className={fieldLabel}>Current medications</legend>

      {selected.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-1.5" data-testid="patient-medication-list">
          {selected.map((slug) => (
            <li key={slug}>
              <button
                type="button"
                onClick={() => onToggle(slug)}
                data-testid={`patient-medication-${slug}`}
                aria-label={`Remove ${medicationDisplayName(slug)}`}
                className={cn(segmentBase, segmentActive, "inline-flex items-center gap-1.5")}
              >
                {medicationDisplayName(slug)}
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <TextField
        label="Add a medication"
        hideLabel
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder="Search medications to add…"
        aria-describedby={listId}
        data-testid="patient-medication-search"
      />

      <div id={listId} className="mt-1.5 flex flex-wrap gap-1.5">
        {matches.map((option) => (
          <button
            key={option.slug}
            type="button"
            onClick={() => {
              onToggle(option.slug);
              setTerm("");
            }}
            data-testid={`patient-medication-add-${option.slug}`}
            className={cn(segmentBase, segmentIdle, "inline-flex items-center gap-1.5")}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {option.name}
          </button>
        ))}
        {query && matches.length === 0 ? (
          <p className="text-2xs text-[color:var(--text-muted)]">
            No catalogue match. Only medications in this catalogue can be interaction-checked.
          </p>
        ) : null}
      </div>
    </fieldset>
  );
}

export function PatientProfilePanel({
  variant = "full",
  defaultOpen,
  className,
}: {
  variant?: "full" | "compact";
  defaultOpen?: boolean;
  className?: string;
}) {
  const { profile, updateField, setScrUnit, toggleAllergy, toggleMedication, clear, isEmpty } = usePatientProfile();
  const [open, setOpen] = useState(defaultOpen ?? variant === "full");
  const [resetNonce, setResetNonce] = useState(0);
  const allergies = new Set(profile.allergies ?? []);
  const scrUnit = profile.scrUnit ?? "umol/L";
  const scrBounds =
    scrUnit === "mg/dL"
      ? {
          min: Math.ceil((PATIENT_PROFILE_SCR_UMOL_BOUNDS.min / SCR_UMOL_PER_MGDL) * 100) / 100,
          max: Math.floor((PATIENT_PROFILE_SCR_UMOL_BOUNDS.max / SCR_UMOL_PER_MGDL) * 100) / 100,
        }
      : PATIENT_PROFILE_SCR_UMOL_BOUNDS;

  return (
    <details
      open={open}
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
      data-testid="patient-profile-panel"
      className={cn(
        "group overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-raised)] shadow-[var(--shadow-inset)]",
        className,
      )}
    >
      <summary className="flex min-h-tap cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-left [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <UserRound className="h-4 w-4 shrink-0 text-[color:var(--clinical-accent)]" aria-hidden="true" />
          <span className="text-sm-minus font-semibold text-[color:var(--text-heading)]">Patient details</span>
          {!isEmpty ? (
            <span className="rounded-full bg-[color:var(--clinical-accent-soft)] px-2 py-0.5 text-2xs font-semibold text-[color:var(--clinical-accent)]">
              Active
            </span>
          ) : (
            <span className="text-2xs font-medium text-[color:var(--text-muted)]">Optional</span>
          )}
        </span>
        <span className="text-2xs font-semibold uppercase tracking-eyebrow text-[color:var(--text-muted)]">
          {open ? "Hide" : "Edit"}
        </span>
      </summary>

      <div className="space-y-3 border-t border-[color:var(--border)] p-3">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          <NumberField
            key={`age-${resetNonce}`}
            label="Age"
            unit="years"
            value={profile.ageYears}
            onChange={(value) => updateField("ageYears", value)}
            testId="patient-age"
            min={PATIENT_PROFILE_NUMERIC_BOUNDS.ageYears.min}
            max={PATIENT_PROFILE_NUMERIC_BOUNDS.ageYears.max}
          />
          <NumberField
            key={`egfr-${resetNonce}`}
            label="eGFR"
            unit="mL/min"
            value={profile.egfr}
            onChange={(value) => updateField("egfr", value)}
            testId="patient-egfr"
            min={PATIENT_PROFILE_NUMERIC_BOUNDS.egfr.min}
            max={PATIENT_PROFILE_NUMERIC_BOUNDS.egfr.max}
          />
          <NumberField
            key={`crcl-${resetNonce}`}
            label="CrCl"
            unit="mL/min"
            value={profile.crcl}
            onChange={(value) => updateField("crcl", value)}
            testId="patient-crcl"
            min={PATIENT_PROFILE_NUMERIC_BOUNDS.crcl.min}
            max={PATIENT_PROFILE_NUMERIC_BOUNDS.crcl.max}
          />
          <NumberField
            key={`qtc-${resetNonce}`}
            label="QTc"
            unit="ms"
            value={profile.qtc}
            onChange={(value) => updateField("qtc", value)}
            testId="patient-qtc"
            min={PATIENT_PROFILE_NUMERIC_BOUNDS.qtc.min}
            max={PATIENT_PROFILE_NUMERIC_BOUNDS.qtc.max}
          />
          <div className="col-span-2 sm:col-span-1">
            <NumberField
              key={`scr-${resetNonce}-${scrUnit}`}
              label="Serum creatinine"
              value={profile.scr}
              onChange={(value) => updateField("scr", value)}
              testId="patient-scr"
              min={scrBounds.min}
              max={scrBounds.max}
            />
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <span id="patient-scr-unit-label" className={fieldLabel}>
              Creatinine unit
            </span>
            <SegmentedControl
              ariaLabelledBy="patient-scr-unit-label"
              value={profile.scrUnit ?? "umol/L"}
              onChange={setScrUnit}
              options={SCR_UNIT_OPTIONS}
              layout="equal"
            />
          </div>
        </div>

        <div className="min-w-0">
          <span id="patient-hepatic-label" className={fieldLabel}>
            Hepatic impairment
          </span>
          <SegmentedControl
            ariaLabelledBy="patient-hepatic-label"
            value={profile.hepatic ?? HEPATIC_UNRECORDED}
            onChange={(value) => updateField("hepatic", value === HEPATIC_UNRECORDED ? null : value)}
            options={HEPATIC_OPTIONS}
            layout="equal"
          />
        </div>

        <MedicationPicker selected={profile.medications ?? []} onToggle={toggleMedication} resetNonce={resetNonce} />

        <fieldset className="min-w-0">
          <legend className={fieldLabel}>Allergies</legend>
          <div className="flex flex-wrap gap-2">
            {ALLERGY_OPTIONS.map((option) => {
              const active = allergies.has(option.value);
              return (
                <ChoiceChip
                  key={option.value}
                  pressed={active}
                  onPressedChange={() => toggleAllergy(option.value)}
                  size="compact"
                  testId={`patient-allergy-${option.value}`}
                >
                  {option.label}
                </ChoiceChip>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-2 items-center gap-x-3 gap-y-2 sm:flex sm:flex-wrap">
          <span className="flex min-w-0 items-center gap-1.5 text-sm-minus font-semibold text-[color:var(--text-heading)]">
            <ToggleSwitch
              enabled={profile.pregnant ?? false}
              onToggle={() => updateField("pregnant", !profile.pregnant)}
              aria-label="Pregnancy"
            />
            Pregnancy
          </span>
          <span className="flex min-w-0 items-center gap-1.5 text-sm-minus font-semibold text-[color:var(--text-heading)]">
            <ToggleSwitch
              enabled={profile.breastfeeding ?? false}
              onToggle={() => updateField("breastfeeding", !profile.breastfeeding)}
              aria-label="Breastfeeding"
            />
            Breastfeeding
          </span>
          <button
            type="button"
            onClick={() => {
              clear();
              setResetNonce((nonce) => nonce + 1);
            }}
            disabled={isEmpty}
            className="col-span-2 inline-flex min-h-tap items-center justify-self-end gap-1.5 rounded-lg border border-[color:var(--border)] px-2.5 text-2xs font-semibold text-[color:var(--text-muted)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-heading)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)] disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
          >
            <Eraser className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </button>
        </div>

        <p className="text-2xs leading-4 text-[color:var(--text-muted)]">
          Anonymous values only — no patient‑identifying information is stored. Cleared when the tab closes. Clinical
          reference — not validated decision support.
        </p>
      </div>
    </details>
  );
}
