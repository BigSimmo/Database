/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TeachingCpdBridgeSheet } from "@/components/teaching/teaching-cpd-bridge-sheet";
import * as client from "@/lib/teaching/client";

describe("TeachingCpdBridgeSheet", () => {
  it("renders session information and 1-tap CPD button", () => {
    render(
      <TeachingCpdBridgeSheet
        open={true}
        onClose={() => {}}
        occurrenceId="occ-1"
        title="Psychopharmacology Update"
        hours={1.0}
      />,
    );

    expect(screen.getByText("Psychopharmacology Update")).toBeTruthy();
    expect(screen.getByText("1.0 h · Category 1: Educational Activities")).toBeTruthy();
    const logButton = screen.getByTestId("teaching-cpd-bridge-log-button");
    expect(logButton).toBeTruthy();
    expect(logButton.textContent).toContain("Log 1.0 h to CPD");
  });

  it("handles 1-tap logging and shows undo countdown ring", async () => {
    const postSpy = vi.spyOn(client, "teachingPost").mockResolvedValueOnce({
      entryId: "cpd-entry-123",
      created: true,
    });

    render(
      <TeachingCpdBridgeSheet
        open={true}
        onClose={() => {}}
        occurrenceId="occ-1"
        title="Psychopharmacology Update"
        hours={1.0}
      />,
    );

    fireEvent.click(screen.getByTestId("teaching-cpd-bridge-log-button"));

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        "/api/teaching/cpd",
        expect.objectContaining({ occurrenceId: "occ-1", hours: 1.0 }),
      );
      expect(screen.getByTestId("teaching-cpd-bridge-confirmed")).toBeTruthy();
      expect(screen.getByTestId("teaching-cpd-bridge-undo-button")).toBeTruthy();
    });

    // Tap undo
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 }));
    fireEvent.click(screen.getByTestId("teaching-cpd-bridge-undo-button"));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/cme/entries/cpd-entry-123",
      expect.objectContaining({ method: "PATCH" }),
    );
    await waitFor(() => {
      expect(screen.queryByTestId("teaching-cpd-bridge-confirmed")).toBeNull();
      expect(screen.getByTestId("teaching-cpd-bridge-log-button")).toBeTruthy();
    });
  });

  it("preserves confirmed state and displays error when undo request fails", async () => {
    vi.spyOn(client, "teachingPost").mockResolvedValueOnce({
      entryId: "cpd-entry-999",
      created: true,
    });
    render(
      <TeachingCpdBridgeSheet
        open={true}
        onClose={vi.fn()}
        occurrenceId="occ-err"
        title="Session With Undo Fail"
        hours={1.0}
      />,
    );

    fireEvent.click(screen.getByTestId("teaching-cpd-bridge-log-button"));
    await waitFor(() => {
      expect(screen.getByTestId("teaching-cpd-bridge-confirmed")).toBeTruthy();
    });

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("Internal Server Error", { status: 500 }));
    fireEvent.click(screen.getByTestId("teaching-cpd-bridge-undo-button"));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Failed to undo CPD log (500)");
      // Confirmed state must be preserved
      expect(screen.getByTestId("teaching-cpd-bridge-confirmed")).toBeTruthy();
    });
  });

  it("does not offer undo when occurrence is already in CPD record", async () => {
    vi.spyOn(client, "teachingPost").mockResolvedValueOnce({
      entryId: "cpd-existing",
      created: false,
    });
    render(
      <TeachingCpdBridgeSheet
        open={true}
        onClose={vi.fn()}
        occurrenceId="occ-exist"
        title="Already Logged Session"
        hours={1.0}
      />,
    );

    fireEvent.click(screen.getByTestId("teaching-cpd-bridge-log-button"));
    await waitFor(() => {
      expect(screen.getByText("Already in your CPD record")).toBeInTheDocument();
      expect(screen.queryByTestId("teaching-cpd-bridge-undo-button")).toBeNull();
    });
  });
});
