import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Same reason as `ward-patient-page.dom.test.tsx`: `AddPatientForm` navigates via `useRouter()`
// after a successful add, and jsdom has no App Router context to resolve it against.
const router = vi.hoisted(() => ({
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => new URLSearchParams(window.location.search),
}));

// Same reason as `ward-patient-search.dom.test.tsx`: `ClinicalRail` and the search page's own
// person links render `next/link` anchors, and this suite reads a real `href` off one of them
// rather than actually navigating, which a plain `<a>` supports and the App Router component does
// not under jsdom.
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import { AddPatientForm } from "@/components/ward-management/patients/add-patient";
import { PatientSearchPage } from "@/components/ward-management/search/patient-search";
import { useWardFlow, WardFlowProvider } from "@/components/ward-management/ward-flow-provider";
import { NOW_ANCHOR } from "@/components/ward-management/ward-sites";

/** Echoes the live patient count so a test can observe `ADD_PATIENT` actually reaching state,
 *  without reaching into the reducer directly — same technique as `ClockAdvancer` in the sibling
 *  search suite. */
function PatientCount() {
  const { patients } = useWardFlow();
  return <span data-testid="patient-count">{patients.length}</span>;
}

function renderForm() {
  return render(
    <WardFlowProvider initialNow={NOW_ANCHOR}>
      <AddPatientForm />
      <PatientCount />
    </WardFlowProvider>,
  );
}

function fillDraft() {
  fireEvent.change(screen.getByLabelText("Record number"), { target: { value: "UM999999" } });
  fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Testable" } });
  fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "Newcomer" } });
  fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1990-01-01" } });
}

describe("AddPatientForm", () => {
  it("renders the screen and its four labelled fields", () => {
    renderForm();

    expect(screen.getByTestId("ward-add-patient-screen")).toBeInTheDocument();
    expect(screen.getByLabelText("Record number")).toBeInTheDocument();
    expect(screen.getByLabelText("Given name")).toBeInTheDocument();
    expect(screen.getByLabelText("Family name")).toBeInTheDocument();
    expect(screen.getByLabelText("Date of birth")).toBeInTheDocument();
  });

  it("keeps Add patient unavailable, and dispatches nothing, while any field is unanswered", () => {
    renderForm();
    const before = Number(screen.getByTestId("patient-count").textContent);
    // Precondition: there is a real starting count to hold constant, not an empty seed that would
    // make "unchanged" true trivially.
    expect(before).toBeGreaterThan(0);

    const submit = screen.getByTestId("ward-add-patient-submit");
    expect(submit).toHaveAttribute("aria-disabled", "true");

    fireEvent.click(submit);

    expect(Number(screen.getByTestId("patient-count").textContent)).toBe(before);
    expect(router.push).not.toHaveBeenCalled();
  });

  it("submitting a fully-answered draft dispatches ADD_PATIENT, the new patient reaches state, and the form navigates to that person's own screen", async () => {
    renderForm();
    const before = Number(screen.getByTestId("patient-count").textContent);
    expect(before).toBeGreaterThan(0);

    fillDraft();

    const submit = screen.getByTestId("ward-add-patient-submit");
    expect(submit).not.toHaveAttribute("aria-disabled");
    fireEvent.click(submit);

    // The dispatch reaches state: the live patient count grows by exactly one.
    await waitFor(() => {
      expect(Number(screen.getByTestId("patient-count").textContent)).toBe(before + 1);
    });

    // The screen navigates to the new person's own page — not search, not the same screen — found
    // by identity (a real `PT-A…` id), never assumed to be a fixed string.
    await waitFor(() => {
      expect(router.push).toHaveBeenCalledTimes(1);
    });
    const [target] = router.push.mock.calls[0] as [string];
    expect(target).toMatch(/^\/mockups\/ward-flow\/people\/PT-A\d+$/);
  });
});

