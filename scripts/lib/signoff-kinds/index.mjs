/**
 * Extra sign-off kinds for npm run clinical:review, one module per content family.
 *
 * Each module exports:
 *   kinds        { [name]: kind }  A kind is the same shape as those in
 *                ../clinical-record-review-contract.mjs `recordKinds`: kind, noun, heading,
 *                path (repo-relative data file), idField, optional, statuses, attested(record,
 *                context), and EITHER collectionKey (+ optional view/unview) OR records(document)
 *                + write(document, reviewedView). `checklist` defaults to the three standard
 *                questions when a module leaves it out. Records are flat views carrying
 *                status (drafted | reviewed | pending) and reviewedBy, reviewedAt,
 *                reviewedContentSha256; everything else in a view is content.
 *   display      { [name]: (record, context) => Array<[label, value]> }  what the walk-through
 *                and the review pack show; must be everything the site shows for the record.
 *   loadContext  async (name, root) => object | undefined  extra files a kind needs.
 *
 * A module must not import the contract (the contract imports this file).
 */
import * as services from "./services.mjs";
import * as sources from "./sources.mjs";
import * as standardsAndCulturalNotes from "./standards-and-cultural-notes.mjs";

export const signOffKindModules = [standardsAndCulturalNotes, sources, services];
