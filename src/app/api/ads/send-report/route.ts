import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * POST /api/ads/send-report
 * Body: { campaignIds: string[] }
 *
 * In production this would:
 *  1. Query campaign stats from Strapi / tracking DB
 *  2. Build an HTML email with impressions, clicks, CTR, pacing, daily chart
 *  3. Send via SendGrid / Brevo to the advertiser's stored email
 *  4. Log the send timestamp in the database
 *
 * For now this is a stub that acknowledges the request.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const campaignIds: string[] = body?.campaignIds;

    if (!Array.isArray(campaignIds) || campaignIds.length === 0) {
      return NextResponse.json(
        { error: "campaignIds array is required" },
        { status: 400 }
      );
    }

    // TODO: Wire up to actual email service (SendGrid / Brevo)
    // For each campaignId:
    //   1. Fetch campaign from Strapi
    //   2. Aggregate impressions/clicks from tracking table
    //   3. Build HTML report email
    //   4. Send via email API
    //   5. Log send time in ad_report_logs table

    console.log(
      `[Ads Report] Queued ${campaignIds.length} report(s) for: ${campaignIds.join(", ")}`
    );

    // Simulate a small delay
    await new Promise((resolve) => setTimeout(resolve, 800));

    return NextResponse.json({
      success: true,
      sent: campaignIds.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Ads Report] Failed:", error);
    return NextResponse.json(
      { error: "Failed to send reports" },
      { status: 500 }
    );
  }
}
