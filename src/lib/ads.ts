import { strapiFetch, type StrapiResponse } from "./strapi";

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
