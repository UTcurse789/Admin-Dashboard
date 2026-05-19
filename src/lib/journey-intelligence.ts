import {
  isDbUnavailableError,
  withDatabaseClient,
  type DbClient,
} from "@/lib/db";
import {
  getClerkUsersSnapshot,
  type ClerkUserRecord,
} from "@/lib/clerk-users";
import { JOURNEY_EVENT_NAMES, type JourneyEventName } from "@/lib/journey-events";
import type { QueryResultRow } from "pg";

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

const DEFAULT_WINDOW_DAYS = parseBoundedInt(
  process.env.JOURNEY_ANALYTICS_WINDOW_DAYS,
  90,
  7,
  365
);
const DEFAULT_TIMELINE_SESSION_LIMIT = parseBoundedInt(
  process.env.JOURNEY_TIMELINE_SESSION_LIMIT,
  3,
  1,
  6
);

export interface JourneyEventInsert {
  visitorId: string;
  sessionId: string;
  eventName: JourneyEventName;
  userId?: string | null;
  clerkId?: string | null;
  pageUrl?: string | null;
  referrer?: string | null;
  source?: string | null;
  device?: string | null;
  ipAddress?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface JourneyFunnelStage {
  key:
    | "visitors"
    | "content_readers"
    | "signup_clicks"
    | "signup_started"
    | "otp_verified"
    | "signup_completed"
    | "dashboard_users"
    | "returning_users";
  label: string;
  count: number;
  conversionRate: number | null;
  dropRate: number | null;
}

export interface JourneyDropoffSummary {
  biggestAbandonmentStage: string;
  biggestAbandonmentCount: number;
  biggestAbandonmentRate: number;
  otpFailures: number;
  authDropRate: number;
  formErrorSessions: number;
  rageClickSessions: number;
  fieldAbandonmentSessions: number;
}

export interface JourneyContentDriverRow {
  key: string;
  label: string;
  contentType: string;
  pagePath: string | null;
  readers: number;
  signupStarted: number;
  signupCompleted: number;
  activatedUsers: number;
}

export interface JourneyDeviceRow {
  device: string;
  visitors: number;
  sessions: number;
  signupRate: number;
  completionRate: number;
  dropOffRate: number;
  avgSessionDurationSeconds: number;
}

export interface JourneySourceRow {
  source: string;
  visitors: number;
  signupRate: number;
  engagementRate: number;
  activeUsers: number;
}

export interface JourneyTimelineEvent {
  id: number;
  occurredAt: string;
  timeLabel: string;
  eventName: JourneyEventName;
  label: string;
  pagePath: string | null;
  source: string | null;
  visitorId: string | null;
  sessionId: string;
  userId: string | null;
  clerkId: string | null;
  email: string | null;
  name: string | null;
  metadata: Record<string, unknown>;
}

export interface JourneyTimelineSession {
  sessionId: string;
  visitorId: string | null;
  userId: string | null;
  clerkId: string | null;
  email: string | null;
  name: string | null;
  device: string | null;
  source: string | null;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  gapFromPreviousSeconds: number | null;
  events: JourneyTimelineEvent[];
}

export interface JourneyTimelineResult {
  query: string | null;
  sessions: JourneyTimelineSession[];
  searched: boolean;
}

export interface JourneyGa4TimelineEvent {
  id: string;
  occurredAt: string;
  timeLabel: string;
  label: string;
  pagePath: string | null;
  pageTitle: string | null;
  source: string | null;
  device: string | null;
  eventCount: number;
  users: number;
}

export interface JourneyGa4TimelineBucket {
  id: string;
  label: string;
  events: JourneyGa4TimelineEvent[];
}

export interface JourneyGa4TimelineResult {
  query: string | null;
  buckets: JourneyGa4TimelineBucket[];
  searched: boolean;
}

export interface JourneyPortalFlowRow {
  source: string;
  landingPage: string | null;
  engagedPage: string | null;
  engagedPageTimeSeconds: number;
  authEntryPage: string | null;
  authDropPage: string | null;
  avgSessionDurationSeconds: number;
  activeUsers: number;
  accountsCreated: number;
}

export interface JourneyPageInsightRow {
  pagePath: string;
  pageTitle: string;
  views: number;
  dropoffRate: number;
}

export interface JourneyLabeledShareRow {
  label: string;
  value: number;
  share: number;
}

export interface JourneyPageDrilldownFlowRow {
  label: string;
  pagePath: string | null;
  pageTitle: string | null;
  views: number;
  users: number;
  share: number;
}

export interface JourneyPageDrilldownOverview {
  sessions: number;
  users: number;
  activeUsers: number;
  pageViews: number;
  avgSessionDurationSeconds: number;
  avgTimeOnPageSeconds: number;
  bounceRate: number;
  exitRate: number;
  entrances: number;
  newUsers: number;
  returningUsers: number;
  newUserShare: number;
  returningUserShare: number;
}

export interface JourneyPageDrilldownConversion {
  authUsers: number;
  authRate: number;
  signupCompletedUsers: number;
  signupCompletedRate: number;
  dashboardUsers: number;
  dashboardRate: number;
  exitPageViews: number;
  exitRate: number;
}

export interface JourneyPageDrilldown {
  query: string | null;
  resolvedPath: string | null;
  resolvedTitle: string | null;
  searched: boolean;
  overview: JourneyPageDrilldownOverview;
  sources: JourneyLabeledShareRow[];
  devices: JourneyLabeledShareRow[];
  regions: JourneyLabeledShareRow[];
  previousPages: JourneyPageDrilldownFlowRow[];
  nextPages: JourneyPageDrilldownFlowRow[];
  conversion: JourneyPageDrilldownConversion;
}

export interface JourneyPortalInsights {
  sessions: number;
  totalUsers: number;
  avgSessionDurationSeconds: number;
  bounceRate: number;
  pageviews: number;
  newUsers: number;
  returningUsers: number;
  newUserShare: number;
  returningUserShare: number;
  authVisitors: number;
  authAbandoned: number;
  signupCompleted: number;
  visitors: number;
  createdUsers: number;
  verifiedUsers: number;
  onboardedUsers: number;
  activePortalUsers: number;
  visitorToAccountRate: number;
  accountToOnboardedRate: number;
}

export interface JourneyIntelligenceData {
  dataMode: "events" | "derived" | "ga4";
  generatedAt: string;
  windowDays: number;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  totalEvents: number;
  trackedVisitors: number;
  hasEventData: boolean;
  funnelStages: JourneyFunnelStage[];
  dropoff: JourneyDropoffSummary;
  contentDrivers: JourneyContentDriverRow[];
  deviceAnalysis: JourneyDeviceRow[];
  sourceAnalysis: JourneySourceRow[];
  timeline: JourneyTimelineResult;
  ga4Timeline?: JourneyGa4TimelineResult | null;
  portalFlowRows?: JourneyPortalFlowRow[];
  portalInsights?: JourneyPortalInsights | null;
  mostViewedPages?: JourneyPageInsightRow[];
  highestDropoffPages?: JourneyPageInsightRow[];
  pageDrilldown?: JourneyPageDrilldown | null;
  notes: string[];
}

interface FunnelRow extends QueryResultRow {
  total_events: string;
  visitors: string;
  content_readers: string;
  signup_clicks: string;
  signup_started: string;
  otp_verified: string;
  signup_completed: string;
  dashboard_users: string;
  returning_users: string;
}

interface DropoffRow extends QueryResultRow {
  otp_failures: string;
  form_error_sessions: string;
  rage_click_sessions: string;
  field_abandonment_sessions: string;
}

interface ContentRow extends QueryResultRow {
  content_key: string;
  content_label: string;
  content_type: string;
  page_url: string | null;
  readers: string;
  signup_started: string;
  signup_completed: string;
  activated_users: string;
}

interface DeviceRow extends QueryResultRow {
  device: string | null;
  visitors: string;
  sessions: string;
  signup_started: string;
  signup_completed: string;
  dashboard_users: string;
  avg_duration_seconds: string | null;
}

interface SourceRow extends QueryResultRow {
  source: string | null;
  visitors: string;
  signup_completed: string;
  engaged: string;
  active_users: string;
}

interface TimelineSessionIdRow extends QueryResultRow {
  session_id: string;
}

interface TimelineEventRow extends QueryResultRow {
  id: number;
  session_id: string;
  visitor_id: string | null;
  user_id: string | null;
  clerk_id: string | null;
  event_name: JourneyEventName;
  page_url: string | null;
  source: string | null;
  device: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface DerivedUserRow extends QueryResultRow {
  id: string;
  clerk_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  source: string | null;
  data_source: string | null;
  utm_source: string | null;
  verification_status: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  reminder_email_count: number | null;
}

interface DerivedPendingRow extends QueryResultRow {
  id: string;
  email: string;
  name: string | null;
  source: string | null;
  utm_source: string | null;
  verification_status: string | null;
  otp_verified: boolean | null;
  verified_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
  user_id: string | null;
}

interface DerivedIdentity {
  key: string;
  email: string;
  user: DerivedUserRow | null;
  pending: DerivedPendingRow | null;
  clerk: ClerkUserRecord | null;
  sourceLabel: string;
  name: string | null;
  createdAtMs: number | null;
  latestActivityMs: number | null;
  otpVerifiedAtMs: number | null;
  signupCompletedAtMs: number | null;
  dashboardAtMs: number | null;
  isOtpVerified: boolean;
  isSignupCompleted: boolean;
  hasDashboardActivity: boolean;
  isReturning: boolean;
  isPendingAuth: boolean;
}

const EMPTY_DROPOFF: JourneyDropoffSummary = {
  biggestAbandonmentStage: "Visitors to content readers",
  biggestAbandonmentCount: 0,
  biggestAbandonmentRate: 0,
  otpFailures: 0,
  authDropRate: 0,
  formErrorSessions: 0,
  rageClickSessions: 0,
  fieldAbandonmentSessions: 0,
};

let journeyEventsMigrationReady = false;

function parseCount(value: string | number | null | undefined) {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(value ?? "0", 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseFloatValue(value: string | number | null | undefined) {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(value ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function timestampOf(value: Date | number | string | null | undefined) {
  if (value == null) {
    return null;
  }

  const timestamp =
    value instanceof Date ? value.getTime() : new Date(value).getTime();

  return Number.isFinite(timestamp) ? timestamp : null;
}

function minTimestamp(...values: Array<Date | number | string | null | undefined>) {
  const timestamps = values
    .map((value) => timestampOf(value))
    .filter((value): value is number => value != null);

  if (timestamps.length === 0) {
    return null;
  }

  return Math.min(...timestamps);
}

function maxTimestamp(...values: Array<Date | number | string | null | undefined>) {
  const timestamps = values
    .map((value) => timestampOf(value))
    .filter((value): value is number => value != null);

  if (timestamps.length === 0) {
    return null;
  }

  return Math.max(...timestamps);
}

function isoFromTimestamp(value: number | null | undefined) {
  if (value == null) {
    return null;
  }

  return new Date(value).toISOString();
}

function percentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(1));
}

function clampText(value: string | null | undefined, maximum = 2048) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maximum);
}

function sanitizeMetadataValue(
  value: unknown,
  depth = 0
): unknown {
  if (value == null) {
    return null;
  }

  if (depth > 3) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return typeof value === "string" ? value.slice(0, 300) : value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((entry) => sanitizeMetadataValue(entry, depth + 1));
  }

