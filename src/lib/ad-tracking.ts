import { withDatabaseClient, isDbUnavailableError, type DbClient } from "./db";
import type { QueryResultRow } from "pg";

// ═══════════════════════════════════════════════════════════════════
// Ad Tracking — Database queries for ad event analytics
// ═══════════════════════════════════════════════════════════════════

/* ── Types ──────────────────────────────────────────────────────── */

export interface AdEventInsert {
  eventType: "impression" | "click";
  adDocumentId: string;
  placement?: string;
  targetUrl?: string;
  userAgent?: string;
  deviceType?: string;
  ipAddress?: string;
  country?: string;
  region?: string;
  city?: string;
  pageUrl?: string;
  referrer?: string;
}

export interface AdStats {
  impressions: number;
  clicks: number;
  ctr: number;
  uniqueVisitors: number;
  dailyPerformance: { date: string; impressions: number; clicks: number }[];
  regionBreakdown: { name: string; value: number }[];
  deviceBreakdown: { name: string; value: number }[];
  topReferrers: { referrer: string; count: number }[];
  recentEvents: {
    id: number;
    eventType: string;
    deviceType: string | null;
    country: string | null;
    region: string | null;
    pageUrl: string | null;
    referrer: string | null;
    createdAt: string;
  }[];
}

/* ── Device detection from User-Agent ──────────────────────────── */

export function detectDeviceType(ua: string | undefined | null): string {
  if (!ua) return "unknown";
  const lower = ua.toLowerCase();
  if (/tablet|ipad|playbook|silk|(android(?!.*mobile))/i.test(lower)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini|iemobile/i.test(lower)) return "mobile";
  return "desktop";
}

/* ── Geo-IP lookup (free ip-api.com, 45 req/min) ───────────────── */

interface GeoResult { country: string; region: string; city: string }
const geoCache = new Map<string, { data: GeoResult; ttl: number }>();
const GEO_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function geoLookup(ip: string | undefined): Promise<GeoResult | null> {
  if (!ip || ip === "127.0.0.1" || ip === "::1") return null;

  const cached = geoCache.get(ip);
  if (cached && Date.now() < cached.ttl) return cached.data;

  try {
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,regionName,city`, {
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    if (json.country) {
      const data: GeoResult = {
        country: json.country || "",
        region: json.regionName || "",
        city: json.city || "",
      };
      geoCache.set(ip, { data, ttl: Date.now() + GEO_CACHE_TTL });
      return data;
    }
  } catch {
    // timeout or network error — skip
  }
  return null;
}

export async function enrichWithGeo(event: AdEventInsert): Promise<AdEventInsert> {
  if (event.country && event.city) return event; // already have geo
  const geo = await geoLookup(event.ipAddress);
  if (geo) {
    if (!event.country) event.country = geo.country;
    if (!event.region) event.region = geo.region;
    if (!event.city) event.city = geo.city;
  }
  return event;
}

/* ── Insert a tracking event ───────────────────────────────────── */

export async function insertAdEvent(event: AdEventInsert): Promise<void> {
  try {
    await withDatabaseClient("ad_tracking_insert", async (client) => {
      await client.query(
        `INSERT INTO ad_events
          (event_type, ad_document_id, placement, target_url,
           user_agent, device_type, ip_address, country, region, city,
           page_url, referrer)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          event.eventType,
          event.adDocumentId,
          event.placement || null,
          event.targetUrl || null,
          event.userAgent || null,
          event.deviceType || null,
          event.ipAddress || null,
          event.country || null,
          event.region || null,
          event.city || null,
          event.pageUrl || null,
          event.referrer || null,
        ]
      );
    });
  } catch (error) {
    // Don't fail the tracking pixel — log and swallow
    console.error("[Ad Tracking] Failed to insert event:", error);
  }
}

/* ── Batch insert (for when the frontend sends multiple impressions) */