describe("PatientSearchPage empty state", () => {
  function renderSearch() {
    return render(
      <WardFlowProvider initialNow={NOW_ANCHOR}>
        <PatientSearchPage />
      </WardFlowProvider>,
    );
  }

  it("offers a real link to /mockups/ward-flow/people/new when nobody is found, carrying what was typed", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Zzzznotarealname" } });

    expect(screen.getByTestId("ward-patient-search-people-empty")).toBeInTheDocument();
    const link = screen.getByTestId("ward-patient-search-people-empty-add");
    // FIX 1 — the empty state must not throw away what the clinician already typed: the query
    // travels forward as `?name=`, for `AddPatientForm`'s `initialDraft()` to read back.
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/people/new?name=Zzzznotarealname");
    expect(link).toHaveTextContent("Add this person");
  });

  it("still renders the original sentence unchanged, alongside the new link", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Zzzznotarealname" } });

    expect(screen.getByTestId("ward-patient-search-people-empty")).toHaveTextContent(
      "Nobody of that name or record number is known to this system. If the person in front of you is real, they need adding before they can be referred.",
    );
  });

  // A multi-word query proves the WHOLE string travels, unsplit — see `addPersonHref`'s own
  // comment in `patient-search.tsx` for why splitting on the space would be a guess.
  it("URL-encodes a multi-word query rather than splitting it", () => {
    renderSearch();

    fireEvent.change(screen.getByLabelText("Search"), { target: { value: "Mary Anne Halloway" } });

    const link = screen.getByTestId("ward-patient-search-people-empty-add");
    expect(link).toHaveAttribute("href", "/mockups/ward-flow/people/new?name=Mary%20Anne%20Halloway");
  });
});

describe("AddPatientForm — FIX 1, reading the carried-forward query back", () => {
  // jsdom's `window.location` is shared across the whole file, so every test here restores it —
  // otherwise a later, unrelated `renderForm()` in this file would inherit a leftover `?name=`.
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  it("prefills Given name from ?name=, and leaves Family name blank for the clinician to answer", async () => {
    window.history.pushState({}, "", "/mockups/ward-flow/people/new?name=Mary%20Anne%20Halloway");

    renderForm();

    // `readNamePrefill` reads `useSearchParams()`, which is live from the first render — but the
    // prefill is APPLIED by `setDraft` called during render, which discards the stale render and
    // commits the corrected one, so `waitFor` still settles this on the very first check rather
    // than genuinely waiting on an async effect. Kept as `waitFor` anyway: it is the same
    // assertion either way, and it stays correct if that mechanism ever changes again.
    await waitFor(() => {
      expect(screen.getByLabelText("Given name")).toHaveValue("Mary Anne Halloway");
    });
    // THE JUDGEMENT CALL, proven directly: the whole typed string lands in ONE field. Family name
    // is left blank rather than guessed at from a split.
    expect(screen.getByLabelText("Family name")).toHaveValue("");
  });

  it("leaves both name fields blank when there is no ?name= to carry", () => {
    window.history.pushState({}, "", "/mockups/ward-flow/people/new");

    renderForm();

    expect(screen.getByLabelText("Given name")).toHaveValue("");
    expect(screen.getByLabelText("Family name")).toHaveValue("");
  });

  // ⚠️ THE PREFILL APPLIES EXACTLY ONCE — proven directly, not just asserted in a comment.
  // `useSearchParams` is LIVE (unlike the inert `useSyncExternalStore` read this replaced), so
  // every keystroke below re-renders `AddPatientForm` with `namePrefillFromUrl` still
  // "Mary Anne Halloway". Without the `appliedNamePrefill` guard, that live value would win the
  // render-time `setDraft` again and stomp whatever the clinician had just typed. This is the
  // regression the guard exists to prevent.
  it("⚠️ applies the ?name= prefill once, then leaves it alone — a reactive read must not fight typing", async () => {
    window.history.pushState({}, "", "/mockups/ward-flow/people/new?name=Mary%20Anne%20Halloway");

    renderForm();

    await waitFor(() => {
      expect(screen.getByLabelText("Given name")).toHaveValue("Mary Anne Halloway");
    });

    // The clinician corrects the prefill — the exact case a re-firing prefill would fight.
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Marianne" } });
    expect(screen.getByLabelText("Given name")).toHaveValue("Marianne");

    // A further re-render (a second keystroke) must not let the still-live `?name=` value win
    // again and overwrite the correction.
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Marianne H" } });
    expect(screen.getByLabelText("Given name")).toHaveValue("Marianne H");

    // Clearing the field entirely must not be read as "still blank, apply the prefill again" —
    // the guard is a one-shot latch, not a re-check of the field's current emptiness.
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "" } });
    expect(screen.getByLabelText("Given name")).toHaveValue("");
  });
});

