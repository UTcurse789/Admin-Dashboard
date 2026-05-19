import { JourneyIntelligenceClient } from "./JourneyIntelligenceClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = ["bom1", "sin1"];
export const maxDuration = 30;

function readQuery(
  value: string | string[] | undefined
) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (Array.isArray(value)) {
    const first = value[0]?.trim();
    return first || null;
  }

  return null;
}

function readDateParam(value: string | string[] | undefined) {
  const parsed = readQuery(value);
  return parsed && /^\d{4}-\d{2}-\d{2}$/.test(parsed) ? parsed : null;
}

export default async function JourneyIntelligencePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    page?: string | string[];
    start?: string | string[];
    end?: string | string[];
    range?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const query = readQuery(params.q);
  const pageQuery = readQuery(params.page);
  const startDate = readDateParam(params.start);
  const endDate = readDateParam(params.end);
  const rangePreset = readQuery(params.range);

  return (
    <JourneyIntelligenceClient
      query={query}
      pageQuery={pageQuery}
      startDate={startDate}
      endDate={endDate}
      rangePreset={rangePreset}
    />
  );
}
