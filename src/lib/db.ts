import { attachDatabasePool } from "@vercel/functions";
import pg, { type PoolConfig, type QueryResultRow } from "pg";

function parseBoundedInt(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, minimum), maximum);
}

const isProduction = process.env.NODE_ENV === "production";

const MAX_DAILY_REG_ROWS = parseBoundedInt(
  process.env.MAX_DAILY_REG_ROWS,
  365,
  1,
  5000
);
const DB_CONNECTION_TIMEOUT_MS = parseBoundedInt(
  process.env.DB_CONNECTION_TIMEOUT_MS,
  isProduction ? 20000 : 1500,
  250,
  60000
);
const DB_QUERY_TIMEOUT_MS = parseBoundedInt(
  process.env.DB_QUERY_TIMEOUT_MS,
  isProduction ? 25000 : 8000,
  500,
  120000
);
const DB_IDLE_TIMEOUT_MS = parseBoundedInt(
  process.env.DB_IDLE_TIMEOUT_MS,
  process.env.VERCEL ? 5000 : 30000,
  1000,
  60000
);
const DB_POOL_MAX = parseBoundedInt(
  process.env.DB_POOL_MAX,
  isProduction ? 3 : 10,
  1,
  20
);
const DB_CONNECT_ATTEMPTS = parseBoundedInt(
  process.env.DB_CONNECT_ATTEMPTS,
  isProduction ? 3 : 1,
  1,
  5
);
const DB_BEST_EFFORT_CONNECT_ATTEMPTS = Math.min(
  DB_CONNECT_ATTEMPTS,
  parseBoundedInt(process.env.DB_BEST_EFFORT_CONNECT_ATTEMPTS, 1, 1, 5)
);
const DB_CONNECT_RETRY_DELAY_MS = parseBoundedInt(
  process.env.DB_CONNECT_RETRY_DELAY_MS,
  isProduction ? 1000 : 0,
  0,
  5000
);
const DB_RETRY_COOLDOWN_MS = parseBoundedInt(
  process.env.DB_RETRY_COOLDOWN_MS,
  isProduction ? 15000 : 60000,
  1000,
  300000
);
// Strip ?sslmode=... from the URL so pg-connection-string does NOT build its
// own ssl object — we always supply one explicitly via the Pool options below.
// This prevents the pg URL parser from overriding our rejectUnauthorized flag.
const rawDatabaseUrl =
  process.env.DATABASE_POOL_URL?.trim() || process.env.DATABASE_URL?.trim();
const databaseUrl = rawDatabaseUrl
  ? rawDatabaseUrl.replace(/([?&])sslmode=[^&]*/g, (_, sep) => sep === "?" ? "?" : "").replace(/\?$/, "")
  : rawDatabaseUrl;

// We still detect SSL intent from the original URL.
const urlRequestsSsl =
  rawDatabaseUrl != null &&
  /[?&]sslmode=(require|verify-ca|verify-full|prefer)/.test(rawDatabaseUrl);

const shouldUseDatabaseSsl =
  process.env.DATABASE_SSL === "true" ||
  urlRequestsSsl ||
  (process.env.NODE_ENV === "production" &&
    process.env.DATABASE_SSL !== "false");

// Allow self-signed certs when ALLOW_SELF_SIGNED_CERTS=true.
// DigitalOcean managed Postgres uses a self-signed CA chain that
// Node's built-in root store does not trust.
// We intentionally do NOT restrict this to non-production — the env var
// itself acts as the safety gate (never set it in real production).
const allowSelfSignedCerts =
  process.env.ALLOW_SELF_SIGNED_CERTS === "true";

const CONNECTIVITY_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
  // SSL handshake failures — treated as transient so the cooldown
  // cache does not permanently block retries after a config fix.
  "SELF_SIGNED_CERT_IN_CHAIN",
  "DEPTH_ZERO_SELF_SIGNED_CERT",
  "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
  "CERT_HAS_EXPIRED",
]);

const dbFailureState = {
  unavailableUntil: 0,
  reason: null as string | null,
  lastLoggedSignature: null as string | null,
};

type DatabaseGlobalState = typeof globalThis & {
  __energdivePgPool?: pg.Pool;
  __energdivePgPoolKey?: string;
};