  if (typeof value === "object") {
    const next: Record<string, unknown> = {};

    for (const [key, entry] of Object.entries(value).slice(0, 25)) {
      next[key.slice(0, 80)] = sanitizeMetadataValue(entry, depth + 1);
    }

    return next;
  }

  return String(value).slice(0, 300);
}

function sanitizeMetadata(
  metadata: Record<string, unknown> | null | undefined
) {
  const sanitized = sanitizeMetadataValue(metadata ?? {}) as
    | Record<string, unknown>
    | null;

  return sanitized ?? {};
}

function normalizeSourceLabel(value: string | null | undefined) {
  const raw = value?.trim();

  if (!raw) {
    return "Direct";
  }

  const lower = raw.toLowerCase();

  if (lower.includes("zoho")) {
    return "Zoho CRM";
  }

  if (lower.includes("linkedin")) {
    return "LinkedIn";
  }

  if (
    lower.includes("google") ||
    lower.includes("bing") ||
    lower.includes("duckduckgo") ||
    lower.includes("yahoo") ||
    lower.includes("organic")
  ) {
    return "Organic";
  }

  if (
    lower === "direct" ||
    lower === "unknown" ||
    lower === "direct / unknown"
  ) {
    return "Direct";
  }

  return raw
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function normalizeDeviceLabel(value: string | null | undefined) {
  const lower = value?.trim().toLowerCase();

  if (lower === "desktop") {
    return "Desktop";
  }

  if (lower === "mobile") {
    return "Mobile";
  }

  if (lower === "tablet") {
    return "Tablet";
  }

  return "Unknown";
}

function pagePathFromUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const parsed = value.startsWith("http")
      ? new URL(value)
      : new URL(value, "https://energdive.local");
    const path = `${parsed.pathname}${parsed.search}`.replace(/\/+$/, "") || "/";
    return path;
  } catch {
    return value.split("?")[0] || value;
  }
}