export async function insertAdEventsBatch(events: AdEventInsert[]): Promise<void> {
  if (!events.length) return;
  try {
    await withDatabaseClient("ad_tracking_batch", async (client) => {
      // Use a single transaction for efficiency
      await client.query("BEGIN");
      for (const event of events) {
        await client.query(
          `INSERT INTO ad_events
            (event_type, ad_document_id, placement, target_url,
             user_agent, device_type, ip_address, country, region, city,
             page_url, referrer)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            event.eventType,
            event.adDocumentId,
            event.placement || null,
            event.targetUrl || null,
            event.userAgent || null,
            event.deviceType || null,
            event.ipAddress || null,
            event.country || null,
            event.region || null,
            event.city || null,
            event.pageUrl || null,
            event.referrer || null,
          ]
        );
      }
      await client.query("COMMIT");
    });
  } catch (error) {
    console.error("[Ad Tracking] Batch insert failed:", error);
  }
}

/* ── Fetch stats for a single ad by documentId ─────────────────── */

async function safeQuery<T extends QueryResultRow>(
  client: DbClient,
  label: string,
  query: string,
  params: unknown[],
  fallback: T[]
): Promise<T[]> {
  try {
    const result = await client.query<T>(query, params);
    return result.rows;
  } catch (error) {
    console.error(`[Ad Tracking] Query "${label}" failed:`, error);
    return fallback;
  }
}

export async function getAdStats(documentId: string): Promise<AdStats> {
  const empty: AdStats = {
    impressions: 0,
    clicks: 0,
    ctr: 0,
    uniqueVisitors: 0,
    dailyPerformance: [],
    regionBreakdown: [],
    deviceBreakdown: [],
    topReferrers: [],
    recentEvents: [],
  };

  try {
    return await withDatabaseClient("ad_stats", async (client) => {
      // 1. Total impressions & clicks
      const totalsRows = await safeQuery<{
        event_type: string;
        cnt: string;
      }>(
        client,
        "totals",
        `SELECT event_type, COUNT(*) as cnt
         FROM ad_events
         WHERE ad_document_id = $1
         GROUP BY event_type`,
        [documentId],
        []
      );

      let impressions = 0;
      let clicks = 0;
      for (const row of totalsRows) {
        if (row.event_type === "impression") impressions = parseInt(row.cnt, 10);
        if (row.event_type === "click") clicks = parseInt(row.cnt, 10);
      }
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      // 2. Unique visitors (by IP)
      const uniqueRows = await safeQuery<{ cnt: string }>(
        client,
        "unique_visitors",
        `SELECT COUNT(DISTINCT ip_address) as cnt
         FROM ad_events
         WHERE ad_document_id = $1
           AND ip_address IS NOT NULL`,
        [documentId],
        [{ cnt: "0" }]
      );
      const uniqueVisitors = parseInt(uniqueRows[0]?.cnt || "0", 10);

      // 3. Daily performance (last 30 days)
      const dailyRows = await safeQuery<{
        date: Date;
        impressions: string;
        clicks: string;
      }>(
        client,
        "daily_performance",
        `SELECT
           DATE(created_at) as date,
           SUM(CASE WHEN event_type = 'impression' THEN 1 ELSE 0 END) as impressions,
           SUM(CASE WHEN event_type = 'click' THEN 1 ELSE 0 END) as clicks
         FROM ad_events
         WHERE ad_document_id = $1
           AND created_at >= NOW() - INTERVAL '30 days'
         GROUP BY DATE(created_at)
         ORDER BY DATE(created_at) ASC`,
        [documentId],
        []
      );
      const dailyPerformance = dailyRows.map((r) => ({
        date: new Date(r.date).toISOString().slice(0, 10),
        impressions: parseInt(r.impressions, 10),
        clicks: parseInt(r.clicks, 10),
      }));

      // 4. Region breakdown (clicks by country + region)
      const regionRows = await safeQuery<{
        area: string;
        cnt: string;
      }>(
        client,
        "region_breakdown",
        `SELECT
           COALESCE(country, 'Unknown') || CASE WHEN region IS NOT NULL AND region != '' THEN ' – ' || region ELSE '' END as area,
           COUNT(*) as cnt
         FROM ad_events
         WHERE ad_document_id = $1
           AND event_type = 'click'
         GROUP BY area
         ORDER BY cnt DESC
         LIMIT 10`,
        [documentId],
        []
      );
      const regionBreakdown = regionRows.map((r) => ({
        name: r.area,
        value: parseInt(r.cnt, 10),
      }));

      // 5. Device breakdown
      const deviceRows = await safeQuery<{
        device_type: string;
        cnt: string;
      }>(
        client,
        "device_breakdown",
        `SELECT
           COALESCE(device_type, 'unknown') as device_type,
           COUNT(*) as cnt
         FROM ad_events
         WHERE ad_document_id = $1
         GROUP BY device_type
         ORDER BY cnt DESC`,
        [documentId],
        []
      );
      const deviceBreakdown = deviceRows.map((r) => ({
        name: r.device_type === "desktop"
          ? "Desktop"
          : r.device_type === "mobile"
          ? "Mobile"
          : r.device_type === "tablet"
          ? "Tablet"
          : "Unknown",
        value: parseInt(r.cnt, 10),
      }));

      // 6. Top referrers
      const referrerRows = await safeQuery<{
        referrer: string;
        cnt: string;
      }>(
        client,
        "top_referrers",
        `SELECT
           COALESCE(referrer, 'Direct') as referrer,
           COUNT(*) as cnt
         FROM ad_events
         WHERE ad_document_id = $1
           AND event_type = 'click'
         GROUP BY referrer
         ORDER BY cnt DESC
         LIMIT 10`,
        [documentId],
        []
      );
      const topReferrers = referrerRows.map((r) => ({
        referrer: r.referrer,
        count: parseInt(r.cnt, 10),
      }));

      // 7. Recent events
      const recentRows = await safeQuery<{
        id: number;
        event_type: string;
        device_type: string | null;
        country: string | null;
        region: string | null;
        page_url: string | null;
        referrer: string | null;
        created_at: Date;
      }>(
        client,
        "recent_events",
        `SELECT id, event_type, device_type, country, region, page_url, referrer, created_at
         FROM ad_events
         WHERE ad_document_id = $1
         ORDER BY created_at DESC
         LIMIT 25`,
        [documentId],
        []
      );
      const recentEvents = recentRows.map((r) => ({
        id: r.id,
        eventType: r.event_type,
        deviceType: r.device_type,
        country: r.country,
        region: r.region,
        pageUrl: r.page_url,
        referrer: r.referrer,
        createdAt: new Date(r.created_at).toISOString(),
      }));

      return {
        impressions,
        clicks,
        ctr,
        uniqueVisitors,
        dailyPerformance,
        regionBreakdown,
        deviceBreakdown,
        topReferrers,
        recentEvents,
      };
    });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return empty;
    }
    throw error;
  }
}

/* ── Ensure the ad_events table exists (auto-migrate) ──────────── */

export async function ensureAdEventsTable(): Promise<void> {
  try {
    await withDatabaseClient("ad_events_migration", async (client) => {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ad_events (
          id            BIGSERIAL PRIMARY KEY,
          event_type    VARCHAR(16)  NOT NULL CHECK (event_type IN ('impression', 'click')),
          ad_document_id VARCHAR(64) NOT NULL,
          placement     VARCHAR(64),
          target_url    TEXT,
          user_agent    TEXT,
          device_type   VARCHAR(16),
          ip_address    INET,
          country       VARCHAR(64),
          region        VARCHAR(128),
          city          VARCHAR(128),
          page_url      TEXT,
          referrer      TEXT,
          created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        );

        ALTER TABLE ad_events
          ADD COLUMN IF NOT EXISTS placement VARCHAR(64),
          ADD COLUMN IF NOT EXISTS target_url TEXT,
          ADD COLUMN IF NOT EXISTS user_agent TEXT,
          ADD COLUMN IF NOT EXISTS device_type VARCHAR(16),
          ADD COLUMN IF NOT EXISTS ip_address INET,
          ADD COLUMN IF NOT EXISTS country VARCHAR(64),
          ADD COLUMN IF NOT EXISTS region VARCHAR(128),
          ADD COLUMN IF NOT EXISTS city VARCHAR(128),
          ADD COLUMN IF NOT EXISTS page_url TEXT,
          ADD COLUMN IF NOT EXISTS referrer TEXT,
          ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

        CREATE INDEX IF NOT EXISTS idx_ad_events_document_id    ON ad_events (ad_document_id);
        CREATE INDEX IF NOT EXISTS idx_ad_events_event_type     ON ad_events (event_type);
        CREATE INDEX IF NOT EXISTS idx_ad_events_created_at     ON ad_events (created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_ad_events_doc_type_date  ON ad_events (ad_document_id, event_type, created_at DESC);
      `);
    });
    console.log("[Ad Tracking] ad_events table ensured.");
  } catch (error) {
    console.error("[Ad Tracking] Failed to ensure ad_events table:", error);
  }
}