function buildPoolOptions(): PoolConfig {
  return {
    connectionString: databaseUrl,
    ...(shouldUseDatabaseSsl
      ? { ssl: { rejectUnauthorized: !allowSelfSignedCerts } }
      : {}),
    max: DB_POOL_MAX,
    connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
    query_timeout: DB_QUERY_TIMEOUT_MS,
    keepAlive: true,
    allowExitOnIdle: true,
  };
}

function buildPoolKey() {
  return [
    databaseUrl ?? "",
    shouldUseDatabaseSsl ? "ssl" : "plain",
    allowSelfSignedCerts ? "self-signed" : "strict",
    DB_POOL_MAX,
    DB_CONNECTION_TIMEOUT_MS,
    DB_IDLE_TIMEOUT_MS,
    DB_QUERY_TIMEOUT_MS,
  ].join("|");
}

function createPool() {
  const nextPool = new pg.Pool(buildPoolOptions());

  if (process.env.VERCEL) {
    attachDatabasePool(nextPool);
  }

  nextPool.on("error", (error) => {
    console.error("Unexpected PostgreSQL pool error:", error);
  });

  return nextPool;
}

function getSharedPool() {
  const globalState = globalThis as DatabaseGlobalState;
  const poolKey = buildPoolKey();

  if (
    globalState.__energdivePgPool &&
    globalState.__energdivePgPoolKey === poolKey
  ) {
    return globalState.__energdivePgPool;
  }

  const previousPool = globalState.__energdivePgPool;
  const nextPool = createPool();

  globalState.__energdivePgPool = nextPool;
  globalState.__energdivePgPoolKey = poolKey;

  if (previousPool && previousPool !== nextPool) {
    void previousPool.end().catch((error) => {
      console.error("Previous PostgreSQL pool shutdown failed:", error);
    });
  }

  return nextPool;
}

function getPoolStats() {
  return `pool(total=${pool.totalCount}, idle=${pool.idleCount}, waiting=${pool.waitingCount})`;
}

export const pool = getSharedPool();

export class DbUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DbUnavailableError";
  }
}

export function isDbUnavailableError(
  error: unknown
): error is DbUnavailableError {
  return error instanceof DbUnavailableError;
}

export type DbClient = pg.PoolClient;

type DatabaseAccessOptions = {
  connectAttempts?: number;
  retryDelayMs?: number;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function isConnectivityError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    CONNECTIVITY_ERROR_CODES.has(error.code)
  );
}

function isTransientConnectionFailure(error: unknown) {
  if (isConnectivityError(error)) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();

  return (
    message.includes("connection terminated") ||
    message.includes("connection timeout") ||
    message.includes("timed out") ||
    message.includes("connection ended unexpectedly") ||
    message.includes("server closed the connection unexpectedly") ||
    message.includes("client has encountered a connection error")
  );
}

function cacheDbFailure(error: unknown) {
  dbFailureState.reason = `${getErrorMessage(error)} (${getPoolStats()})`;
  dbFailureState.unavailableUntil = Date.now() + DB_RETRY_COOLDOWN_MS;
}

function clearDbFailureState() {
  dbFailureState.reason = null;
  dbFailureState.unavailableUntil = 0;
  dbFailureState.lastLoggedSignature = null;
}

export function isDatabaseOffline(): boolean {
  return Date.now() < dbFailureState.unavailableUntil;
}

export function getDatabaseOfflineReason(): string | null {
  return dbFailureState.reason;
}

function logDatabaseUnavailable(context: string, error: unknown) {
  const signature = `${context}:${getErrorMessage(error)}`;

  if (
    dbFailureState.lastLoggedSignature === signature &&
    Date.now() < dbFailureState.unavailableUntil
  ) {
    return;
  }

  dbFailureState.lastLoggedSignature = signature;
  console.error(`[DB] ${context} unavailable:`, error);
}

