import { ipAddress } from "@vercel/functions";
import { after, NextRequest, NextResponse } from "next/server";
import {
  ensureJourneyEventsTable,
  insertJourneyEvent,
  isJourneyEventName,
} from "@/lib/journey-intelligence";
import type { JourneyEventName } from "@/lib/journey-events";

export const runtime = "nodejs";
export const maxDuration = 10;

interface TrackEventBody {
  visitorId?: string;
  visitor_id?: string;
  sessionId?: string;
  session_id?: string;
  userId?: string | null;
  user_id?: string | null;
  clerkId?: string | null;
  clerk_id?: string | null;
  eventName?: string;
  event_name?: string;
  pageUrl?: string | null;
  page_url?: string | null;
  referrer?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
  };
}

function detectDeviceType(userAgent: string | null) {
  if (!userAgent) {
    return "unknown";
  }

  const lower = userAgent.toLowerCase();

  if (/tablet|ipad|playbook|silk|(android(?!.*mobile))/i.test(lower)) {
    return "tablet";
  }

  if (
    /mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/i.test(
      lower
    )
  ) {
    return "mobile";
  }

  return "desktop";
}

function getRequestIp(req: NextRequest) {
  return (
    ipAddress(req) ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    undefined
  );
}

function readString(
  ...values: Array<string | null | undefined>
) {
  for (const value of values) {
    const trimmed = value?.trim();

    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function parsePayload(body: TrackEventBody) {
  const eventNameRaw = readString(body.eventName, body.event_name);

  if (!eventNameRaw || !isJourneyEventName(eventNameRaw)) {
    return {
      error:
        "eventName is required and must match the approved Journey Intelligence event list.",
    };
  }

  const visitorId = readString(body.visitorId, body.visitor_id);
  const sessionId = readString(body.sessionId, body.session_id);

  if (!visitorId || !sessionId) {
    return {
      error: "visitorId and sessionId are required.",
    };
  }

  return {
    eventName: eventNameRaw as JourneyEventName,
    visitorId,
    sessionId,
    userId: readString(body.userId, body.user_id),
    clerkId: readString(body.clerkId, body.clerk_id),
    pageUrl: readString(body.pageUrl, body.page_url),
    referrer: readString(body.referrer),
    source: readString(body.source),
    metadata:
      body.metadata && typeof body.metadata === "object" ? body.metadata : {},
  };
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders();

  try {
    await ensureJourneyEventsTable();

    const body = (await req.json()) as TrackEventBody;
    const parsed = parsePayload(body);

    if ("error" in parsed) {
      return NextResponse.json({ error: parsed.error }, { status: 400, headers });
    }

    const userAgent = req.headers.get("user-agent");
    const device = detectDeviceType(userAgent);
    const requestIp = getRequestIp(req);
    const referrer =
      parsed.referrer || req.headers.get("referer") || undefined;

    after(async () => {
      try {
        await insertJourneyEvent({
          ...parsed,
          referrer,
          device,
          ipAddress: requestIp,
        });
      } catch (error) {
        console.error("[Journey Track] Failed to persist event:", error);
      }
    });

    return NextResponse.json({ success: true }, { headers });
  } catch (error) {
    console.error("[Journey Track] Request failed:", error);
    return NextResponse.json(
      { error: "Failed to track event." },
      { status: 500, headers }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}
