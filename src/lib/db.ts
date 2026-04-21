import pg, { type QueryResultRow } from "pg";

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

const MAX_DAILY_REG_ROWS = parseBoundedInt(
  process.env.MAX_DAILY_REG_ROWS,
  365,
  1,
  5000
);
const DB_CONNECTION_TIMEOUT_MS = parseBoundedInt(
  process.env.DB_CONNECTION_TIMEOUT_MS,
  8000,
  1000,
  30000
);
const DB_QUERY_TIMEOUT_MS = parseBoundedInt(
  process.env.DB_QUERY_TIMEOUT_MS,
  15000,
  1000,
  120000
);
const DB_POOL_MAX = parseBoundedInt(process.env.DB_POOL_MAX, 3, 1, 20);
const DB_CONNECT_ATTEMPTS = parseBoundedInt(
  process.env.DB_CONNECT_ATTEMPTS,
  2,
  1,
  5
);
const DB_CONNECT_RETRY_DELAY_MS = parseBoundedInt(
  process.env.DB_CONNECT_RETRY_DELAY_MS,
  400,
  0,
  5000
);
const DB_RETRY_COOLDOWN_MS = parseBoundedInt(
  process.env.DB_RETRY_COOLDOWN_MS,
  15000,
  1000,
  300000
);
const databaseUrl = process.env.DATABASE_URL?.trim();
const shouldUseDatabaseSsl =
  process.env.DATABASE_SSL === "true" ||
  (process.env.NODE_ENV === "production" &&
    process.env.DATABASE_SSL !== "false");
const allowSelfSignedCerts =
  process.env.ALLOW_SELF_SIGNED_CERTS === "true" &&
  process.env.NODE_ENV !== "production";
const CONNECTIVITY_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "ENOTFOUND",
  "ETIMEDOUT",
]);

const dbFailureState = {
  unavailableUntil: 0,
  reason: null as string | null,
};

export const pool = new pg.Pool({
  connectionString: databaseUrl,
  ...(shouldUseDatabaseSsl
    ? { ssl: { rejectUnauthorized: !allowSelfSignedCerts } }
    : {}),
  max: DB_POOL_MAX,
  connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
  idleTimeoutMillis: 30000,
  query_timeout: DB_QUERY_TIMEOUT_MS,
  keepAlive: true,
  allowExitOnIdle: true,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

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
  dbFailureState.reason = getErrorMessage(error);
  dbFailureState.unavailableUntil = Date.now() + DB_RETRY_COOLDOWN_MS;
}

function clearDbFailureState() {
  dbFailureState.reason = null;
  dbFailureState.unavailableUntil = 0;
}

async function ensureDatabaseAvailable(context: string) {
  if (!databaseUrl) {
    throw new DbUnavailableError("DATABASE_URL is not configured.");
  }

  if (Date.now() < dbFailureState.unavailableUntil) {
    throw new DbUnavailableError(
      dbFailureState.reason ?? "Database is temporarily unavailable."
    );
  }

  let client: pg.PoolClient | null = null;

  try {
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= DB_CONNECT_ATTEMPTS; attempt += 1) {
      try {
        client = await pool.connect();
        clearDbFailureState();
        return client;
      } catch (error) {
        lastError = error;

        if (
          !isTransientConnectionFailure(error) ||
          attempt === DB_CONNECT_ATTEMPTS
        ) {
          break;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, DB_CONNECT_RETRY_DELAY_MS * attempt)
        );
      }
    }

    throw lastError;
  } catch (error) {
    cacheDbFailure(error);
    console.error(`[DB] ${context} unavailable:`, error);
    throw new DbUnavailableError(getErrorMessage(error));
  }
}

export async function withDatabaseClient<T>(
  context: string,
  operation: (client: DbClient) => Promise<T>
) {
  const client = await ensureDatabaseAvailable(context);

  try {
    const result = await operation(client);
    clearDbFailureState();
    return result;
  } catch (error) {
    if (isTransientConnectionFailure(error)) {
      cacheDbFailure(error);
      throw new DbUnavailableError(getErrorMessage(error));
    }

    throw error;
  } finally {
    client.release();
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
  id: number;
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
    return await withDatabaseClient("analytics", async (client) => {
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
    });
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
    return await withDatabaseClient("funnel analytics", async (client) => {
      const [
        sourceConvRes,
        utmRes,
        cohortRes,
        onboardingTotalsRes,
      ] = await Promise.all([
        // Onboarding rate by source
        client.query<{ source: string | null; total: string; onboarded: string }>(`
          SELECT
            COALESCE(source, 'Unknown') as source,
            COUNT(*) as total,
            SUM(CASE WHEN onboarding_completed = true THEN 1 ELSE 0 END) as onboarded
          FROM users
          GROUP BY source
          ORDER BY COUNT(*) DESC
        `),

        // UTM campaign performance
        client.query<{ utm_campaign: string; utm_source: string | null; total: string; onboarded: string }>(`
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
        `),

        // Monthly cohort: registrations + onboarded
        client.query<{ month: Date; registered: string; onboarded: string }>(`
          SELECT
            DATE_TRUNC('month', created_at) as month,
            COUNT(*) as registered,
            SUM(CASE WHEN onboarding_completed = true THEN 1 ELSE 0 END) as onboarded
          FROM users
          WHERE created_at >= DATE_TRUNC('month', NOW() - INTERVAL '11 months')
          GROUP BY 1
          ORDER BY 1 ASC
        `),

        // Overall onboarding totals
        client.query<{ total: string; onboarded: string }>(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN onboarding_completed = true THEN 1 ELSE 0 END) as onboarded
          FROM users
        `),
      ]);

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
    });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return buildEmptyFunnelAnalytics();
    }

    throw error;
  }
}