function formatTimelineLabel(
  eventName: JourneyEventName,
  metadata: Record<string, unknown>
) {
  const labels: Record<JourneyEventName, string> = {
    homepage_view: "Homepage",
    article_view: "Article viewed",
    report_view: "Report viewed",
    energclub_page_view: "Energclub page",
    signup_cta_click: "Signup CTA clicked",
    login_cta_click: "Login CTA clicked",
    dashboard_entered: "Dashboard entered",
    article_read: "Article read",
    return_visit: "Returned to site",
    signup_started: "Signup started",
    otp_sent: "OTP sent",
    otp_verified: "OTP verified",
    signup_completed: "Signup completed",
    login_success: "Login success",
    auth_abandoned: "Auth abandoned",
    form_error: "Form error",
    rage_click: "Rage click",
    field_abandonment: "Field abandoned",
  };

  if (eventName === "form_error") {
    const step = typeof metadata.step === "string" ? metadata.step : null;
    return step ? `Form error (${step})` : labels[eventName];
  }

  if (eventName === "field_abandonment") {
    const fieldName =
      typeof metadata.field === "string"
        ? metadata.field
        : typeof metadata.fieldName === "string"
        ? metadata.fieldName
        : null;
    return fieldName ? `Field abandoned (${fieldName})` : labels[eventName];
  }

  return labels[eventName];
}

function formatTimeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildFunnelStages(row: FunnelRow): JourneyFunnelStage[] {
  const stages = [
    { key: "visitors", label: "Visitors", count: parseCount(row.visitors) },
    {
      key: "content_readers",
      label: "Content Readers",
      count: parseCount(row.content_readers),
    },
    {
      key: "signup_clicks",
      label: "Signup Clicks",
      count: parseCount(row.signup_clicks),
    },
    {
      key: "signup_started",
      label: "Signup Started",
      count: parseCount(row.signup_started),
    },
    {
      key: "otp_verified",
      label: "OTP Verified",
      count: parseCount(row.otp_verified),
    },
    {
      key: "signup_completed",
      label: "Signup Completed",
      count: parseCount(row.signup_completed),
    },
    {
      key: "dashboard_users",
      label: "Dashboard Users",
      count: parseCount(row.dashboard_users),
    },
    {
      key: "returning_users",
      label: "Returning Users",
      count: parseCount(row.returning_users),
    },
  ] as const;

  return stages.map((stage, index) => {
    if (index === 0) {
      return {
        ...stage,
        conversionRate: null,
        dropRate: null,
      };
    }

    const previous = stages[index - 1].count;
    const conversionRate = percentage(stage.count, previous);
    const dropRate = Number((100 - conversionRate).toFixed(1));

    return {
      ...stage,
      conversionRate,
      dropRate,
    };
  });
}

function buildDropoffSummary(
  stages: JourneyFunnelStage[],
  row: DropoffRow
): JourneyDropoffSummary {
  const transitions = stages.slice(1).map((stage, index) => {
    const previous = stages[index];
    const loss = Math.max(previous.count - stage.count, 0);
    return {
      label: `${previous.label} to ${stage.label}`,
      loss,
      rate: percentage(loss, previous.count),
    };
  });
  const biggest = transitions.reduce(
    (current, item) => (item.loss > current.loss ? item : current),
    { label: "Visitors to content readers", loss: 0, rate: 0 }
  );
  const signupStarted = stages.find((stage) => stage.key === "signup_started")?.count ?? 0;
  const signupCompleted =
    stages.find((stage) => stage.key === "signup_completed")?.count ?? 0;

  return {
    biggestAbandonmentStage: biggest.label,
    biggestAbandonmentCount: biggest.loss,
    biggestAbandonmentRate: biggest.rate,
    otpFailures: parseCount(row.otp_failures),
    authDropRate: percentage(
      Math.max(signupStarted - signupCompleted, 0),
      signupStarted
    ),
    formErrorSessions: parseCount(row.form_error_sessions),
    rageClickSessions: parseCount(row.rage_click_sessions),
    fieldAbandonmentSessions: parseCount(row.field_abandonment_sessions),
  };
}

function aggregateSources(rows: SourceRow[]) {
  const sourceMap = new Map<
    string,
    { visitors: number; signupCompleted: number; engaged: number; activeUsers: number }
  >();

  rows.forEach((row) => {
    const key = normalizeSourceLabel(row.source);
    const existing = sourceMap.get(key) ?? {
      visitors: 0,
      signupCompleted: 0,
      engaged: 0,
      activeUsers: 0,
    };

    existing.visitors += parseCount(row.visitors);
    existing.signupCompleted += parseCount(row.signup_completed);
    existing.engaged += parseCount(row.engaged);
    existing.activeUsers += parseCount(row.active_users);

    sourceMap.set(key, existing);
  });

  return Array.from(sourceMap.entries())
    .map(([source, value]) => ({
      source,
      visitors: value.visitors,
      signupRate: percentage(value.signupCompleted, value.visitors),
      engagementRate: percentage(value.engaged, value.visitors),
      activeUsers: value.activeUsers,
    }))
    .sort((left, right) => right.visitors - left.visitors)
    .slice(0, 8);
}

function finalizeTimelineSessions(
  query: string | null,
  sessions: JourneyTimelineSession[]
): JourneyTimelineResult {
  const sortedSessions = [...sessions]
    .sort(
      (left, right) =>
        new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime()
    )
    .map((session, index, entries) => {
      const startedAtMs = new Date(session.startedAt).getTime();
      const endedAtMs = new Date(session.endedAt).getTime();
      const previous = index > 0 ? entries[index - 1] : null;

      return {
        ...session,
        events: [...session.events].sort(
          (left, right) =>
            new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()
        ),
        durationSeconds: Math.max(
          Math.round((endedAtMs - startedAtMs) / 1000),
          0
        ),
        gapFromPreviousSeconds: previous
          ? Math.max(
              Math.round(
                (startedAtMs - new Date(previous.endedAt).getTime()) / 1000
              ),
              0
            )
          : null,
      };
    });

  return {
    query,
    sessions: sortedSessions,
    searched: Boolean(query),
  };
}

function buildTimelineResult(
  query: string | null,
  rows: TimelineEventRow[]
): JourneyTimelineResult {
  const sessionsMap = new Map<string, JourneyTimelineSession>();

  rows.forEach((row) => {
    const occurredAt = new Date(row.created_at).toISOString();
    const metadata =
      row.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const displayName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();

    const existing = sessionsMap.get(row.session_id);
    const event: JourneyTimelineEvent = {
      id: row.id,
      occurredAt,
      timeLabel: formatTimeLabel(occurredAt),
      eventName: row.event_name,
      label: formatTimelineLabel(row.event_name, metadata),
      pagePath: pagePathFromUrl(row.page_url),
      source: row.source ? normalizeSourceLabel(row.source) : null,
      visitorId: row.visitor_id,
      sessionId: row.session_id,
      userId: row.user_id,
      clerkId: row.clerk_id,
      email: row.email,
      name: displayName || null,
      metadata,
    };

    if (!existing) {
      sessionsMap.set(row.session_id, {
        sessionId: row.session_id,
        visitorId: row.visitor_id,
        userId: row.user_id,
        clerkId: row.clerk_id,
        email: row.email,
        name: displayName || null,
        device: row.device ? normalizeDeviceLabel(row.device) : null,
        source: row.source ? normalizeSourceLabel(row.source) : null,
        startedAt: occurredAt,
        endedAt: occurredAt,
        durationSeconds: 0,
        gapFromPreviousSeconds: null,
        events: [event],
      });
      return;
    }

    existing.events.push(event);
    existing.endedAt = occurredAt;
  });

  return finalizeTimelineSessions(query, Array.from(sessionsMap.values()));
}

