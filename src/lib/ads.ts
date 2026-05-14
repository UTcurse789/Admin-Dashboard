import { strapiFetch, type StrapiResponse } from "./strapi";
import { withDatabaseClient, isDbUnavailableError } from "./db";

// ─── Strapi Advertisement Schema ──────────────────────────────────
export interface StrapiAdvertisement {
  id: number;
  documentId: string;
  title: string;
  placement: string;
  partner_name: string | null;
  target_url: string | null;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  priority: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  sectors: { id: number; name: string; slug: string }[];
  logo: { url: string } | null;
  creative: {
    id: number;
    url: string;
    width: number;
    height: number;
    name: string;
  }[];
}

// ─── Normalized ad for the dashboard ──────────────────────────────
export interface NormalizedAd {
  id: number;
  documentId: string;
  title: string;
  companyName: string;
  placement: string;
  placementLabel: string;
  targetUrl: string;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  status: "Active" | "Paused" | "Ended";
  sectors: string[];
  creativeUrl: string | null;
  creativeWidth: number | null;
  creativeHeight: number | null;
}

// ─── Listing page data ───────────────────────────────────────────
export interface AdsListData {
  ads: NormalizedAd[];
  totalAds: number;
  activeCount: number;
  pausedCount: number;
  endedCount: number;
  placements: string[];
  placementCounts: { placement: string; label: string; count: number }[];
}

// ─── Placement label map ─────────────────────────────────────────
const PLACEMENT_LABELS: Record<string, string> = {
  new_sidebar: "News Sidebar",
  article_sidebar: "Article Sidebar",
  sector_banner: "Sector Banner",
  interview_right: "Interview Right",
  interview_left: "Interview Left",
  sector_card: "Sector Card",
  home_featured_partner: "Home Featured Partner",
  home_platform_hero: "Home Platform Hero",
  new_top: "News Top Banner",
  Opinion_right: "Opinion Right",
  Opinion_left: "Opinion Left",
};

