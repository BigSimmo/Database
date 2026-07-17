import { type NextRequest, NextResponse } from "next/server";

// "Tools" is the canonical name and /tools the canonical route (PT-11). A
// route handler redirects the incoming legacy request before React renders it.
export function GET(request: NextRequest) {
  const destination = request.nextUrl.clone();
  destination.pathname = "/tools";
  return NextResponse.redirect(destination);
}

export const HEAD = GET;
