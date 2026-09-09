"use client";

import { useState } from "react";

import { usePhoneMedia } from "@/components/compare/use-phone-media";

export function useComparePicker(openWhenIncomplete: boolean, initialSlot = 0) {
  const phone = usePhoneMedia();
  const [open, setOpen] = useState(openWhenIncomplete);
  const [activeSlot, setActiveSlot] = useState(initialSlot);
  const [query, setQuery] = useState("");
  const [wasIncomplete, setWasIncomplete] = useState(openWhenIncomplete);

  // Close during render only when a completed comparison arrives on a preserved
  // App Router instance (query-only navigation). Keying off the incomplete →
  // complete transition — not "is complete" — lets the user reopen a filled
  // pair. Avoids react-hooks/set-state-in-effect.
  if (wasIncomplete !== openWhenIncomplete) {
    setWasIncomplete(openWhenIncomplete);
    if (!openWhenIncomplete) {
      setOpen(false);
      setQuery("");
    }
  }

  function openSlot(index: number) {
    setActiveSlot(index);
    setQuery("");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setQuery("");
  }

  return {
    phone,
    open,
    setOpen,
    activeSlot,
    setActiveSlot,
    query,
    setQuery,
    openSlot,
    close,
  };
}