describe("AddPatientForm — FIX 3, the unanswered-fields notice is announced only on an attempted submit", () => {
  it("is present on mount (every field starts blank) but is NOT an alert region yet", () => {
    renderForm();

    const notice = screen.getByTestId("ward-add-patient-unavailable");
    expect(notice).toBeInTheDocument();
    // A screen reader must not be interrupted the instant this screen loads — nothing has been
    // attempted yet, so this is a static hint, not an alert.
    expect(notice).not.toHaveAttribute("role", "alert");
  });

  it("becomes an alert once the clinician clicks Add patient while a field is still unanswered", () => {
    renderForm();

    fireEvent.click(screen.getByTestId("ward-add-patient-submit"));

    expect(screen.getByTestId("ward-add-patient-unavailable")).toHaveAttribute("role", "alert");
  });

  it("becomes an alert on the keyboard route too — submitting the form directly, not via the button", () => {
    renderForm();

    fireEvent.submit(screen.getByTestId("ward-add-patient-form"));

    expect(screen.getByTestId("ward-add-patient-unavailable")).toHaveAttribute("role", "alert");
  });
});

/**
 * ⚠️ THE CREATION-TIME DUPLICATE CHECK — the door that actually stops the harm.
 *
 * The search screen's near-spelling suggestion helps the clinician who reads it. This catches the
 * one who did not, and that is the one who creates the duplicate. The journey: search "Halowin",
 * be told nobody of that name is known, press Add, and land here with "Halowin" already in Given
 * name while Marcus HALLOWIN sits in the system.
 *
 * ⚠️ `b273dc96b` MADE THAT JOURNEY QUICKER by carrying the typed text forward — before it, the
 * clinician had to retype the name and might have typed it correctly. These tests pin what now
 * stands in the way.
 */
