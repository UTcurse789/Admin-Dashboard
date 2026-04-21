import { isDbUnavailableError, runDbQuery, type CountRow } from "@/lib/db";

export type JourneyCohortKey = "crm" | "native";

export interface JourneyClerkUser {
  id: string;
  createdAt: number;
  lastSignInAt: number | null;
}

export interface JourneyDeltaMetric {
  current: number;
  previous: number;
}

export interface JourneyWeeklySummary {
  invited: JourneyDeltaMetric;
  completedSignups: JourneyDeltaMetric;
  reminderOptOuts: JourneyDeltaMetric;
  reminderConversions: JourneyDeltaMetric;
  activeUsers: JourneyDeltaMetric;
  reLoggedUsers: JourneyDeltaMetric;
}

export interface JourneyCohortSummary {
  key: JourneyCohortKey;
  label: string;
  invitedUsers: number;
  completedSignups: number;
  completionRate: number;
  optedOutFromReminders: number;
  stillInReminderLoop: number;
  avgDaysToConvert: number | null;
  avgReminderEmailsToConvert: number | null;
  activeUsers30d: number;
  reLoggedUsers: number;
  deletedAccounts: number;
  abandonedUsers: number;
  weekly: JourneyWeeklySummary;
  referralSources: CountRow[];
}

export interface JourneyPageStat {
  page: string;
  count: number;
}

export interface JourneyPageInsights {
  available: boolean;
  note: string | null;
  mostVisitedPage: JourneyPageStat | null;
  dropoffPage: JourneyPageStat | null;
}

export interface JourneyDashboardData {
  generatedAt: string;
  completedSignupDefinition: string;
  abandonedDefinition: string;
  cohorts: JourneyCohortSummary[];
  pageInsights: JourneyPageInsights;
}

interface CohortRow {
  cohort: JourneyCohortKey;
}

interface InvitedRow extends CohortRow {
  invited_total: string;
  invited_current: string;
  invited_previous: string;
}

interface CompletedRow extends CohortRow {
  completed_total: string;
  completed_current: string;
  completed_previous: string;
  avg_days_to_convert: string | null;
  avg_reminder_emails_to_convert: string | null;
  reminder_conversion_current: string;
  reminder_conversion_previous: string;
}

interface ReminderRow extends CohortRow {
  opted_out_total: string;
  still_in_loop_total: string;
  abandoned_total: string;
  opted_out_current: string;
  opted_out_previous: string;
}

interface ReferralRow {
  label: string;
  count: string;
}

interface JourneyUserRow extends CohortRow {
  clerk_id: string | null;
  created_at: Date | null;
}

const COHORT_LABELS: Record<JourneyCohortKey, string> = {
  crm: "CRM invited",
  native: "Native sign-up",
};

function createEmptyWeeklySummary(): JourneyWeeklySummary {
  return {
    invited: { current: 0, previous: 0 },
    completedSignups: { current: 0, previous: 0 },
    reminderOptOuts: { current: 0, previous: 0 },
    reminderConversions: { current: 0, previous: 0 },
    activeUsers: { current: 0, previous: 0 },
    reLoggedUsers: { current: 0, previous: 0 },
  };
}

function createEmptyCohortSummary(
  key: JourneyCohortKey
): JourneyCohortSummary {
  return {
    key,
    label: COHORT_LABELS[key],
    invitedUsers: 0,
    completedSignups: 0,
    completionRate: 0,
    optedOutFromReminders: 0,
    stillInReminderLoop: 0,
    avgDaysToConvert: null,
    avgReminderEmailsToConvert: null,
    activeUsers30d: 0,
    reLoggedUsers: 0,
    deletedAccounts: 0,
    abandonedUsers: 0,
    weekly: createEmptyWeeklySummary(),
    referralSources: [],
  };
}

function buildEmptyJourneyDashboardData(
  note = "Page visit and drop-off analytics are not available in this environment."
): JourneyDashboardData {
  return {
    generatedAt: new Date().toISOString(),
    completedSignupDefinition:
      "Verified users who also selected at least one category or industry.",
    abandonedDefinition:
      "Users still unverified after repeated reminders or more than 30 days in the reminder funnel.",
    cohorts: [
      createEmptyCohortSummary("crm"),
      createEmptyCohortSummary("native"),
    ],
    pageInsights: {
      available: false,
      note,
      mostVisitedPage: null,
      dropoffPage: null,
    },
  };
}

function parseCount(value: string | null | undefined) {
  return Number.parseInt(value ?? "0", 10) || 0;
}

