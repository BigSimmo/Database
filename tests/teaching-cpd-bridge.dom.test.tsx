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
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(JSON.stringify({})));
    fireEvent.click(screen.getByTestId("teaching-cpd-bridge-undo-button"));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/cme/entries/cpd-entry-123",
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(screen.queryByTestId("teaching-cpd-bridge-confirmed")).toBeNull();
    expect(screen.getByTestId("teaching-cpd-bridge-log-button")).toBeTruthy();
  });
});
