import pg from "pg";

const MAX_DAILY_REG_ROWS = Math.max(
  1,
  Math.min(
    Number.parseInt(process.env.MAX_DAILY_REG_ROWS ?? "365", 10) || 365,
    5000
  )
);
const shouldUseDatabaseSsl =
  process.env.DATABASE_SSL === "true" ||
  (process.env.NODE_ENV === "production" &&
    process.env.DATABASE_SSL !== "false");
const allowSelfSignedCerts =
  process.env.ALLOW_SELF_SIGNED_CERTS === "true" &&
  process.env.NODE_ENV !== "production";

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ...(shouldUseDatabaseSsl
    ? { ssl: { rejectUnauthorized: !allowSelfSignedCerts } }
    : {}),
  max: 5,
  idleTimeoutMillis: 30000,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error:", error);
});

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

function unwrapSettledRows<T>(
  result: PromiseSettledResult<T[]>,
  label: string,
  fallback: T[],
  queryErrors: string[]
) {
  if (result.status === "fulfilled") {
    return result.value;
  }

  const message =
    result.reason instanceof Error
      ? result.reason.message
      : String(result.reason);

  console.error(`DB analytics query failed (${label}):`, result.reason);
  queryErrors.push(`${label}: ${message}`);

  return fallback;
}

/**
 * Fetch all database analytics in a single call.
 * Each query is independent so we run them in parallel.
 */
export async function getDbAnalytics() {
  const results = await Promise.allSettled([
    // 1. Total users
    pool
      .query<{ cnt: string }>("SELECT COUNT(*) as cnt FROM users")
      .then((result) => result.rows),

    // 2. Users by source (zoho_form, website, etc.)
    pool
      .query<{ source: string | null; cnt: string }>(
        "SELECT source, COUNT(*) as cnt FROM users GROUP BY source ORDER BY cnt DESC"
      )
      .then((result) => result.rows),

    // 3. Users by data_source
    pool
      .query<{ data_source: string | null; cnt: string }>(
        "SELECT data_source, COUNT(*) as cnt FROM users GROUP BY data_source ORDER BY cnt DESC"
      )
      .then((result) => result.rows),

    // 4. Users by salutation
    pool
      .query<{ salutation: string | null; cnt: string }>(
        "SELECT salutation, COUNT(*) as cnt FROM users WHERE salutation IS NOT NULL GROUP BY salutation ORDER BY cnt DESC"
      )
      .then((result) => result.rows),

    // 5. Users by industry
    pool
      .query<{ industry: string; cnt: string }>(
        `SELECT i.name as industry, COUNT(*) as cnt
       FROM user_industries ui
       JOIN industry i ON ui.industry_id = i.id
       GROUP BY i.name
       ORDER BY cnt DESC`
      )
      .then((result) => result.rows),

    // 6. Users by state (top 15)
    pool
      .query<{ state: string; cnt: string }>(
        `SELECT state, COUNT(*) as cnt FROM users 
       WHERE state IS NOT NULL AND state != '' 
       GROUP BY state ORDER BY cnt DESC LIMIT 15`
      )
      .then((result) => result.rows),

    // 7. Daily registrations (all time from DB)
    pool
      .query<{ date: Date; cnt: string }>(
        `SELECT DATE(created_at) as date, COUNT(*) as cnt 
       FROM users 
       GROUP BY DATE(created_at) 
       ORDER BY DATE(created_at) DESC
       LIMIT $1`,
        [MAX_DAILY_REG_ROWS]
      )
      .then((result) => result.rows),

    // 8. Growth: this month vs last month (for growth rate KPI)
    pool
      .query<{ period: string; cnt: string }>(
        `SELECT 
         'this_month' as period, COUNT(*) as cnt FROM users 
         WHERE created_at >= DATE_TRUNC('month', NOW())
       UNION ALL
       SELECT 
         'last_month' as period, COUNT(*) as cnt FROM users 
         WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
           AND created_at < DATE_TRUNC('month', NOW())`
      )
      .then((result) => result.rows),

    // 9. Recent 20 users with all fields
    pool
      .query<DbUser>(
        `SELECT id, clerk_id, email, first_name, last_name, phone, country, state,
              job_title, organization, onboarding_completed, created_at,
              source, data_source, salutation, registration_method,
              utm_source, utm_medium, utm_campaign
       FROM users ORDER BY created_at DESC LIMIT 20`
      )
      .then((result) => result.rows),
  ]);

  const queryErrors: string[] = [];
  const totalUsersRows = unwrapSettledRows(
    results[0],
    "total_users",
    [{ cnt: "0" }],
    queryErrors
  );
  const sourceRows = unwrapSettledRows(results[1], "by_source", [], queryErrors);
  const dataSourceRows = unwrapSettledRows(
    results[2],
    "by_data_source",
    [],
    queryErrors
  );
  const salutationRows = unwrapSettledRows(
    results[3],
    "by_salutation",
    [],
    queryErrors
  );
  const industryRows = unwrapSettledRows(
    results[4],
    "by_industry",
    [],
    queryErrors
  );
  const stateRows = unwrapSettledRows(results[5], "by_state", [], queryErrors);
  const dailyRegistrationRows = unwrapSettledRows(
    results[6],
    "daily_registrations",
    [],
    queryErrors
  );
  const growthRows = unwrapSettledRows(results[7], "growth", [], queryErrors);
  const recentUserRows = unwrapSettledRows(
    results[8],
    "recent_users",
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

  // Growth rate
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
}

export type DbAnalytics = Awaited<ReturnType<typeof getDbAnalytics>>;

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

export async function getFunnelAnalytics() {
  const [
    sourceConvRes,
    utmRes,
    cohortRes,
    onboardingTotalsRes,
  ] = await Promise.all([
    // Onboarding rate by source
    pool.query<{ source: string | null; total: string; onboarded: string }>(`
      SELECT
        COALESCE(source, 'Unknown') as source,
        COUNT(*) as total,
        SUM(CASE WHEN onboarding_completed = true THEN 1 ELSE 0 END) as onboarded
      FROM users
      GROUP BY source
      ORDER BY COUNT(*) DESC
    `),

    // UTM campaign performance
    pool.query<{ utm_campaign: string; utm_source: string | null; total: string; onboarded: string }>(`
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
    pool.query<{ month: Date; registered: string; onboarded: string }>(`
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
    pool.query<{ total: string; onboarded: string }>(`
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
}

export type FunnelAnalytics = Awaited<ReturnType<typeof getFunnelAnalytics>>;
