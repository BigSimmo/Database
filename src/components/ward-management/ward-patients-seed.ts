import type { Patient } from "@/components/ward-management/ward-patients";

/**
 * Synthetic patients, and the names are a deliberate choice rather than filler.
 *
 * TWO REQUIREMENTS PULL IN OPPOSITE DIRECTIONS and both are real.
 *
 * The owner asked for RELATED-NAME SEARCH, which can only be demonstrated on things shaped like
 * names. "Test Patient Alpha" and "Patient 004" defeat the requirement they were meant to make safe:
 * you cannot show that a search finds a near-miss if there are no near-misses to find.
 *
 * And a screen of realistic Australian names is at its most dangerous in a room full of health
 * service staff — somebody may recognise a name, or find their own, and a synthetic list is one
 * screenshot away from being read as a patient list.
 *
 * So: NAME-SHAPED AND CLEARLY FICTIONAL. Invented surnames that no Perth phone book carries, paired
 * so that related-name search has something to prove — `Halloway` beside `Hallowin`, `Marrowby`
 * beside `Marrowbee`, `O'Quinn` beside `Oquinn`. A search for "hallow" finds two people, which is
 * the behaviour a clinician needs to see, and neither of them can be anybody.
 *
 * The screens that render these carry a visible synthetic-data marker. That belongs on the screen
 * rather than in this comment: the person in the room is the one who needs to know, and they will
 * never read this file.
 *
 * Dates of birth are fixed rather than computed, so a patient's age does not silently change with
 * the demo clock and every screenshot of this fixture agrees with every other.
 *
 * OWNER RULING R-2026-09-04-A adds nine more fields a patient may hold (see `ward-patients.ts`).
 * Every value below is invented, same as the names: the suburb names and their paired community
 * team are real, verified pairs from `ward-catchment.ts` (this repository's own catchment table,
 * not looked up at runtime here), so the pairing itself is not a mistake for anybody who checks —
 * but the house number, the GP and clinic name, the legal status detail and the interpreter/
 * Aboriginal-or-Torres-Strait-Islander-status values are all fictional and vary patient to patient
 * so the field set has something to render other than one repeated example.
 */
export const wardPatients: Patient[] = [
  {
    id: "PT-001",
    umrn: "UM100001",
    givenName: "Talia",
    familyName: "Halloway",
    dateOfBirth: "1988-03-14",
    preferredName: "Tali",
    sexOrGender: "Female",
    address: "No. 7, Ashfield",
    suburb: "Ashfield",
    generalPractitioner: "Dr A. Farrowmere, Hallowcrest Family Medical",
    catchmentCommunityTeam: "Midland Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Neither Aboriginal nor Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-002",
    umrn: "UM100002",
    givenName: "Marcus",
    familyName: "Hallowin",
    dateOfBirth: "1961-11-02",
    preferredName: "Marc",
    sexOrGender: "Male",
    address: "No. 23, Bassendean",
    suburb: "Bassendean",
    generalPractitioner: "Dr T. Oakenfell, Marrowvale Medical Centre",
    catchmentCommunityTeam: "Midland Community Team",
    legalStatus: "Involuntary patient under the Mental Health Act 2014 (WA)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "Vietnamese — interpreter required",
  },
  {
    id: "PT-003",
    umrn: "UM100003",
    givenName: "Ines",
    familyName: "Marrowby",
    dateOfBirth: "1995-07-21",
    preferredName: "Nes",
    sexOrGender: "Female",
    address: "No. 5, Cannington",
    suburb: "Cannington",
    generalPractitioner: "Dr S. Brackenridge, Quillcross Family Practice",
    catchmentCommunityTeam: "Bentley Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Aboriginal, not Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-004",
    umrn: "UM100004",
    givenName: "Devan",
    familyName: "Marrowbee",
    dateOfBirth: "1974-01-09",
    preferredName: "Dev",
    sexOrGender: "Male",
    address: "No. 118, Beckenham",
    suburb: "Beckenham",
    generalPractitioner: "Dr L. Winterthorn, Oquincrest Medical",
    catchmentCommunityTeam: "Bentley Community Team",
    legalStatus: "Community Treatment Order under the Mental Health Act 2014 (WA)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "Mandarin — interpreter required",
  },
  {
    id: "PT-005",
    umrn: "UM100005",
    givenName: "Roshan",
    familyName: "O'Quinn",
    dateOfBirth: "2003-05-30",
    preferredName: "Ro",
    sexOrGender: "Male",
    address: "No. 61, Bertram",
    suburb: "Bertram",
    generalPractitioner: "Dr M. Ashgrove, Vandersloot Family Clinic",
    catchmentCommunityTeam: "Rockingham Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Torres Strait Islander, not Aboriginal",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-006",
    umrn: "UM100006",
    givenName: "Priya",
    familyName: "Oquinn",
    dateOfBirth: "1952-09-17",
    preferredName: "Pri",
    sexOrGender: "Female",
    address: "No. 34, Caversham",
    suburb: "Caversham",
    generalPractitioner: "Dr R. Thistledown, Blennerhast Medical Group",
    catchmentCommunityTeam: "Midland Community Team",
    legalStatus: "Involuntary patient under the Mental Health Act 2014 (WA)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "Punjabi — interpreter required",
  },
  {
    id: "PT-007",
    umrn: "UM100007",
    givenName: "Feodora",
    familyName: "Blennerhast",
    dateOfBirth: "1969-12-25",
    preferredName: "Feo",
    sexOrGender: "Non-binary",
    address: "No. 9, Como",
    suburb: "Como",
    generalPractitioner: "Dr J. Hollowfield, Farrowmere Medical Centre",
    catchmentCommunityTeam: "Bentley Community Team",
    legalStatus: "Voluntary patient",
    aboriginalOrTorresStraitIslanderStatus: "Aboriginal and Torres Strait Islander",
    interpreterLanguage: "English — no interpreter required",
  },
  {
    id: "PT-008",
    umrn: "UM100008",
    givenName: "Kwame",
    familyName: "Vandersloot",
    dateOfBirth: "1991-04-03",
    preferredName: "Kwe",
    sexOrGender: "Male",
    address: "No. 88, East Fremantle",
    suburb: "East Fremantle",
    generalPractitioner: "Dr E. Cresswick, Oakenfell Community Health",
    catchmentCommunityTeam: "Alma Street (Fremantle) Community Team",
    legalStatus: "Community Treatment Order under the Mental Health Act 2014 (WA)",
    aboriginalOrTorresStraitIslanderStatus: "Not stated",
    interpreterLanguage: "Auslan — interpreter required",
  },
];
