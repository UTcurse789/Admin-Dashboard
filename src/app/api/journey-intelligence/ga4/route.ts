import { NextResponse } from "next/server";
import {
  buildGa4JourneyIntelligenceData,
  type BuildGa4JourneyInput,
} from "@/lib/ga4-journey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = ["bom1", "sin1"];
export const maxDuration = 30;

interface RequestBody {
  propertyId?: unknown;
  credentials?: unknown;
  query?: unknown;
  pageQuery?: unknown;
  windowDays?: unknown;
  startDate?: unknown;
  endDate?: unknown;
  rangePreset?: unknown;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readWindowDays(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return value;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RequestBody;
    const propertyId = readString(body.propertyId);

    if (!propertyId) {
      return NextResponse.json(
        { error: "propertyId is required." },
        { status: 400 }
      );
    }

    const input: BuildGa4JourneyInput = {
      propertyId,
      credentials: body.credentials as BuildGa4JourneyInput["credentials"],
      query: readString(body.query) || null,
      pageQuery: readString(body.pageQuery) || null,
      windowDays: readWindowDays(body.windowDays),
      startDate: readString(body.startDate) || null,
      endDate: readString(body.endDate) || null,
      rangePreset: readString(body.rangePreset) || null,
    };

    const data = await buildGa4JourneyIntelligenceData(input);
    return NextResponse.json(data);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not load GA4 Journey Intelligence data.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
