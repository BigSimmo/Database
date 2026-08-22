/** @vitest-environment jsdom */

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ClinicalAskSessionProvider,
  useClinicalAskSession,
} from "@/components/clinical-dashboard/clinical-ask-session-context";

const question = "Synthetic question for Example Community Clinic";

function Harness() {
  const session = useClinicalAskSession();
  return (
    <>
      <output data-testid="state">
        {JSON.stringify({ draft: session.draft, context: session.confirmedContext, response: session.response })}
      </output>
      <button onClick={() => session.setDraft(question, "dsm")}>Draft</button>
      <button onClick={() => session.submit("dsm", { workingDiagnosis: "fictional diagnosis" })}>Context</button>
      <button
        onClick={() =>
          session.setSuggestions([{ id: "s1", field: "duration", value: "fictional duration", status: "suggested" }])
        }
      >
        Suggest
      </button>
      <button onClick={() => session.confirmSuggestion("s1")}>Confirm suggestion</button>
      <button onClick={() => session.rejectSuggestion("s1")}>Reject suggestion</button>
      <button
        onClick={() =>
          session.receiveEvent({
            type: "final",
            payload: {
              feedback: null,
              response: {
                state: "evidence_gap",
                mode: "dsm",
                explanation: "Synthetic evidence gap",
                evidence: [],
                missingInformation: [],
                nextActions: [],
              },
            },
          })
        }
      >
        Answer
      </button>
      <button onClick={session.clear}>Clear case</button>
    </>
  );
}

describe("ClinicalAskSessionProvider", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the session in memory and destructively clears draft, context, and answer", () => {
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const push = vi.spyOn(history, "pushState");
    const replace = vi.spyOn(history, "replaceState");
    render(
      <ClinicalAskSessionProvider>
        <Harness />
      </ClinicalAskSessionProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Draft" }));
    fireEvent.click(screen.getByRole("button", { name: "Context" }));
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(screen.getByTestId("state")).toHaveTextContent(question);
    expect(screen.getByTestId("state")).toHaveTextContent("fictional diagnosis");
    expect(screen.getByTestId("state")).toHaveTextContent("evidence_gap");
    fireEvent.click(screen.getByRole("button", { name: "Suggest" }));
    expect(screen.getByTestId("state")).not.toHaveTextContent("fictional duration");
    fireEvent.click(screen.getByRole("button", { name: "Confirm suggestion" }));
    expect(screen.getByTestId("state")).toHaveTextContent("fictional duration");
    fireEvent.click(screen.getByRole("button", { name: "Reject suggestion" }));
    expect(screen.getByTestId("state")).not.toHaveTextContent("fictional duration");
    fireEvent.click(screen.getByRole("button", { name: "Clear case" }));
    expect(screen.getByTestId("state")).toHaveTextContent(JSON.stringify({ draft: "", context: {}, response: null }));
    expect(storage).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("clears on account change and unmount aborts active work", () => {
    const abort = vi.spyOn(AbortController.prototype, "abort");
    function ActiveHarness() {
      const session = useClinicalAskSession();
      return (
        <button
          onClick={() => {
            session.setDraft(question, "services");
            session.setAbortController(new AbortController());
          }}
        >
          Start
        </button>
      );
    }
    const view = render(
      <ClinicalAskSessionProvider accountId="account-a">
        <ActiveHarness />
      </ClinicalAskSessionProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    view.rerender(
      <ClinicalAskSessionProvider accountId="account-b">
        <Harness />
      </ClinicalAskSessionProvider>,
    );
    expect(screen.getByTestId("state")).toHaveTextContent('"draft":""');
    expect(abort).toHaveBeenCalledOnce();
    view.unmount();
  });
});
