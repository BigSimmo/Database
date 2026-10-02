import { NextResponse, type NextRequest } from "next/server";

import { TEACHING_SAMPLE_COOKIE, teachingSampleReturnPath } from "@/lib/teaching/sample-paths";

/*
 * `/teaching/sample` turns the made-up Teaching sample on for this browser and
 * lands on Teaching's home; `?leave=1` turns it off. `next` returns the reader
 * to the Teaching page they came from. See `src/lib/teaching/sample.ts`.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const response = new NextResponse(null, {
    status: 303,
    headers: { Location: teachingSampleReturnPath(params.get("next")), "Cache-Control": "no-store" },
  });
  if (params.get("leave") === "1") {
    response.cookies.delete(TEACHING_SAMPLE_COOKIE);
  } else {
    response.cookies.set(TEACHING_SAMPLE_COOKIE, "1", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 12,
    });
  }
  return response;
}
