import { describe, expect, it } from "vitest";
import {
  canonicalDocumentDisplayTitle,
  classifyDocumentOrganization,
  extractDocumentBracketTags,
} from "@/lib/document-organization";

describe("document organization classifier", () => {
  it("extracts bracket tags from titles, filenames, and source paths", () => {
    expect(
      extractDocumentBracketTags(
        "Tracheostomy Management (Adult) (FSH)",
        "Remote Network Access (RNA) to WA Health System (Including FSH Clinical Applications) (FSH).pdf",
        "Policies/[SMHS Policy]/example.pdf",
      ),
    ).toEqual(["Adult", "FSH", "RNA", "Including FSH Clinical Applications", "SMHS Policy"]);
  });

  it("assigns Fiona Stanley Hospital only when bracket and source evidence agree", () => {
    const classification = classifyDocumentOrganization({
      title: "Tracheostomy Management (Adult) (FSH)",
      file_name: "Tracheostomy Management (Adult) (FSH).pdf",
      contentText: "This Fiona Stanley Hospital procedure applies to adult inpatient wards.",
    });

    expect(classification.profile).toMatchObject({
      canonical_display_title: "Tracheostomy Management",
      review_status: "confident",
      site: {
        label: "Fiona Stanley Hospital",
        raw_tag: "FSH",
        kind: "hospital",
      },
      document_type: { label: "procedure" },
      secondary_facets: { population: ["adult"] },
    });
    expect(classification.labels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Fiona Stanley Hospital", label_type: "site" }),
        expect.objectContaining({ label: "adult", label_type: "population" }),
      ]),
    );
  });

  it("marks site candidates for review when only the bracket supports the site", () => {
    const classification = classifyDocumentOrganization({
      title: "Waitlist Management (Kara Maar) (FSH)",
      file_name: "Waitlist Management (Kara Maar) (FSH).pdf",
      contentText: "This source describes waitlist management for a local service.",
    });

    expect(classification.profile.site.label).toBeNull();
    expect(classification.profile.site.candidates[0]).toMatchObject({
      label: "Fiona Stanley Hospital",
      raw_tag: "FSH",
      confidence: 0.58,
    });
    expect(classification.profile.review_status).toBe("needs_review");
    expect(classification.profile.secondary_facets.service).toEqual(["kara maar"]);
  });

  it("maps health-service and program tags conservatively", () => {
    expect(
      classifyDocumentOrganization({
        title: "Transport of Mental Health Consumers (EMHS Policy)",
        file_name: "Transport of Mental Health Consumers (EMHS Policy).pdf",
        contentText: "East Metropolitan Health Service policy for transport.",
      }).profile.site,
    ).toMatchObject({ label: "East Metropolitan Health Service", kind: "health_service" });

    expect(
      classifyDocumentOrganization({
        title: "Paediatric Consultation Liaison Program Entry Protocol Placecard (CAMHS)",
        file_name: "Paediatric Consultation Liaison Program Entry Protocol Placecard (CAMHS).pdf",
        contentText: "Child and Adolescent Mental Health Service entry protocol.",
      }).profile.site,
    ).toMatchObject({ label: "Child and Adolescent Mental Health Service", kind: "program" });
  });

  it("keeps non-site acronym tags out of site assignment", () => {
    const classification = classifyDocumentOrganization({
      title: "Patient Assisted Travel Scheme (PATS)",
      file_name: "Patient Assisted Travel Scheme (PATS).pdf",
      contentText: "Patient assisted travel workflow.",
    });

    expect(classification.profile.site.label).toBeNull();
    expect(classification.profile.site.candidates).toEqual([]);
    expect(classification.profile.secondary_facets.workflow).toEqual(["patient assisted travel scheme"]);
  });

  it("preserves unknown clinical brackets in display titles", () => {
    expect(
      canonicalDocumentDisplayTitle({
        title: "Management of (CAR-T Cell) Therapy Recipients (FSH)",
        file_name: "Management of (CAR-T Cell) Therapy Recipients (FSH).pdf",
      }),
    ).toBe("Management Of(CAR-T Cell) Therapy Recipients");
  });

  it("classifies new document types accurately based on title keywords", () => {
    expect(
      classifyDocumentOrganization({
        title: "6C Orientation Manual",
        file_name: "6C Orientation Manual (RPBG).pdf",
        contentText: "Welcome to 6C.",
      }).profile.document_type.label,
    ).toBe("manual");

    expect(
      classifyDocumentOrganization({
        title: "Abnormal Involuntary Movement Scale (AIMS)",
        file_name: "AIMS (FSH).pdf",
        contentText: "Movement scale assessment.",
      }).profile.document_type.label,
    ).toBe("assessment_tool");

    expect(
      classifyDocumentOrganization({
        title: "Lithium Prescribing Aid and Calculator",
        file_name: "lithium_prescribing_aid.pdf",
        contentText: "Dosing and monitoring aid.",
      }).profile.document_type.label,
    ).toBe("prescribing_aid");

    expect(
      classifyDocumentOrganization({
        title: "Clozapine Factsheet for Patients",
        file_name: "clozapine_patient_factsheet.pdf",
        contentText: "Patient information sheet.",
      }).profile.document_type.label,
    ).toBe("factsheet");

    expect(
      classifyDocumentOrganization({
        title: "Acute Severe Behavioral Disturbance (ASBD) Management Algorithm",
        file_name: "ASBD Algorithm (PHC).pdf",
        contentText: "Clinical decision flowchart.",
      }).profile.document_type.label,
    ).toBe("algorithm");

    expect(
      classifyDocumentOrganization({
        title: "Acute Surgical Unit SOP",
        file_name: "ASU SOP (RPBG).pdf",
        contentText: "Standard operating procedure.",
      }).profile.document_type.label,
    ).toBe("procedure");
  });

  it("flags low-confidence document type classifications as needs_review", () => {
    const classification = classifyDocumentOrganization({
      title: "Random Document",
      file_name: "random_doc.pdf",
      contentText: "Does not contain any pattern keywords.",
    });
    expect(classification.profile.document_type.label).toBe("unknown");
    expect(classification.profile.review_status).toBe("needs_review");
  });
});
