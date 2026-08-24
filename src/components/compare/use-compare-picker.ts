"use client";

import { useState } from "react";

import { usePhoneMedia } from "@/components/compare/use-phone-media";

export function useComparePicker(openWhenIncomplete: boolean, initialSlot = 0) {
  const phone = usePhoneMedia();
  const [open, setOpen] = useState(openWhenIncomplete);
  const [activeSlot, setActiveSlot] = useState(initialSlot);
  const [query, setQuery] = useState("");

  // Close during render when a completed comparison arrives on a preserved App
  // Router instance (query-only navigation). Avoids react-hooks/set-state-in-effect.
  // Do not force-open if the user dismissed the picker while slots were still empty.
  if (!openWhenIncomplete && open) {
    setOpen(false);
    setQuery("");
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