export function getPlacementLabel(placement: string): string {
  return (
    PLACEMENT_LABELS[placement] ??
    placement
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function computeAdStatus(
  isActive: boolean,
  endDate: string | null
): "Active" | "Paused" | "Ended" {
  if (endDate && new Date(endDate) < new Date()) return "Ended";
  return isActive ? "Active" : "Paused";
}

function normalizeAd(ad: StrapiAdvertisement): NormalizedAd {
  return {
    id: ad.id,
    documentId: ad.documentId,
    title: ad.title,
    companyName: ad.partner_name || ad.title,
    placement: ad.placement,
    placementLabel: getPlacementLabel(ad.placement),
    targetUrl: ad.target_url || "",
    isActive: ad.is_active,
    startDate: ad.start_date,
    endDate: ad.end_date,
    createdAt: ad.createdAt,
    updatedAt: ad.updatedAt,
    status: computeAdStatus(ad.is_active, ad.end_date),
    sectors: ad.sectors.map((s) => s.name),
    creativeUrl: ad.creative?.[0]?.url || null,
    creativeWidth: ad.creative?.[0]?.width || null,
    creativeHeight: ad.creative?.[0]?.height || null,
  };
}

// ─── Fetch all ads (listing page) ─────────────────────────────────
export async function getAdsListData(): Promise<AdsListData> {
  let page = 1;
  const allAds: StrapiAdvertisement[] = [];

  while (true) {
    const data = await strapiFetch<StrapiResponse<StrapiAdvertisement>>(
      `/api/advertisements?populate=*&pagination[page]=${page}&pagination[pageSize]=100&sort=createdAt:desc`
    );
    allAds.push(...data.data);
    if (page >= data.meta.pagination.pageCount) break;
    page++;
  }

  const ads = allAds.map(normalizeAd);

  const activeCount = ads.filter((a) => a.status === "Active").length;
  const pausedCount = ads.filter((a) => a.status === "Paused").length;
  const endedCount = ads.filter((a) => a.status === "Ended").length;

  const placements = [...new Set(allAds.map((a) => a.placement))];

  const placementMap = new Map<string, number>();
  for (const ad of ads) {
    placementMap.set(ad.placement, (placementMap.get(ad.placement) || 0) + 1);
  }
  const placementCounts = [...placementMap.entries()]
    .map(([placement, count]) => ({
      placement,
      label: getPlacementLabel(placement),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    ads,
    totalAds: ads.length,
    activeCount,
    pausedCount,
    endedCount,
    placements,
    placementCounts,
  };
}

// ─── Fetch single ad (detail page) ───────────────────────────────
export async function getAdByDocumentId(
  documentId: string
): Promise<NormalizedAd | null> {
  try {
    const data = await strapiFetch<StrapiResponse<StrapiAdvertisement>>(
      `/api/advertisements?filters[documentId][$eq]=${documentId}&populate=*`
    );
    if (!data.data.length) return null;
    return normalizeAd(data.data[0]);
  } catch {
    return null;
  }
}

// ─── Ad Tracking Analytics ───────────────────────────────────────────

export interface AdTrackingKPIs {
  impressions: number;
  clicks: number;
  ctr: number;
  uniqueVisitors: number;
}

export interface DailyStat {
  day: string;
  impressions: number;
  clicks: number;
}

export interface RegionStat {
  region: string;
  count: number;
}

export interface DeviceStat {
  device: string;
  count: number;
}

export interface AdTrackingData {
  kpis: AdTrackingKPIs;
  daily: DailyStat[];
  regions: RegionStat[];
  devices: DeviceStat[];
}

function buildEmptyTrackingData(): AdTrackingData {
  return {
    kpis: { impressions: 0, clicks: 0, ctr: 0, uniqueVisitors: 0 },
    daily: [],
    regions: [],
    devices: [],
  };
}

export async function getAdTrackingData(
  adDocumentId: string
): Promise<AdTrackingData> {
  try {
    return await withDatabaseClient("ad-tracking", async (client) => {
      // 1. KPIs — total impressions, clicks, unique IPs
      const kpiRes = await client.query<{
        event_type: string;
        cnt: string;
      }>(
        `SELECT event_type, COUNT(*) as cnt
         FROM ad_events
         WHERE ad_document_id = $1
         GROUP BY event_type`,
        [adDocumentId]
      );

      let impressions = 0;
      let clicks = 0;
      for (const row of kpiRes.rows) {
        if (row.event_type === "impression")
          impressions = parseInt(row.cnt, 10);
        if (row.event_type === "click") clicks = parseInt(row.cnt, 10);
      }
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      const uniqueRes = await client.query<{ cnt: string }>(
        `SELECT COUNT(DISTINCT ip_address) as cnt
         FROM ad_events
         WHERE ad_document_id = $1`,
        [adDocumentId]
      );
      const uniqueVisitors = parseInt(uniqueRes.rows[0]?.cnt || "0", 10);

      // 2. Daily stats (last 30 days)
      const dailyRes = await client.query<{
        day: Date;
        event_type: string;
        cnt: string;
      }>(
        `SELECT DATE(created_at) as day, event_type, COUNT(*) as cnt
         FROM ad_events
         WHERE ad_document_id = $1 AND created_at > NOW() - INTERVAL '30 days'
         GROUP BY day, event_type
         ORDER BY day`,
        [adDocumentId]
      );

      const dailyMap = new Map<
        string,
        { impressions: number; clicks: number }
      >();
      for (const row of dailyRes.rows) {
        const d = new Date(row.day).toISOString().slice(0, 10);
        const existing = dailyMap.get(d) || { impressions: 0, clicks: 0 };
        if (row.event_type === "impression")
          existing.impressions = parseInt(row.cnt, 10);
        if (row.event_type === "click")
          existing.clicks = parseInt(row.cnt, 10);
        dailyMap.set(d, existing);
      }
      const daily: DailyStat[] = [...dailyMap.entries()].map(([day, v]) => ({
        day,
        ...v,
      }));

      // 3. Region breakdown (clicks)
      const regionRes = await client.query<{
        region: string | null;
        cnt: string;
      }>(
        `SELECT region, COUNT(*) as cnt
         FROM ad_events
         WHERE ad_document_id = $1 AND event_type = 'click'
           AND region IS NOT NULL
         GROUP BY region ORDER BY cnt DESC LIMIT 15`,
        [adDocumentId]
      );
      const regions: RegionStat[] = regionRes.rows.map((r) => ({
        region: r.region || "Unknown",
        count: parseInt(r.cnt, 10),
      }));

      // 4. Device breakdown
      const deviceRes = await client.query<{
        device_type: string | null;
        cnt: string;
      }>(
        `SELECT device_type, COUNT(*) as cnt
         FROM ad_events
         WHERE ad_document_id = $1
         GROUP BY device_type ORDER BY cnt DESC`,
        [adDocumentId]
      );
      const devices: DeviceStat[] = deviceRes.rows.map((r) => ({
        device: r.device_type || "Unknown",
        count: parseInt(r.cnt, 10),
      }));

      return { kpis: { impressions, clicks, ctr, uniqueVisitors }, daily, regions, devices };
    });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return buildEmptyTrackingData();
    }
    console.error("[ad-tracking] Query error:", error);
    return buildEmptyTrackingData();
  }
}
