import { getAdsListData } from "@/lib/ads";
import { AdsListClient } from "./AdsListClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = ["bom1", "sin1"];
export const maxDuration = 30;

export default async function AdsPage() {
  const data = await getAdsListData();
  return <AdsListClient data={data} />;
}
