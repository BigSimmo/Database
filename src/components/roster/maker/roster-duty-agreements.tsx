"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { rosterMyAgreementsSchema, type RosterMyAgreements } from "@/lib/roster/maker/workflow-model";
import { RosterProposalComparison } from "./roster-proposal-comparison";

/** The server returns only this session doctor's own before/after duties. */
export function RosterDutyAgreements({ serviceId, sites = {} }: { serviceId: string; sites?: Record<string, string> }) {
  const [data, setData] = useState<RosterMyAgreements | null>(null);
  const [selected, setSelected] = useState("");
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const alive = useRef(true);
  const pending = useRef(false);
  const url = `/api/roster/team/${encodeURIComponent(serviceId)}/agreements`;
  const load = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch(url, { cache: "no-store", signal });
      if (!response.ok)
        throw new Error("Duty-change reviews are unavailable. Your published duties have not changed here.");
      const result = rosterMyAgreementsSchema.parse(await response.json());
      if (!signal?.aborted && alive.current) {
        setData(result);
        setReviewed(false);
      }
    },
    [url],
  );
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void load(controller.signal).catch((cause: unknown) => {
      if (!controller.signal.aborted && alive.current)
        setError(cause instanceof Error ? cause.message : "Could not load duty changes.");
    });
    return () => {
      alive.current = false;
      controller.abort();
    };
  }, [load]);
  async function refresh() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await load();
    } catch {
      if (alive.current) setError("Duty-change reviews could not be refreshed. Try again.");
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const proposal = data?.proposals.find((item) => item.id === selected);
  async function agree() {
    if (pending.current || !proposal || !reviewed || proposal.status !== "pending" || proposal.agreedAt) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "agree", proposalId: proposal.id }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "The proposed duties changed. Reload and review again before agreeing."
            : "Agreement could not be confirmed. Reload before trying again.",
        );
      await load();
      if (alive.current)
        setMessage(
          "Your agreement is recorded. Your published duties change only when the manager publishes this review.",
        );
    } catch (cause) {
      if (alive.current) {
        setReviewed(false);
        setData(null);
        setError(
          cause instanceof Error ? cause.message : "Agreement could not be confirmed. Reload before trying again.",
        );
      }
    } finally {
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section
      aria-label="Changes needing my agreement"
      className="grid gap-3 rounded-xl border border-[color:var(--border)] p-4"
    >
      <h2 className="text-lg font-medium">Changes needing my agreement</h2>
      <p className="text-sm">
        Review your own proposed duties. You may leave a proposal unanswered; it cannot change your published duties
        without your agreement.
      </p>
      <Button disabled={busy} onClick={() => void refresh()}>
        Refresh duty changes
      </Button>
      {data?.proposals.length === 0 ? <p>No duty changes awaiting your review.</p> : null}
      {data?.proposals.length ? (
        <label className="grid gap-1 text-sm">
          Duty change to review
          <select
            value={selected}
            disabled={busy}
            className="min-h-12 rounded border bg-[color:var(--surface)] p-2"
            onChange={(event) => {
              setSelected(event.target.value);
              setReviewed(false);
              setMessage("");
            }}
          >
            <option value="">Choose a proposed change</option>
            {data.proposals.map((item) => (
              <option value={item.id} key={item.id}>
                {item.periodStart} to {item.periodEnd} · draft v{item.draftVersion} ·{" "}
                {item.agreedAt ? "agreed" : item.status}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {proposal ? (
        <div className="grid gap-3">
          <RosterProposalComparison before={proposal.before} after={proposal.after} sites={sites} />
          {proposal.status !== "pending" ? (
            <p>This review is {proposal.status}. It cannot accept a new agreement.</p>
          ) : proposal.agreedAt ? (
            <p>You agreed to this exact review.</p>
          ) : (
            <>
              <label className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={reviewed}
                  disabled={busy}
                  onChange={(event) => setReviewed(event.target.checked)}
                />
                I have reviewed and agree to these changes to my duties.
              </label>
              <Button variant="primary" disabled={busy || !reviewed} onClick={() => void agree()}>
                Record my agreement
              </Button>
            </>
          )}
        </div>
      ) : null}
      {busy ? <p role="status">Checking your duty changes…</p> : null}
      {error ? <p role="alert">{error}</p> : null}
      {message ? <p role="status">{message}</p> : null}
    </section>
  );
}