async function safeQuery<T extends QueryResultRow>(
  client: DbClient,
  label: string,
  query: string,
  values: readonly unknown[],
  fallback: T[]
) {
  try {
    const result = await client.query<T>(query, [...values]);
    return result.rows;
  } catch (error) {
    console.error(`[Journey Intelligence] ${label} query failed:`, error);
    return fallback;
  }
}

export function isJourneyEventName(value: string): value is JourneyEventName {
  return (JOURNEY_EVENT_NAMES as readonly string[]).includes(value);
}

export async function ensureJourneyEventsTable() {
  if (journeyEventsMigrationReady) {
    return;
  }

  await withDatabaseClient("journey_events_migration", async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id BIGSERIAL PRIMARY KEY,
        visitor_id VARCHAR(64) NOT NULL,
        session_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(128),
        clerk_id VARCHAR(128),
        event_name VARCHAR(64) NOT NULL,
        page_url TEXT,
        referrer TEXT,
        source VARCHAR(128),
        device VARCHAR(16),
        ip_address INET,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      ALTER TABLE analytics_events
        ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(64),
        ADD COLUMN IF NOT EXISTS session_id VARCHAR(64),
        ADD COLUMN IF NOT EXISTS user_id VARCHAR(128),
        ADD COLUMN IF NOT EXISTS clerk_id VARCHAR(128),
        ADD COLUMN IF NOT EXISTS event_name VARCHAR(64),
        ADD COLUMN IF NOT EXISTS page_url TEXT,
        ADD COLUMN IF NOT EXISTS referrer TEXT,
        ADD COLUMN IF NOT EXISTS source VARCHAR(128),
        ADD COLUMN IF NOT EXISTS device VARCHAR(16),
        ADD COLUMN IF NOT EXISTS ip_address INET,
        ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

      CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at
        ON analytics_events (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_event_name
        ON analytics_events (event_name, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_visitor
        ON analytics_events (visitor_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_session
        ON analytics_events (session_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id
        ON analytics_events (user_id, created_at DESC)
        WHERE user_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_analytics_events_clerk_id
        ON analytics_events (clerk_id, created_at DESC)
        WHERE clerk_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_analytics_events_source
        ON analytics_events (source, created_at DESC)
        WHERE source IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_analytics_events_device
        ON analytics_events (device, created_at DESC)
        WHERE device IS NOT NULL;
    `);
  });

  journeyEventsMigrationReady = true;
}

export async function insertJourneyEvent(event: JourneyEventInsert) {
  const metadata = sanitizeMetadata(event.metadata);

  await withDatabaseClient("journey_event_insert", async (client) => {
    await client.query(
      `
        INSERT INTO analytics_events (
          visitor_id,
          session_id,
          user_id,
          clerk_id,
          event_name,
          page_url,
          referrer,
          source,
          device,
          ip_address,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `,
      [
        clampText(event.visitorId, 64),
        clampText(event.sessionId, 64),
        clampText(event.userId, 128),
        clampText(event.clerkId, 128),
        event.eventName,
        clampText(event.pageUrl),
        clampText(event.referrer),
        clampText(event.source, 128),
        clampText(event.device, 16),
        clampText(event.ipAddress, 64),
        metadata,
      ]
    );

    if (event.userId || event.clerkId || event.source) {
      await client.query(
        `
          UPDATE analytics_events
          SET
            user_id = COALESCE(user_id, $2),
            clerk_id = COALESCE(clerk_id, $3),
            source = COALESCE(source, $4)
          WHERE visitor_id = $1
        `,
        [
          clampText(event.visitorId, 64),
          clampText(event.userId, 128),
          clampText(event.clerkId, 128),
          clampText(event.source, 128),
        ]
      );
    }
  });
}

function buildEmptyJourneyData(query: string | null, note?: string): JourneyIntelligenceData {
  return {
    dataMode: "events",
    generatedAt: new Date().toISOString(),
    windowDays: DEFAULT_WINDOW_DAYS,
    totalEvents: 0,
    trackedVisitors: 0,
    hasEventData: false,
    funnelStages: buildFunnelStages({
      total_events: "0",
      visitors: "0",
      content_readers: "0",
      signup_clicks: "0",
      signup_started: "0",
      otp_verified: "0",
      signup_completed: "0",
      dashboard_users: "0",
      returning_users: "0",
    }),
    dropoff: EMPTY_DROPOFF,
    contentDrivers: [],
    deviceAnalysis: [],
    sourceAnalysis: [],
    timeline: {
      query,
      sessions: [],
      searched: Boolean(query),
    },
    notes: note ? [note] : [],
  };
}

async function getClerkUsersSnapshotSafe() {
  try {
    const snapshot = await getClerkUsersSnapshot();
    return snapshot.users;
  } catch (error) {
    console.error("[Journey Intelligence] Clerk snapshot failed:", error);
    return [];
  }
}

function buildDerivedIdentities(
  users: DerivedUserRow[],
  pendingRows: DerivedPendingRow[],
  clerkUsers: ClerkUserRecord[]
) {
  const identityMap = new Map<string, DerivedIdentity>();
  const clerkById = new Map(clerkUsers.map((user) => [user.id, user]));
  const clerkByEmail = new Map(
    clerkUsers.map((user) => [user.email.trim().toLowerCase(), user])
  );
  const oneDayMs = 24 * 60 * 60 * 1000;

  function getIdentity(email: string) {
    const key = email.trim().toLowerCase();
    const existing = identityMap.get(key);

    if (existing) {
      return existing;
    }

    const next: DerivedIdentity = {
      key,
      email,
      user: null,
      pending: null,
      clerk: null,
      sourceLabel: "Direct",
      name: null,
      createdAtMs: null,
      latestActivityMs: null,
      otpVerifiedAtMs: null,
      signupCompletedAtMs: null,
      dashboardAtMs: null,
      isOtpVerified: false,
      isSignupCompleted: false,
      hasDashboardActivity: false,
      isReturning: false,
      isPendingAuth: false,
    };

    identityMap.set(key, next);
    return next;
  }

  users.forEach((user) => {
    const email = user.email.trim().toLowerCase();

    if (!email) {
      return;
    }

    const identity = getIdentity(email);
    identity.user = user;
  });

  pendingRows.forEach((pending) => {
    const email = pending.email.trim().toLowerCase();

    if (!email) {
      return;
    }

    const identity = getIdentity(email);
    identity.pending = pending;
  });

  identityMap.forEach((identity) => {
    const clerk =
      (identity.user?.clerk_id ? clerkById.get(identity.user.clerk_id) : null) ??
      clerkByEmail.get(identity.email) ??
      null;
    const createdAtMs = minTimestamp(
      identity.pending?.created_at,
      identity.user?.created_at
    );
    const latestActivityMs = maxTimestamp(
      identity.pending?.updated_at,
      identity.user?.updated_at,
      clerk?.lastSignInAt ?? null
    );
    const otpVerifiedAtMs = minTimestamp(
      identity.pending?.verified_at,
      identity.pending?.otp_verified ? identity.pending?.updated_at : null,
      identity.user?.verification_status === "verified"
        ? identity.user?.updated_at
        : null
    );
    const signupCompletedAtMs =
      identity.user?.verification_status === "verified"
        ? maxTimestamp(identity.user.updated_at, identity.user.created_at)
        : null;
    const dashboardAtMs = signupCompletedAtMs
      ? timestampOf(clerk?.lastSignInAt ?? null)
      : null;

    identity.clerk = clerk;
    identity.name =
      [identity.user?.first_name, identity.user?.last_name]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      identity.pending?.name?.trim() ||
      null;
    identity.sourceLabel = normalizeSourceLabel(
      identity.user?.utm_source ||
        identity.user?.source ||
        identity.user?.data_source ||
        identity.pending?.utm_source ||
        identity.pending?.source
    );
    identity.createdAtMs = createdAtMs;
    identity.latestActivityMs = latestActivityMs ?? createdAtMs;
    identity.otpVerifiedAtMs = otpVerifiedAtMs;
    identity.signupCompletedAtMs = signupCompletedAtMs;
    identity.dashboardAtMs = dashboardAtMs;
    identity.isOtpVerified = otpVerifiedAtMs != null;
    identity.isSignupCompleted = signupCompletedAtMs != null;
    identity.hasDashboardActivity = dashboardAtMs != null;
    identity.isReturning = Boolean(
      dashboardAtMs &&
        createdAtMs &&
        dashboardAtMs - createdAtMs > oneDayMs
    );
    identity.isPendingAuth = Boolean(
      !identity.isOtpVerified &&
        ((identity.pending?.verification_status === "pending") ||
          identity.user?.verification_status === "pending_verification")
    );
  });

  return Array.from(identityMap.values());
}

function buildDerivedSourceAnalysis(identities: DerivedIdentity[]) {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const groups = new Map<
    string,
    {
      visitors: number;
      signupCompleted: number;
      engaged: number;
      activeUsers: number;
    }
  >();

  identities.forEach((identity) => {
    const key = identity.sourceLabel;
    const existing = groups.get(key) ?? {
      visitors: 0,
      signupCompleted: 0,
      engaged: 0,
      activeUsers: 0,
    };

    existing.visitors += 1;

    if (identity.isSignupCompleted) {
      existing.signupCompleted += 1;
    }

    if (identity.isOtpVerified || identity.hasDashboardActivity) {
      existing.engaged += 1;
    }

    if ((identity.clerk?.lastSignInAt ?? 0) >= thirtyDaysAgo) {
      existing.activeUsers += 1;
    }

    groups.set(key, existing);
  });

  return Array.from(groups.entries())
    .map(([source, value]) => ({
      source,
      visitors: value.visitors,
      signupRate: percentage(value.signupCompleted, value.visitors),
      engagementRate: percentage(value.engaged, value.visitors),
      activeUsers: value.activeUsers,
    }))
    .sort((left, right) => right.visitors - left.visitors)
    .slice(0, 8);
}

function buildDerivedTimelineResult(
  query: string | null,
  identities: DerivedIdentity[]
) {
  const normalizedQuery = query?.trim().toLowerCase() ?? "";
  const matchedIdentities = identities
    .filter((identity) => {
      if (!normalizedQuery) {
        return true;
      }

      return [
        identity.email,
        identity.key,
        identity.name,
        identity.user?.id,
        identity.user?.clerk_id,
        identity.pending?.id,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery));
    })
    .sort(
      (left, right) =>
        (right.latestActivityMs ?? 0) - (left.latestActivityMs ?? 0)
    )
    .slice(0, DEFAULT_TIMELINE_SESSION_LIMIT);

  const sessions: JourneyTimelineSession[] = [];
  let syntheticId = 1;

  matchedIdentities.forEach((identity) => {
    const authEvents: JourneyTimelineEvent[] = [];
    const authStartMs = identity.createdAtMs;

    function pushEvent(
      target: JourneyTimelineEvent[],
      eventName: JourneyEventName,
      atMs: number | null,
      metadata: Record<string, unknown> = {}
    ) {
      const occurredAt = isoFromTimestamp(atMs);

      if (!occurredAt) {
        return;
      }

      target.push({
        id: syntheticId++,
        occurredAt,
        timeLabel: formatTimeLabel(occurredAt),
        eventName,
        label: formatTimelineLabel(eventName, metadata),
        pagePath: null,
        source: identity.sourceLabel,
        visitorId: identity.key,
        sessionId: "",
        userId: identity.user?.id ?? identity.pending?.user_id ?? null,
        clerkId: identity.user?.clerk_id ?? null,
        email: identity.email,
        name: identity.name,
        metadata,
      });
    }

    pushEvent(authEvents, "signup_started", authStartMs, {
      derived: true,
      source: "existing_signup_records",
    });
    pushEvent(authEvents, "otp_verified", identity.otpVerifiedAtMs, {
      derived: true,
    });
    pushEvent(authEvents, "signup_completed", identity.signupCompletedAtMs, {
      derived: true,
    });

    if (!identity.isSignupCompleted && identity.latestActivityMs) {
      pushEvent(authEvents, "auth_abandoned", identity.latestActivityMs, {
        derived: true,
        reason: "Pending verification",
      });
    }

    if (authEvents.length > 0) {
      const sessionId = `derived-auth-${identity.key}`;
      authEvents.forEach((event) => {
        event.sessionId = sessionId;
      });

      sessions.push({
        sessionId,
        visitorId: identity.key,
        userId: identity.user?.id ?? identity.pending?.user_id ?? null,
        clerkId: identity.user?.clerk_id ?? null,
        email: identity.email,
        name: identity.name,
        device: null,
        source: identity.sourceLabel,
        startedAt: authEvents[0].occurredAt,
        endedAt: authEvents[authEvents.length - 1].occurredAt,
        durationSeconds: 0,
        gapFromPreviousSeconds: null,
        events: authEvents,
      });
    }

    if (identity.dashboardAtMs) {
      const dashboardEvents: JourneyTimelineEvent[] = [];

      if (identity.isReturning) {
        pushEvent(
          dashboardEvents,
          "return_visit",
          identity.dashboardAtMs - 60_000,
          {
            derived: true,
          }
        );
      }

      pushEvent(dashboardEvents, "dashboard_entered", identity.dashboardAtMs, {
        derived: true,
      });

      const sessionId = `derived-dashboard-${identity.key}`;
      dashboardEvents.forEach((event) => {
        event.sessionId = sessionId;
      });

      sessions.push({
        sessionId,
        visitorId: identity.key,
        userId: identity.user?.id ?? identity.pending?.user_id ?? null,
        clerkId: identity.user?.clerk_id ?? null,
        email: identity.email,
        name: identity.name,
        device: null,
        source: identity.sourceLabel,
        startedAt: dashboardEvents[0].occurredAt,
        endedAt: dashboardEvents[dashboardEvents.length - 1].occurredAt,
        durationSeconds: 0,
        gapFromPreviousSeconds: null,
        events: dashboardEvents,
      });
    }
  });

  return finalizeTimelineSessions(query, sessions);
}

async function getDerivedJourneyIntelligenceData(
  client: DbClient,
  query: string | null
): Promise<JourneyIntelligenceData> {
  const [users, pendingRows, clerkUsers] = await Promise.all([
    safeQuery<DerivedUserRow>(
      client,
      "derived_users",
      `
        SELECT
          CAST(id AS text) AS id,
          clerk_id,
          email,
          first_name,
          last_name,
          source,
          data_source,
          utm_source,
          verification_status,
          created_at,
          updated_at,
          COALESCE(reminder_email_count, 0) AS reminder_email_count
        FROM users
        WHERE COALESCE(updated_at, created_at) >= NOW() - ($1 * INTERVAL '1 day')
      `,
      [DEFAULT_WINDOW_DAYS],
      []
    ),
    safeQuery<DerivedPendingRow>(
      client,
      "derived_pending",
      `
        SELECT
          CAST(id AS text) AS id,
          email,
          name,
          source,
          utm_source,
          verification_status,
          otp_verified,
          verified_at,
          created_at,
          updated_at,
          CAST(user_id AS text) AS user_id
        FROM pending_verifications
        WHERE COALESCE(updated_at, created_at) >= NOW() - ($1 * INTERVAL '1 day')
      `,
      [DEFAULT_WINDOW_DAYS],
      []
    ),
    getClerkUsersSnapshotSafe(),
  ]);

  const identities = buildDerivedIdentities(users, pendingRows, clerkUsers);
  const visitors = identities.length;
  const otpVerified = identities.filter((identity) => identity.isOtpVerified).length;
  const signupCompleted = identities.filter(
    (identity) => identity.isSignupCompleted
  ).length;
  const dashboardUsers = identities.filter(
    (identity) => identity.hasDashboardActivity
  ).length;
  const returningUsers = identities.filter((identity) => identity.isReturning).length;
  const otpUnresolved = identities.filter((identity) => identity.isPendingAuth).length;
  const reminderLoopUsers = identities.filter(
    (identity) => (identity.user?.reminder_email_count ?? 0) > 0
  ).length;

  const funnelStages = buildFunnelStages({
    total_events: "0",
    visitors: String(visitors),
    content_readers: String(visitors),
    signup_clicks: String(visitors),
    signup_started: String(visitors),
    otp_verified: String(otpVerified),
    signup_completed: String(signupCompleted),
    dashboard_users: String(Math.min(dashboardUsers, signupCompleted)),
    returning_users: String(Math.min(returningUsers, dashboardUsers, signupCompleted)),
  });

  return {
    dataMode: "derived",
    generatedAt: new Date().toISOString(),
    windowDays: DEFAULT_WINDOW_DAYS,
    totalEvents: 0,
    trackedVisitors: visitors,
    hasEventData: false,
    funnelStages,
    dropoff: buildDropoffSummary(funnelStages, {
      otp_failures: String(otpUnresolved),
      form_error_sessions: String(Math.max(otpUnresolved, reminderLoopUsers)),
      rage_click_sessions: "0",
      field_abandonment_sessions: "0",
    }),
    contentDrivers: [],
    deviceAnalysis: [],
    sourceAnalysis: buildDerivedSourceAnalysis(identities),
    timeline: buildDerivedTimelineResult(query, identities),
    notes: [
      "Showing fallback analytics from existing signup, verification, and Clerk sign-in records because custom website events have not been captured yet.",
      "Pre-signup browsing, content attribution, device split, and behavior signals will become precise once frontend event tracking is wired.",
    ],
  };
}

export async function getJourneyIntelligenceData(
  query: string | null
): Promise<JourneyIntelligenceData> {
  try {
    await ensureJourneyEventsTable();

    return await withDatabaseClient("journey_intelligence", async (client) => {
      const notes: string[] = [];

      const funnelRows = await safeQuery<FunnelRow>(
        client,
        "funnel",
        `
          WITH windowed AS (
            SELECT *
            FROM analytics_events
            WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
          ),
          returning_visitors AS (
            SELECT visitor_id
            FROM windowed
            WHERE visitor_id IS NOT NULL
            GROUP BY visitor_id
            HAVING COUNT(DISTINCT session_id) > 1
               OR BOOL_OR(event_name = 'return_visit')
          )
          SELECT
            COUNT(*)::text AS total_events,
            COUNT(DISTINCT visitor_id)::text AS visitors,
            COUNT(DISTINCT CASE
              WHEN event_name IN ('article_view', 'article_read', 'report_view')
              THEN visitor_id
            END)::text AS content_readers,
            COUNT(DISTINCT CASE
              WHEN event_name = 'signup_cta_click'
              THEN visitor_id
            END)::text AS signup_clicks,
            COUNT(DISTINCT CASE
              WHEN event_name = 'signup_started'
              THEN visitor_id
            END)::text AS signup_started,
            COUNT(DISTINCT CASE
              WHEN event_name = 'otp_verified'
              THEN visitor_id
            END)::text AS otp_verified,
            COUNT(DISTINCT CASE
              WHEN event_name = 'signup_completed'
              THEN visitor_id
            END)::text AS signup_completed,
            COUNT(DISTINCT CASE
              WHEN event_name = 'dashboard_entered'
              THEN visitor_id
            END)::text AS dashboard_users,
            (SELECT COUNT(*)::text FROM returning_visitors) AS returning_users
          FROM windowed
        `,
        [DEFAULT_WINDOW_DAYS],
        [
          {
            total_events: "0",
            visitors: "0",
            content_readers: "0",
            signup_clicks: "0",
            signup_started: "0",
            otp_verified: "0",
            signup_completed: "0",
            dashboard_users: "0",
            returning_users: "0",
          },
        ]
      );

      const dropoffRows = await safeQuery<DropoffRow>(
        client,
        "dropoff",
        `
          WITH windowed AS (
            SELECT *
            FROM analytics_events
            WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
          )
          SELECT
            COUNT(DISTINCT CASE
              WHEN event_name = 'form_error'
                AND LOWER(COALESCE(metadata->>'step', '')) = 'otp'
              THEN session_id
            END)::text AS otp_failures,
            COUNT(DISTINCT CASE
              WHEN event_name = 'form_error'
              THEN session_id
            END)::text AS form_error_sessions,
            COUNT(DISTINCT CASE
              WHEN event_name = 'rage_click'
              THEN session_id
            END)::text AS rage_click_sessions,
            COUNT(DISTINCT CASE
              WHEN event_name = 'field_abandonment'
              THEN session_id
            END)::text AS field_abandonment_sessions
          FROM windowed
        `,
        [DEFAULT_WINDOW_DAYS],
        [
          {
            otp_failures: "0",
            form_error_sessions: "0",
            rage_click_sessions: "0",
            field_abandonment_sessions: "0",
          },
        ]
      );

      const contentRows = await safeQuery<ContentRow>(
        client,
        "content_drivers",
        `
          WITH windowed AS (
            SELECT *
            FROM analytics_events
            WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
          ),
          content_reads AS (
            SELECT
              COALESCE(
                NULLIF(metadata->>'content_slug', ''),
                NULLIF(metadata->>'slug', ''),
                NULLIF(page_url, ''),
                CONCAT('content-', id::text)
              ) AS content_key,
              COALESCE(
                NULLIF(metadata->>'content_title', ''),
                NULLIF(metadata->>'title', ''),
                NULLIF(page_url, ''),
                'Untitled content'
              ) AS content_label,
              COALESCE(
                NULLIF(metadata->>'content_type', ''),
                CASE
                  WHEN event_name = 'report_view' THEN 'Report'
                  ELSE 'Article'
                END
              ) AS content_type,
              page_url,
              visitor_id,
              created_at
            FROM windowed
            WHERE event_name IN ('article_view', 'article_read', 'report_view')
          ),
          content_summary AS (
            SELECT
              content_key,
              MAX(content_label) AS content_label,
              MAX(content_type) AS content_type,
              MAX(page_url) AS page_url,
              COUNT(DISTINCT visitor_id)::text AS readers
            FROM content_reads
            GROUP BY content_key
          ),
          first_signup AS (
            SELECT visitor_id, MIN(created_at) AS signup_started_at
            FROM windowed
            WHERE event_name = 'signup_started'
            GROUP BY visitor_id
          ),
          first_completion AS (
            SELECT visitor_id, MIN(created_at) AS signup_completed_at
            FROM windowed
            WHERE event_name = 'signup_completed'
            GROUP BY visitor_id
          ),
          first_dashboard AS (
            SELECT visitor_id, MIN(created_at) AS dashboard_entered_at
            FROM windowed
            WHERE event_name = 'dashboard_entered'
            GROUP BY visitor_id
          ),
          attributed_content AS (
            SELECT DISTINCT ON (fs.visitor_id)
              fs.visitor_id,
              cr.content_key,
              cr.created_at AS touched_at,
              fs.signup_started_at
            FROM first_signup fs
            JOIN content_reads cr
              ON cr.visitor_id = fs.visitor_id
             AND cr.created_at <= fs.signup_started_at
             AND cr.created_at >= fs.signup_started_at - INTERVAL '7 days'
            ORDER BY fs.visitor_id, cr.created_at DESC
          ),
          conversion_summary AS (
            SELECT
              ac.content_key,
              COUNT(*)::text AS signup_started,
              COUNT(*) FILTER (
                WHERE fc.signup_completed_at IS NOT NULL
                  AND fc.signup_completed_at >= ac.signup_started_at
              )::text AS signup_completed,
              COUNT(*) FILTER (
                WHERE fd.dashboard_entered_at IS NOT NULL
                  AND fd.dashboard_entered_at >= COALESCE(fc.signup_completed_at, ac.signup_started_at)
              )::text AS activated_users
            FROM attributed_content ac
            LEFT JOIN first_completion fc
              ON fc.visitor_id = ac.visitor_id
            LEFT JOIN first_dashboard fd
              ON fd.visitor_id = ac.visitor_id
            GROUP BY ac.content_key
          )
          SELECT
            cs.content_key,
            cs.content_label,
            cs.content_type,
            cs.page_url,
            cs.readers,
            COALESCE(cv.signup_started, '0') AS signup_started,
            COALESCE(cv.signup_completed, '0') AS signup_completed,
            COALESCE(cv.activated_users, '0') AS activated_users
          FROM content_summary cs
          LEFT JOIN conversion_summary cv
            ON cv.content_key = cs.content_key
          ORDER BY
            COALESCE(NULLIF(cv.signup_completed, '0')::int, 0) DESC,
            COALESCE(NULLIF(cv.signup_started, '0')::int, 0) DESC,
            cs.readers::int DESC
          LIMIT 6
        `,
        [DEFAULT_WINDOW_DAYS],
        []
      );

      const deviceRows = await safeQuery<DeviceRow>(
        client,
        "device_analysis",
        `
          WITH windowed AS (
            SELECT *
            FROM analytics_events
            WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
          ),
          session_rollup AS (
            SELECT
              session_id,
              MIN(visitor_id) AS visitor_id,
              COALESCE(NULLIF(MAX(device), ''), 'unknown') AS device,
              MIN(created_at) AS started_at,
              MAX(created_at) AS ended_at,
              MAX(CASE WHEN event_name = 'signup_started' THEN 1 ELSE 0 END) AS signup_started,
              MAX(CASE WHEN event_name = 'signup_completed' THEN 1 ELSE 0 END) AS signup_completed,
              MAX(CASE WHEN event_name = 'dashboard_entered' THEN 1 ELSE 0 END) AS dashboard_users
            FROM windowed
            GROUP BY session_id
          )
          SELECT
            device,
            COUNT(DISTINCT visitor_id)::text AS visitors,
            COUNT(*)::text AS sessions,
            SUM(signup_started)::text AS signup_started,
            SUM(signup_completed)::text AS signup_completed,
            SUM(dashboard_users)::text AS dashboard_users,
            AVG(EXTRACT(EPOCH FROM (ended_at - started_at)))::text AS avg_duration_seconds
          FROM session_rollup
          GROUP BY device
          ORDER BY COUNT(*) DESC
        `,
        [DEFAULT_WINDOW_DAYS],
        []
      );

      const sourceRows = await safeQuery<SourceRow>(
        client,
        "source_analysis",
        `
          WITH windowed AS (
            SELECT *
            FROM analytics_events
            WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
          ),
          enriched AS (
            SELECT
              e.visitor_id,
              e.event_name,
              COALESCE(
                NULLIF(e.source, ''),
                NULLIF(e.metadata->>'source', ''),
                NULLIF(u_id.source, ''),
                NULLIF(u_id.utm_source, ''),
                NULLIF(u_id.data_source, ''),
                NULLIF(u_clerk.source, ''),
                NULLIF(u_clerk.utm_source, ''),
                NULLIF(u_clerk.data_source, ''),
                'Direct'
              ) AS source
            FROM windowed e
            LEFT JOIN users u_id
              ON e.user_id IS NOT NULL
             AND CAST(u_id.id AS text) = e.user_id
            LEFT JOIN users u_clerk
              ON e.clerk_id IS NOT NULL
             AND u_clerk.clerk_id = e.clerk_id
          )
          SELECT
            source,
            COUNT(DISTINCT visitor_id)::text AS visitors,
            COUNT(DISTINCT CASE
              WHEN event_name = 'signup_completed'
              THEN visitor_id
            END)::text AS signup_completed,
            COUNT(DISTINCT CASE
              WHEN event_name IN ('article_view', 'article_read', 'report_view', 'dashboard_entered')
              THEN visitor_id
            END)::text AS engaged,
            COUNT(DISTINCT CASE
              WHEN event_name = 'dashboard_entered'
              THEN visitor_id
            END)::text AS active_users
          FROM enriched
          GROUP BY source
          ORDER BY COUNT(DISTINCT visitor_id) DESC
          LIMIT 12
        `,
        [DEFAULT_WINDOW_DAYS],
        []
      );

      const timelineLike = query ? `%${query.trim()}%` : "";
      const timelineSessionRows = await safeQuery<TimelineSessionIdRow>(
        client,
        "timeline_session_ids",
        `
          WITH matching_sessions AS (
            SELECT
              e.session_id,
              MAX(e.created_at) AS last_seen_at
            FROM analytics_events e
            LEFT JOIN users u_id
              ON e.user_id IS NOT NULL
             AND CAST(u_id.id AS text) = e.user_id
            LEFT JOIN users u_clerk
              ON e.clerk_id IS NOT NULL
             AND u_clerk.clerk_id = e.clerk_id
            WHERE
              $1 = ''
              OR e.session_id ILIKE $2
              OR e.visitor_id ILIKE $2
              OR COALESCE(e.user_id, '') ILIKE $2
              OR COALESCE(e.clerk_id, '') ILIKE $2
              OR COALESCE(u_id.email, u_clerk.email, '') ILIKE $2
              OR TRIM(COALESCE(u_id.first_name, u_clerk.first_name, '') || ' ' || COALESCE(u_id.last_name, u_clerk.last_name, '')) ILIKE $2
            GROUP BY e.session_id
          )
          SELECT session_id
          FROM matching_sessions
          ORDER BY last_seen_at DESC
          LIMIT $3
        `,
        [query?.trim() ?? "", timelineLike, DEFAULT_TIMELINE_SESSION_LIMIT],
        []
      );

      const sessionIds = timelineSessionRows.map((row) => row.session_id);

      const timelineRows =
        sessionIds.length > 0
          ? await safeQuery<TimelineEventRow>(
              client,
              "timeline_events",
              `
                SELECT
                  e.id,
                  e.session_id,
                  e.visitor_id,
                  e.user_id,
                  e.clerk_id,
                  e.event_name,
                  e.page_url,
                  e.source,
                  e.device,
                  e.metadata,
                  e.created_at,
                  COALESCE(u_id.email, u_clerk.email) AS email,
                  COALESCE(u_id.first_name, u_clerk.first_name) AS first_name,
                  COALESCE(u_id.last_name, u_clerk.last_name) AS last_name
                FROM analytics_events e
                LEFT JOIN users u_id
                  ON e.user_id IS NOT NULL
                 AND CAST(u_id.id AS text) = e.user_id
                LEFT JOIN users u_clerk
                  ON e.clerk_id IS NOT NULL
                 AND u_clerk.clerk_id = e.clerk_id
                WHERE e.session_id = ANY($1::text[])
                ORDER BY e.created_at ASC, e.id ASC
              `,
              [sessionIds],
              []
            )
          : [];

      const funnelRow = funnelRows[0];
      const funnelStages = buildFunnelStages(funnelRow);
      const totalEvents = parseCount(funnelRow.total_events);
      const trackedVisitors = parseCount(funnelRow.visitors);

      if (totalEvents === 0) {
        return getDerivedJourneyIntelligenceData(client, query);
      }

      if (query && timelineRows.length === 0) {
        notes.push(
          "No tracked session matched the current search. Try an email, visitor ID, session ID, database user ID, or Clerk ID."
        );
      }

      return {
        dataMode: "events",
        generatedAt: new Date().toISOString(),
        windowDays: DEFAULT_WINDOW_DAYS,
        totalEvents,
        trackedVisitors,
        hasEventData: totalEvents > 0,
        funnelStages,
        dropoff: buildDropoffSummary(
          funnelStages,
          dropoffRows[0] ?? {
            otp_failures: "0",
            form_error_sessions: "0",
            rage_click_sessions: "0",
            field_abandonment_sessions: "0",
          }
        ),
        contentDrivers: contentRows.map((row) => ({
          key: row.content_key,
          label: row.content_label,
          contentType: row.content_type,
          pagePath: pagePathFromUrl(row.page_url),
          readers: parseCount(row.readers),
          signupStarted: parseCount(row.signup_started),
          signupCompleted: parseCount(row.signup_completed),
          activatedUsers: parseCount(row.activated_users),
        })),
        deviceAnalysis: deviceRows.map((row) => {
          const visitors = parseCount(row.visitors);
          const signupStarted = parseCount(row.signup_started);
          const signupCompleted = parseCount(row.signup_completed);

          return {
            device: normalizeDeviceLabel(row.device),
            visitors,
            sessions: parseCount(row.sessions),
            signupRate: percentage(signupStarted, visitors),
            completionRate: percentage(signupCompleted, visitors),
            dropOffRate: percentage(
              Math.max(signupStarted - signupCompleted, 0),
              signupStarted
            ),
            avgSessionDurationSeconds: Math.round(
              parseFloatValue(row.avg_duration_seconds)
            ),
          };
        }),
        sourceAnalysis: aggregateSources(sourceRows),
        timeline: buildTimelineResult(query, timelineRows),
        notes,
      };
    });
  } catch (error) {
    if (isDbUnavailableError(error)) {
      return buildEmptyJourneyData(
        query,
        `Journey Intelligence is unavailable because the database could not be reached: ${error.message}`
      );
    }

    throw error;
  }
}
