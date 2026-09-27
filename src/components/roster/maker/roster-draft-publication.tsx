"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { rosterDraftReceiptSchema, type RosterDraft } from "@/lib/roster/maker/model";
import {
  rosterMakerStateSchema,
  rosterMakerProposalSchema,
  rosterMakerPublicationReceiptSchema,
  type RosterMakerState,
  type RosterMakerProposal,
} from "@/lib/roster/maker/workflow-model";
import type { RosterOverview, RosterPerson } from "@/lib/roster/team/model";
import { formatPerthDay, perthDateOf, perthTimeOf } from "@/lib/roster/shifts/perth-time";
import { RosterProposalComparison } from "./roster-proposal-comparison";

const box = "grid gap-3 rounded-xl border border-[color:var(--border)] p-4";
const alertResultSchema = z.object({
  status: z.enum(["not_retried", "not_configured", "partial", "failed", "processed"]),
  sent: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});
const blockerLabel: Record<string, string> = {
  unlinked_duty: "Link named doctors to team members before changing their published duties.",
  inactive_doctor: "An affected doctor is no longer a current team member. Resolve their team membership first.",
  protected_change: "An approved swap or claimed shift needs explicit review before it can be replaced.",
};

export function RosterDraftPublication({
  serviceId,
  snapshot,
  overview,
  people,
  disabled = false,
  onPublished,
}: {
  serviceId: string;
  snapshot: RosterDraft;
  overview: RosterOverview;
  people: RosterPerson[];
  disabled?: boolean;
  onPublished: (message?: string) => void;
}) {
  const [state, setState] = useState<RosterMakerState | null>(null);
  const [selected, setSelected] = useState<RosterMakerProposal | null>(null);
  const [changeId, setChangeId] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [fresh, setFresh] = useState(false);
  const [overrides, setOverrides] = useState<string[]>([]);
  const alive = useRef(true);
  const pending = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const url = `/api/roster/team/${encodeURIComponent(serviceId)}/maker`;
  const names = Object.fromEntries(
    people.map((person) => [person.userId, person.rosterName ?? person.displayName ?? "Team member"]),
  );
  const sites = Object.fromEntries(overview.sites.map((site) => [site.id, site.name]));
  async function request(body?: object): Promise<unknown> {
    const response = await fetch(body ? url : `${url}?draftId=${encodeURIComponent(snapshot.draft.id)}`, {
      cache: "no-store",
      ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    const value: unknown = await response.json();
    if (!response.ok)
      throw new Error(
        response.status === 409
          ? "The draft, live roster or agreements changed. Reload the review before continuing."
          : "This action could not be confirmed. Reload the review before trying again.",
      );
    return value;
  }
  async function act(work: () => Promise<void>) {
    if (pending.current || disabled) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (cause) {
      if (alive.current) {
        setFresh(false);
        setReviewed(false);
        setError(cause instanceof Error ? cause.message : "Could not confirm the change. Reload the review.");
      }
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  async function reload() {
    const value = rosterMakerStateSchema.parse(await request());
    if (!alive.current) return;
    setState(value);
    setFresh(true);
    setReviewed(false);
    setOverrides([]);
    setSelected((old) => (old ? (value.proposals.find((proposal) => proposal.id === old.id) ?? null) : null));
  }
  async function create(scope: "full" | "change", replaceProtected = false) {
    const payload = await request({
      action: "proposal.create",
      draftId: snapshot.draft.id,
      expectedVersion: snapshot.draft.version,
      scope,
      ...(scope === "change" ? { changeId: replaceProtected ? selected?.changeId : changeId } : {}),
      ...(replaceProtected && selected
        ? {
            overrideChanges: selected.protectedChanges
              .filter((item) => overrides.includes(`${item.kind}:${item.id}`))
              .map(({ kind, id }) => ({ kind, id })),
          }
        : {}),
    });
    const value = rosterMakerProposalSchema.parse((payload as { proposal?: unknown })?.proposal);
    if (alive.current) {
      setSelected(value);
      setReviewed(false);
      setOverrides([]);
      setFresh(true);
    }
  }
  async function reconcile() {
    if (!state?.reconciliation || !reviewed || !fresh) return;
    const receipt = rosterDraftReceiptSchema.parse(
      await request({
        action: "draft.reconcile",
        draftId: snapshot.draft.id,
        expectedVersion: snapshot.draft.version,
        expectedLiveToken: state.reconciliation.liveToken,
      }),
    );
    if (receipt.draftId !== snapshot.draft.id || receipt.version !== snapshot.draft.version + 1)
      throw new Error("Reconciliation could not be confirmed. Reload the draft.");
    if (alive.current) {
      setState(null);
      setSelected(null);
      setReviewed(false);
      setFresh(false);
      onPublished("Draft retained with the reviewed live baseline. No duties were published.");
    }
  }
  async function publish() {
    if (!selected || !reviewed || !fresh || !selected.canPublish || selected.draftVersion !== snapshot.draft.version)
      return;
    const result = await request({ action: "proposal.publish", proposalId: selected.id });
    const receipt = rosterMakerPublicationReceiptSchema.parse(result);
    const alerts = alertResultSchema.safeParse((result as { alerts?: unknown })?.alerts);
    const delivery = !alerts.success
      ? "Phone-alert delivery is unconfirmed."
      : alerts.data.status === "not_configured"
        ? "Phone alerts are not configured."
        : alerts.data.status === "not_retried"
          ? "Alerts were not sent again."
          : alerts.data.status === "failed" || alerts.data.status === "partial"
            ? `Phone alerts: ${alerts.data.sent} sent, ${alerts.data.failed} failed, ${alerts.data.skipped} skipped. Publication succeeded.`
            : `Phone alerts: ${alerts.data.sent} sent, ${alerts.data.skipped} skipped.`;
    const confirmation = `${receipt.replayed ? "Already published" : "Published"} as roster version ${receipt.version}. ${delivery}`;
    if (alive.current) {
      setSelected(null);
      setFresh(false);
      setReviewed(false);
      setMessage(confirmation);
      onPublished(confirmation);
    }
  }
  return (
    <section className={box} aria-label="Review and publish draft">
      <h3 className="font-semibold">Review and publish</h3>
      <p className="text-sm">
        Doctors keep their current duties until publication succeeds. Each affected doctor must agree to changes to
        their published duties in Requests.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy || disabled} onClick={() => void act(() => create("full"))}>
          Review whole draft
        </Button>
        <Button disabled={busy || disabled} onClick={() => void act(reload)}>
          Reload publication reviews
        </Button>
      </div>
      {state?.reconciliation ? (
        <div className={box}>
          <h4 className="font-medium">Reconcile the draft with current duties</h4>
          <p className="text-sm">
            Published duties have changed, or this draft has no recorded baseline. Review the current published duties
            against your draft. Continuing retains your draft, records the current live baseline and invalidates older
            publication reviews. No duties are published here.
          </p>
          <RosterProposalComparison
            before={state.reconciliation.before}
            after={state.reconciliation.after}
            names={names}
            sites={sites}
          />
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={reviewed}
              disabled={busy || disabled || !fresh}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            I reviewed the current live duties and retained draft differences.
          </label>
          <Button disabled={busy || disabled || !fresh || !reviewed} onClick={() => void act(reconcile)}>
            Keep draft and adopt reviewed baseline
          </Button>
        </div>
      ) : null}
      <label className="grid gap-1 text-sm">
        Single draft change
        <select
          className="min-h-12 rounded border bg-[color:var(--surface)] p-2"
          value={changeId}
          disabled={busy || disabled}
          onChange={(event) => setChangeId(event.target.value)}
        >
          <option value="">Choose a change</option>
          {snapshot.changes
            .filter((change) => !change.undoneAt)
            .map((change) => (
              <option key={change.id} value={change.id}>
                Change {change.id} · {change.source} ·{" "}
                {new Date(change.at).toLocaleString("en-AU", { timeZone: "Australia/Perth" })}
              </option>
            ))}
        </select>
      </label>
      <Button disabled={busy || disabled || !changeId} onClick={() => void act(() => create("change"))}>
        Review only selected change
      </Button>
      {state?.proposals.length ? (
        <label className="grid gap-1 text-sm">
          Saved publication review
          <select
            className="min-h-12 rounded border bg-[color:var(--surface)] p-2"
            value={selected?.id ?? ""}
            disabled={busy || disabled}
            onChange={(event) => {
              setSelected(state.proposals.find((proposal) => proposal.id === event.target.value) ?? null);
              setReviewed(false);
            }}
          >
            <option value="">Choose a review</option>
            {state.proposals.map((proposal) => (
              <option value={proposal.id} key={proposal.id}>
                {proposal.scope === "full" ? "Whole draft" : `Change ${proposal.changeId}`} · draft v
                {proposal.draftVersion} · {proposal.status}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {selected ? (
        <div className={box}>
          <h4 className="font-medium">
            {selected.scope === "full" ? "Whole draft" : `Only change ${selected.changeId}`} · {selected.periodStart} to{" "}
            {selected.periodEnd}
          </h4>
          <RosterProposalComparison before={selected.before} after={selected.after} names={names} sites={sites} />
          <ul className="grid gap-2 text-sm">
            {selected.affected.map((doctor) => (
              <li key={doctor.userId}>
                {doctor.displayName}: {doctor.agreedAt ? "Agreed to this review" : "Waiting for agreement in Requests"}
              </li>
            ))}
          </ul>
          {selected.blockers.map((reason) => (
            <p key={reason} role="status">
              {blockerLabel[reason] ?? "This review cannot be published."}
            </p>
          ))}
          {selected.blockers.includes("protected_change") && selected.protectedChanges.length ? (
            <div className="grid gap-2">
              <p className="text-sm">
                Choose each approved change you intend to replace, after reviewing its duties above. Affected doctors
                must agree to the new review.
              </p>
              {selected.protectedChanges.map((item) => {
                const key = `${item.kind}:${item.id}`;
                return (
                  <label key={key} className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      checked={overrides.includes(key)}
                      disabled={busy || disabled}
                      onChange={(event) =>
                        setOverrides((current) =>
                          event.target.checked ? [...current, key] : current.filter((id) => id !== key),
                        )
                      }
                    />
                    <span>
                      Replace approved {item.kind === "swap" ? "swap" : "claimed shift"}
                      <span className="block text-sm">
                        {item.before
                          .map(
                            (row) =>
                              `${row.userId ? (names[row.userId] ?? "Team doctor") : (row.rosterName ?? "Unfilled shift")} · ${formatPerthDay(perthDateOf(row.startsAt))} · ${row.shiftCode} ${perthTimeOf(row.startsAt)}–${perthTimeOf(row.endsAt)}`,
                          )
                          .join("; ")}
                      </span>
                    </span>
                  </label>
                );
              })}
              <Button
                disabled={busy || disabled || overrides.length !== selected.protectedChanges.length}
                onClick={() => void act(() => create(selected.scope, true))}
              >
                Create review with selected overrides
              </Button>
            </div>
          ) : null}
          {selected.status === "stale" || selected.draftVersion !== snapshot.draft.version ? (
            <p role="status">This review is out of date. Create a new review.</p>
          ) : null}
          {selected.status === "published" ? <p role="status">This review has already been published.</p> : null}
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={reviewed}
              disabled={busy || disabled || !fresh}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            I reviewed the before and after duties, including removals.
          </label>
          <Button
            variant="primary"
            disabled={
              busy ||
              disabled ||
              !fresh ||
              !reviewed ||
              !selected.canPublish ||
              selected.draftVersion !== snapshot.draft.version
            }
            onClick={() => void act(publish)}
          >
            Publish reviewed duties
          </Button>
        </div>
      ) : null}
      {busy ? <p role="status">Checking the current roster…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
