import { NextResponse } from "next/server";
import { z } from "zod";
import { demoSearch } from "@/lib/demo-data";
import { isDemoMode } from "@/lib/env";
import { buildSmartPanel, buildVisualEvidence, diversifySearchResults } from "@/lib/evidence";
import { jsonError } from "@/lib/http";
import { searchChunks } from "@/lib/rag";
import { createAdminClient } from "@/lib/supabase/admin";
import { AuthenticationError, requireAuthenticatedUser, unauthorizedResponse } from "@/lib/supabase/auth";

export const runtime = "nodejs";

const searchSchema = z.object({
  query: z.string().trim().min(2),
  topK: z.number().int().min(1).max(20).optional(),
  documentId: z.string().uuid().optional(),
  documentIds: z.array(z.string().uuid()).max(25).optional(),
});

export async function POST(request: Request) {
  try {
    const body = searchSchema.parse(await request.json());
    if (isDemoMode()) {
      const results = demoSearch(body.query, body.topK ?? 8, body.documentId, body.documentIds);
      return NextResponse.json({
        results,
        visualEvidence: buildVisualEvidence(results),
        smartPanel: buildSmartPanel(body.query, results),
        demoMode: true,
      });
    }

    const supabase = createAdminClient();
    const user = await requireAuthenticatedUser(request, supabase);
    const results = diversifySearchResults(
      await searchChunks({
        query: body.query,
        topK: body.topK ?? 8,
        documentId: body.documentId,
        documentIds: body.documentIds,
        ownerId: user.id,
      }),
      body.topK ?? 8,
    );

    return NextResponse.json({
      results,
      visualEvidence: buildVisualEvidence(results),
      smartPanel: buildSmartPanel(body.query, results),
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return unauthorizedResponse();
    }
    return jsonError(error, 400);
  }
}