async function ensureDatabaseAvailable(
  context: string,
  options: DatabaseAccessOptions = {}
) {
  if (!databaseUrl) {
    throw new DbUnavailableError(
      "DATABASE_POOL_URL or DATABASE_URL is not configured."
    );
  }

  if (Date.now() < dbFailureState.unavailableUntil) {
    throw new DbUnavailableError(
      dbFailureState.reason ?? "Database is temporarily unavailable."
    );
  }

  let client: pg.PoolClient | null = null;
  const connectAttempts = Math.max(
    1,
    options.connectAttempts ?? DB_CONNECT_ATTEMPTS
  );
  const retryDelayMs = Math.max(
    0,
    options.retryDelayMs ?? DB_CONNECT_RETRY_DELAY_MS
  );

  try {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= connectAttempts; attempt += 1) {
      try {
        client = await pool.connect();
        clearDbFailureState();
        return client;
      } catch (error) {
        lastError = error;

        if (!isTransientConnectionFailure(error) || attempt === connectAttempts) {
          break;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, retryDelayMs * attempt)
        );
      }
    }

    throw lastError;
  } catch (error) {
    cacheDbFailure(error);
    logDatabaseUnavailable(context, error);
    throw new DbUnavailableError(getErrorMessage(error));
  }
}

export async function withDatabaseClient<T>(
  context: string,
  operation: (client: DbClient) => Promise<T>,
  options: DatabaseAccessOptions = {}
) {
  const client = await ensureDatabaseAvailable(context, options);
  let destroyClient = false;

  try {
    const result = await operation(client);
    clearDbFailureState();
    return result;
  } catch (error) {
    if (isTransientConnectionFailure(error)) {
      destroyClient = true;
      cacheDbFailure(error);
      throw new DbUnavailableError(getErrorMessage(error));
    }

    throw error;
  } finally {
    client.release(destroyClient || undefined);
  }
}

export async function runDbQuery<TResult extends QueryResultRow>(
  queryText: string,
  values: readonly unknown[] = [],
  context = "query",
  client?: DbClient
) {
  if (client) {
    return client.query<TResult>(queryText, [...values]);
  }

  return withDatabaseClient(context, (dbClient) =>
    dbClient.query<TResult>(queryText, [...values])
  );
}

export interface DbUser {
  id: number | string;
  clerk_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  country: string | null;
  state: string | null;
  job_title: string | null;
  organization: string | null;
  onboarding_completed: boolean | null;
  created_at: Date | null;
  source: string | null;
  data_source: string | null;
  salutation: string | null;
  registration_method: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

export interface CountRow {
  label: string;
  count: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface DbAnalytics {
  totalDbUsers: number;
  bySource: CountRow[];
  byDataSource: CountRow[];
  bySalutation: CountRow[];
  byIndustry: CountRow[];
  byState: CountRow[];
  dailyRegistrations: DailyCount[];
  growthRate: number;
  thisMonthCount: number;
  lastMonthCount: number;
  recentDbUsers: DbUser[];
  queryErrors: string[];
}

export function getDatabaseUnavailableMessage(queryErrors: string[]) {
  const databaseError = queryErrors.find((error) =>
    error.startsWith("database:")
  );

  return databaseError
    ? databaseError.replace(/^database:\s*/, "").trim()
    : null;
}

export async function getDbUsersDirectory(): Promise<DbUser[]> {
  try {
    return await withDatabaseClient("users directory", async (client) => {
      const result = await client.query<DbUser>(
        `SELECT id, clerk_id, email, first_name, last_name, phone, country, state,
                job_title, organization, onboarding_completed, created_at,
                source, data_source, salutation, registration_method,
                utm_source, utm_medium, utm_campaign
         FROM users
         ORDER BY created_at DESC NULLS LAST`
      );

      return result.rows;
    });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return [];
    }

    throw error;
  }
}

export async function getDbUserById(id: string | number): Promise<DbUser | null> {
  try {
    return await withDatabaseClient("user by id", async (client) => {
      const result = await client.query<DbUser>(
        `SELECT id, clerk_id, email, first_name, last_name, phone, country, state,
                job_title, organization, onboarding_completed, created_at,
                source, data_source, salutation, registration_method,
                utm_source, utm_medium, utm_campaign
         FROM users
         WHERE id = $1
         LIMIT 1`,
        [id]
      );

      return result.rows[0] || null;
    });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return null;
    }

    throw error;
  }
}

