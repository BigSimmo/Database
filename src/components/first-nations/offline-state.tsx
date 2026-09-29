"use client";
import { useEffect, useState } from "react";
import { StateModule } from "@/components/first-nations/state-module";

export function OfflineState() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline ? <StateModule kind="offline" onAction={() => window.location.reload()} /> : null;
}
