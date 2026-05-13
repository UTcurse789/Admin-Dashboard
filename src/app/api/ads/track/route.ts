import { ipAddress, geolocation } from "@vercel/functions";
import { after, NextRequest, NextResponse } from "next/server";
import {
  insertAdEvent,
  insertAdEventsBatch,
  detectDeviceType,
  ensureAdEventsTable,
  enrichWithGeo,
  type AdEventInsert,
} from "@/lib/ad-tracking";
import { getAdByDocumentId } from "@/lib/ads";

export const runtime = "nodejs";
export const maxDuration = 10;

// Auto-migrate on first cold start
let migrationDone = false;
async function ensureMigration() {
  if (!migrationDone) {
    await ensureAdEventsTable();
    migrationDone = true;
  }
}

/* ── Ad info cache (avoid hitting Strapi on every event) ─────── */
const adCache = new Map<string, { placement: string; targetUrl: string; ttl: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function readSearchParam(
  params: URLSearchParams,
  names: string[]
): string | undefined {
  for (const name of names) {
    const value = params.get(name)?.trim();
    if (value) return value;
  }
  return undefined;
}

async function enrichEvent(event: AdEventInsert): Promise<AdEventInsert> {
  // If both fields are already present, no need to look up
  if (event.placement && event.targetUrl) return event;

  const docId = event.adDocumentId;
  let cached = adCache.get(docId);

  if (!cached || Date.now() > cached.ttl) {
    try {
      const ad = await getAdByDocumentId(docId);
      if (ad) {
        cached = {
          placement: ad.placement,
          targetUrl: ad.targetUrl,
          ttl: Date.now() + CACHE_TTL,
        };
        adCache.set(docId, cached);
      }
    } catch (error) {
      console.error(`[Ad Track] Failed to enrich metadata for ${docId}:`, error);
    }
  }

  if (cached) {
    if (!event.placement) event.placement = cached.placement;
    if (!event.targetUrl) event.targetUrl = cached.targetUrl;
  }

  return event;
}

function readRequestIp(req: NextRequest): string | undefined {
  return (
    ipAddress(req) ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined
  );
}

function readRequestGeo(req: NextRequest): Pick<AdEventInsert, "country" | "region" | "city"> {
  const geo = geolocation(req);

  return {
    country: geo.country || undefined,
    region: geo.countryRegion || undefined,
    city: geo.city || undefined,
  };
}

async function prepareEventForInsert(event: AdEventInsert): Promise<AdEventInsert> {
  const enrichedEvent = await enrichEvent({ ...event });
  return enrichWithGeo(enrichedEvent);
}

/**
 * GET /api/ads/track — Tracking pixel (1×1 transparent GIF)
 *
 * Query params:
 *   t    = event type ("impression" | "click")
 *   id   = ad documentId
 *   p    = placement key
 *   url  = target URL (for clicks)
 *   page = page URL where the ad is shown
 *   ref  = referrer
 *
 * Returns a 1×1 transparent GIF.
 * This is the simplest tracking approach — works even without JS.
 */
export async function GET(req: NextRequest) {
  await ensureMigration();

  const sp = req.nextUrl.searchParams;
  const eventType = sp.get("t") === "click" ? "click" : "impression";
  const adDocumentId = sp.get("id");

  if (!adDocumentId) {
    // Return the pixel anyway to avoid breaking the page
    return transparentGif();
  }

  const ua = req.headers.get("user-agent") || undefined;
  const ip = readRequestIp(req);
  const requestGeo = readRequestGeo(req);
  const redirectUrl = readSearchParam(sp, ["url", "target_url", "targetUrl"]);
  const referrer =
    readSearchParam(sp, ["ref", "referrer"]) ||
    req.headers.get("referer") ||
    undefined;
  const pageUrl =
    readSearchParam(sp, ["page", "page_url", "pageUrl"]) ||
    referrer;

  const event: AdEventInsert = {
    eventType,
    adDocumentId,
    placement: readSearchParam(sp, ["p", "placement"]),
    targetUrl: redirectUrl,
    userAgent: ua,
    deviceType: detectDeviceType(ua),
    ipAddress: ip,
    ...requestGeo,
    pageUrl,
    referrer,
  };

  after(async () => {
    try {
      await insertAdEvent(await prepareEventForInsert(event));
    } catch (error) {
      console.error("[Ad Track] GET persistence failed:", error);
    }
  });

  // For click events, redirect to target URL
  if (eventType === "click" && redirectUrl) {
    return NextResponse.redirect(redirectUrl, { status: 302 });
  }

  return transparentGif();
}

/**
 * POST /api/ads/track — Batch event tracking via JSON
 *
 * Body: { events: Array<{ type, id, placement?, targetUrl?, pageUrl?, referrer? }> }
 *
 * Used by the frontend JS SDK for beacon-based tracking.
 */
export async function POST(req: NextRequest) {
  await ensureMigration();

  // CORS: allow any origin (tracking pixels need this)
  const headers = corsHeaders();

  try {
    const body = await req.json();
    const rawEvents: Array<{
      type?: string;
      id?: string;
      adDocumentId?: string;
      placement?: string;
      targetUrl?: string;
      target_url?: string;
      url?: string;
      pageUrl?: string;
      page_url?: string;
      page?: string;
      referrer?: string;
      ref?: string;
    }> = body?.events;

    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return NextResponse.json(
        { error: "events array is required" },
        { status: 400, headers }
      );
    }

    // Cap batch size
    const capped = rawEvents.slice(0, 50);

    const ua = req.headers.get("user-agent") || undefined;
    const ip = readRequestIp(req);
    const requestGeo = readRequestGeo(req);

    const rawMapped = capped.reduce<AdEventInsert[]>((events, e) => {
        const adDocumentId = e.id || e.adDocumentId;
        if (!adDocumentId) return events;

        const referrer =
          e.referrer ||
          e.ref ||
          req.headers.get("referer") ||
          undefined;

        events.push({
          eventType: e.type === "click" ? "click" as const : "impression" as const,
          adDocumentId,
          placement: e.placement,
          targetUrl: e.targetUrl || e.target_url || e.url,
          userAgent: ua,
          deviceType: detectDeviceType(ua),
          ipAddress: ip,
          ...requestGeo,
          pageUrl: e.pageUrl || e.page_url || e.page || referrer,
          referrer,
        });

        return events;
      }, []);

    const events = await Promise.all(rawMapped.map(prepareEventForInsert));

    await insertAdEventsBatch(events);

    return NextResponse.json(
      { success: true, tracked: events.length },
      { headers }
    );
  } catch (error) {
    console.error("[Ad Track] POST failed:", error);
    return NextResponse.json(
      { error: "Failed to track events" },
      { status: 500, headers }
    );
  }
}

/**
 * OPTIONS — CORS preflight
 */
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

/* ── Helpers ────────────────────────────────────────────────────── */

function transparentGif(): NextResponse {
  // 1×1 transparent GIF (43 bytes)
  const gif = Buffer.from(
    "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    "base64"
  );
  return new NextResponse(gif, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(gif.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      ...corsHeaders(),
    },
  });
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}
