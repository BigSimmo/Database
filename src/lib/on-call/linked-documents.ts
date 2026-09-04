"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";

import type { OnCallLinkedDocument } from "@/lib/on-call/entry-model";

/**
 * Resolves the `linkedDocumentIds` an On Call entry carries to the one fact
 * the Playbook and Orientation sections may state about a document: its title
 * and its date.
 *
 * Those two sections are deliberately pure and prop-driven — they resolve
 * nothing themselves — so this is the seam that feeds them. An id with no
 * match here is treated exactly like an id that was never linked, which is
 * what stops a deleted or unreadable document from silently promoting a
 * playbook scenario to "has guidance" when nothing backs it.
 *
 * A failed fetch returns an empty map rather than throwing. That degrades the
 * right way: the Playbook renders its explicit "no local guideline" state,
 * which is honest, instead of a broken card or a claim it cannot support.
 */
const documentRowSchema = z.object({
  id: z.string(),
  title: z.string().nullish(),
  file_name: z.string().nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
});

const documentsResponseSchema = z.object({
  documents: z.array(z.unknown()).default([]),
});

export function useOnCallLinkedDocuments(): Readonly<Record<string, OnCallLinkedDocument>> {
  const [documents, setDocuments] = useState<Record<string, OnCallLinkedDocument>>({});

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch("/api/documents?limit=200");
        if (!response.ok) return;

        const parsed = documentsResponseSchema.safeParse(await response.json());
        if (!parsed.success || cancelled) return;

        const resolved: Record<string, OnCallLinkedDocument> = {};
        for (const raw of parsed.data.documents) {
          const row = documentRowSchema.safeParse(raw);
          if (!row.success) continue;
          // A document with neither a title nor a file name has nothing this
          // surface may display, so it is left unresolved rather than shown
          // as an untitled link the reader cannot identify.
          const title = row.data.title?.trim() || row.data.file_name?.trim();
          if (!title) continue;
          resolved[row.data.id] = {
            id: row.data.id,
            title,
            date: row.data.updated_at ?? row.data.created_at ?? null,
          };
        }
        setDocuments(resolved);
      } catch {
        // Offline or a malformed payload. Leave the map empty; see above.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo(() => documents, [documents]);
}