export interface DbUserEnrichment {
  preferred_frequency: string | null;
  preferred_formats: string[];
  industries: Array<{ industry: string | null; sub_industry: string | null }>;
  communities: Array<{ community: string | null; sub_community: string | null }>;
}

export async function getDbUserEnrichment(id: string | number): Promise<DbUserEnrichment | null> {
  try {
    return await withDatabaseClient("user enrichment", async (client) => {
      const q = `
        SELECT 
          u.preferred_frequency, 
          u.preferred_formats,
          (SELECT json_agg(json_build_object('industry', i.name, 'sub_industry', si.name)) 
           FROM user_industries ui 
           LEFT JOIN industry i ON ui.industry_id = i.id 
           LEFT JOIN sub_industries si ON ui.sub_industry_id = si.id 
           WHERE ui.user_id = u.id) as industries,
          (SELECT json_agg(json_build_object('community', c.name, 'sub_community', sc.name)) 
           FROM user_communities uc 
           LEFT JOIN communities c ON uc.community_id = c.id 
           LEFT JOIN sub_communities sc ON uc.sub_community_id = sc.id 
           WHERE uc.user_id = u.id) as communities
        FROM users u 
        WHERE u.id = $1
      `;
      const result = await client.query(q, [id]);
      if (result.rows.length === 0) return null;
      
      const row = result.rows[0];
      return {
        preferred_frequency: row.preferred_frequency,
        preferred_formats: Array.isArray(row.preferred_formats) ? row.preferred_formats : [],
        industries: Array.isArray(row.industries) ? row.industries : [],
        communities: Array.isArray(row.communities) ? row.communities : [],
      };
    });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return null;
    }
    throw error;
  }
}

function buildEmptyDbAnalytics(queryErrors: string[] = []): DbAnalytics {
  return {
    totalDbUsers: 0,
    bySource: [],
    byDataSource: [],
    bySalutation: [],
    byIndustry: [],
    byState: [],
    dailyRegistrations: [],
    growthRate: 0,
    thisMonthCount: 0,
    lastMonthCount: 0,
    recentDbUsers: [],
    queryErrors,
  };
}

async function runAnalyticsQuery<TResult extends QueryResultRow>(
  client: DbClient,
  label: string,
  queryText: string,
  values: readonly unknown[] = [],
  fallback: TResult[],
  queryErrors: string[]
) {
  try {
    const result = await client.query<TResult>(queryText, [...values]);
    return result.rows;
  } catch (error) {
    if (isTransientConnectionFailure(error)) {
      throw new DbUnavailableError(getErrorMessage(error));
    }

    console.error(`DB analytics query failed (${label}):`, error);
    queryErrors.push(`${label}: ${getErrorMessage(error)}`);
    return fallback;
  }
}

/**
 * Fetch all database analytics in a single call.
 * We intentionally reuse one client here to avoid connection spikes on serverless hosts.
 */
