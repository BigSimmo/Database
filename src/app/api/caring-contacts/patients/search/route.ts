// src/app/api/caring-contacts/patients/search/route.ts
//
// POST caseload search endpoint (#HDCF2B).
//
// Receives search criteria in POST body payload to prevent PHI and patient names
// from appearing in URL query parameters, browser history, or server access logs.
// Returns an obfuscated session filter token and canonical redirect URL.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { CARING_CONTACTS_ROUTES } from "@/lib/caring-contacts-routes";
import { createSearchFilterToken } from "@/lib/caring-contacts/caseload-search-token";
import {
  PATIENTS_DIRECTORY_FILTER_TOKEN_PARAM,
  PATIENTS_DIRECTORY_STATE_ORDER,
} from "@/lib/caring-contacts/patients-directory-filter";
import { CARING_CONTACTS_STATE_PARAM } from "@/lib/caring-contacts/workspace-address";
import { parseJsonBody } from "@/lib/validation/body";

export const runtime = "nodejs";

const searchRequestSchema = z
  .object({
    query: z.string().default(""),
    state: z
      .enum(["all", ...PATIENTS_DIRECTORY_STATE_ORDER])
      .optional()
      .default("all"),
  })
  .strict();

export async function POST(request: NextRequest): Promise<Response> {
  let body: z.infer<typeof searchRequestSchema>;
  try {
    body = await parseJsonBody(request, searchRequestSchema);
  } catch {
    return NextResponse.json({ error: "invalid-request-payload" }, { status: 400 });
  }

  const query = body.query.trim();
  const filterToken = createSearchFilterToken(query);

  const searchParams = new URLSearchParams();
  if (body.state && body.state !== "all") {
    searchParams.set(CARING_CONTACTS_STATE_PARAM, body.state);
  }
  if (filterToken) {
    searchParams.set(PATIENTS_DIRECTORY_FILTER_TOKEN_PARAM, filterToken);
  }

  const queryString = searchParams.toString();
  const destination =
    queryString === "" ? CARING_CONTACTS_ROUTES.patients : `${CARING_CONTACTS_ROUTES.patients}?${queryString}`;

  return NextResponse.json(
    {
      filterToken,
      destination,
      queryLength: query.length,
      hasFilter: filterToken !== "",
    },
    { status: 200 },
  );
}
