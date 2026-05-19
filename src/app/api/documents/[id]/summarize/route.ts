import { NextResponse } from "next/server";
import { demoSummary, getDemoDocument } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { summarizeDocument } from "@/lib/rag";
import { jsonError } from "@/lib/http";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    if (isDemoMode()) {
      if (!getDemoDocument(id)) {
        return NextResponse.json({ error: "Demo document not found." }, { status: 404 });
      }
      return NextResponse.json({ ...demoSummary(id), demoMode: true });
    }

    return NextResponse.json(await summarizeDocument(id));
  } catch (error) {
    return jsonError(error, 400);
  }
}
