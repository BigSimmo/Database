"use client";

import { useEffect, useState } from "react";

import { usePhoneMedia } from "@/components/compare/use-phone-media";

export function useComparePicker(openWhenIncomplete: boolean, initialSlot = 0) {
  const phone = usePhoneMedia();
  const [open, setOpen] = useState(openWhenIncomplete);
  const [activeSlot, setActiveSlot] = useState(initialSlot);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!openWhenIncomplete) setOpen(false);
  }, [openWhenIncomplete]);

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
