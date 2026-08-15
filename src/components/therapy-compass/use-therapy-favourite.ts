"use client";

import { useRef, useState } from "react";

import { useAccountData } from "@/components/account-data-provider";

export function useTherapyFavourite(slug: string | null) {
  const accountData = useAccountData();
  const [notice, setNotice] = useState<string | null>(null);
  const mutationInFlight = useRef(false);
  const saved = slug ? accountData.isSaved("therapy", slug) : false;

  async function toggleFavourite() {
    if (!slug || mutationInFlight.current) return;
    mutationInFlight.current = true;
    const nowSaved = !saved;
    try {
      if (!(await accountData.setFavourite("therapy", slug, nowSaved))) {
        setNotice(
          accountData.isAuthenticated ? "Save failed. Try again." : "Sign in or create an account to save therapies.",
        );
        return;
      }
      setNotice(nowSaved ? "Therapy saved." : "Therapy removed from saved items.");
    } catch {
      setNotice("Save failed. Try again.");
    } finally {
      mutationInFlight.current = false;
    }
  }

  return { notice, saved, toggleFavourite };
}
