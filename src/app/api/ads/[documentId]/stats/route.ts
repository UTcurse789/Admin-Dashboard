import { NextRequest, NextResponse } from "next/server";
import { getAdStats } from "@/lib/ad-tracking";

export const runtime = "nodejs";
export const maxDuration = 15;

interface RouteContext {
  params: Promise<{ documentId: string }>;
}

/**
 * GET /api/ads/[documentId]/stats
 *
 * Returns aggregated tracking statistics for a single advertisement.
 * Used by the ad detail page to populate charts and KPIs.
 */
export async function GET(
  _req: NextRequest,
  context: RouteContext
) {
  try {
    const { documentId } = await context.params;

    if (!documentId || documentId.length < 5) {
      return NextResponse.json(
        { error: "Invalid documentId" },
        { status: 400 }
      );
    }

    const stats = await getAdStats(documentId);

    return NextResponse.json(stats, {
      headers: {
        // Allow the page to cache for 30 seconds for quick reloads
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("[Ad Stats] Failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch ad stats" },
      { status: 500 }
    );
  }
}
