import { type NextRequest } from "next/server";

export function GET(_request: NextRequest) {
  return new Response(null, {
    status: 307,
    headers: { Location: "/?mode=prescribing" },
  });
}

export const HEAD = GET;
