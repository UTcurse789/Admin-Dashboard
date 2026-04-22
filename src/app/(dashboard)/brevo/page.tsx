import { getBrevoAnalytics } from "@/lib/brevo";
import { BrevoAnalyticsClient } from "./BrevoAnalyticsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = ["bom1", "sin1"];
export const maxDuration = 60;

export default async function BrevoPage() {
  const data = await getBrevoAnalytics();
  return <BrevoAnalyticsClient data={data} />;
}
