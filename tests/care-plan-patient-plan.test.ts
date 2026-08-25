import { describe, expect, it } from "vitest";

import {
  canPerformAction,
  getCurrentManagementPlanVersion,
  getCurrentPatientPlanVersion,
  getOpenPatientPlanDraft,
  isPatientPlanVersionStale,
} from "@/components/care-plan/mockups/domain";
import { publicCrisisContacts, syntheticPatients } from "@/components/care-plan/mockups/fixtures";
import {
  PATIENT_RESOURCE_CATEGORY_ORDER,
  getPatientResources,
  groupPatientResources,
  syntheticPatientResources,
} from "@/components/care-plan/mockups/patient-plan-fixtures";
import {
  AGREEMENT_SAFE_S_WORDS,
  EVERYDAY_WORDS,
  PATIENT_PLAN_GAP_REASON,
  PATIENT_PLAN_OMITTED_CONTENT_KEYS,
  PATIENT_PLAN_SECTION_HEADING,
  PATIENT_PLAN_SECTION_LEAD_IN,
  PATIENT_PLAN_SECTION_SOURCES,
  PLAIN_LANGUAGE_TERMS,
  THIRD_PERSON_VERBS,
  UNCONVERTIBLE_CLINICAL_TERMS,
  buildPatientPlanDraft,
  createLineConverter,
  isEverydayWord,
  unfilledGapSections,
} from "@/components/care-plan/mockups/patient-plan-transform";
import { createInitialPrototypeState, prototypeReducer } from "@/components/care-plan/mockups/prototype-state";
import {
  PATIENT_PLAN_SECTION_KEYS,
  type CarePlanPrototypeAction,
  type CarePlanPrototypeState,
  type ManagementPlanContent,
  type ManagementPlanVersion,
  type Patient,
  type PatientPlanSection,
  type PrototypeRole,
  type SyntheticId,
} from "@/components/care-plan/mockups/types";

/**
 * The Patient Plan: the deterministic transformation, the lifecycle around it,
 * and — the part none of the other gates can see — whether the page it produces
 * is kind to read.
 *
 * The content checks below spell their forbidden phrasing out literally rather
 * than reading it back from the constant the code renders from. A generative
 * assertion can never disagree with what it checks: two of Task 8's controls
 * survived a deliberate break because they compared rendered text against the
 * very constant that produced it. Structural checks may read from the domain;
 * content checks may not.
 */

const ROWAN: SyntheticId = "SYN-PATIENT-001";
const MIRA: SyntheticId = "SYN-PATIENT-002";
const JORDAN: SyntheticId = "SYN-PATIENT-003";

function patientBy(id: SyntheticId): Patient {
  const patient = syntheticPatients.find((candidate) => candidate.id === id);
  if (patient === undefined) throw new Error(`no synthetic patient ${id}`);
  return patient;
}

/**
 * The Current Management Plan Version for one patient.
 *
 * The brief's worked example called `getCurrentManagementPlanVersion(state, patientId)`.
 * That is not the selector's signature — it takes a version list and a *plan*
 * identifier — so the lookup goes through the patient's `managementPlanId`.
 */
function currentVersionFor(patientId: SyntheticId, state = createInitialPrototypeState()): ManagementPlanVersion {
  const version = getCurrentManagementPlanVersion(state.managementPlanVersions, patientBy(patientId).managementPlanId);
  if (version === null) throw new Error(`no current management version for ${patientId}`);
  return version;
}

function draftFor(patientId: SyntheticId) {
  return buildPatientPlanDraft(currentVersionFor(patientId), patientBy(patientId), syntheticPatientResources);
}

function converterFor(patientId: SyntheticId) {
  return createLineConverter(currentVersionFor(patientId), patientBy(patientId), syntheticPatientResources);
}

/** A version whose content is whatever the caller wants, so a rule can be
 *  proved on the sentence that triggers it rather than on whichever fixture
 *  happens to contain one. */
function versionWithContent(content: Partial<ManagementPlanContent>): ManagementPlanVersion {
  return {
    ...currentVersionFor(ROWAN),
    content: { ...currentVersionFor(ROWAN).content, ...content },
  };
}

function run(state: CarePlanPrototypeState, ...actions: CarePlanPrototypeAction[]): CarePlanPrototypeState {
  return actions.reduce(prototypeReducer, state);
}

function asUser(state: CarePlanPrototypeState, role: PrototypeRole): CarePlanPrototypeState {
  const user = state.users.find((candidate) => candidate.role === role);
  if (user === undefined) throw new Error(`no synthetic user with role ${role}`);
  return prototypeReducer(state, { type: "set-active-user", userId: user.id });
}

/** The whole world one patient copy is built in: a draft, open and editable. */
function stateWithDraft(patientId: SyntheticId = ROWAN, role: PrototypeRole = "liaison_clinician") {
  const state = run(asUser(createInitialPrototypeState(), role), {
    type: "create-patient-plan-draft",
    patientId,
  });
  const plan = state.patientPlans.find((candidate) => candidate.patientId === patientId);
  if (plan === undefined) throw new Error("no patient plan record was created");
  const draft = getOpenPatientPlanDraft(state.patientPlanVersions, plan.id);
  if (draft === null) throw new Error("no patient plan draft was created");
  return { state, plan, draft };
}

/** Every gap filled with something a clinician might actually write. */
function filled(sections: readonly PatientPlanSection[]): PatientPlanSection[] {
  return sections.map((section) =>
    section.gap
      ? { ...section, body: ["Written with this person at the bedside."], gap: false, gapReason: null }
      : section,
  );
}