describe("AddPatientForm — the creation-time duplicate check", () => {
  afterEach(() => {
    window.history.pushState({}, "", "/");
  });

  /** The notice's three states, read as one value so a test can never assert two at once. */
  function checkState(): "unchecked" | "none" | "matches" {
    if (screen.queryByTestId("ward-add-patient-duplicate-unchecked")) return "unchecked";
    if (screen.queryByTestId("ward-add-patient-duplicate-none")) return "none";
    return "matches";
  }

  it("⚠️ shows the warning AND the prefilled name together, which is the whole acceptance test", async () => {
    window.history.pushState({}, "", "/mockups/ward-flow/people/new?name=Halowin");
    renderForm();

    await waitFor(() => {
      expect(screen.getByLabelText("Given name")).toHaveValue("Halowin");
    });
    // ⚠️ TOGETHER IS THE POINT, not merely "the warning exists". The prefill is what makes the
    // duplicate quick; a warning that waited for a submit attempt would arrive after the record
    // number and the date of birth had been typed, which is exactly when nobody re-reads the top
    // of a form they have just filled in.
    const notice = screen.getByTestId("ward-add-patient-duplicate-check");
    expect(
      notice.textContent,
      "the prefilled misspelling is on screen with nothing saying an almost identical person " +
        "already exists — which is how a second record for Marcus Hallowin gets created",
    ).toContain("Marcus Hallowin");
    // The identifier, because by construction the NAME cannot distinguish these two people.
    expect(notice.textContent).toContain("UM100002");
    expect(notice.textContent).toContain("1961-11-02");
  });

  it("⚠️ keeps warning after the obvious tidy-up — the case that broke in nearPatients", () => {
    renderForm();
    // The clinician realises "Halowin" is a surname and moves it, typing the given name correctly.
    // An "already found" guard used to exclude Marcus Hallowin the instant "Marcus" matched his
    // real given name exactly — so the warning vanished at the moment the record became MOST
    // obviously a duplicate. Right first name, misspelt surname is the commonest duplicate there
    // is. Found by standing where the caller stands; fixed in `nearPatients` at a3886747e.
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Marcus" } });
    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "Halowin" } });

    expect(checkState()).toBe("matches");
    expect(screen.getByTestId("ward-add-patient-duplicate-check").textContent).toContain("Marcus Hallowin");
  });

  it("⚠️ says the check has NOT RUN rather than reporting a clear result, below the matcher's floor", () => {
    renderForm();
    // ⚠️ THREE STATES, NOT TWO, AND I DEMANDED THIS OF THE SEARCH SCREEN BEFORE APPLYING IT HERE.
    // "No similar names" over a blank form is a reassurance nobody earned: `nearPatients` will not
    // look at a term below four characters, so there is no result to report. A screen that has not
    // looked and a screen that looked and found nothing are different answers.
    expect(checkState(), "a blank form claims a clear result").toBe("unchecked");

    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Mar" } });
    expect(checkState(), "a three-letter name claims a clear result the matcher never produced").toBe("unchecked");

    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Marc" } });
    expect(checkState(), "at the matcher's own floor the check still refuses to report").not.toBe("unchecked");
  });

  it("says plainly when nobody is near, rather than falling silent", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Zebedee" } });
    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "Ashgrove" } });
    // Silence reads as "we checked and it is clear" — a reassurance the screen would be issuing on
    // its own authority. An empty result and no check are different answers and must look different.
    expect(checkState()).toBe("none");
    expect(screen.getByTestId("ward-add-patient-duplicate-none")).toBeInTheDocument();
  });

  it("⚠️ NEVER BLOCKS, and offers no way to dismiss it", () => {
    renderForm();
    fireEvent.change(screen.getByLabelText("Record number"), { target: { value: "UM100099" } });
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: "Marcus" } });
    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: "Halowin" } });
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: "1961-11-02" } });

    expect(checkState(), "the warning is not even showing, so the assertion below proves nothing").toBe("matches");
    const submit = screen.getByRole("button", { name: "Add patient" });
    // ⚠️ Two people really can have near-identical names. A hard stop would be worked around by
    // typing a name that does not collide, which puts a deliberately WRONG name into an identity
    // record — worse than the duplicate it prevented.
    expect(submit.getAttribute("aria-disabled"), "the warning has become a gate").toBeNull();
    expect((submit as HTMLButtonElement).disabled, "the warning has become a gate").toBe(false);
    // ⚠️ A dismiss control on a notice that updates as you type becomes a thing clicked once and
    // never seen again while the names go on matching.
    expect(
      screen.getByTestId("ward-add-patient-duplicate-check").querySelector("button"),
      "the notice can be dismissed, so it can be silenced while it is still true",
    ).toBeNull();
  });
});

/**
 * ⚠️ THE EXACT-DUPLICATE TIERS — the hole I declared in my own work rather than leaving it to be
 * found. `nearPatients` cannot report an exact duplicate by construction, because a string is not
 * one keystroke from itself, so re-entering Marcus Hallowin with BOTH names spelled correctly
 * produced no warning at all. The near-miss case was covered and the exact case was not, which is
 * the wrong way round for how often each happens.
 */
