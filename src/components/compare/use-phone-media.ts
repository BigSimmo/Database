"use client";

import { useEffect, useState } from "react";

/** Matches Tailwind `sm` / Dictionary compare: phone sheet below 640px. */
export function usePhoneMedia() {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const update = () => setIsPhone(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return isPhone;
}