export async function getDbAnalytics(): Promise<DbAnalytics> {
  try {
    return await withDatabaseClient(
      "analytics",
      async (client) => {
        const queryErrors: string[] = [];
        const totalUsersRows = await runAnalyticsQuery<{ cnt: string }>(
          client,
          "total_users",
          "SELECT COUNT(*) as cnt FROM users",
          [],
          [{ cnt: "0" }],
          queryErrors
        );
        const sourceRows = await runAnalyticsQuery<{ source: string | null; cnt: string }>(
          client,
          "by_source",
          "SELECT source, COUNT(*) as cnt FROM users GROUP BY source ORDER BY cnt DESC",
          [],
          [],
          queryErrors
        );
        const dataSourceRows = await runAnalyticsQuery<{
          data_source: string | null;
          cnt: string;
        }>(
          client,
          "by_data_source",
          "SELECT data_source, COUNT(*) as cnt FROM users GROUP BY data_source ORDER BY cnt DESC",
          [],
          [],
          queryErrors
        );
        const salutationRows = await runAnalyticsQuery<{
          salutation: string | null;
          cnt: string;
        }>(
          client,
          "by_salutation",
          "SELECT salutation, COUNT(*) as cnt FROM users WHERE salutation IS NOT NULL GROUP BY salutation ORDER BY cnt DESC",
          [],
          [],
          queryErrors
        );
        const industryRows = await runAnalyticsQuery<{ industry: string; cnt: string }>(
          client,
          "by_industry",
          `SELECT i.name as industry, COUNT(*) as cnt
       FROM user_industries ui
       JOIN industry i ON ui.industry_id = i.id
       GROUP BY i.name
       ORDER BY cnt DESC`,
          [],
          [],
          queryErrors
        );
        const stateRows = await runAnalyticsQuery<{ state: string; cnt: string }>(
          client,
          "by_state",
          `SELECT state, COUNT(*) as cnt FROM users 
       WHERE state IS NOT NULL AND state != '' 
       GROUP BY state ORDER BY cnt DESC LIMIT 15`,
          [],
          [],
          queryErrors
        );
        const dailyRegistrationRows = await runAnalyticsQuery<{
          date: Date;
          cnt: string;
        }>(
          client,
          "daily_registrations",
          `SELECT DATE(created_at) as date, COUNT(*) as cnt 
       FROM users 
       GROUP BY DATE(created_at) 
       ORDER BY DATE(created_at) DESC
       LIMIT $1`,
          [MAX_DAILY_REG_ROWS],
          [],
          queryErrors
        );
        const growthRows = await runAnalyticsQuery<{ period: string; cnt: string }>(
          client,
          "growth",
          `SELECT 
         'this_month' as period, COUNT(*) as cnt FROM users 
         WHERE created_at >= DATE_TRUNC('month', NOW())
       UNION ALL
       SELECT 
         'last_month' as period, COUNT(*) as cnt FROM users 
         WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
           AND created_at < DATE_TRUNC('month', NOW())`,
          [],
          [],
          queryErrors
        );
        const recentUserRows = await runAnalyticsQuery<DbUser>(
          client,
          "recent_users",
          `SELECT id, clerk_id, email, first_name, last_name, phone, country, state,
              job_title, organization, onboarding_completed, created_at,
              source, data_source, salutation, registration_method,
              utm_source, utm_medium, utm_campaign
       FROM users ORDER BY created_at DESC LIMIT 20`,
          [],
          [],
          queryErrors
        );

        const totalDbUsers = parseInt(totalUsersRows[0]?.cnt || "0", 10);

        const bySource: CountRow[] = sourceRows.map((r) => ({
          label: r.source || "Unknown",
          count: parseInt(r.cnt, 10),
        }));

        const byDataSource: CountRow[] = dataSourceRows.map((r) => ({
          label: r.data_source || "Unknown",
          count: parseInt(r.cnt, 10),
        }));

        const bySalutation: CountRow[] = salutationRows.map((r) => ({
          label: r.salutation || "Unknown",
          count: parseInt(r.cnt, 10),
        }));

        const byIndustry: CountRow[] = industryRows.map((r) => ({
          label: r.industry,
          count: parseInt(r.cnt, 10),
        }));

        const byState: CountRow[] = stateRows.map((r) => ({
          label: r.state,
          count: parseInt(r.cnt, 10),
        }));

        const dailyRegistrations: DailyCount[] = dailyRegistrationRows
          .map((r) => ({
            date: new Date(r.date).toISOString().slice(0, 10),
            count: parseInt(r.cnt, 10),
          }))
          .reverse();

        let thisMonthCount = 0;
        let lastMonthCount = 0;
        growthRows.forEach((r) => {
          if (r.period === "this_month") thisMonthCount = parseInt(r.cnt, 10);
          if (r.period === "last_month") lastMonthCount = parseInt(r.cnt, 10);
        });
        const growthRate =
          lastMonthCount > 0
            ? ((thisMonthCount - lastMonthCount) / lastMonthCount) * 100
            : thisMonthCount > 0
            ? 100
            : 0;

        return {
          totalDbUsers,
          bySource,
          byDataSource,
          bySalutation,
          byIndustry,
          byState,
          dailyRegistrations,
          growthRate,
          thisMonthCount,
          lastMonthCount,
          recentDbUsers: recentUserRows,
          queryErrors,
        };
      },
      {
        // These routes already degrade gracefully, so fail fast instead of
        // burning extra request time retrying an unavailable database.
        connectAttempts: DB_BEST_EFFORT_CONNECT_ATTEMPTS,
      }
    );
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return buildEmptyDbAnalytics([`database: ${error.message}`]);
    }

    throw error;
  }
}

