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
 */
export const wardPatients: Patient[] = [
  { id: "PT-001", umrn: "UM100001", givenName: "Talia", familyName: "Halloway", dateOfBirth: "1988-03-14" },
  { id: "PT-002", umrn: "UM100002", givenName: "Marcus", familyName: "Hallowin", dateOfBirth: "1961-11-02" },
  { id: "PT-003", umrn: "UM100003", givenName: "Ines", familyName: "Marrowby", dateOfBirth: "1995-07-21" },
  { id: "PT-004", umrn: "UM100004", givenName: "Devan", familyName: "Marrowbee", dateOfBirth: "1974-01-09" },
  { id: "PT-005", umrn: "UM100005", givenName: "Roshan", familyName: "O'Quinn", dateOfBirth: "2003-05-30" },
  { id: "PT-006", umrn: "UM100006", givenName: "Priya", familyName: "Oquinn", dateOfBirth: "1952-09-17" },
  { id: "PT-007", umrn: "UM100007", givenName: "Feodora", familyName: "Blennerhast", dateOfBirth: "1969-12-25" },
  { id: "PT-008", umrn: "UM100008", givenName: "Kwame", familyName: "Vandersloot", dateOfBirth: "1991-04-03" },
];