describe("Patient Plan transformation", () => {
  it("never auto-converts the agreed approach and leaves it as a clinician gap", () => {
    const agreed = draftFor(ROWAN).sections.find(({ key }) => key === "whatWeAgreedWillHappen");
    if (agreed === undefined) throw new Error("the draft has no agreed-approach section");

    expect(agreed.gap).toBe(true);
    expect(agreed.body).toEqual([]);
    expect(agreed.gapReason).toMatch(/written by a clinician/i);
  });

  /**
   * The section is refused for what it *is*, not for what it happens to say.
   * Content this plain converts anywhere else in the plan, so if the rule were
   * ever weakened to "gap when the wording is difficult", this is the case that
   * would slip through — and it is the section a person is most likely to read
   * as a judgement about them.
   */
  it("refuses the agreed approach even when its content is entirely plain", () => {
    const plain = versionWithContent({ agreedEdApproach: ["We will find you a quiet room."] });
    const draft = buildPatientPlanDraft(plain, patientBy(ROWAN), syntheticPatientResources);
    const agreed = draft.sections.find(({ key }) => key === "whatWeAgreedWillHappen");

    expect(agreed?.gap).toBe(true);
    expect(agreed?.body).toEqual([]);
    // The same sentence under any other heading converts, which is what makes
    // the refusal above about the section rather than about the words.
    expect(converterFor(ROWAN)("We will find you a quiet room.")).toEqual({
      converted: "We will find you a quiet room.",
    });
  });

  it("is a pure function of the version and never reaches outside itself", () => {
    const a = draftFor(ROWAN);
    const b = draftFor(ROWAN);
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("leaves the version, the patient, and the resources it was given untouched", () => {
    const version = currentVersionFor(ROWAN);
    const patient = patientBy(ROWAN);
    const before = JSON.stringify({ version, patient, resources: syntheticPatientResources });
    buildPatientPlanDraft(version, patient, syntheticPatientResources);
    expect(JSON.stringify({ version, patient, resources: syntheticPatientResources })).toBe(before);
  });

  it("produces the eight approved sections, in order, generated from the domain keys", () => {
    const draft = draftFor(ROWAN);
    expect(draft.sections.map((section) => section.key)).toEqual([...PATIENT_PLAN_SECTION_KEYS]);
    expect(draft.sections).toHaveLength(8);
    for (const section of draft.sections) {
      expect(section.heading).toBe(PATIENT_PLAN_SECTION_HEADING[section.key]);
    }
  });

  /**
   * Physical health and medication is deliberately absent, and so is the
   * how-to-approach field. Asserting the mapping is exhaustive is what stops a
   * twelfth content field being added later and appearing on no surface at all
   * while nothing goes red.
   */
  it("accounts for every Management Plan content field, and carries neither medication nor staff instructions", () => {
    const mapped = new Set(Object.values(PATIENT_PLAN_SECTION_SOURCES).flat());
    const omitted = new Set<string>(PATIENT_PLAN_OMITTED_CONTENT_KEYS);
    const everyField = Object.keys(currentVersionFor(ROWAN).content) as (keyof ManagementPlanContent)[];

    expect(everyField.length).toBe(11);
    for (const field of everyField) {
      expect(mapped.has(field) || omitted.has(field), `${field} is neither mapped nor deliberately omitted`).toBe(true);
      expect(mapped.has(field) && omitted.has(field), `${field} is both mapped and omitted`).toBe(false);
    }
    expect(omitted.has("physicalHealthAndMedication")).toBe(true);
    expect(omitted.has("howToApproach")).toBe(true);

    // Nothing from the medication field reaches any section body, on any
    // fixture, whatever the dictionary does to the words in it.
    for (const patient of syntheticPatients) {
      const version = getCurrentManagementPlanVersion(
        createInitialPrototypeState().managementPlanVersions,
        patient.managementPlanId,
      );
      if (version === null) continue;
      const bodies = buildPatientPlanDraft(version, patient, syntheticPatientResources)
        .sections.flatMap((section) => section.body)
        .join(" ")
        .toLowerCase();
      for (const line of version.content.physicalHealthAndMedication) {
        expect(bodies).not.toContain(line.slice(0, 24).toLowerCase());
      }
    }
  });

  it("carries no ninth section and no physical-health heading", () => {
    const headings = Object.values(PATIENT_PLAN_SECTION_HEADING).join(" ").toLowerCase();
    expect(PATIENT_PLAN_SECTION_KEYS).toHaveLength(8);
    for (const forbidden of ["medication", "medicine", "physical health", "allergy", "dose"]) {
      expect(headings).not.toContain(forbidden);
    }
  });
});

describe("Patient Plan gap triggers", () => {
  const convert = converterFor(ROWAN);

  it("gaps a sentence holding a clinical term the dictionary refuses to convert", () => {
    expect(convert("The waiting area can be loud at night.")).toEqual({
      converted: "The waiting area can be loud at night.",
    });
    expect(convert("A quiet room helps when your distress is building.")).toEqual({
      gapReasonKey: "unknownTerm",
    });
  });

  /**
   * The dictionary rule proper: a word that is simply *not in the vocabulary*,
   * whether or not anybody thought to list it as clinical.
   *
   * This is separate from the test above on purpose. "Distress" is on the
   * refused list and is caught by that check first, so a test using it proves
   * nothing about the vocabulary — with the whole word check deleted, it still
   * passed. Every word below is ordinary English that the curated vocabulary
   * does not contain, which is the only shape that isolates this rule.
   */
  it("gaps a sentence holding any word the vocabulary does not contain", () => {
    expect(convert("The corridor can feel claustrophobic at night.")).toEqual({ gapReasonKey: "unknownTerm" });
    expect(convert("A blanket and a cup of tea help enormously.")).toEqual({ gapReasonKey: "unknownTerm" });
    expect(convert("You settle once the negotiation is over.")).toEqual({ gapReasonKey: "unknownTerm" });
    // The same sentences in words the vocabulary does hold.
    expect(convert("The corridor can feel loud at night.")).toEqual({
      converted: "The corridor can feel loud at night.",
    });
    expect(convert("A blanket and a warm drink help a lot.")).toEqual({
      converted: "A blanket and a warm drink help a lot.",
    });
  });

  /** A name already on this person's record is not an unknown word. */
  it("lets through a name the person's own record already carries, and refuses one it does not", () => {
    expect(convert("You can ring Jess.")).toEqual({ converted: "You can ring Jess." });
    expect(convert("You can ring Pemberton.")).toEqual({ gapReasonKey: "unknownTerm" });
  });

  /**
   * The negation rule earns its place only if a plain negation still converts.
   * If every "not" gapped, the rule would be indistinguishable from refusing
   * the whole plan, and the section reasons would be lies about why.
   */
  it("gaps a negated clinical statement while letting a plain preference through", () => {
    expect(convert("Pain relief was not offered before the mental-health assessment.")).toEqual({
      gapReasonKey: "unknownTerm",
    });
    expect(convert("Your family doctor is not the team you would ring at night.")).toEqual({
      gapReasonKey: "clinicalNegation",
    });
    expect(convert("We will ring the number you give us.")).toEqual({
      converted: "We will ring the number you give us.",
    });
  });

  /**
   * The rule that caught the worst line the first run of this transformation
   * produced: a clinician's instruction, converted into an order addressed to
   * the person the plan is about.
   */
  it("gaps a sentence written as an instruction to staff", () => {
    expect(convert("Say so plainly when you use it, and offer again to write it together.")).toEqual({
      gapReasonKey: "clinicianInstruction",
    });
    expect(convert("Keep the first conversation short and say what will happen next.")).toEqual({
      gapReasonKey: "clinicianInstruction",
    });
    expect(convert("A seat in a quieter area, and a clear time for the next update.")).toEqual({
      converted: "A seat in a quieter area, and a clear time for the next update.",
    });
  });

  /** The rule that caught "To be called you" on Evie's copy. */
  it("gaps a sentence about what this person is called rather than replacing the name with “you”", () => {
    const evie = createLineConverter(currentVersionFor(ROWAN), patientBy("SYN-PATIENT-004"), syntheticPatientResources);
    expect(evie("To be called Evie, and to have privacy for the conversation.")).toEqual({
      gapReasonKey: "namingContext",
    });
    expect(convert("To be addressed as Rowan.")).toEqual({ gapReasonKey: "namingContext" });
  });

  it("gaps a sentence whose pronoun could belong to somebody else in it", () => {
    expect(convert("You settle once they can ring their sister.")).toEqual({ gapReasonKey: "ambiguousPronoun" });
    expect(convert("A drink, a blanket, and a warm room.")).toEqual({
      converted: "A drink, a blanket, and a warm room.",
    });
  });

  /**
   * For a `she/her` patient the possessive and the object pronoun are the same
   * word: "ring her son" wants "your son" and "hard for her to follow" wants
   * "you", and no grammar here can tell them apart. Substituting one rule
   * everywhere printed "which make it hard for your to follow" on Mira's copy on
   * the first run, so the sentence is refused instead.
   */
  it("refuses a sentence whose pronoun is both this person's possessive and their object", () => {
    const mira = converterFor(MIRA);
    expect(mira("It is hard for her to follow what is being asked.")).toEqual({
      gapReasonKey: "ambiguousPronoun",
    });
    expect(mira("A warm blanket helps her back.")).toEqual({ gapReasonKey: "ambiguousPronoun" });
    // A they/them patient's pronouns are distinct, so the same shape converts.
    expect(convert("A warm blanket helps their back.")).toEqual({ converted: "A warm blanket helps your back." });
  });

  /**
   * A negated sentence about the person is refused whether the name is bare or
   * possessive.
   *
   * `wordsOf` keeps the apostrophe, so "Rowan's" tokenises as `rowan's` and did
   * not match the `rowan` in `ownNames` — the negation rule saw a sentence that
   * was not about anybody. "Rowan was not told what was happening." was refused;
   * "Rowan's family was not told." converted to "Your family was not told." with
   * `gap: false`, ready to approve straight onto the person's own copy.
   */
  it("refuses a negated sentence about this person whether the name is bare or possessive", () => {
    expect(convert("Rowan was not told what was happening.")).toEqual({ gapReasonKey: "clinicalNegation" });
    expect(convert("Rowan's family was not told.")).toEqual({ gapReasonKey: "clinicalNegation" });
    // Literal, so the specific sentence that used to print cannot come back.
    expect(convert("Rowan's family was not told.")).not.toEqual({ converted: "Your family was not told." });
    // A possessive with no negation still converts, so the rule stays narrow.
    expect(convert("Rowan's family can ring the team.")).toEqual({ converted: "Your family can ring the team." });
  });

  /**
   * Pronoun substitution across all three pronoun sets, built from constructed
   * patients rather than fixtures.
   *
   * The fixtures cover they/them and she/her only: Jordan is the sole he/him
   * patient and has no Management Plan, so nothing exercised that path. It was
   * broken. The possessive replacement had no leading word boundary, so "his"
   * matched inside "This", turning "This is what helps you." into "Tyour is what
   * helps you." — which then failed the vocabulary check and told the clinician
   * the section used wording with no everyday equivalent, a reason that was
   * simply untrue.
   */
  it.each([
    ["they/them", "their"],
    ["she/her", "her"],
    ["he/him", "his"],
  ])("leaves ordinary English alone for a %s patient", (pronouns, possessive) => {
    const patient = { ...patientBy(ROWAN), pronouns };
    const forPatient = createLineConverter(currentVersionFor(ROWAN), patient, syntheticPatientResources);

    // Every one of these is plain English that must survive untouched, and each
    // contains the substring of some patient's possessive pronoun: "This" holds
    // "his", "there" holds "her", "theirs" would hold "their".
    for (const sentence of [
      "This is what helps you.",
      "There is a quiet room here.",
      "You can ring the team.",
      "The nurse will tell you what is happening.",
    ]) {
      expect(forPatient(sentence), `“${sentence}” was corrupted for a ${pronouns} patient`).toEqual({
        converted: sentence,
      });
    }
    // And the possessive is still substituted where it really is one.
    expect(forPatient(`A warm blanket helps ${possessive} back.`)).toEqual(
      // she/her is refused outright, because its possessive and object pronouns
      // are the same word and cannot be told apart.
      possessive === "her" ? { gapReasonKey: "ambiguousPronoun" } : { converted: "A warm blanket helps your back." },
    );
  });

  it("gaps a sentence whose verb it cannot put into the second person", () => {
    // `settles` is in the agreement table, so this converts.
    expect(convert("Rowan settles once the room is quiet.")).toEqual({
      converted: "You settle once the room is quiet.",
    });
    // `dawdles` is not, and guessing by dropping the trailing s is wrong for
    // every plural noun, so the sentence is refused instead.
    expect(convert("Rowan dawdles on the way in.")).toEqual({ gapReasonKey: "personAsSubject" });
  });

  it("gaps a heading whose Management Plan field holds nothing", () => {
    const empty = versionWithContent({ practicalNeeds: [], whatThePersonWants: [] });
    const draft = buildPatientPlanDraft(empty, patientBy(ROWAN), syntheticPatientResources);
    for (const key of ["thingsThatMightHelp", "whatMattersToYou"] as const) {
      const section = draft.sections.find((candidate) => candidate.key === key);
      expect(section?.gap).toBe(true);
      expect(section?.gapReason).toBe(PATIENT_PLAN_GAP_REASON.nothingRecorded);
    }
  });

  /**
   * A section keeps the points that converted and is still flagged for the ones
   * that did not.
   *
   * This replaced the opposite rule. Returning on the first refusal threw away
   * everything already converted with it, which on the real fixtures cost the
   * person's own "What matters to you" three plain, correctly converted lines
   * because a fourth could not be converted. Nothing about the safety of the
   * result changed: the section is still flagged, a flagged section still
   * cannot be approved, and only an approved version prints.
   */
  it("keeps the points that converted while still reporting the ones that did not", () => {
    const mixed = versionWithContent({
      whatThePersonWants: [
        "A quiet room.",
        "To be seen without your distress being the first thing anybody says.",
        "A warm drink.",
      ],
    });
    const section = buildPatientPlanDraft(mixed, patientBy(ROWAN), syntheticPatientResources).sections.find(
      (candidate) => candidate.key === "whatMattersToYou",
    );

    expect(section?.gap).toBe(true);
    // Named exactly, not merely non-empty: these are the two that converted,
    // in source order, and the refused one is absent rather than half-rendered.
    expect(section?.body).toEqual(["A quiet room.", "A warm drink."]);
    expect(section?.gapReason).toMatch(/2 of 3 points converted/);
    expect(section?.gapReason).toMatch(/written by a clinician/i);
    // The refused point is quoted, not merely counted. A number alone let a
    // clinician satisfy the approval gate without ever learning what was
    // missing — and on the real fixtures the refused points are the clinical
    // ones while the survivors are administrative.
    expect(section?.gapReason).toContain("“To be seen without your distress being the first thing anybody says.”");
    expect(section?.gapReason).toMatch(/Still to write, from the Management Plan/);
  });

  /** Every refused point is quoted, not just the first. */
  it("quotes every point it refused, so nothing is dropped silently", () => {
    const mixed = versionWithContent({
      whatThePersonWants: [
        "A quiet room.",
        "Assess the presentation on its merits.",
        "Your distress is the first thing anybody says.",
      ],
    });
    const section = buildPatientPlanDraft(mixed, patientBy(ROWAN), syntheticPatientResources).sections.find(
      (candidate) => candidate.key === "whatMattersToYou",
    );
    expect(section?.body).toEqual(["A quiet room."]);
    expect(section?.gapReason).toContain("“Assess the presentation on its merits.”");
    expect(section?.gapReason).toContain("“Your distress is the first thing anybody says.”");
  });

  /**
   * Points refused for different reasons are reported under their own reasons.
   *
   * Attributing every quoted point to the first refusal's reason was recorded as
   * latent while only a count was shown. Quoting the points made it live: a
   * clinician would read two sentences under one reason that is false of one of
   * them, which is the same false-reason failure the naming rule was narrowed to
   * avoid.
   */
  it("attributes each refused point to the reason it was actually refused for", () => {
    const mixed = versionWithContent({
      whatThePersonWants: ["A quiet room.", "No interpreter is needed here.", "Assess the presentation on its merits."],
    });
    const reason =
      buildPatientPlanDraft(mixed, patientBy(ROWAN), syntheticPatientResources).sections.find(
        (candidate) => candidate.key === "whatMattersToYou",
      )?.gapReason ?? "";

    // Each quoted point sits with its own reason, and both reasons appear.
    expect(reason).toContain(
      "“No interpreter is needed here.” It was refused because: This section says what does not happen.",
    );
    expect(reason).toContain(
      "“Assess the presentation on its merits.” It was refused because: This section uses wording the plain-language conversion has no confident everyday equivalent for",
    );
  });

  /** Nothing convertible at all still reads as one whole refusal, with the one
   *  reason stated plainly rather than wrapped in arithmetic. */
  it("still empties a section in which nothing at all could be converted", () => {
    const none = versionWithContent({
      whatThePersonWants: ["Your distress is the first thing anybody says.", "Assess the presentation on its merits."],
    });
    const section = buildPatientPlanDraft(none, patientBy(ROWAN), syntheticPatientResources).sections.find(
      (candidate) => candidate.key === "whatMattersToYou",
    );
    expect(section?.gap).toBe(true);
    expect(section?.body).toEqual([]);
    expect(section?.gapReason).toBe(PATIENT_PLAN_GAP_REASON.unknownTerm);
  });

  /**
   * The agreed approach is refused whole, whatever it contains and however much
   * of it would convert. Partial sections must not have opened a door here: this
   * is the section most easily read as a judgement about the person.
   */
  it("never keeps partial content for the agreed approach, however convertible it is", () => {
    const plain = versionWithContent({
      agreedEdApproach: ["We will find you a quiet room.", "You can ring the number you gave us."],
    });
    const agreed = buildPatientPlanDraft(plain, patientBy(ROWAN), syntheticPatientResources).sections.find(
      (candidate) => candidate.key === "whatWeAgreedWillHappen",
    );
    expect(agreed?.gap).toBe(true);
    expect(agreed?.body).toEqual([]);
    expect(agreed?.gapReason).toBe(PATIENT_PLAN_GAP_REASON.agreedApproach);
  });
});

describe("Patient Plan dictionary", () => {
  const convert = converterFor(ROWAN);

  it("replaces clinical vocabulary with the curated everyday wording", () => {
    expect(convert("The CMHT will ring you the next working day.")).toEqual({
      converted: "The mental health team will ring you the next working day.",
    });
    expect(convert("Your GP knows you well.")).toEqual({ converted: "Your family doctor knows you well." });
  });

  it("shifts the person's own name and pronouns into the second person, with the verb to match", () => {
    expect(convert("Rowan wants a quiet room.")).toEqual({ converted: "You want a quiet room." });
    expect(convert("A blanket helps with Rowan's sleep.")).toEqual({
      converted: "A blanket helps with your sleep.",
    });
  });

  /**
   * A word ending in `s` after a substituted subject is either a verb needing
   * agreement or a noun needing none, and the difference cannot be guessed. This
   * proves every such word in the vocabulary is classified, so a word added
   * later cannot quietly become an unchecked verb and print "you settles".
   */
  it("classifies every s-ending everyday word as a verb or as safe after “you”", () => {
    const safe = new Set(AGREEMENT_SAFE_S_WORDS);
    const unclassified = [...EVERYDAY_WORDS].filter(
      (word) => word.endsWith("s") && THIRD_PERSON_VERBS[word] === undefined && !safe.has(word),
    );
    expect(unclassified, `unclassified s-ending words: ${unclassified.join(", ")}`).toEqual([]);
    expect(EVERYDAY_WORDS.size).toBeGreaterThan(400);
  });

  /**
   * The inflection rule widens the vocabulary — "waits" and "waiting" from
   * "wait" — and it must never widen it onto a clinical term. Fails closed: a
   * term whose base form is everyday would be admitted here and caught nowhere
   * else.
   */
  it("never admits a clinical term, or its plural, through the inflection rule", () => {
    for (const term of UNCONVERTIBLE_CLINICAL_TERMS) {
      expect(isEverydayWord(term), `${term} is treated as an everyday word`).toBe(false);
      expect(isEverydayWord(`${term}s`), `${term}s is treated as an everyday word`).toBe(false);
    }
  });

  it("holds no dictionary entry that is also refused as unconvertible", () => {
    const unconvertible = new Set(UNCONVERTIBLE_CLINICAL_TERMS);
    for (const term of Object.keys(PLAIN_LANGUAGE_TERMS)) {
      expect(unconvertible.has(term), `${term} is both convertible and unconvertible`).toBe(false);
    }
  });
});

/**
 * The checks none of the other gates can make.
 *
 * Every string below is spelled out here rather than read from the module that
 * produces it. A page can be structurally perfect, pass 400 tests, and still be
 * cruel to read — that is the one class of harm every automated check on this
 * project is blind to, and it is the reason these are literal.
 */
describe("Patient Plan reads as something a person can be handed", () => {
  const CLINICAL_WORDS = [
    "triage",
    "disposition",
    "presentation",
    "mental-state",
    "assessment",
    "distress",
    "compliance",
    "comorbid",
    "prognosis",
    "acuity",
    "severity",
    "aetiology",
    "psychosocial",
    "sequelae",
    "prn",
    "bd",
    "nocte",
  ];

  const BLAMING_PHRASES = [
    "failed to",
    "refused to",
    "declined to",
    "did not engage",
    "non-compliant",
    "noncompliant",
    "poorly compliant",
    "attention-seeking",
    "attention seeking",
    "manipulative",
    "drug-seeking",
    "frequent flyer",
    "frequent presenter",
    "frequent attender",
    "difficult patient",
    "problem patient",
    "known to services",
    "poor insight",
    "lacks insight",
    "unable to cope",
    "does not cooperate",
    "uncooperative",
    "should have",
    "you must",
    "you failed",
  ];

  const HOPELESS_PHRASES = [
    "nothing can be done",
    "nothing more can be done",
    "no further options",
    "there is no point",
    "will not improve",
    "chronic and unchanging",
    "beyond help",
  ];

  /** The exact string Task 8 printed on a person's own safety plan, and every
   *  shape of it. A blank stated as a blank, on a page addressed to somebody. */
  const BLANK_STATEMENTS = ["not recorded", "not stated", "no data", "none recorded", "n/a", "unknown", "nil"];

  const STAFF_IMPERATIVES = [
    "say so",
    "ask rowan",
    "ask mira",
    "ask the patient",
    "read this plan",
    "read the triage",
    "introduce yourself",
    "offer again",
    "keep the first",
    "check that",
    "sit down to talk",
    "record the reason",
    "confirm only",
  ];

  /**
   * Everything a reader would actually see, for one patient — except the
   * verified crisis lines.
   *
   * Those are excluded from the clinical-vocabulary check on purpose, and only
   * from that one. Their wording is quoted from the official public page each
   * number was checked against: MHERL's own statement is that it "is a telephone
   * triage and support line. It is not an emergency service". Paraphrasing a
   * real service's own safety caveat to satisfy a house style would be a worse
   * error than the one this test exists to catch, so the word stays and the
   * exception is written down. The blaming and hopelessness checks below still
   * cover them.
   */
  function readableStrings(patientId: SyntheticId, options: { includeVerifiedContacts: boolean }): string[] {
    const patient = patientBy(patientId);
    const version = getCurrentManagementPlanVersion(
      createInitialPrototypeState().managementPlanVersions,
      patient.managementPlanId,
    );
    if (version === null) return [];
    const draft = buildPatientPlanDraft(version, patient, syntheticPatientResources);
    const resources = options.includeVerifiedContacts
      ? draft.resources
      : draft.resources.filter((resource) => !resource.isRealContact);
    return [
      ...draft.sections.flatMap((section) => [section.heading, ...section.body]),
      ...resources.flatMap((resource) => [resource.name, resource.detail]),
      ...Object.values(PATIENT_PLAN_SECTION_LEAD_IN),
    ];
  }

  /**
   * Every line the conversion actually produces, across every fixture.
   *
   * The checks below have to run over converted prose. On this corpus every
   * section is still flagged, and most carry no content at all, so reading the
   * checks off the section bodies would leave them nearly empty — and a rule
   * change that made the conversion refuse everything would empty them
   * completely, at which point they would pass over nothing, for ever, and pass
   * loudest at the moment the conversion broke. So they run over the line
   * converter directly, behind the non-vacuity guard below.
   */
  function everyConvertedLine(): string[] {
    const state = createInitialPrototypeState();
    return syntheticPatients.flatMap((patient) => {
      const version = getCurrentManagementPlanVersion(state.managementPlanVersions, patient.managementPlanId);
      if (version === null) return [];
      const convert = createLineConverter(version, patient, syntheticPatientResources);
      return Object.values(PATIENT_PLAN_SECTION_SOURCES)
        .flat()
        .flatMap((field) => {
          const value = version.content[field];
          return typeof value === "string" ? [value] : [...value];
        })
        .flatMap((line) => {
          const outcome = convert(line);
          return "converted" in outcome ? [outcome.converted] : [];
        });
    });
  }

  /**
   * Fails closed. If a later change made the conversion refuse everything, every
   * content check below would pass over an empty list and report the page as
   * flawless. This is the guard that stops that being counted as coverage.
   */
  it("actually converts something, so the content checks below are not vacuous", () => {
    expect(everyConvertedLine().length).toBeGreaterThanOrEqual(5);
  });

  const PATIENTS_WITH_A_CURRENT_PLAN = [ROWAN, MIRA];

  it.each(PATIENTS_WITH_A_CURRENT_PLAN)("says nothing clinical to %s in its own words", (patientId) => {
    const lines = readableStrings(patientId, { includeVerifiedContacts: false });
    expect(lines.length).toBeGreaterThan(8);
    for (const line of lines) {
      const lowered = line.toLowerCase();
      for (const word of CLINICAL_WORDS) {
        expect(lowered.includes(word), `“${line}” uses the clinical word “${word}”`).toBe(false);
      }
    }
  });

  it.each(PATIENTS_WITH_A_CURRENT_PLAN)("says nothing blaming or hopeless to %s, anywhere", (patientId) => {
    const lines = readableStrings(patientId, { includeVerifiedContacts: true });
    expect(lines.length).toBeGreaterThan(8);
    for (const line of lines) {
      const lowered = line.toLowerCase();
      for (const phrase of [...BLAMING_PHRASES, ...HOPELESS_PHRASES]) {
        expect(lowered.includes(phrase), `“${line}” reads as a judgement: “${phrase}”`).toBe(false);
      }
    }
  });

  /**
   * The Task 8 defect, generalised. A printed sheet reading "My reasons for
   * living — Not recorded" broke no rule and failed no gate. Here a section with
   * nothing in it is a gap, a gap is never approved, and an unapproved copy is
   * never printed — so the words themselves must never appear either.
   */
  it.each(PATIENTS_WITH_A_CURRENT_PLAN)("never states a blank as a fact about %s", (patientId) => {
    for (const line of readableStrings(patientId, { includeVerifiedContacts: true })) {
      const lowered = line.toLowerCase();
      for (const blank of BLANK_STATEMENTS) {
        expect(lowered.includes(blank), `“${line}” states a blank as a fact about this person`).toBe(false);
      }
    }
  });

  it("hands nobody an instruction that was written for staff", () => {
    const lines = everyConvertedLine();
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      const lowered = line.toLowerCase();
      for (const imperative of STAFF_IMPERATIVES) {
        expect(lowered.includes(imperative), `“${line}” is an instruction written for staff`).toBe(false);
      }
      for (const opener of ["say ", "ask ", "tell ", "keep ", "check ", "offer ", "read ", "sit ", "speak ", "use "]) {
        expect(lowered.startsWith(opener), `“${line}” is an order addressed to the reader`).toBe(false);
      }
    }
  });

  /**
   * Nothing converted still refers to the person in the third person, and
   * nothing is left as broken English by a half-applied substitution. "To be
   * called you" and "hard for your to follow" are the two failures at either end
   * of the same rule, and both were printed on a real fixture's copy before
   * these existed.
   */
  it("addresses the reader as “you”, never as themselves, and never in broken English", () => {
    const state = createInitialPrototypeState();
    let checked = 0;
    for (const patient of syntheticPatients) {
      const version = getCurrentManagementPlanVersion(state.managementPlanVersions, patient.managementPlanId);
      if (version === null) continue;
      const convert = createLineConverter(version, patient, syntheticPatientResources);
      for (const field of Object.values(PATIENT_PLAN_SECTION_SOURCES).flat()) {
        const value = version.content[field];
        for (const line of typeof value === "string" ? [value] : value) {
          const outcome = convert(line);
          if (!("converted" in outcome)) continue;
          checked += 1;
          const lowered = outcome.converted.toLowerCase();
          expect(lowered.includes(patient.preferredName.toLowerCase()), `“${outcome.converted}” still names them`).toBe(
            false,
          );
          expect(lowered.includes(patient.fullName.toLowerCase()), `“${outcome.converted}” still names them`).toBe(
            false,
          );
          for (const broken of [
            "called you,",
            "addressed as you",
            "referred to as you",
            "for your to",
            "with your to",
            "you settles",
            "you is ",
            "you has ",
            "you was ",
            "you does ",
            "you their",
            "you her ",
          ]) {
            expect(lowered.includes(broken), `“${outcome.converted}” is broken English: “${broken}”`).toBe(false);
          }

          /*
           * No third-person pronoun for this person survives on their own copy.
           * The object pronoun is deliberately not checked: "so you can read
           * them again later" is about the notes, not about the reader.
           */
          const [subjectPronoun = ""] = patient.pronouns.split("/");
          const possessivePronoun = subjectPronoun === "they" ? "their" : subjectPronoun === "she" ? "her" : "his";
          for (const pronoun of [subjectPronoun, possessivePronoun]) {
            expect(
              new RegExp(`\\b${pronoun}\\b`, "i").test(outcome.converted),
              `“${outcome.converted}” still talks about this person in the third person`,
            ).toBe(false);
          }
        }
      }
    }
    expect(checked, "nothing converted, so this check proved nothing").toBeGreaterThanOrEqual(5);
  });

  it("writes every heading and lead-in in the person's own voice", () => {
    // Literal, from the specification, not read back from the module.
    expect(PATIENT_PLAN_SECTION_HEADING.whyWeWroteThis).toBe("Why we wrote this together");
    expect(PATIENT_PLAN_SECTION_HEADING.whatMattersToYou).toBe("What matters to you");
    expect(PATIENT_PLAN_SECTION_HEADING.whatHelpsYou).toBe("What helps you");
    expect(PATIENT_PLAN_SECTION_HEADING.whatMakesThingsHarder).toBe("What makes things harder");
    expect(PATIENT_PLAN_SECTION_HEADING.whatWeAgreedWillHappen).toBe(
      "What we agreed will happen when you come to the emergency department",
    );
    expect(PATIENT_PLAN_SECTION_HEADING.ifSomethingNewIsHappening).toBe("If something new is happening");
    expect(PATIENT_PLAN_SECTION_HEADING.whoIsInvolved).toBe("Who's involved in your care");
    expect(PATIENT_PLAN_SECTION_HEADING.thingsThatMightHelp).toBe("Things that might help");
  });
});

describe("Patient Plan resources", () => {
  it("gives every patient a resource list, with housing and money on the ones that need them", () => {
    for (const patient of syntheticPatients) {
      expect(getPatientResources(syntheticPatientResources, patient.id).length).toBeGreaterThan(0);
    }
    const categories = new Set(syntheticPatientResources.map((resource) => resource.category));
    for (const category of PATIENT_RESOURCE_CATEGORY_ORDER) {
      expect(categories.has(category), `no synthetic resource covers ${category}`).toBe(true);
    }
    // Housing and money are frequently the actual reason somebody keeps
    // arriving, so a list that cannot mention them is a list about the wrong
    // problem.
    for (const category of ["housing", "financial"] as const) {
      const patients = new Set(
        syntheticPatientResources.filter((resource) => resource.category === category).map((r) => r.patientId),
      );
      expect(patients.size, `no patient has a ${category} resource`).toBeGreaterThan(0);
    }
  });

  it("marks only the verified public crisis lines as real, and takes them from the one verified source", () => {
    const real = syntheticPatientResources.filter((resource) => resource.isRealContact);
    const invented = syntheticPatientResources.filter((resource) => !resource.isRealContact);

    expect(real.length).toBe(publicCrisisContacts.length * syntheticPatients.length);
    for (const resource of real) {
      expect(resource.category).toBe("crisis_contact");
      const source = publicCrisisContacts.find((contact) => contact.telephoneDisplay === resource.contact);
      expect(source, `${resource.name} is not one of the verified public numbers`).toBeDefined();
      expect(resource.sourceUrl).toBe(source?.sourceUrl);
      if (source?.caveat != null) expect(resource.detail).toContain(source.caveat);
    }

    // Literal, so a fictional service can never be given a real number and a
    // real number can never be quietly changed here.
    const realNumbers = real.map((resource) => resource.contact);
    expect(new Set(realNumbers)).toEqual(new Set(["000", "1300 555 788", "1800 676 822", "1800 552 002"]));
    for (const resource of invented) {
      expect(realNumbers.includes(resource.contact), `${resource.name} carries a real telephone number`).toBe(false);
      expect(resource.category).not.toBe("crisis_contact");
      expect(resource.id.startsWith("SYN-")).toBe(true);
    }
  });

  /**
   * A draft carries this person's resources and nobody else's. The whole
   * catalogue is passed in, so the narrowing is the transformation's job — and
   * a copy handed to somebody listing another person's youth housing service or
   * carer line is both wrong and quietly revealing about who else is on the
   * list.
   */
  it("carries only the resources chosen for the person the copy is for", () => {
    for (const patientId of [ROWAN, MIRA] as const) {
      const draft = draftFor(patientId);
      expect(draft.resources.length).toBeGreaterThan(0);
      expect(draft.resources.length).toBeLessThan(syntheticPatientResources.length);
      for (const resource of draft.resources) {
        expect(resource.patientId, `${resource.name} belongs to somebody else`).toBe(patientId);
      }
      expect(draft.resources).toEqual(getPatientResources(syntheticPatientResources, patientId));
    }
  });

  it("groups resources in the approved order and drops a category with nothing in it", () => {
    const groups = groupPatientResources(getPatientResources(syntheticPatientResources, ROWAN));
    const order = groups.map((group) => group.category);
    expect(order).toEqual([...PATIENT_RESOURCE_CATEGORY_ORDER].filter((category) => order.includes(category)));
    // The crisis lines are last, where a reader flipping to the end will find
    // them when everything above has not worked.
    expect(order.at(-1)).toBe("crisis_contact");
    for (const group of groups) expect(group.resources.length).toBeGreaterThan(0);
  });
});

describe("Patient Plan lifecycle", () => {
  it("derives a draft from the Current Management Plan Version and refuses when there is none", () => {
    const { draft } = stateWithDraft(ROWAN);
    expect(draft.derivedFromManagementVersionId).toBe(currentVersionFor(ROWAN).id);
    expect(draft.state).toBe("draft");
    expect(draft.version).toBe(1);

    // Jordan has a Management Plan record with no versions at all.
    const refused = run(asUser(createInitialPrototypeState(), "liaison_clinician"), {
      type: "create-patient-plan-draft",
      patientId: JORDAN,
    });
    expect(refused.patientPlanVersions).toEqual([]);
    expect(refused.lastOutcome?.kind).toBe("error");
    expect(refused.lastOutcome?.message).toMatch(/no Current Plan/i);
  });

  it("refuses to open a second draft beside an open one", () => {
    const { state } = stateWithDraft(ROWAN);
    const again = prototypeReducer(state, { type: "create-patient-plan-draft", patientId: ROWAN });
    expect(again.patientPlanVersions).toHaveLength(1);
    expect(again.lastOutcome?.kind).toBe("error");
  });

  it("replaces sections and resources whole when a draft is saved", () => {
    const { state, draft } = stateWithDraft(ROWAN);
    const sections = filled(draft.sections);
    const saved = prototypeReducer(state, {
      type: "save-patient-plan-draft",
      versionId: draft.id,
      input: { sections, resources: [] },
    });
    const after = saved.patientPlanVersions.find((version) => version.id === draft.id);
    expect(after?.sections).toEqual(sections);
    expect(after?.resources).toEqual([]);
    expect(unfilledGapSections(after?.sections ?? [])).toEqual([]);
  });

  /**
   * The gap block, with its positive control beside it. The first half proves
   * approval is refused while a gap remains; the second proves the same action
   * succeeds once it is filled — without which the refusal could be caused by
   * anything at all.
   */
  it("refuses approval while any gap is unfilled, and allows it once none is", () => {
    const { state, draft } = stateWithDraft(ROWAN);
    expect(unfilledGapSections(draft.sections).length).toBeGreaterThan(0);

    const blocked = prototypeReducer(state, { type: "approve-patient-plan-version", versionId: draft.id });
    expect(blocked.lastOutcome?.kind).toBe("error");
    expect(blocked.lastOutcome?.message).toMatch(/cannot be approved while/i);
    expect(blocked.patientPlanVersions.find((version) => version.id === draft.id)?.state).toBe("draft");
    expect(blocked.patientPlans[0]?.currentVersionId ?? null).toBeNull();

    const approved = run(
      state,
      {
        type: "save-patient-plan-draft",
        versionId: draft.id,
        input: { sections: filled(draft.sections), resources: [...draft.resources] },
      },
      { type: "approve-patient-plan-version", versionId: draft.id },
    );
    expect(approved.lastOutcome?.kind).toBe("success");
    expect(approved.patientPlanVersions.find((version) => version.id === draft.id)?.state).toBe("current");
  });

  /**
   * The case partial sections created. A section that already holds converted
   * text is *not* finished, and approval must refuse it exactly as it refuses an
   * empty one — otherwise the whole change would have traded a blank box for a
   * half-written page nobody checked.
   */
  it("refuses approval for a section that holds converted text and is still flagged", () => {
    const { state, draft } = stateWithDraft(ROWAN);
    const sections = filled(draft.sections).map((section, index) =>
      // One section left exactly as the conversion produced it: real content,
      // still flagged.
      index === 1
        ? { ...section, body: ["A quiet room.", "A warm drink."], gap: true, gapReason: "half done" }
        : section,
    );

    const saved = prototypeReducer(state, {
      type: "save-patient-plan-draft",
      versionId: draft.id,
      input: { sections, resources: [...draft.resources] },
    });
    const stored = saved.patientPlanVersions.find((version) => version.id === draft.id);
    // The converted text survives the save; the flag survives with it.
    expect(stored?.sections[1]?.body).toEqual(["A quiet room.", "A warm drink."]);
    expect(stored?.sections[1]?.gap).toBe(true);

    const blocked = prototypeReducer(saved, { type: "approve-patient-plan-version", versionId: draft.id });
    expect(blocked.lastOutcome?.kind).toBe("error");
    expect(blocked.lastOutcome?.message).toMatch(/cannot be approved while/i);
    expect(blocked.patientPlanVersions.find((version) => version.id === draft.id)?.state).toBe("draft");
  });

  /**
   * The reducer is the guard, not a restatement of the form's opinion.
   *
   * `unfilledGapSections` filtered on the flag alone, so a caller saving a
   * section with an empty body and `gap: false` was approved — and the page then
   * printed that heading and its lead-in with nothing beneath them. A heading
   * over a blank on somebody's own copy is the Task 8 defect exactly, and it was
   * one dispatch away with only the form standing in front of it.
   */
  it("refuses approval for an empty section however the caller flagged it", () => {
    const { state, draft } = stateWithDraft(ROWAN);
    const sections = filled(draft.sections).map((section, index) =>
      index === 3 ? { ...section, body: [], gap: false, gapReason: null } : section,
    );

    const saved = prototypeReducer(state, {
      type: "save-patient-plan-draft",
      versionId: draft.id,
      input: { sections, resources: [...draft.resources] },
    });
    const blocked = prototypeReducer(saved, { type: "approve-patient-plan-version", versionId: draft.id });

    expect(blocked.lastOutcome?.kind).toBe("error");
    expect(blocked.lastOutcome?.message).toMatch(/cannot be approved while/i);
    expect(blocked.patientPlanVersions.find((version) => version.id === draft.id)?.state).toBe("draft");
  });

  /** A version that has lost headings is not a copy of the plan. */
  it("refuses approval for a version missing any of the eight headings", () => {
    const { state, draft } = stateWithDraft(ROWAN);
    const sections = filled(draft.sections).slice(0, 6);

    const saved = prototypeReducer(state, {
      type: "save-patient-plan-draft",
      versionId: draft.id,
      input: { sections, resources: [...draft.resources] },
    });
    const blocked = prototypeReducer(saved, { type: "approve-patient-plan-version", versionId: draft.id });

    expect(blocked.lastOutcome?.kind).toBe("error");
    expect(blocked.lastOutcome?.message).toMatch(/missing 2 of the eight headings/i);
    expect(blocked.patientPlanVersions.find((version) => version.id === draft.id)?.state).toBe("draft");
  });

  /**
   * Any clinical role, and no senior. Requiring a senior clinician would mean a
   * person waits days for their own copy of their own plan, which defeats the
   * point of giving them one — so the check is that all four clinical roles
   * succeed, not merely that one does.
   */
  it("gives every clinical role the capability, and withholds it from the non-clinical one", () => {
    for (const role of ["ed_clinician", "liaison_clinician", "cmht_clinician", "senior_clinician"] as const) {
      expect(canPerformAction(role, "approve_patient_plan"), `${role} cannot approve a patient copy`).toBe(true);
    }
    expect(canPerformAction("plan_coordinator", "approve_patient_plan")).toBe(false);
  });

  // The fixtures carry a signed-in user for three of the four clinical roles;
  // the capability check above covers the fourth, which has no synthetic user.
  it.each(["ed_clinician", "liaison_clinician", "senior_clinician"] as const)(
    "lets a %s approve the patient copy",
    (role) => {
      const { state, draft } = stateWithDraft(ROWAN, role);
      const approved = run(
        state,
        {
          type: "save-patient-plan-draft",
          versionId: draft.id,
          input: { sections: filled(draft.sections), resources: [...draft.resources] },
        },
        { type: "approve-patient-plan-version", versionId: draft.id },
      );
      const current = approved.patientPlanVersions.find((version) => version.id === draft.id);
      expect(current?.state).toBe("current");
      expect(current?.approvedBy).toBe(approved.activeUserId);
      expect(current?.approvedAt).not.toBeNull();
    },
  );

  /**
   * The record does not claim a document reached somebody's hands.
   *
   * Approving a copy is the whole of what this application observed; handing it
   * over happens in a room nothing here can see, and History's own line for this
   * same event already hedges to "may be holding". An Audit Event that says the
   * copy *was* given contradicts the one surface a reader would check it
   * against, and it is the same overclaim, inverted, as the wrong-name
   * attribution Task 10 found.
   *
   * The forbidden and required phrasings are spelled out rather than read from
   * the reducer, because an expectation taken from the string its subject
   * renders can never disagree with it.
   */
  it("never records that an approved copy was given to anyone", () => {
    const { state, draft } = stateWithDraft(ROWAN);
    const approved = run(
      state,
      {
        type: "save-patient-plan-draft",
        versionId: draft.id,
        input: { sections: filled(draft.sections), resources: [...draft.resources] },
      },
      { type: "approve-patient-plan-version", versionId: draft.id },
    );

    const event = approved.auditEvents.find((candidate) => candidate.type === "patient_plan_approved");
    expect(event, "approving a patient copy recorded no audit event").toBeDefined();
    expect(event?.evidence).toContain("is now the copy to be given to this person");
    expect(event?.evidence).not.toMatch(/is now the copy given to/i);
    expect(event?.evidence).not.toMatch(/\bhas been (?:given|handed)\b/i);
    expect(event?.evidence).not.toMatch(/\bwas (?:given|handed) to\b/i);
  });

  it("refuses the non-clinical plan coordinator", () => {
    expect(canPerformAction("plan_coordinator", "approve_patient_plan")).toBe(false);
    const { state, draft } = stateWithDraft(ROWAN);
    const asCoordinator = asUser(state, "plan_coordinator");
    const refused = prototypeReducer(asCoordinator, { type: "approve-patient-plan-version", versionId: draft.id });
    expect(refused.lastOutcome?.kind).toBe("blocked");
    expect(refused.patientPlanVersions.find((version) => version.id === draft.id)?.state).toBe("draft");
  });

  /**
   * Approval must not consult senior-approval state at any point. Proved by
   * approving a patient copy as an emergency department clinician while the
   * Management Plan itself has a version sitting unapproved: the patient copy
   * lands anyway.
   */
  it("never consults senior-approval state", () => {
    const { state, draft } = stateWithDraft(MIRA, "ed_clinician");
    expect(state.managementPlanVersions.some((version) => version.state === "awaiting_approval")).toBe(true);
    const approved = run(
      state,
      {
        type: "save-patient-plan-draft",
        versionId: draft.id,
        input: { sections: filled(draft.sections), resources: [...draft.resources] },
      },
      { type: "approve-patient-plan-version", versionId: draft.id },
    );
    expect(approved.patientPlanVersions.find((version) => version.id === draft.id)?.state).toBe("current");
    // Untouched: approving a patient copy is not approving a Management Plan.
    expect(approved.managementPlanVersions.filter((version) => version.state === "awaiting_approval")).toHaveLength(1);
  });

  it("supersedes the prior current copy rather than deleting it", () => {
    const { state, draft } = stateWithDraft(ROWAN);
    const first = run(
      state,
      {
        type: "save-patient-plan-draft",
        versionId: draft.id,
        input: { sections: filled(draft.sections), resources: [...draft.resources] },
      },
      { type: "approve-patient-plan-version", versionId: draft.id },
      { type: "create-patient-plan-draft", patientId: ROWAN },
    );
    const second = getOpenPatientPlanDraft(first.patientPlanVersions, first.patientPlans[0]?.id ?? "SYN-NONE");
    if (second === null) throw new Error("no second draft");
    const after = run(
      first,
      {
        type: "save-patient-plan-draft",
        versionId: second.id,
        input: { sections: filled(second.sections), resources: [...second.resources] },
      },
      { type: "approve-patient-plan-version", versionId: second.id },
    );

    expect(after.patientPlanVersions.find((version) => version.id === draft.id)?.state).toBe("superseded");
    expect(after.patientPlanVersions.find((version) => version.id === second.id)?.state).toBe("current");
    expect(after.patientPlans[0]?.currentVersionId).toBe(second.id);
    // The superseded copy stays readable: it is what the person was actually
    // given, and the record of that must not be deleted.
    expect(after.patientPlanVersions.find((version) => version.id === draft.id)?.sections.length).toBe(8);
  });

  it("records a print intent without claiming anything reached a printer or a person", () => {
    const { state, draft } = stateWithDraft(ROWAN);
    const approved = run(
      state,
      {
        type: "save-patient-plan-draft",
        versionId: draft.id,
        input: { sections: filled(draft.sections), resources: [...draft.resources] },
      },
      { type: "approve-patient-plan-version", versionId: draft.id },
      { type: "record-patient-plan-print-intent", patientId: ROWAN },
    );
    const event = approved.auditEvents.at(-1);
    expect(event?.type).toBe("patient_plan_print_intent_opened");
    expect(event?.evidence).toMatch(/is not evidence that anything reached a printer/i);
    // Evidence only: no clinical record changed.
    expect(approved.patientPlanVersions.find((version) => version.id === draft.id)?.state).toBe("current");
  });

  it("refuses a print intent when there is no approved copy, and prints nothing", () => {
    const { state } = stateWithDraft(ROWAN);
    const refused = prototypeReducer(state, { type: "record-patient-plan-print-intent", patientId: ROWAN });
    expect(refused.lastOutcome?.kind).toBe("error");
    expect(refused.auditEvents.filter((event) => event.type === "patient_plan_print_intent_opened")).toEqual([]);
  });

  /** Printing is the one action most wanted when systems are down. */
  it("still records a print intent offline, while refusing to write a copy", () => {
    const { state, draft } = stateWithDraft(ROWAN);
    const approved = run(state, {
      type: "save-patient-plan-draft",
      versionId: draft.id,
      input: { sections: filled(draft.sections), resources: [...draft.resources] },
    });
    const live = prototypeReducer(approved, { type: "approve-patient-plan-version", versionId: draft.id });
    const offline: CarePlanPrototypeState = { ...live, connectivity: { online: false } };

    const printed = prototypeReducer(offline, { type: "record-patient-plan-print-intent", patientId: ROWAN });
    expect(printed.lastOutcome?.kind).toBe("info");

    const written = prototypeReducer(offline, { type: "create-patient-plan-draft", patientId: ROWAN });
    expect(written.lastOutcome?.kind).toBe("blocked");
  });
});

describe("Patient Plan staleness", () => {
  /** An approved patient copy for Mira, whose Management Plan has a version
   *  awaiting approval — so the plan can be moved on underneath it. */
  function withApprovedCopy() {
    const { state, draft } = stateWithDraft(MIRA, "senior_clinician");
    return run(
      state,
      {
        type: "save-patient-plan-draft",
        versionId: draft.id,
        input: { sections: filled(draft.sections), resources: [...draft.resources] },
      },
      { type: "approve-patient-plan-version", versionId: draft.id },
    );
  }

  function awaitingVersionId(state: CarePlanPrototypeState): SyntheticId {
    const version = state.managementPlanVersions.find((candidate) => candidate.state === "awaiting_approval");
    if (version === undefined) throw new Error("no version awaiting approval");
    return version.id;
  }

  it("derives staleness from the two identifiers and never stores it", () => {
    const before = withApprovedCopy();
    const plan = before.patientPlans[0];
    const copy = getCurrentPatientPlanVersion(before.patientPlanVersions, plan?.id ?? "SYN-NONE");
    const management = before.managementPlans.find((candidate) => candidate.patientId === MIRA);
    expect(isPatientPlanVersionStale(copy, management?.currentVersionId ?? null)).toBe(false);

    const after = prototypeReducer(before, {
      type: "approve-management-version",
      versionId: awaitingVersionId(before),
    });
    const stillTheSameCopy = getCurrentPatientPlanVersion(after.patientPlanVersions, plan?.id ?? "SYN-NONE");
    const movedOn = after.managementPlans.find((candidate) => candidate.patientId === MIRA);
    expect(isPatientPlanVersionStale(stillTheSameCopy, movedOn?.currentVersionId ?? null)).toBe(true);

    // Nothing about the copy itself changed: staleness is not a stored field.
    expect(stillTheSameCopy).toEqual(copy);
    expect(JSON.stringify(stillTheSameCopy)).not.toContain("stale");
  });

  it("never regenerates, hides, or withdraws a copy the person may be holding", () => {
    const before = withApprovedCopy();
    const copyBefore = before.patientPlanVersions.map((version) => ({ ...version }));
    const after = prototypeReducer(before, {
      type: "approve-management-version",
      versionId: awaitingVersionId(before),
    });

    expect(after.patientPlanVersions).toEqual(copyBefore);
    expect(after.patientPlanVersions.every((version) => version.state !== "superseded")).toBe(true);
    expect(after.patientPlans[0]?.currentVersionId).toBe(copyBefore[0]?.id);
  });

  it("raises exactly one Review Trigger, however many versions are approved after it", () => {
    const before = withApprovedCopy();
    const openBefore = before.reviewTriggers.filter((trigger) => trigger.source === "patient_plan_stale");
    expect(openBefore).toEqual([]);

    const after = prototypeReducer(before, {
      type: "approve-management-version",
      versionId: awaitingVersionId(before),
    });
    const raised = after.reviewTriggers.filter((trigger) => trigger.source === "patient_plan_stale");
    expect(raised).toHaveLength(1);
    expect(raised[0]?.status).toBe("open");
    expect(raised[0]?.patientId).toBe(MIRA);
    // Literal: the reason a human reads in the queue must say the copy stays
    // readable, because the instinct on reading "stale" is to take it away.
    expect(raised[0]?.reason).toMatch(/stays readable and unchanged/i);

    // A further approval on the same plan does not stack a second item.
    const draftedAgain = run(
      after,
      { type: "create-management-draft", patientId: MIRA },
      { type: "select-patient", patientId: MIRA },
    );
    const nextDraft = draftedAgain.managementPlanVersions.filter((version) => version.state === "draft").at(-1);
    if (nextDraft === undefined) throw new Error("no further draft");
    const twice = run(
      draftedAgain,
      {
        type: "save-management-draft",
        versionId: nextDraft.id,
        input: {
          ownerId: nextDraft.ownerId,
          reviewDueAt: "2027-01-01T12:00:00+08:00",
          revisionReason: "A further revision, to prove the trigger does not stack.",
          participationState: "co_produced",
          consentedSupportPeople: [],
          content: nextDraft.content,
        },
      },
      { type: "submit-management-draft", versionId: nextDraft.id },
      { type: "approve-management-version", versionId: nextDraft.id },
    );
    expect(twice.reviewTriggers.filter((trigger) => trigger.source === "patient_plan_stale")).toHaveLength(1);
  });

  /**
   * A withdrawn Management Plan makes the copy stale.
   *
   * The selector used to return "not stale" when the plan had no version in use,
   * because withdrawal sets `currentVersionId` to null. So a person holding a
   * copy of a plan the service had taken out of use entirely was told nothing,
   * printed it unmarked, and nobody's queue heard about it — the case that most
   * needs marking, quietly exempted by an unstated carve-out.
   */
  it("marks a copy stale when the Management Plan it describes has been withdrawn", () => {
    const before = withApprovedCopy();
    const plan = before.patientPlans[0];
    const copy = getCurrentPatientPlanVersion(before.patientPlanVersions, plan?.id ?? "SYN-NONE");
    expect(
      isPatientPlanVersionStale(
        copy,
        before.managementPlans.find((p) => p.patientId === MIRA)?.currentVersionId ?? null,
      ),
    ).toBe(false);

    const withdrawn = prototypeReducer(before, {
      type: "withdraw-current-management-version",
      patientId: MIRA,
      reason: "Withdrawn at review; a new plan will be written with this person.",
    });

    const management = withdrawn.managementPlans.find((candidate) => candidate.patientId === MIRA);
    expect(management?.currentVersionId).toBeNull();
    const after = getCurrentPatientPlanVersion(withdrawn.patientPlanVersions, plan?.id ?? "SYN-NONE");
    expect(isPatientPlanVersionStale(after, management?.currentVersionId ?? null)).toBe(true);

    // The copy itself is untouched — never regenerated, hidden, or withdrawn.
    expect(after).toEqual(copy);

    // And it reaches a human rather than only a screen.
    const raised = withdrawn.reviewTriggers.filter((trigger) => trigger.source === "patient_plan_stale");
    expect(raised).toHaveLength(1);
    expect(raised[0]?.reason).toMatch(/no longer in use/i);
    expect(raised[0]?.reason).toMatch(/stays readable and unchanged/i);
  });

  it("raises nothing when the person holds no patient copy at all", () => {
    const state = asUser(createInitialPrototypeState(), "senior_clinician");
    const after = prototypeReducer(state, {
      type: "approve-management-version",
      versionId: awaitingVersionId(state),
    });
    expect(after.reviewTriggers.filter((trigger) => trigger.source === "patient_plan_stale")).toEqual([]);
  });
});
