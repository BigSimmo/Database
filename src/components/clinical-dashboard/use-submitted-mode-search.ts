import { useCallback, useState } from "react";
import type { AppModeId } from "@/lib/app-modes";

/** Keeps the visible results attached to their submitted query while the composer is edited. */
export function useSubmittedModeSearch({
  autoRunSearch,
  initialQuery,
  initialSearchMode,
}: {
  autoRunSearch?: boolean;
  initialQuery: string;
  initialSearchMode: AppModeId;
}) {
  const [modeSearchSubmitted, setModeSearchSubmittedFlag] = useState(() =>
    Boolean(autoRunSearch && initialQuery.trim() && initialSearchMode !== "tools"),
  );
  // The query the mode's on-screen results actually belong to, which is NOT `query`:
  // editing the bottom composer calls `setQuery` alone and leaves both the results and
  // the submitted flag in place. Anything keyed to the submitted search must read this,
  // or a paused draft silently replaces it while the primary cards still show the last
  // submitted search. Null until a submission records one.
  const [submittedModeQuery, setSubmittedModeQuery] = useState<string | null>(() =>
    autoRunSearch && initialQuery.trim() && initialSearchMode !== "tools" ? initialQuery.trim() : null,
  );
  // Every submission already sets `query` to the text it submitted, so the text is passed
  // here too rather than read back from state. Clearing the flag clears the query with it.
  const setModeSearchSubmitted = useCallback((submitted: boolean, submittedText?: string) => {
    setModeSearchSubmittedFlag(submitted);
    if (!submitted) setSubmittedModeQuery(null);
    else if (submittedText !== undefined) setSubmittedModeQuery(submittedText.trim());
  }, []);
  return { modeSearchSubmitted, submittedModeQuery, setModeSearchSubmitted };
}
