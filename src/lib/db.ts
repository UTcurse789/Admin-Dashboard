import pg from "pg";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
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
  created_at: string | null;
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

/**
 * Fetch all database analytics in a single call.
 * Each query is independent so we run them in parallel.
 */
export async function getDbAnalytics() {
  const [
    totalUsersRes,
    sourceRes,
    dataSourceRes,
    salutationRes,
    industryRes,
    stateRes,
    dailyRegRes,
    growthRes,
    recentUsersRes,
  ] = await Promise.all([
    // 1. Total users
    pool.query<{ cnt: string }>("SELECT COUNT(*) as cnt FROM users"),

    // 2. Users by source (zoho_form, website, etc.)
    pool.query<{ source: string | null; cnt: string }>(
      "SELECT source, COUNT(*) as cnt FROM users GROUP BY source ORDER BY cnt DESC"
    ),

    // 3. Users by data_source
    pool.query<{ data_source: string | null; cnt: string }>(
      "SELECT data_source, COUNT(*) as cnt FROM users GROUP BY data_source ORDER BY cnt DESC"
    ),

    // 4. Users by salutation
    pool.query<{ salutation: string | null; cnt: string }>(
      "SELECT salutation, COUNT(*) as cnt FROM users WHERE salutation IS NOT NULL GROUP BY salutation ORDER BY cnt DESC"
    ),

    // 5. Users by industry
    pool.query<{ industry: string; cnt: string }>(
      `SELECT i.name as industry, COUNT(*) as cnt
       FROM user_industries ui
       JOIN industry i ON ui.industry_id = i.id
       GROUP BY i.name
       ORDER BY cnt DESC`
    ),

    // 6. Users by state (top 15)
    pool.query<{ state: string; cnt: string }>(
      `SELECT state, COUNT(*) as cnt FROM users 
       WHERE state IS NOT NULL AND state != '' 
       GROUP BY state ORDER BY cnt DESC LIMIT 15`
    ),

    // 7. Daily registrations (all time from DB)
    pool.query<{ date: Date; cnt: string }>(
      `SELECT DATE(created_at) as date, COUNT(*) as cnt 
       FROM users 
       GROUP BY DATE(created_at) 
       ORDER BY date`
    ),

    // 8. Growth: this month vs last month (for growth rate KPI)
    pool.query<{ period: string; cnt: string }>(
      `SELECT 
         'this_month' as period, COUNT(*) as cnt FROM users 
         WHERE created_at >= DATE_TRUNC('month', NOW())
       UNION ALL
       SELECT 
         'last_month' as period, COUNT(*) as cnt FROM users 
         WHERE created_at >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month'
           AND created_at < DATE_TRUNC('month', NOW())`
    ),

    // 9. Recent 20 users with all fields
    pool.query<DbUser>(
      `SELECT id, clerk_id, email, first_name, last_name, phone, country, state,
              job_title, organization, onboarding_completed, created_at,
              source, data_source, salutation, registration_method,
              utm_source, utm_medium, utm_campaign
       FROM users ORDER BY created_at DESC LIMIT 20`
    ),
  ]);

  const totalDbUsers = parseInt(totalUsersRes.rows[0]?.cnt || "0", 10);

  const bySource: CountRow[] = sourceRes.rows.map((r) => ({
    label: r.source || "Unknown",
    count: parseInt(r.cnt, 10),
  }));

  const byDataSource: CountRow[] = dataSourceRes.rows.map((r) => ({
    label: r.data_source || "Unknown",
    count: parseInt(r.cnt, 10),
  }));

  const bySalutation: CountRow[] = salutationRes.rows.map((r) => ({
    label: r.salutation || "Unknown",
    count: parseInt(r.cnt, 10),
  }));

  const byIndustry: CountRow[] = industryRes.rows.map((r) => ({
    label: r.industry,
    count: parseInt(r.cnt, 10),
  }));

  const byState: CountRow[] = stateRes.rows.map((r) => ({
    label: r.state,
    count: parseInt(r.cnt, 10),
  }));

  const dailyRegistrations: DailyCount[] = dailyRegRes.rows.map((r) => ({
    date: new Date(r.date).toISOString().slice(0, 10),
    count: parseInt(r.cnt, 10),
  }));

  // Growth rate
  let thisMonthCount = 0;
  let lastMonthCount = 0;
  growthRes.rows.forEach((r) => {
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
    recentDbUsers: recentUsersRes.rows,
  };
}

export type DbAnalytics = Awaited<ReturnType<typeof getDbAnalytics>>;
