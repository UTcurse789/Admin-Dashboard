const pg = require("pg");

function getDatabaseConfig() {
  const rawDatabaseUrl =
    process.env.DATABASE_POOL_URL?.trim() || process.env.DATABASE_URL?.trim();

  if (!rawDatabaseUrl) {
    throw new Error("DATABASE_POOL_URL or DATABASE_URL is not configured.");
  }

  const connectionString = rawDatabaseUrl
    .replace(/([?&])sslmode=[^&]*/g, (_, sep) => (sep === "?" ? "?" : ""))
    .replace(/\?$/, "");

  return {
    connectionString,
    ssl: { rejectUnauthorized: process.env.ALLOW_SELF_SIGNED_CERTS !== "true" },
  };
}

function getStrapiConfig() {
  const url = process.env.STRAPI_URL?.trim();
  const token = process.env.STRAPI_ADMIN_TOKEN?.trim();

  if (!url || !token) {
    throw new Error("STRAPI_URL and STRAPI_ADMIN_TOKEN must be configured.");
  }

  return { url, token };
}

function stripCidr(ipAddress) {
  return ipAddress ? ipAddress.split("/")[0] : "";
}

async function fetchAdMetadata(documentId, strapiConfig, cache) {
  if (cache.has(documentId)) return cache.get(documentId);

  const url =
    `${strapiConfig.url}/api/advertisements` +
    `?filters[documentId][$eq]=${encodeURIComponent(documentId)}&populate=*`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${strapiConfig.token}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Strapi request failed with ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const ad = json.data?.[0] ?? null;
  const metadata = ad
    ? {
        placement: typeof ad.placement === "string" ? ad.placement : null,
        targetUrl: typeof ad.target_url === "string" ? ad.target_url : null,
      }
    : null;

  cache.set(documentId, metadata);
  return metadata;
}

async function fetchGeo(ipAddress, cache) {
  const ip = stripCidr(ipAddress);
  if (!ip) return null;

  if (cache.has(ip)) return cache.get(ip);

  const res = await fetch(
    `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,regionName,city`,
    { signal: AbortSignal.timeout(3000) }
  );

  if (!res.ok) {
    throw new Error(`Geo lookup failed with ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  const geo =
    json.status === "success"
      ? {
          country: typeof json.country === "string" ? json.country : null,
          region: typeof json.regionName === "string" ? json.regionName : null,
          city: typeof json.city === "string" ? json.city : null,
        }
      : null;

  cache.set(ip, geo);
  return geo;
}

async function main() {
  const db = new pg.Client(getDatabaseConfig());
  const strapiConfig = getStrapiConfig();
  const adCache = new Map();
  const geoCache = new Map();

  await db.connect();

  const rows = await db.query(`
    SELECT
      id,
      ad_document_id,
      placement,
      target_url,
      country,
      region,
      city,
      page_url,
      referrer,
      ip_address::text AS ip_address
    FROM ad_events
    WHERE placement IS NULL
       OR target_url IS NULL
       OR country IS NULL
       OR region IS NULL
       OR city IS NULL
       OR page_url IS NULL
    ORDER BY created_at ASC
  `);

  let updated = 0;

  for (const row of rows.rows) {
    let metadata = null;
    let geo = null;

    try {
      metadata = await fetchAdMetadata(row.ad_document_id, strapiConfig, adCache);
    } catch (error) {
      console.error(`[backfill] Failed to fetch ad metadata for ${row.ad_document_id}:`, error);
    }

    try {
      geo = await fetchGeo(row.ip_address, geoCache);
    } catch (error) {
      console.error(`[backfill] Failed geo lookup for row ${row.id}:`, error);
    }

    const placement = row.placement ?? metadata?.placement ?? null;
    const targetUrl = row.target_url ?? metadata?.targetUrl ?? null;
    const pageUrl = row.page_url ?? row.referrer ?? null;
    const country = row.country ?? geo?.country ?? null;
    const region = row.region ?? geo?.region ?? null;
    const city = row.city ?? geo?.city ?? null;

    const changed =
      placement !== row.placement ||
      targetUrl !== row.target_url ||
      pageUrl !== row.page_url ||
      country !== row.country ||
      region !== row.region ||
      city !== row.city;

    if (!changed) continue;

    await db.query(
      `
        UPDATE ad_events
        SET
          placement = $2,
          target_url = $3,
          page_url = $4,
          country = $5,
          region = $6,
          city = $7
        WHERE id = $1
      `,
      [row.id, placement, targetUrl, pageUrl, country, region, city]
    );

    updated += 1;
  }

  console.log(
    JSON.stringify(
      {
        scanned: rows.rows.length,
        updated,
      },
      null,
      2
    )
  );

  await db.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
