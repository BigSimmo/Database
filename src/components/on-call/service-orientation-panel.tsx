"use client";

import { Check, Circle, Pencil } from "lucide-react";
import { useState } from "react";

import { cardSurface } from "@/components/card-recipes";
import { Button } from "@/components/ui/button";
import { InlineNotice, cn, textMuted } from "@/components/ui-primitives";
import type { ServiceAction, ServiceDetail, ServiceEntry } from "@/lib/on-call/service-model";

type OrientationAction = Extract<ServiceAction, { action: "orientation.set" }>;
type OrientationGroup = "before" | "during" | "leaving";

const groupLabels: Record<OrientationGroup, string> = {
  before: "Before starting",
  during: "During the rotation",
  leaving: "Before leaving",
};

function phaseGroup(phase: ServiceEntry["content"]["orientationPhase"]): OrientationGroup {
  if (phase === "before_start") return "before";
  if (phase === "leaving") return "leaving";
  return "during";
}

export function ServiceOrientationPanel({
  detail,
  selectedSiteId,
  rotation,
  canEdit,
  onEdit,
  onAction,
}: {
  readonly detail: ServiceDetail;
  readonly selectedSiteId: string | null;
  readonly rotation: string;
  readonly canEdit: boolean;
  readonly onEdit: (entry: ServiceEntry) => void;
  readonly onAction: (action: OrientationAction) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const entries = detail.entries
    .filter((entry) => entry.content.section === "orientation")
    .map((entry) => ({
      entry,
      content: entry.publishedContent ?? (entry.status === "published" ? entry.content : null),
      revision: entry.publishedRevision ?? (entry.status === "published" ? entry.revision : null),
    }))
    .filter(
      (item) =>
        (item.content !== null || canEdit) &&
        ((item.content ?? item.entry.content).siteId === null ||
          (item.content ?? item.entry.content).siteId === selectedSiteId),
    );

  function isComplete(entry: ServiceEntry, publishedRevision: number | null): boolean {
    if (!selectedSiteId || !rotation.trim() || publishedRevision === null) return false;
    return detail.orientation.some(
      (item) =>
        item.entryId === entry.id &&
        item.siteId === selectedSiteId &&
        item.rotation === rotation.trim() &&
        item.revision === publishedRevision,
    );
  }

  async function toggle(entry: ServiceEntry, publishedRevision: number) {
    if (!selectedSiteId || !rotation.trim() || busyId) return;
    setBusyId(entry.id);
    setError(null);
    try {
      await onAction({
        action: "orientation.set",
        entryId: entry.id,
        siteId: selectedSiteId,
        rotation: rotation.trim(),
        completed: !isComplete(entry, publishedRevision),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This orientation item could not be updated.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="service-orientation-heading" className="grid gap-4" data-testid="service-orientation">
      <div>
        <h2 id="service-orientation-heading" className="text-lg font-bold text-[color:var(--text-heading)]">
          Site orientation
        </h2>
        <p className={cn(textMuted, "mt-1 text-sm leading-6")}>
          Completion is private to your account, selected site and named rotation. A revised item needs a fresh check.
        </p>
      </div>
      {!selectedSiteId || !rotation.trim() ? (
        <InlineNotice tone="neutral">
          Choose a site and name this rotation before marking orientation complete.
        </InlineNotice>
      ) : null}
      {error ? <InlineNotice tone="danger">{error}</InlineNotice> : null}

      {(["before", "during", "leaving"] as const).map((group) => {
        const groupEntries = entries.filter(
          (item) => phaseGroup((item.content ?? item.entry.content).orientationPhase) === group,
        );
        return (
          <section key={group} aria-labelledby={`orientation-${group}-heading`} className="grid gap-2">
            <h3 id={`orientation-${group}-heading`} className="text-sm font-bold text-[color:var(--text-heading)]">
              {groupLabels[group]}
            </h3>
            {groupEntries.length === 0 ? (
              <p className={cn(textMuted, "text-sm")}>No published items for this stage yet.</p>
            ) : (
              <div className="grid gap-2">
                {groupEntries.map(({ entry, content, revision }) => {
                  const visibleContent = content ?? entry.content;
                  const complete = isComplete(entry, revision);
                  return (
                    <article
                      key={entry.id}
                      className={cn(cardSurface, "grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center")}
                    >
                      <div className="min-w-0">
                        <h4 className="break-words text-sm font-bold text-[color:var(--text-heading)]">
                          {visibleContent.title}
                        </h4>
                        {visibleContent.body ? (
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--text)]">
                            {visibleContent.body}
                          </p>
                        ) : null}
                      </div>
                      <div className="grid gap-2">
                        {revision !== null ? (
                          <Button
                            variant={complete ? "secondary" : "primary"}
                            icon={complete ? Check : Circle}
                            busy={busyId === entry.id}
                            busyLabel="Saving…"
                            disabled={!selectedSiteId || !rotation.trim() || busyId !== null}
                            onClick={() => void toggle(entry, revision)}
                          >
                            {complete ? "Completed" : "Mark complete"}
                          </Button>
                        ) : (
                          <span className={cn(textMuted, "text-xs")}>Draft · not in the member checklist</span>
                        )}
                        {canEdit ? (
                          <Button variant="ghost" size="sm" icon={Pencil} onClick={() => onEdit(entry)}>
                            Edit
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </section>
  );
}
