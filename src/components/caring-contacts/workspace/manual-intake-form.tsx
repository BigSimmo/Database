"use client";

import { AlertCircle, CheckCircle2, FilePlus, RefreshCw, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { floatingControl, primaryControl } from "@/components/ui-primitives";
import { CARING_CONTACTS_ROUTES } from "@/lib/caring-contacts-routes";
import {
  SyntheticHospitalReferralAdapter,
  WA_HEALTH_FACILITIES,
  type PatientReferral,
  type WAHealthFacility,
} from "@/lib/caring-contacts/referral";

import { workspacePanelPadded } from "./surfaces";

export function ManualIntakeForm() {
  const [adapter] = useState(() => new SyntheticHospitalReferralAdapter());

  // Form State
  const [facility, setFacility] = useState<WAHealthFacility>("Royal Perth Hospital");
  const [patientIdentifier, setPatientIdentifier] = useState("");
  const [givenName, setGivenName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [admittingWard, setAdmittingWard] = useState("Ward 4A Acute Mental Health");
  const [dischargeDate, setDischargeDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [cohort, setCohort] = useState("adult_crisis");
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [safetyAlerts, setSafetyAlerts] = useState("Acute distress, Aftercare support required");

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifiedReferral, setVerifiedReferral] = useState<PatientReferral | null>(null);

  const handlePrefill = (targetFacility: WAHealthFacility) => {
    const payload = adapter.createSyntheticPayload(targetFacility);
    const pat = payload.patient as Record<string, string>;
    const ep = payload.episode as Record<string, unknown>;

    setFacility(targetFacility);
    setPatientIdentifier(pat.mrn ?? "");
    setGivenName(pat.givenName ?? "");
    setFamilyName(pat.familyName ?? "");
    setMobileNumber(pat.mobile ?? "");
    setAdmittingWard(typeof ep.admittingWard === "string" ? ep.admittingWard : "Acute Unit");
    setDischargeDate(new Date().toISOString().slice(0, 16));
    setCohort(typeof ep.cohort === "string" ? ep.cohort : "adult_crisis");
    setClinicalSummary(typeof ep.clinicalSummary === "string" ? ep.clinicalSummary : "");
    setSafetyAlerts(Array.isArray(ep.safetyAlerts) ? ep.safetyAlerts.join(", ") : "");
    setErrorMessage(null);
    setVerifiedReferral(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    const alertsList = safetyAlerts
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const result = await adapter.ingestReferral({
      patientIdentifier,
      givenName,
      familyName,
      mobileNumber,
      dischargeDate: new Date(dischargeDate).toISOString(),
      hospitalFacility: facility,
      cohort,
      admittingWard,
      clinicalSummary,
      safetyAlerts: alertsList,
    });

    setIsSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.error);
    } else {
      setVerifiedReferral(result.value);
    }
  };

  const handleReset = () => {
    setVerifiedReferral(null);
    setErrorMessage(null);
    setPatientIdentifier("");
    setGivenName("");
    setFamilyName("");
    setMobileNumber("");
    setClinicalSummary("");
  };

  return (
    <div className="space-y-6">
      {/* Hazard H-44 Context & Notice Banner */}
      <section
        aria-label="Intake fallback context"
        className={`${workspacePanelPadded} border-l-4 border-l-[color:var(--focus)]`}
      >
        <div className="flex items-start gap-3">
          <FilePlus aria-hidden="true" className="size-5 shrink-0 text-[color:var(--focus)] mt-0.5" />
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-[color:var(--text-heading)]">
              Manual Referral Intake Fallback (Hazard H-44 Mitigation)
            </h2>
            <p className="text-xs leading-5 text-[color:var(--text-muted)]">
              This verified clinical intake interface allows coordinators to manually enter hospital discharge referrals
              when structured WA Health enterprise feeds (HL7 v2 or FHIR) are unavailable or during service onboarding.
              Referrals entered here are parsed, validated, and staged for clinical review.
            </p>
          </div>
        </div>

        {/* Quick Prefill Actions */}
        <div className="mt-4 pt-3 border-t border-[color:var(--border-subtle)] flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-[color:var(--text-muted)]">Prefill WA Health sample:</span>
          {WA_HEALTH_FACILITIES.map((fac) => (
            <button
              key={fac}
              type="button"
              onClick={() => handlePrefill(fac)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--text)] transition-colors hover:bg-[color:var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--focus)]"
            >
              <RefreshCw aria-hidden="true" className="size-3" />
              <span>{fac}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Error Notice */}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-[var(--radius-lg)] border border-[color:var(--danger)] bg-[color:var(--danger-subtle)] p-4 text-xs text-[color:var(--danger-text)]"
        >
          <AlertCircle aria-hidden="true" className="size-5 shrink-0 text-[color:var(--danger)]" />
          <div className="space-y-1">
            <p className="font-semibold">Referral Validation Refusal</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Success State Confirmation Card */}
      {verifiedReferral ? (
        <section aria-label="Verified referral summary" className={`${workspacePanelPadded} space-y-4`}>
          <div className="flex items-start gap-3">
            <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-[color:var(--success)] mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-[color:var(--text-heading)]">
                Discharge Referral Verified and Staged
              </h2>
              <p className="text-xs text-[color:var(--text-muted)]">
                The referral was validated by the hospital adapter and is ready for care plan initiation.
              </p>
            </div>
          </div>

          <div className="rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface-subtle)] p-4 text-xs space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <span className="font-semibold text-[color:var(--text-muted)]">Patient:</span>{" "}
                <span className="font-medium text-[color:var(--text)]">
                  {verifiedReferral.givenName} {verifiedReferral.familyName}
                </span>
              </div>
              <div>
                <span className="font-semibold text-[color:var(--text-muted)]">Identifier (MRN):</span>{" "}
                <span className="font-medium text-[color:var(--text)]">{verifiedReferral.patientIdentifier}</span>
              </div>
              <div>
                <span className="font-semibold text-[color:var(--text-muted)]">Facility:</span>{" "}
                <span className="font-medium text-[color:var(--text)]">{verifiedReferral.hospitalFacility}</span>
              </div>
              <div>
                <span className="font-semibold text-[color:var(--text-muted)]">Admitting Ward:</span>{" "}
                <span className="font-medium text-[color:var(--text)]">{verifiedReferral.admittingWard}</span>
              </div>
              <div>
                <span className="font-semibold text-[color:var(--text-muted)]">Mobile Number:</span>{" "}
                <span className="font-medium text-[color:var(--text)]">{verifiedReferral.mobileNumber}</span>
              </div>
              <div>
                <span className="font-semibold text-[color:var(--text-muted)]">Discharge Timestamp:</span>{" "}
                <span className="font-medium text-[color:var(--text)]">
                  {new Date(verifiedReferral.dischargeDate).toLocaleString()}
                </span>
              </div>
            </div>

            {verifiedReferral.clinicalSummary && (
              <div className="pt-2 border-t border-[color:var(--border-subtle)]">
                <span className="font-semibold text-[color:var(--text-muted)]">Summary:</span>
                <p className="mt-1 text-[color:var(--text)]">{verifiedReferral.clinicalSummary}</p>
              </div>
            )}

            {verifiedReferral.safetyAlerts.length > 0 && (
              <div className="pt-2 border-t border-[color:var(--border-subtle)]">
                <span className="font-semibold text-[color:var(--text-muted)]">Safety & Support Alerts:</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {verifiedReferral.safetyAlerts.map((alert, idx) => (
                    <span
                      key={idx}
                      className="inline-block rounded-[var(--radius-sm)] bg-[color:var(--surface)] border border-[color:var(--border)] px-2 py-0.5 text-2xs font-medium text-[color:var(--text)]"
                    >
                      {alert}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Link href={CARING_CONTACTS_ROUTES.newPlan} data-internal-link="true" className={primaryControl}>
              <span>Initiate Care Plan</span>
            </Link>
            <Link href={CARING_CONTACTS_ROUTES.patients} data-internal-link="true" className={floatingControl}>
              <span>View Caseload</span>
            </Link>
            <button type="button" onClick={handleReset} className={floatingControl}>
              <span>Enter Another Referral</span>
            </button>
          </div>
        </section>
      ) : (
        /* Manual Intake Fallback Form */
        <form onSubmit={handleSubmit} className={`${workspacePanelPadded} space-y-5`}>
          <div className="border-b border-[color:var(--border-subtle)] pb-3">
            <h2 className="text-sm font-semibold text-[color:var(--text-heading)]">Referral Details</h2>
            <p className="text-xs text-[color:var(--text-muted)]">
              Enter the patient discharge information extracted from the hospital discharge summary.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Hospital Facility */}
            <div className="space-y-1">
              <label htmlFor="hospital-facility" className="block text-xs font-semibold text-[color:var(--text)]">
                Hospital Facility <span className="text-[color:var(--danger)]">*</span>
              </label>
              <select
                id="hospital-facility"
                value={facility}
                onChange={(e) => setFacility(e.target.value as WAHealthFacility)}
                required
                className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              >
                {WA_HEALTH_FACILITIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>

            {/* Admitting Ward */}
            <div className="space-y-1">
              <label htmlFor="admitting-ward" className="block text-xs font-semibold text-[color:var(--text)]">
                Admitting Ward / Unit
              </label>
              <input
                id="admitting-ward"
                type="text"
                value={admittingWard}
                onChange={(e) => setAdmittingWard(e.target.value)}
                placeholder="e.g. Ward 4A Acute Mental Health"
                className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              />
            </div>

            {/* Patient MRN */}
            <div className="space-y-1">
              <label htmlFor="patient-identifier" className="block text-xs font-semibold text-[color:var(--text)]">
                Patient Identifier (MRN / UMRN) <span className="text-[color:var(--danger)]">*</span>
              </label>
              <input
                id="patient-identifier"
                type="text"
                value={patientIdentifier}
                onChange={(e) => setPatientIdentifier(e.target.value)}
                placeholder="e.g. RPH-582914 or UMRN"
                required
                className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              />
            </div>

            {/* Discharge Date & Time */}
            <div className="space-y-1">
              <label htmlFor="discharge-date" className="block text-xs font-semibold text-[color:var(--text)]">
                Discharge Date & Time <span className="text-[color:var(--danger)]">*</span>
              </label>
              <input
                id="discharge-date"
                type="datetime-local"
                value={dischargeDate}
                onChange={(e) => setDischargeDate(e.target.value)}
                required
                className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              />
            </div>

            {/* Given Name */}
            <div className="space-y-1">
              <label htmlFor="given-name" className="block text-xs font-semibold text-[color:var(--text)]">
                Given Name <span className="text-[color:var(--danger)]">*</span>
              </label>
              <input
                id="given-name"
                type="text"
                value={givenName}
                onChange={(e) => setGivenName(e.target.value)}
                placeholder="e.g. Mira"
                required
                className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              />
            </div>

            {/* Family Name */}
            <div className="space-y-1">
              <label htmlFor="family-name" className="block text-xs font-semibold text-[color:var(--text)]">
                Family Name <span className="text-[color:var(--danger)]">*</span>
              </label>
              <input
                id="family-name"
                type="text"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder="e.g. Chen"
                required
                className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              />
            </div>

            {/* Mobile Number */}
            <div className="space-y-1">
              <label htmlFor="mobile-number" className="block text-xs font-semibold text-[color:var(--text)]">
                Mobile Telephone Number <span className="text-[color:var(--danger)]">*</span>
              </label>
              <input
                id="mobile-number"
                type="text"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                placeholder="e.g. +61 491 570 006 or 0491 570 006"
                required
                className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              />
              <p className="text-2xs text-[color:var(--text-muted)]">
                Must be an Australian mobile number. Landline numbers cannot receive SMS contacts.
              </p>
            </div>

            {/* Cohort */}
            <div className="space-y-1">
              <label htmlFor="cohort" className="block text-xs font-semibold text-[color:var(--text)]">
                Clinical Cohort
              </label>
              <select
                id="cohort"
                value={cohort}
                onChange={(e) => setCohort(e.target.value)}
                className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
              >
                <option value="adult_crisis">Adult Post-Discharge Crisis</option>
                <option value="youth_mh">Youth Mental Health</option>
                <option value="perinatal">Perinatal Care</option>
                <option value="general">General Support</option>
              </select>
            </div>
          </div>

          {/* Clinical Summary */}
          <div className="space-y-1">
            <label htmlFor="clinical-summary" className="block text-xs font-semibold text-[color:var(--text)]">
              Clinical Summary / Handover Notes
            </label>
            <textarea
              id="clinical-summary"
              rows={3}
              value={clinicalSummary}
              onChange={(e) => setClinicalSummary(e.target.value)}
              placeholder="Key clinical context, discharge reason, and follow-up arrangements..."
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
            />
          </div>

          {/* Safety Alerts */}
          <div className="space-y-1">
            <label htmlFor="safety-alerts" className="block text-xs font-semibold text-[color:var(--text)]">
              Support Notes & Safety Alerts (Comma-separated)
            </label>
            <input
              id="safety-alerts"
              type="text"
              value={safetyAlerts}
              onChange={(e) => setSafetyAlerts(e.target.value)}
              placeholder="e.g. Acute distress, Social isolation, Aftercare support required"
              className="w-full rounded-[var(--radius-md)] border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-2 text-xs text-[color:var(--text)] focus-visible:outline-2 focus-visible:outline-[color:var(--focus)]"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-3 border-t border-[color:var(--border-subtle)] flex items-center justify-between">
            <Link href={CARING_CONTACTS_ROUTES.today} data-internal-link="true" className={floatingControl}>
              <span>Cancel</span>
            </Link>

            <button type="submit" disabled={isSubmitting} className={primaryControl}>
              <Send aria-hidden="true" className="size-4 shrink-0" />
              <span>{isSubmitting ? "Validating..." : "Verify & Ingest Referral"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
