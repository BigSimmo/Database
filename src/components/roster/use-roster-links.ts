"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The doctor's calendar links, from `/api/roster/links`. The server never
 * sends a link's full address back (it can carry a private token): only its
 * host and "…", which is all these screens show.
 */
export type RosterCalendarLink = {
  readonly id: string;
  /** Host plus "…", e.g. `calendar.example.org/…`. */
  readonly display: string;
  readonly workplace: string | null;
  readonly refreshedAt: string | null;
  /** The last refresh's reason code, or null when it worked. */
  readonly failure: string | null;
};

export type RosterLinksState = {
  readonly status: "loading" | "ready" | "signed-out" | "error";
  readonly links: readonly RosterCalendarLink[];
  readonly add: (url: string, workplace: string | null) => Promise<string | null>;
  readonly remove: (id: string) => Promise<string | null>;
  readonly refresh: (id: string) => Promise<string | null>;
};

const LINKS_URL = "/api/roster/links";
/** A link refreshed this recently counts as live on Today. */
export const ROSTER_LINK_FRESH_MS = 6 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function readLink(value: unknown): RosterCalendarLink | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  if (!id) return null;
  return {
    id,
    display: text(value.display) ?? text(value.host) ?? "Calendar link",
    workplace: text(value.workplace),
    refreshedAt: text(value.refreshedAt) ?? text(value.lastRefreshedAt),
    failure: text(value.failure) ?? text(value.lastError),
  };
}

export function readRosterLinks(payload: unknown): RosterCalendarLink[] {
  const list = isRecord(payload) && Array.isArray(payload.links) ? payload.links : [];
  return list.flatMap((item) => {
    const link = readLink(item);
    return link ? [link] : [];
  });
}

/** The reason code in an error body, whether `{ error: { code } }` or `{ error, code }`. */
export function errorCodeOf(payload: unknown): string | null {
  if (!isRecord(payload)) return null;
  if (isRecord(payload.error)) return text(payload.error.code);
  return text(payload.code);
}

const ADD_ERRORS: Record<string, string> = {
  not_https: "Use a link that starts with https://.",
  private_address: "That link points at a private address.",
  blocked_address: "That link points at a private address.",
  too_long: "That link is too long.",
};

const REFRESH_ERRORS: Record<string, string> = {
  blocked_address: "That link points at a private address.",
  too_large: "That calendar is too big to read.",
  unreachable: "That calendar could not be reached.",
  not_calendar: "That link is not a calendar.",
  too_many_shifts: "That calendar has too many shifts.",
};

/** Words for a stored refresh failure. */
export function describeLinkFailure(code: string | null): string | null {
  if (!code) return null;
  return REFRESH_ERRORS[code] ?? "The last refresh did not work.";
}

/** Whether any link refreshed without error within the last six hours. */
export function hasFreshLink(links: readonly RosterCalendarLink[], now: Date): boolean {
  return links.some((link) => {
    if (link.failure || !link.refreshedAt) return false;
    const age = now.getTime() - Date.parse(link.refreshedAt);
    return age >= 0 && age <= ROSTER_LINK_FRESH_MS;
  });
}

type LoadedLinks = RosterCalendarLink[] | "signed-out" | "error" | "aborted";

async function fetchLinks(signal?: AbortSignal): Promise<LoadedLinks> {
  try {
    const response = await fetch(LINKS_URL, { cache: "no-store", signal });
    if (response.status === 401) return "signed-out";
    if (!response.ok) return "error";
    return readRosterLinks(await response.json().catch(() => null));
  } catch (error) {
    return (error as { name?: string })?.name === "AbortError" ? "aborted" : "error";
  }
}

export function useRosterLinks(): RosterLinksState {
  const [status, setStatus] = useState<RosterLinksState["status"]>("loading");
  const [links, setLinks] = useState<readonly RosterCalendarLink[]>([]);

  const apply = useCallback((result: LoadedLinks) => {
    if (result === "aborted") return;
    if (result === "signed-out" || result === "error") {
      setStatus(result);
      return;
    }
    setLinks(result);
    setStatus("ready");
  }, []);

  const load = useCallback(async () => apply(await fetchLinks()), [apply]);

  useEffect(() => {
    const controller = new AbortController();
    fetchLinks(controller.signal).then(apply, () => undefined);
    return () => controller.abort();
  }, [apply]);

  const add = useCallback(
    async (url: string, workplace: string | null) => {
      try {
        const response = await fetch(LINKS_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url, workplace }),
        });
        if (!response.ok) {
          if (response.status === 409) return "You can keep up to 3 calendar links.";
          const code = errorCodeOf(await response.json().catch(() => null));
          return (code && ADD_ERRORS[code]) ?? "That link could not be added.";
        }
        await load();
        return null;
      } catch {
        return "That link could not be added. Check your connection and try again.";
      }
    },
    [load],
  );

  const remove = useCallback(async (id: string) => {
    try {
      const response = await fetch(LINKS_URL, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) return "That link could not be removed.";
      setLinks((current) => current.filter((link) => link.id !== id));
      return null;
    } catch {
      return "That link could not be removed. Check your connection and try again.";
    }
  }, []);

  const refresh = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`${LINKS_URL}/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        await load();
        if (!response.ok) {
          return describeLinkFailure(errorCodeOf(await response.json().catch(() => null))) ?? "Refresh did not work.";
        }
        return null;
      } catch {
        return "That link could not be refreshed. Check your connection and try again.";
      }
    },
    [load],
  );

  return { status, links, add, remove, refresh };
}