describe("AddPatientForm — the exact-duplicate tiers", () => {
  function type(umrn: string, given: string, family: string, born: string) {
    fireEvent.change(screen.getByLabelText("Record number"), { target: { value: umrn } });
    fireEvent.change(screen.getByLabelText("Given name"), { target: { value: given } });
    fireEvent.change(screen.getByLabelText("Family name"), { target: { value: family } });
    fireEvent.change(screen.getByLabelText("Date of birth"), { target: { value: born } });
  }

  it("⚠️ states a record-number collision FLATLY, because it is not a resemblance", () => {
    renderForm();
    type("UM100002", "", "", "");
    // A record number is unique by definition: either this is the same person or somebody
    // mistyped. There is no third reading in which a new patient legitimately holds it, so a
    // hedged "might be" would be a WEAKER claim than the evidence supports.
    const notice = screen.getByTestId("ward-add-patient-duplicate-umrn");
    expect(notice.textContent).toContain("UM100002 already belongs to Marcus Hallowin");
    expect(
      notice.textContent,
      "the collision is hedged, which understates evidence that admits only two readings",
    ).not.toMatch(/might|possibly|perhaps/i);
  });

  it("distinguishes same-name-same-birth-date from same-name-birth-date-unconfirmed", () => {
    const first = renderForm();
    type("", "Marcus", "Hallowin", "1961-11-02");
    expect(screen.getByTestId("ward-add-patient-duplicate-same-name-same-dob")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-add-patient-duplicate-same-name")).not.toBeInTheDocument();
    first.unmount();

    renderForm();
    type("", "Marcus", "Hallowin", "1999-01-01");
    expect(screen.getByTestId("ward-add-patient-duplicate-same-name")).toBeInTheDocument();
    expect(screen.queryByTestId("ward-add-patient-duplicate-same-name-same-dob")).not.toBeInTheDocument();
  });

  it("⚠️ never says the date of birth is DIFFERENT when the field is blank", () => {
    renderForm();
    // This screen reaches this tier with the date of birth not yet typed EVERY time, because the
    // notice renders live from first paint. "Different date of birth" would be a false statement
    // about an empty field, on a clinical record. Ward Builder Three renamed the tier for this
    // reason and declined my request to split it, correctly: two arrays would have tempted this
    // copy into exactly that falsehood.
    type("", "Marcus", "Hallowin", "");
    const notice = screen.getByTestId("ward-add-patient-duplicate-same-name");
    expect(notice).toBeInTheDocument();
    // ⚠️ THE PROPERTY, NOT A LIST OF PHRASINGS. My first version of this assertion named two
    // wordings — "different date of birth" and "dates differ" — and a mutation writing "The date
    // of birth is different" walked straight past both. A denylist of sentences somebody thought
    // of is not a check on what the sentence CLAIMS. With the field blank, no form of the word
    // "differ" can be true here, so that is what is asserted.
    expect(
      notice.textContent,
      "the screen asserts the dates differ when no date has been given — a false statement about " +
        "an empty field, on an identity record",
    ).not.toMatch(/differ/i);
    expect(notice.textContent, "the same falsehood by another route").not.toMatch(/does not match|do not match/i);
  });

  it("⚠️ an unknown record number says no record matches, and NEVER 'did you mean'", () => {
    renderForm();
    type("UM19999", "", "", "");
    // `nearPatients` deliberately never near-matches a record number: a number one keystroke from
    // another IS a different patient. So there is no such thing as a near-miss here, and offering
    // one would be the single most dangerous sentence on this page.
    expect(screen.getByTestId("ward-add-patient-duplicate-none")).toBeInTheDocument();
    expect(
      screen.getByTestId("ward-add-patient-duplicate-check").textContent,
      "a record number was offered as a near miss, which would point a clinician at a different person",
    ).not.toMatch(/did you mean/i);
  });

  it("names nobody twice across the tiers", () => {
    renderForm();
    type("UM100002", "Marcus", "Hallowin", "1961-11-02");
    const rows = screen.getAllByTestId(/^ward-add-patient-duplicate-PT-/);
    expect(rows.length, "no candidate is listed at all, so this asserts nothing").toBeGreaterThan(0);
    const ids = rows.map((row) => row.getAttribute("data-testid"));
    // A screen that says the same thing twice about one person trains a reader to skim both.
    expect(new Set(ids).size, "the same person is named more than once in one notice").toBe(ids.length);
  });

  it("still does not block, even on a record-number collision", () => {
    renderForm();
    type("UM100002", "Marcus", "Hallowin", "1961-11-02");
    expect(screen.getByTestId("ward-add-patient-duplicate-umrn")).toBeInTheDocument();
    // ⚠️ Tempting to block, because a duplicate record number is definitively wrong. But a
    // clinician who cannot proceed types a DIFFERENT record number, which puts a knowingly wrong
    // identifier into a clinical record — worse than the duplicate it prevented.
    const submit = screen.getByRole("button", { name: "Add patient" });
    expect(submit.getAttribute("aria-disabled"), "the collision has become a gate").toBeNull();
    expect((submit as HTMLButtonElement).disabled, "the collision has become a gate").toBe(false);
  });
});
