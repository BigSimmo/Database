"use client";

import { useEffect, useRef, useState } from "react";

import { useAccountData } from "@/components/account-data-provider";

export function useTherapyFavourite(slug: string | null) {
  const accountData = useAccountData();
  const [notice, setNotice] = useState<string | null>(null);
  const saved = slug ? accountData.isSaved("therapy", slug) : false;
  const desiredSavedRef = useRef(saved);
  const currentSlugRef = useRef(slug);
  const latestMutationRef = useRef(0);
  useEffect(() => {
    desiredSavedRef.current = saved;
    currentSlugRef.current = slug;
  }, [saved, slug]);

  async function toggleFavourite() {
    if (!slug) return;
    const mutationId = ++latestMutationRef.current;
    const nowSaved = !desiredSavedRef.current;
    desiredSavedRef.current = nowSaved;
    try {
      if (!(await accountData.setFavourite("therapy", slug, nowSaved))) {
        if (mutationId !== latestMutationRef.current || currentSlugRef.current !== slug) return;
        desiredSavedRef.current = saved;
        setNotice(
          accountData.isAuthenticated ? "Save failed. Try again." : "Sign in or create an account to save therapies.",
        );
        return;
      }
      if (mutationId !== latestMutationRef.current || currentSlugRef.current !== slug) return;
      setNotice(nowSaved ? "Therapy saved." : "Therapy removed from saved items.");
    } catch {
      if (mutationId !== latestMutationRef.current || currentSlugRef.current !== slug) return;
      desiredSavedRef.current = saved;
      setNotice("Save failed. Try again.");
    }
  }

  return { notice, saved, toggleFavourite };
}