function parseAverage(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function getJourneyDashboardData(
  clerkUsers: JourneyClerkUser[]
): Promise<JourneyDashboardData> {
  try {
    const [
      invitedResult,
      completedResult,
      reminderResult,
      referralResult,
      userResult,
    ] = await Promise.all([
      runDbQuery<InvitedRow>(
        `
          WITH journey_records AS (
            SELECT
              LOWER(email) AS email,
              CASE
                WHEN crm_lead_id IS NULL OR crm_lead_id = '' THEN 'native'
                ELSE 'crm'
              END AS cohort,
              created_at AS occurred_at
            FROM users
            WHERE email IS NOT NULL AND email != ''

            UNION ALL

            SELECT
              LOWER(p.email) AS email,
              CASE
                WHEN COALESCE(NULLIF(p.crm_lead_id, ''), NULLIF(u.crm_lead_id, '')) IS NULL THEN 'native'
                ELSE 'crm'
              END AS cohort,
              p.created_at AS occurred_at
            FROM pending_verifications p
            LEFT JOIN users u ON LOWER(u.email) = LOWER(p.email)
            WHERE p.email IS NOT NULL AND p.email != ''
          ),
          deduped AS (
            SELECT
              cohort,
              email,
              MIN(occurred_at) AS first_seen_at
            FROM journey_records
            GROUP BY cohort, email
          )
          SELECT
            cohort,
            COUNT(*)::text AS invited_total,
            COUNT(*) FILTER (
              WHERE first_seen_at >= NOW() - INTERVAL '7 days'
            )::text AS invited_current,
            COUNT(*) FILTER (
              WHERE first_seen_at >= NOW() - INTERVAL '14 days'
                AND first_seen_at < NOW() - INTERVAL '7 days'
            )::text AS invited_previous
          FROM deduped
          GROUP BY cohort
        `,
        [],
        "journey invited metrics"
      ),
      runDbQuery<CompletedRow>(
        `
          SELECT
            CASE
              WHEN u.crm_lead_id IS NULL OR u.crm_lead_id = '' THEN 'native'
              ELSE 'crm'
            END AS cohort,
            COUNT(DISTINCT u.id) FILTER (
              WHERE u.verification_status = 'verified'
                AND (uc.user_id IS NOT NULL OR ui.user_id IS NOT NULL)
            )::text AS completed_total,
            COUNT(DISTINCT u.id) FILTER (
              WHERE u.verification_status = 'verified'
                AND (uc.user_id IS NOT NULL OR ui.user_id IS NOT NULL)
                AND COALESCE(u.updated_at, u.created_at) >= NOW() - INTERVAL '7 days'
            )::text AS completed_current,
            COUNT(DISTINCT u.id) FILTER (
              WHERE u.verification_status = 'verified'
                AND (uc.user_id IS NOT NULL OR ui.user_id IS NOT NULL)
                AND COALESCE(u.updated_at, u.created_at) >= NOW() - INTERVAL '14 days'
                AND COALESCE(u.updated_at, u.created_at) < NOW() - INTERVAL '7 days'
            )::text AS completed_previous,
            AVG(
              EXTRACT(EPOCH FROM (COALESCE(u.updated_at, u.created_at) - u.created_at)) / 86400.0
            ) FILTER (
              WHERE u.verification_status = 'verified'
                AND (uc.user_id IS NOT NULL OR ui.user_id IS NOT NULL)
            )::text AS avg_days_to_convert,
            AVG(u.reminder_email_count::numeric) FILTER (
              WHERE u.verification_status = 'verified'
                AND (uc.user_id IS NOT NULL OR ui.user_id IS NOT NULL)
                AND COALESCE(u.reminder_email_count, 0) > 0
            )::text AS avg_reminder_emails_to_convert,
            COUNT(DISTINCT u.id) FILTER (
              WHERE u.verification_status = 'verified'
                AND (uc.user_id IS NOT NULL OR ui.user_id IS NOT NULL)
                AND COALESCE(u.reminder_email_count, 0) > 0
                AND COALESCE(u.updated_at, u.created_at) >= NOW() - INTERVAL '7 days'
            )::text AS reminder_conversion_current,
            COUNT(DISTINCT u.id) FILTER (
              WHERE u.verification_status = 'verified'
                AND (uc.user_id IS NOT NULL OR ui.user_id IS NOT NULL)
                AND COALESCE(u.reminder_email_count, 0) > 0
                AND COALESCE(u.updated_at, u.created_at) >= NOW() - INTERVAL '14 days'
                AND COALESCE(u.updated_at, u.created_at) < NOW() - INTERVAL '7 days'
            )::text AS reminder_conversion_previous
          FROM users u
          LEFT JOIN user_communities uc ON uc.user_id = u.id
          LEFT JOIN user_industries ui ON ui.user_id = u.id
          GROUP BY cohort
        `,
        [],
        "journey completed metrics"
      ),
      runDbQuery<ReminderRow>(
        `
          WITH reminder_records AS (
            SELECT
              LOWER(email) AS email,
              CASE
                WHEN crm_lead_id IS NULL OR crm_lead_id = '' THEN 'native'
                ELSE 'crm'
              END AS cohort,
              COALESCE(reminder_opted_out, false) AS opted_out,
              CASE
                WHEN verification_status = 'pending_verification'
                  AND COALESCE(reminder_opted_out, false) = false THEN true
                ELSE false
              END AS active_loop,
              CASE
                WHEN verification_status = 'pending_verification'
                  AND COALESCE(reminder_opted_out, false) = false
                  AND (
                    COALESCE(reminder_email_count, 0) >= 4
                    OR created_at < NOW() - INTERVAL '30 days'
                  ) THEN true
                ELSE false
              END AS abandoned,
              updated_at
            FROM users
            WHERE email IS NOT NULL AND email != ''

            UNION ALL

            SELECT
              LOWER(p.email) AS email,
              CASE
                WHEN COALESCE(NULLIF(p.crm_lead_id, ''), NULLIF(u.crm_lead_id, '')) IS NULL THEN 'native'
                ELSE 'crm'
              END AS cohort,
              COALESCE(p.drip_opted_out, false) AS opted_out,
              CASE
                WHEN p.user_id IS NULL
                  AND p.verification_status = 'pending'
                  AND COALESCE(p.drip_opted_out, false) = false THEN true
                ELSE false
              END AS active_loop,
              CASE
                WHEN p.user_id IS NULL
                  AND p.verification_status = 'pending'
                  AND COALESCE(p.drip_opted_out, false) = false
                  AND p.created_at < NOW() - INTERVAL '30 days' THEN true
                ELSE false
              END AS abandoned,
              p.updated_at
            FROM pending_verifications p
            LEFT JOIN users u ON LOWER(u.email) = LOWER(p.email)
            WHERE p.email IS NOT NULL AND p.email != ''
          ),
          deduped AS (
            SELECT
              cohort,
              email,
              BOOL_OR(opted_out) AS opted_out,
              BOOL_OR(active_loop) AS active_loop,
              BOOL_OR(abandoned) AS abandoned,
              MAX(updated_at) FILTER (WHERE opted_out) AS opted_out_at
            FROM reminder_records
            GROUP BY cohort, email
          )
          SELECT
            cohort,
            COUNT(*) FILTER (WHERE opted_out)::text AS opted_out_total,
            COUNT(*) FILTER (WHERE active_loop)::text AS still_in_loop_total,
            COUNT(*) FILTER (WHERE abandoned)::text AS abandoned_total,
            COUNT(*) FILTER (
              WHERE opted_out
                AND opted_out_at >= NOW() - INTERVAL '7 days'
            )::text AS opted_out_current,
            COUNT(*) FILTER (
              WHERE opted_out
                AND opted_out_at >= NOW() - INTERVAL '14 days'
                AND opted_out_at < NOW() - INTERVAL '7 days'
            )::text AS opted_out_previous
          FROM deduped
          GROUP BY cohort
        `,
        [],
        "journey reminder metrics"
      ),
      runDbQuery<ReferralRow>(
        `
          SELECT
            COALESCE(
              NULLIF(utm_source, ''),
              NULLIF(utm_campaign, ''),
              NULLIF(data_source, ''),
              NULLIF(source, ''),
              'Direct / Unknown'
            ) AS label,
            COUNT(*)::text AS count
          FROM users
          WHERE crm_lead_id IS NULL OR crm_lead_id = ''
          GROUP BY 1
          ORDER BY COUNT(*) DESC, 1 ASC
          LIMIT 6
        `,
        [],
        "journey referral sources"
      ),
      runDbQuery<JourneyUserRow>(
        `
          SELECT
            CASE
              WHEN crm_lead_id IS NULL OR crm_lead_id = '' THEN 'native'
              ELSE 'crm'
            END AS cohort,
            clerk_id,
            created_at
          FROM users
        `,
        [],
        "journey clerk mapping"
      ),
    ]);

    const cohortMap = new Map<JourneyCohortKey, JourneyCohortSummary>([
      ["crm", createEmptyCohortSummary("crm")],
      ["native", createEmptyCohortSummary("native")],
    ]);

    invitedResult.rows.forEach((row) => {
      const summary = cohortMap.get(row.cohort);
      if (!summary) {
        return;
      }

      summary.invitedUsers = parseCount(row.invited_total);
      summary.weekly.invited.current = parseCount(row.invited_current);
      summary.weekly.invited.previous = parseCount(row.invited_previous);
    });

    completedResult.rows.forEach((row) => {
      const summary = cohortMap.get(row.cohort);
      if (!summary) {
        return;
      }

      summary.completedSignups = parseCount(row.completed_total);
      summary.avgDaysToConvert = parseAverage(row.avg_days_to_convert);
      summary.avgReminderEmailsToConvert = parseAverage(
        row.avg_reminder_emails_to_convert
      );
      summary.weekly.completedSignups.current = parseCount(
        row.completed_current
      );
      summary.weekly.completedSignups.previous = parseCount(
        row.completed_previous
      );
      summary.weekly.reminderConversions.current = parseCount(
        row.reminder_conversion_current
      );
      summary.weekly.reminderConversions.previous = parseCount(
        row.reminder_conversion_previous
      );
    });

    reminderResult.rows.forEach((row) => {
      const summary = cohortMap.get(row.cohort);
      if (!summary) {
        return;
      }

      summary.optedOutFromReminders = parseCount(row.opted_out_total);
      summary.stillInReminderLoop = parseCount(row.still_in_loop_total);
      summary.abandonedUsers = parseCount(row.abandoned_total);
      summary.weekly.reminderOptOuts.current = parseCount(
        row.opted_out_current
      );
      summary.weekly.reminderOptOuts.previous = parseCount(
        row.opted_out_previous
      );
    });

    cohortMap.get("native")!.referralSources = referralResult.rows.map((row) => ({
      label: row.label,
      count: parseCount(row.count),
    }));

    const clerkMap = new Map(clerkUsers.map((user) => [user.id, user]));
    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
    const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
    const oneDayMs = 24 * 60 * 60 * 1000;

    userResult.rows.forEach((row) => {
      const summary = cohortMap.get(row.cohort);
      if (!summary) {
        return;
      }

      const clerkId = row.clerk_id?.trim();
      const clerkUser = clerkId ? clerkMap.get(clerkId) : null;

      if (!clerkUser) {
        summary.deletedAccounts += 1;
        return;
      }

      const lastSignInAt = clerkUser.lastSignInAt;

      if (lastSignInAt && lastSignInAt >= thirtyDaysAgo) {
        summary.activeUsers30d += 1;
      }

      if (lastSignInAt && lastSignInAt >= sevenDaysAgo) {
        summary.weekly.activeUsers.current += 1;
      } else if (
        lastSignInAt &&
        lastSignInAt >= fourteenDaysAgo &&
        lastSignInAt < sevenDaysAgo
      ) {
        summary.weekly.activeUsers.previous += 1;
      }

      const createdAtMs = row.created_at
        ? new Date(row.created_at).getTime()
        : clerkUser.createdAt;
      const reLogged = Boolean(
        lastSignInAt && createdAtMs && lastSignInAt - createdAtMs > oneDayMs
      );

      if (reLogged) {
        summary.reLoggedUsers += 1;
      }

      if (reLogged && lastSignInAt && lastSignInAt >= sevenDaysAgo) {
        summary.weekly.reLoggedUsers.current += 1;
      } else if (
        reLogged &&
        lastSignInAt &&
        lastSignInAt >= fourteenDaysAgo &&
        lastSignInAt < sevenDaysAgo
      ) {
        summary.weekly.reLoggedUsers.previous += 1;
      }
    });

    cohortMap.forEach((summary) => {
      summary.completionRate =
        summary.invitedUsers > 0
          ? (summary.completedSignups / summary.invitedUsers) * 100
          : 0;
    });

    return {
      generatedAt: new Date().toISOString(),
      completedSignupDefinition:
        "Verified users who also selected at least one category or industry.",
      abandonedDefinition:
        "Users still unverified after repeated reminders or more than 30 days in the reminder funnel.",
      cohorts: [cohortMap.get("crm")!, cohortMap.get("native")!],
      pageInsights: {
        available: false,
        note:
          "Page visit and drop-off analytics need a server-side product analytics query source. This environment only has client-side pageview capture configured.",
        mostVisitedPage: null,
        dropoffPage: null,
      },
    };
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return buildEmptyJourneyDashboardData(
        `Journey analytics are unavailable because the database could not be reached: ${error.message}`
      );
    }

    throw error;
  }
}
