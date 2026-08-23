/** @vitest-environment jsdom */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const streamClinicalAsk = vi.hoisted(() => vi.fn());
vi.mock("@/lib/clinical-ask/client-stream", () => ({ streamClinicalAsk }));

import {
  ClinicalAskSessionProvider,
  useClinicalAskSession,
} from "@/components/clinical-dashboard/clinical-ask-session-context";
import { useClinicalAskRunner } from "@/components/clinical-dashboard/use-clinical-ask-runner";
import type { ClinicalAskFinalPayload } from "@/lib/clinical-ask/contracts";

type PendingRun = {
  signal: AbortSignal;
  resolve(payload: ClinicalAskFinalPayload): void;
};

function RunnerHarness({ query }: { query: string }) {
  const session = useClinicalAskSession();
  const run = useClinicalAskRunner({
    clinicalAskMode: "services",
    clinicalAskOnline: true,
    clinicalAskSession: session,
    query,
  });
  return (
    <>
      <button type="button" onClick={run}>
        Run
      </button>
      <output data-testid="runner-state">
        {JSON.stringify({ submitted: session.submitted, response: session.response })}
      </output>
    </>
  );
}

describe("useClinicalAskRunner", () => {
  beforeEach(() => {
    streamClinicalAsk.mockReset();
  });

  it("keeps run B active when the aborted run A settles", async () => {
    const pending: PendingRun[] = [];
    streamClinicalAsk.mockImplementation(
      (_request: unknown, signal: AbortSignal) =>
        new Promise<ClinicalAskFinalPayload>((resolve) => pending.push({ signal, resolve })),
    );
    const view = render(
      <ClinicalAskSessionProvider>
        <RunnerHarness query="Question A" />
      </ClinicalAskSessionProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(pending).toHaveLength(1));
    view.rerender(
      <ClinicalAskSessionProvider>
        <RunnerHarness query="Question B" />
      </ClinicalAskSessionProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Run" }));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0]?.signal.aborted).toBe(true);
    expect(pending[1]?.signal.aborted).toBe(false);

    await act(async () => {
      pending[0]?.resolve({
        response: {
          state: "failed",
          mode: "services",
          code: "aborted",
          retryable: false,
          message: "Clinical Ask was cancelled.",
        },
        feedback: null,
      });
      await Promise.resolve();
    });

    expect(pending[1]?.signal.aborted).toBe(false);
    expect(screen.getByTestId("runner-state")).toHaveTextContent('"submitted":true');
    expect(screen.getByTestId("runner-state")).toHaveTextContent('"response":null');

    await act(async () => {
      pending[1]?.resolve({
        response: {
          state: "failed",
          mode: "services",
          code: "provider_unavailable",
          retryable: true,
          message: "Clinical Ask is temporarily unavailable.",
        },
        feedback: null,
      });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByTestId("runner-state")).toHaveTextContent('"submitted":false'));
    expect(screen.getByTestId("runner-state")).toHaveTextContent('"code":"provider_unavailable"');
  });
});
