/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => import("./helpers/teaching-auth"));

import { GroupSheet, SeriesSheet } from "@/components/teaching/organise-sheets";
import { TEAM_A, TODAY, apiError, json, serveFetch, useTeachingTestClock } from "./helpers/teaching-fixtures";

// eslint-disable-next-line react-hooks/rules-of-hooks
useTeachingTestClock();

const SERIES = "55555555-5555-4555-8555-555555555555";
const GROUP = "66666666-6666-4666-8666-666666666666";
const MEMBER = "77777777-7777-4777-8777-777777777777";
const serviceUrl = `/api/teaching/services/${TEAM_A}`;

describe("Organise save retries", () => {
  it("updates the first series after opening it fails, keeping later form edits", async () => {
    const posts: Record<string, unknown>[] = [];
    let openAttempts = 0;
    serveFetch((url, body) => {
      if (!body) return null;
      posts.push(body);
      if (url === serviceUrl && body.action === "series.save") return json(200, { seriesId: SERIES });
      if (url === `/api/teaching/resources/services/${TEAM_A}` && body.action === "series.set_open_to") {
        openAttempts += 1;
        return openAttempts === 1 ? apiError(503, "temporary") : json(200, { seriesId: SERIES });
      }
      return null;
    });
    const onSaved = vi.fn();
    render(
      <SeriesSheet
        serviceId={TEAM_A}
        series={null}
        organise={{ series: [], groups: [], members: [] }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Registrar teaching" } });
    fireEvent.change(screen.getByLabelText("First date"), { target: { value: TODAY } });
    fireEvent.click(screen.getByRole("radio", { name: "Health service" }));
    fireEvent.click(screen.getByRole("button", { name: "Save series" }));
    await screen.findByText("The outcome could not be confirmed. Check your records before trying again.");
    expect(onSaved).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Updated teaching" } });
    fireEvent.click(screen.getByRole("button", { name: "Save series" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(posts.map((body) => body.action)).toEqual([
      "series.save",
      "series.set_open_to",
      "series.save",
      "series.set_open_to",
    ]);
    expect(posts[0]).not.toHaveProperty("seriesId");
    expect(posts[2]).toMatchObject({ seriesId: SERIES, title: "Updated teaching" });
    expect(posts[1]).toMatchObject({ seriesId: SERIES, openTo: "health_service" });
    expect(posts[3]).toMatchObject({ seriesId: SERIES, openTo: "health_service" });
  });

  it("updates the first group after setting members fails, keeping later form edits", async () => {
    const posts: Record<string, unknown>[] = [];
    let memberAttempts = 0;
    serveFetch((url, body) => {
      if (url !== serviceUrl || !body) return null;
      posts.push(body);
      if (body.action === "group.save") return json(200, { groupId: GROUP });
      if (body.action === "group.members.set") {
        memberAttempts += 1;
        return memberAttempts === 1 ? apiError(503, "temporary") : json(200, {});
      }
      return null;
    });
    const onSaved = vi.fn();
    render(
      <GroupSheet
        serviceId={TEAM_A}
        group={null}
        organise={{
          series: [],
          groups: [],
          members: [{ userId: MEMBER, name: "Demo Dr A", role: "doctor", joinedAt: "2026-01-01T00:00:00Z" }],
        }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Registrars" } });
    fireEvent.click(screen.getByRole("checkbox", { name: "Demo Dr A" }));
    fireEvent.click(screen.getByRole("button", { name: "Save group" }));
    await screen.findByText("The outcome could not be confirmed. Check your records before trying again.");
    expect(onSaved).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Senior registrars" } });
    fireEvent.click(screen.getByRole("button", { name: "Save group" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(posts.map((body) => body.action)).toEqual([
      "group.save",
      "group.members.set",
      "group.save",
      "group.members.set",
    ]);
    expect(posts[0]).not.toHaveProperty("groupId");
    expect(posts[2]).toMatchObject({ groupId: GROUP, name: "Senior registrars" });
    expect(posts[1]).toMatchObject({ groupId: GROUP, userIds: [MEMBER] });
    expect(posts[3]).toMatchObject({ groupId: GROUP, userIds: [MEMBER] });
  });

  it("stops a new series without a returned ID from being saved again", async () => {
    const posts: Record<string, unknown>[] = [];
    serveFetch((url, body) => {
      if (url !== serviceUrl || body?.action !== "series.save") return null;
      posts.push(body);
      return json(200, {});
    });
    const onSaved = vi.fn();
    render(
      <SeriesSheet
        serviceId={TEAM_A}
        series={null}
        organise={{ series: [], groups: [], members: [] }}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Registrar teaching" } });
    fireEvent.change(screen.getByLabelText("First date"), { target: { value: TODAY } });
    fireEvent.click(screen.getByRole("button", { name: "Save series" }));
    expect(await screen.findByText(/series may have saved, but its ID was missing/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save series" })).toBeDisabled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(posts).toHaveLength(1);
  });
});