// ── Funnel-specific analytics ─────────────────────────────────────────
export interface SourceConversionRow {
  source: string;
  total: number;
  onboarded: number;
}

export interface MonthlyCoHortRow {
  month: string; // "YYYY-MM"
  registered: number;
  onboarded: number;
}

export interface UtmPerformanceRow {
  campaign: string;
  utmSource: string;
  total: number;
  onboarded: number;
}

export interface FunnelAnalytics {
  totalRegistered: number;
  totalOnboarded: number;
  sourceConversion: SourceConversionRow[];
  utmPerformance: UtmPerformanceRow[];
  monthlyCohorts: MonthlyCoHortRow[];
}

function buildEmptyFunnelAnalytics(): FunnelAnalytics {
  return {
    totalRegistered: 0,
    totalOnboarded: 0,
    sourceConversion: [],
    utmPerformance: [],
    monthlyCohorts: [],
  };
}

export async function getFunnelAnalytics(): Promise<FunnelAnalytics> {
  try {
    return await withDatabaseClient(
      "funnel analytics",
      async (client) => {
      // Run queries sequentially on the same client — pg does not multiplex
      // a single PoolClient, so Promise.all triggers a deprecation in pg v8+.
      const sourceConvRes = await client.query<{
        source: string | null;
        total: string;
        onboarded: string;
      }>(`
        SELECT
          COALESCE(source, 'Unknown') as source,
          COUNT(*) as total,
          SUM(CASE WHEN onboarding_completed = true THEN 1 ELSE 0 END) as onboarded
        FROM users
        GROUP BY source
        ORDER BY COUNT(*) DESC
      `);

      const utmRes = await client.query<{
        utm_campaign: string;
        utm_source: string | null;
        total: string;
        onboarded: string;
      }>(`
        SELECT
          utm_campaign,
          COALESCE(utm_source, '') as utm_source,
          COUNT(*) as total,
          SUM(CASE WHEN onboarding_completed = true THEN 1 ELSE 0 END) as onboarded
        FROM users
        WHERE utm_campaign IS NOT NULL AND utm_campaign != ''
        GROUP BY utm_campaign, utm_source
        ORDER BY COUNT(*) DESC
        LIMIT 10
      `);

      const cohortRes = await client.query<{
        month: Date;
        registered: string;
        onboarded: string;
      }>(`
        SELECT
          DATE_TRUNC('month', created_at) as month,
          COUNT(*) as registered,
          SUM(CASE WHEN onboarding_completed = true THEN 1 ELSE 0 END) as onboarded
        FROM users
        WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '11 months')
        GROUP BY 1
        ORDER BY 1 ASC
      `);

      const onboardingTotalsRes = await client.query<{
        total: string;
        onboarded: string;
      }>(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN onboarding_completed = true THEN 1 ELSE 0 END) as onboarded
        FROM users
      `);

      const totalRow = onboardingTotalsRes.rows[0];

      return {
        totalRegistered: parseInt(totalRow?.total || "0", 10),
        totalOnboarded: parseInt(totalRow?.onboarded || "0", 10),

        sourceConversion: sourceConvRes.rows.map((r) => ({
          source: r.source || "Unknown",
          total: parseInt(r.total, 10),
          onboarded: parseInt(r.onboarded, 10),
        })) as SourceConversionRow[],

        utmPerformance: utmRes.rows.map((r) => ({
          campaign: r.utm_campaign,
          utmSource: r.utm_source || "",
          total: parseInt(r.total, 10),
          onboarded: parseInt(r.onboarded, 10),
        })) as UtmPerformanceRow[],

        monthlyCohorts: cohortRes.rows
          .map((r) => ({
            month: new Date(r.month).toISOString().slice(0, 7),
            registered: parseInt(r.registered, 10),
            onboarded: parseInt(r.onboarded, 10),
          }))
          .reverse() as MonthlyCoHortRow[],
        };
      },
      {
        connectAttempts: DB_BEST_EFFORT_CONNECT_ATTEMPTS,
      }
    );
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return buildEmptyFunnelAnalytics();
    }

    throw error;
  }
}
