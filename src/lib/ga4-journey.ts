import { BetaAnalyticsDataClient, type protos } from "@google-analytics/data";
import { getClerkUsersSnapshot } from "@/lib/clerk-users";
import { withDatabaseClient } from "@/lib/db";
import type {
  JourneyContentDriverRow,
  JourneyDeviceRow,
  JourneyDropoffSummary,
  JourneyFunnelStage,
  JourneyGa4TimelineResult,
  JourneyIntelligenceData,
  JourneyLabeledShareRow,
  JourneyPageDrilldown,
  JourneyPageDrilldownFlowRow,
  JourneyPageInsightRow,
  JourneyPortalFlowRow,
  JourneyPortalInsights,
  JourneySourceRow,
} from "@/lib/journey-intelligence";

type ReportRequest = protos.google.analytics.data.v1beta.IRunReportRequest;
type ReportResponse = protos.google.analytics.data.v1beta.IRunReportResponse;
type ReportRow = protos.google.analytics.data.v1beta.IRow | null | undefined;
type FilterExpression = protos.google.analytics.data.v1beta.IFilterExpression;

const DEFAULT_WINDOW_DAYS = 90;
const BATCH_LIMIT = 5;
const REPORT_PAGE_SIZE = 2500;
const HOMEPAGE_REGEX = "^(?:/|/home/?|/homepage/?)$";
const CONTENT_PATH_REGEX =
  ".*(?:article|articles|report|reports|insight|insights|blog|news|resource|resources|energclub).*";
const CONTENT_TITLE_REGEX =
  ".*(?:article|report|insight|brief|analysis|energclub|market intelligence).*";
const SIGNUP_ENTRY_REGEX = ".*(?:auth|signup|sign-up|register|join|apply|start).*";
const AUTH_FLOW_REGEX = ".*(?:auth|signup|sign-up|register|join|verify|verification|otp|onboard).*";
const OTP_REGEX = ".*(?:otp|verify|verification).*";
const SIGNUP_SUCCESS_REGEX = ".*(?:success|welcome|complete|thank-you|thankyou).*";
const DASHBOARD_REGEX = ".*(?:dashboard|portal|console).*";
const INTERNAL_REFERRER_FALLBACK_REGEX = "^https?://[^/]+(?:/.*)?$";
const RETURNING_LABEL = "returning";

const STEP_EVENT_NAMES = {
  homepage: ["homepage_view"],
  content: ["article_view", "article_read", "report_view", "energclub_page_view"],
  signupClick: ["signup_cta_click", "login_cta_click", "signup_click", "sign_up_click"],
  signupStart: ["signup_started", "begin_sign_up", "begin_signup", "registration_started"],
  otpVerified: ["otp_verified", "otp_success", "verification_success"],
  signupCompleted: ["signup_completed", "sign_up", "registration_completed"],
  dashboard: ["dashboard_entered", "login_success"],
  behavior: ["form_error", "rage_click", "field_abandonment", "auth_abandoned"],
} as const;

export interface Ga4JourneyCredentials {
  type: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

export interface BuildGa4JourneyInput {
  propertyId: string;
  credentials: Ga4JourneyCredentials;
  query?: string | null;
  pageQuery?: string | null;
  windowDays?: number;
  startDate?: string | null;
  endDate?: string | null;
  rangePreset?: string | null;
}

interface ContentTransitionTotals {
  signupStarted: number;
  signupCompleted: number;
  activatedUsers: number;
}

interface ResolvedPageCandidate {
  pagePath: string;
  pageTitle: string;
  views: number;
  dropoffRate: number;
}

function getTodayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function shiftIsoDate(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function metricValue(row: ReportRow, index: number) {
  return Number.parseFloat(row?.metricValues?.[index]?.value ?? "0") || 0;
}

function dimensionValue(row: ReportRow, index: number) {
  return row?.dimensionValues?.[index]?.value?.trim() ?? "";
}

function exactFilter(fieldName: string, value: string): FilterExpression {
  return {
    filter: {
      fieldName,
      stringFilter: {
        matchType: "EXACT",
        value,
      },
    },
  };
}

function regexFilter(fieldName: string, value: string): FilterExpression {
  return {
    filter: {
      fieldName,
      stringFilter: {
        matchType: "FULL_REGEXP",
        value,
        caseSensitive: false,
      },
    },
  };
}

function containsFilter(fieldName: string, value: string): FilterExpression {
  return {
    filter: {
      fieldName,
      stringFilter: {
        matchType: "CONTAINS",
        value,
        caseSensitive: false,
      },
    },
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function andFilters(...filters: Array<FilterExpression | undefined>): FilterExpression | undefined {
  const expressions = filters.filter(
    (filter): filter is FilterExpression => Boolean(filter)
  );

  if (expressions.length === 0) {
    return undefined;
  }

  if (expressions.length === 1) {
    return expressions[0];
  }

  return {
    andGroup: {
      expressions,
    },
  };
}

function orFilters(...filters: Array<FilterExpression | undefined>): FilterExpression | undefined {
  const expressions = filters.filter(
    (filter): filter is FilterExpression => Boolean(filter)
  );

  if (expressions.length === 0) {
    return undefined;
  }

  if (expressions.length === 1) {
    return expressions[0];
  }

  return {
    orGroup: {
      expressions,
    },
  };
}

function buildPagePathFilter(regex: string) {
  return andFilters(regexFilter("pagePath", regex), exactFilter("eventName", "page_view"));
}

function currentPageFilter(path: string) {
  return exactFilter("pagePath", path);
}

function pageViewPathFilter(path: string) {
  return andFilters(exactFilter("pagePath", path), exactFilter("eventName", "page_view"));
}

function buildPageTitleFilter(regex: string) {
  return andFilters(regexFilter("pageTitle", regex), exactFilter("eventName", "page_view"));
}

function selectedPageReferrerRegex(path: string, hostnames: string[]) {
  const escapedPath = escapeRegex(path);
  const hostPart =
    hostnames.length > 0
      ? `(?:${hostnames.map((hostname) => escapeRegex(hostname)).join("|")})`
      : "[^/]+";
  const normalizedPath = path === "/" ? "/" : escapedPath;
  return `https?://${hostPart}${normalizedPath}(?:\\?.*)?$`;
}

function landingPageRegex(path: string) {
  const escapedPath = escapeRegex(path);
  return `^${path === "/" ? "/" : escapedPath}(?:\\?.*)?$`;
}

function buildEventNamesFilter(eventNames: readonly string[]) {
  return orFilters(...eventNames.map((eventName) => exactFilter("eventName", eventName)));
}

function buildJourneyActivityFilter() {
  return orFilters(
    buildPagePathFilter(HOMEPAGE_REGEX),
    buildPagePathFilter(CONTENT_PATH_REGEX),
    buildPageTitleFilter(CONTENT_TITLE_REGEX),
    buildPagePathFilter(AUTH_FLOW_REGEX),
    buildPagePathFilter(DASHBOARD_REGEX),
    buildEventNamesFilter(STEP_EVENT_NAMES.homepage),
    buildEventNamesFilter(STEP_EVENT_NAMES.content),
    buildEventNamesFilter(STEP_EVENT_NAMES.signupClick),
    buildEventNamesFilter(STEP_EVENT_NAMES.signupStart),
    buildEventNamesFilter(STEP_EVENT_NAMES.otpVerified),
    buildEventNamesFilter(STEP_EVENT_NAMES.signupCompleted),
    buildEventNamesFilter(STEP_EVENT_NAMES.dashboard)
  );
}

function buildTimelineSearchFilter(query: string | null | undefined) {
  const trimmed = query?.trim();

  if (!trimmed) {
    return undefined;
  }

  return orFilters(
    containsFilter("pagePath", trimmed),
    containsFilter("pageTitle", trimmed),
    containsFilter("sessionSource", trimmed),
    containsFilter("eventName", trimmed)
  );
}

function readWindowDays(value?: number) {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_WINDOW_DAYS;
  }

  return Math.min(Math.max(Math.floor(value), 7), 365);
}

function currentDateRange(windowDays: number) {
  const end = getTodayIso();
  const start = shiftIsoDate(end, -(windowDays - 1));
  return { startDate: start, endDate: end };
}

function isIsoDate(value: string | null | undefined) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function diffDaysInclusive(startDate: string, endDate: string) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.max(Math.round((end.getTime() - start.getTime()) / 86400000) + 1, 1);
}

async function fetchAllTimeStart(client: BetaAnalyticsDataClient, property: string) {
  const response = await runReport(client, {
    property,
    dateRanges: [{ startDate: "2015-08-14", endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "screenPageViews" }],
    orderBys: [{ dimension: { dimensionName: "date" }, desc: false }],
    limit: 1,
  });

  const firstDate = dimensionValue(response.rows?.[0], 0);

  if (/^\d{8}$/.test(firstDate)) {
    return `${firstDate.slice(0, 4)}-${firstDate.slice(4, 6)}-${firstDate.slice(6, 8)}`;
  }

  return currentDateRange(DEFAULT_WINDOW_DAYS).startDate;
}

async function resolveDateRange(
  client: BetaAnalyticsDataClient,
  property: string,
  input: BuildGa4JourneyInput
) {
  const startDate = isIsoDate(input.startDate) ? input.startDate : null;
  const endDate = isIsoDate(input.endDate) ? input.endDate : null;

  if (input.rangePreset === "all") {
    const allTimeStart = await fetchAllTimeStart(client, property);
    const today = getTodayIso();

    return {
      startDate: allTimeStart,
      endDate: today,
      windowDays: diffDaysInclusive(allTimeStart, today),
    };
  }

  if (input.rangePreset === "today") {
    const today = getTodayIso();
    return {
      startDate: today,
      endDate: today,
      windowDays: 1,
    };
  }

  if (input.rangePreset === "7d") {
    const today = getTodayIso();
    return {
      startDate: shiftIsoDate(today, -6),
      endDate: today,
      windowDays: 7,
    };
  }

  if (input.rangePreset === "30d") {
    const today = getTodayIso();
    return {
      startDate: shiftIsoDate(today, -29),
      endDate: today,
      windowDays: 30,
    };
  }

  if (input.rangePreset === "90d") {
    const today = getTodayIso();
    return {
      startDate: shiftIsoDate(today, -89),
      endDate: today,
      windowDays: 90,
    };
  }

  if (startDate && endDate) {
    if (new Date(`${startDate}T00:00:00`) > new Date(`${endDate}T00:00:00`)) {
      throw new Error("Start date cannot be later than end date.");
    }

    return {
      startDate,
      endDate,
      windowDays: diffDaysInclusive(startDate, endDate),
    };
  }

  const windowDays = readWindowDays(input.windowDays);
  return {
    ...currentDateRange(windowDays),
    windowDays,
  };
}

function roundPercent(value: number) {
  return Math.round(value * 10) / 10;
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) {
    return 0;
  }

  return roundPercent((numerator / denominator) * 100);
}

function normalizeDevice(device: string) {
  const value = device.trim().toLowerCase();

  if (!value) {
    return "Desktop";
  }

  if (value === "mobile") {
    return "Mobile";
  }

  if (value === "tablet") {
    return "Tablet";
  }

  if (value === "desktop") {
    return "Desktop";
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function normalizePath(value: string) {
  if (!value) {
    return "";
  }

  if (value.startsWith("/")) {
    return value;
  }

  try {
    const parsed = new URL(value);
    return parsed.pathname || "/";
  } catch {
    return value;
  }
}

function normalizeReferrer(referrer: string, hostnames: string[]) {
  if (!referrer || referrer === "(direct)" || referrer === "(not set)") {
    return "Direct / none";
  }

  try {
    const url = new URL(referrer);
    const isInternal = hostnames.includes(url.hostname);

    if (isInternal) {
      return `${url.pathname || "/"}${url.search || ""}`;
    }

    return `${url.hostname}${url.pathname && url.pathname !== "/" ? url.pathname : ""}`;
  } catch {
    return referrer;
  }
}

function isContentPath(path: string) {
  return /article|articles|report|reports|insight|insights|blog|news|resource|resources|energclub/i.test(
    path
  );
}

function isSignupPath(path: string) {
  return /auth|signup|sign-up|register|join|apply|start/i.test(path);
}

function isAuthPath(path: string) {
  return /auth|signup|sign-up|register|join|verify|verification|otp|onboard/i.test(path);
}

function isOtpPath(path: string) {
  return /otp|verify|verification/i.test(path);
}

function isSuccessPath(path: string) {
  return /success|welcome|complete|thank-you|thankyou/i.test(path);
}

function isDashboardPath(path: string) {
  return /dashboard|portal|console/i.test(path);
}

function contentTypeFor(pagePath: string, pageTitle: string) {
  const joined = `${pagePath} ${pageTitle}`.toLowerCase();

  if (joined.includes("report")) {
    return "Report";
  }

  if (joined.includes("energclub")) {
    return "Energclub";
  }

  return "Article";
}

function normalizePageInsightRows(rows: ReportRow[]): ResolvedPageCandidate[] {
  const aggregated = new Map<
    string,
    {
      pagePath: string;
      pageTitle: string;
      primaryTitleViews: number;
      totalDropoffWeight: number;
      views: number;
    }
  >();

  rows.forEach((row) => {
    const pagePath = normalizePath(dimensionValue(row, 0)) || "/";
    const rawTitle = dimensionValue(row, 1).trim();
    const pageTitle = rawTitle || pagePath || "Untitled page";
    const views = Math.round(metricValue(row, 0));
    const dropoffRate = metricValue(row, 1);

    if (!pagePath || pagePath === "(not set)" || views <= 0) {
      return;
    }

    const current =
      aggregated.get(pagePath) ??
      {
        pagePath,
        pageTitle,
        primaryTitleViews: 0,
        totalDropoffWeight: 0,
        views: 0,
      };

    current.views += views;
    current.totalDropoffWeight += dropoffRate * views;

    const titleIsGeneric =
      !current.pageTitle || current.pageTitle === current.pagePath || current.pageTitle === "Untitled page";
    const titleIsBetter =
      Boolean(rawTitle) &&
      rawTitle !== pagePath &&
      (titleIsGeneric || views > current.primaryTitleViews);

    if (titleIsBetter) {
      current.pageTitle = rawTitle;
      current.primaryTitleViews = views;
    }

    aggregated.set(pagePath, current);
  });

  return Array.from(aggregated.values()).map((row) => ({
    pagePath: row.pagePath,
    pageTitle: row.pageTitle || row.pagePath || "Untitled page",
    views: row.views,
    dropoffRate: row.views > 0 ? row.totalDropoffWeight / row.views : 0,
  }));
}

function resolvePageCandidate(
  rows: ReportRow[],
  rawQuery: string | null | undefined
): ResolvedPageCandidate | null {
  const query = rawQuery?.trim();

  if (!query) {
    return null;
  }

  const normalizedQuery = query.toLowerCase();
  const candidates = normalizePageInsightRows(rows)
    .map((row) => {
      const path = row.pagePath.toLowerCase();
      const title = row.pageTitle.toLowerCase();
      let score = Number.POSITIVE_INFINITY;

      if (path === normalizedQuery || `${path}/` === normalizedQuery) {
        score = 0;
      } else if (title === normalizedQuery) {
        score = 1;
      } else if (path.startsWith(normalizedQuery)) {
        score = 2;
      } else if (path.includes(normalizedQuery)) {
        score = 3;
      } else if (title.includes(normalizedQuery)) {
        score = 4;
      }

      return { row, score };
    })
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort(
      (left, right) =>
        left.score - right.score ||
        right.row.views - left.row.views ||
        left.row.pagePath.length - right.row.pagePath.length
    );

  return candidates[0]?.row ?? null;
}

function timelineLabelFor(
  eventName: string,
  pagePath: string,
  pageTitle: string
) {
  const normalizedPath = pagePath.toLowerCase();
  const normalizedEvent = eventName.toLowerCase();

  if (
    STEP_EVENT_NAMES.homepage.some((eventName) => eventName === normalizedEvent) ||
    normalizedPath === "/"
  ) {
    return "Homepage";
  }

  if (
    STEP_EVENT_NAMES.content.some((eventName) => eventName === normalizedEvent) ||
    isContentPath(normalizedPath)
  ) {
    return pageTitle || pagePath || "Content page";
  }

  if (
    STEP_EVENT_NAMES.signupClick.some((eventName) => eventName === normalizedEvent)
  ) {
    return "Signup click";
  }

  if (
    STEP_EVENT_NAMES.signupStart.some((eventName) => eventName === normalizedEvent) ||
    isAuthPath(normalizedPath)
  ) {
    return pageTitle || "Signup flow";
  }

  if (STEP_EVENT_NAMES.otpVerified.some((eventName) => eventName === normalizedEvent)) {
    return "OTP verified";
  }

  if (isOtpPath(normalizedPath)) {
    return pageTitle || "OTP step";
  }

  if (
    STEP_EVENT_NAMES.signupCompleted.some((eventName) => eventName === normalizedEvent) ||
    isSuccessPath(normalizedPath)
  ) {
    return "Signup completed";
  }

  if (
    STEP_EVENT_NAMES.dashboard.some((eventName) => eventName === normalizedEvent) ||
    isDashboardPath(normalizedPath)
  ) {
    return "Dashboard entered";
  }

  if (pageTitle) {
    return pageTitle;
  }

  if (pagePath) {
    return pagePath;
  }

  return eventName || "Activity";
}

function formatDateHourMinute(value: string) {
  if (!/^\d{12}$/.test(value)) {
    return {
      iso: value,
      label: value || "Unknown time",
    };
  }

  const iso = `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}T${value.slice(
    8,
    10
  )}:${value.slice(10, 12)}:00`;
  const date = new Date(iso);

  return {
    iso: date.toISOString(),
    label: date.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function sourceBucketFor(source: string, medium: string) {
  const normalizedSource = source.trim().toLowerCase();
  const normalizedMedium = medium.trim().toLowerCase();

  if (
    normalizedSource.includes("zoho") ||
    normalizedSource.includes("crm") ||
    normalizedMedium.includes("crm")
  ) {
    return "Zoho CRM";
  }

  if (
    normalizedSource.includes("linkedin") ||
    normalizedSource.includes("lnkd") ||
    normalizedMedium.includes("linkedin")
  ) {
    return "LinkedIn";
  }

  if (
    normalizedMedium.includes("organic") ||
    normalizedSource.includes("organic search") ||
    normalizedSource === "google" ||
    normalizedSource === "bing" ||
    normalizedSource === "yahoo"
  ) {
    return "Organic";
  }

  if (
    normalizedSource === "(direct)" ||
    normalizedSource === "direct" ||
    normalizedSource === "website" ||
    normalizedSource === "web" ||
    normalizedMedium === "(none)" ||
    normalizedMedium === "none"
  ) {
    return "Direct";
  }

  return "Other";
}

async function runReport(client: BetaAnalyticsDataClient, request: ReportRequest) {
  const [response] = await client.runReport(request);
  return response;
}

async function batchRunReports(
  client: BetaAnalyticsDataClient,
  property: string,
  requests: ReportRequest[]
) {
  if (requests.length === 0) {
    return [] as ReportResponse[];
  }

  const responses: ReportResponse[] = [];

  for (let index = 0; index < requests.length; index += BATCH_LIMIT) {
    const chunk = requests.slice(index, index + BATCH_LIMIT);
    const [result] = await client.batchRunReports({
      property,
      requests: chunk.map((request) => ({
        ...request,
        property: undefined,
      })),
    });

    responses.push(...(result.reports ?? []));
  }

  return responses;
}

async function runPaginatedReport(
  client: BetaAnalyticsDataClient,
  request: ReportRequest,
  pageSize = REPORT_PAGE_SIZE
) {
  const rows: NonNullable<ReportResponse["rows"]> = [];
  let offset = 0;
  let rowCount = 0;
  let firstResponse: ReportResponse | null = null;

  while (true) {
    const response = await runReport(client, {
      ...request,
      limit: pageSize,
      offset,
    });

    if (!firstResponse) {
      firstResponse = response;
    }

    const pageRows = response.rows ?? [];
    rows.push(...pageRows);
    rowCount = Number(response.rowCount ?? rows.length);

    if (pageRows.length === 0 || rows.length >= rowCount) {
      break;
    }

    offset += pageRows.length;
  }

  return {
    ...(firstResponse ?? {}),
    rows,
    rowCount,
  } satisfies ReportResponse;
}

function buildFunnelStages(stepCounts: Record<JourneyFunnelStage["key"], number>) {
  const definitions: Array<Pick<JourneyFunnelStage, "key" | "label">> = [
    { key: "visitors", label: "Visitors" },
    { key: "content_readers", label: "Content Readers" },
    { key: "signup_clicks", label: "Signup Clicks" },
    { key: "signup_started", label: "Signup Started" },
    { key: "otp_verified", label: "OTP Verified" },
    { key: "signup_completed", label: "Signup Completed" },
    { key: "dashboard_users", label: "Dashboard Users" },
    { key: "returning_users", label: "Returning Users" },
  ];

  return definitions.map((definition, index) => {
    const current = stepCounts[definition.key] ?? 0;
    const previous = index > 0 ? stepCounts[definitions[index - 1].key] ?? 0 : 0;
    const rawConversion = previous > 0 ? (current / previous) * 100 : null;
    const boundedConversion = rawConversion == null ? null : Math.min(rawConversion, 100);
    const dropRate =
      rawConversion == null ? null : Math.max(0, roundPercent(100 - Math.min(rawConversion, 100)));

    return {
      ...definition,
      count: Math.max(Math.round(current), 0),
      conversionRate:
        boundedConversion == null ? null : roundPercent(boundedConversion),
      dropRate,
    };
  });
}

function buildSequentialFunnelStepCounts(
  rawStepCounts: Record<JourneyFunnelStage["key"], number>,
  helpers: {
    authVisitors: number;
    createdUsers: number;
    verifiedUsers: number;
    activePortalUsers: number;
    signupCompletedOverride?: number | null;
    dashboardUsersOverride?: number | null;
    returningUsersOverride?: number | null;
  }
) {
  const signupIntent = Math.max(
    rawStepCounts.signup_clicks,
    rawStepCounts.signup_started,
    helpers.authVisitors
  );
  const verifiedProxy =
    signupIntent > 0 ? Math.min(helpers.verifiedUsers, signupIntent) : 0;
  const createdProxy =
    signupIntent > 0 ? Math.min(helpers.createdUsers, signupIntent) : 0;
  const signupCompletedOverride =
    helpers.signupCompletedOverride != null
      ? Math.max(Math.round(helpers.signupCompletedOverride), 0)
      : null;
  const dashboardUsersOverride =
    helpers.dashboardUsersOverride != null
      ? Math.max(Math.round(helpers.dashboardUsersOverride), 0)
      : null;
  const returningUsersOverride =
    helpers.returningUsersOverride != null
      ? Math.max(Math.round(helpers.returningUsersOverride), 0)
      : null;
  const primaryOrder = [
    "visitors",
    "content_readers",
    "signup_clicks",
    "signup_started",
    "otp_verified",
    "signup_completed",
  ] as const;

  const counts: Record<JourneyFunnelStage["key"], number> = {
    visitors: Math.max(Math.round(rawStepCounts.visitors), 0),
    content_readers: Math.max(Math.round(rawStepCounts.content_readers), 0),
    signup_clicks: Math.max(
      Math.round(Math.max(rawStepCounts.signup_clicks, helpers.authVisitors)),
      0
    ),
    signup_started: Math.max(Math.round(rawStepCounts.signup_started), 0),
    otp_verified: Math.max(
      Math.round(Math.max(rawStepCounts.otp_verified, verifiedProxy)),
      0
    ),
    signup_completed:
      signupCompletedOverride ??
      Math.max(Math.round(Math.max(rawStepCounts.signup_completed, createdProxy)), 0),
    dashboard_users: Math.max(Math.round(rawStepCounts.dashboard_users), 0),
    returning_users: Math.max(Math.round(rawStepCounts.returning_users), 0),
  };

  for (let index = primaryOrder.length - 2; index >= 0; index -= 1) {
    const currentKey = primaryOrder[index];
    const nextKey = primaryOrder[index + 1];
    counts[currentKey] = Math.max(counts[currentKey], counts[nextKey]);
  }

  for (let index = 1; index < primaryOrder.length; index += 1) {
    const previousKey = primaryOrder[index - 1];
    const currentKey = primaryOrder[index];
    counts[currentKey] = Math.min(counts[currentKey], counts[previousKey]);
  }

  const dashboardProxy = Math.min(
    Math.max(Math.round(helpers.activePortalUsers), 0),
    counts.signup_completed
  );
  counts.dashboard_users =
    dashboardUsersOverride != null
      ? Math.min(dashboardUsersOverride, counts.signup_completed)
      : Math.min(
          Math.max(counts.dashboard_users, dashboardProxy),
          counts.signup_completed
        );
  counts.returning_users =
    returningUsersOverride != null
      ? Math.min(returningUsersOverride, counts.dashboard_users)
      : Math.min(counts.returning_users, counts.dashboard_users);

  return counts;
}

function buildDropoffSummary(
  stages: JourneyFunnelStage[],
  behaviorCounts: Map<string, number>
): JourneyDropoffSummary {
  let biggestAbandonmentStage = stages[0]?.label ?? "Visitors";
  let biggestAbandonmentCount = 0;
  let biggestAbandonmentRate = 0;

  for (let index = 1; index < stages.length; index += 1) {
    const previous = stages[index - 1];
    const current = stages[index];
    const abandonmentCount = Math.max(previous.count - current.count, 0);
    const abandonmentRate =
      previous.count > 0 ? roundPercent((abandonmentCount / previous.count) * 100) : 0;

    if (abandonmentCount > biggestAbandonmentCount) {
      biggestAbandonmentCount = abandonmentCount;
      biggestAbandonmentRate = abandonmentRate;
      biggestAbandonmentStage = `${previous.label} to ${current.label}`.toLowerCase();
    }
  }

  const signupStarted =
    stages.find((stage) => stage.key === "signup_started")?.count ?? 0;
  const otpVerified =
    stages.find((stage) => stage.key === "otp_verified")?.count ?? 0;
  const signupCompleted =
    stages.find((stage) => stage.key === "signup_completed")?.count ?? 0;

  return {
    biggestAbandonmentStage,
    biggestAbandonmentCount,
    biggestAbandonmentRate,
    otpFailures: Math.max(
      behaviorCounts.get("otp_failed") ?? 0,
      signupStarted - otpVerified,
      0
    ),
    authDropRate: percentage(Math.max(signupStarted - signupCompleted, 0), signupStarted),
    formErrorSessions: Math.round(behaviorCounts.get("form_error") ?? 0),
    rageClickSessions: Math.round(behaviorCounts.get("rage_click") ?? 0),
    fieldAbandonmentSessions: Math.round(behaviorCounts.get("field_abandonment") ?? 0),
  };
}

function buildSourceRows(
  summaryRows: ReportRow[],
  signupRows: ReportRow[]
): JourneySourceRow[] {
  const buckets = new Map<
    string,
    {
      source: string;
      visitors: number;
      activeUsers: number;
      sessions: number;
      engagedSessions: number;
      signupCompleted: number;
    }
  >();

  for (const row of summaryRows) {
    const source = dimensionValue(row, 0);
    const medium = dimensionValue(row, 1);
    const bucketName = sourceBucketFor(source, medium);
    const current =
      buckets.get(bucketName) ??
      {
        source: bucketName,
        visitors: 0,
        activeUsers: 0,
        sessions: 0,
        engagedSessions: 0,
        signupCompleted: 0,
      };
    const visitors = metricValue(row, 0);
    const activeUsers = metricValue(row, 1);
    const sessions = metricValue(row, 2);
    const engagedSessions = metricValue(row, 3);

    current.visitors += visitors;
    current.activeUsers += activeUsers;
    current.sessions += sessions;
    current.engagedSessions += engagedSessions;
    buckets.set(bucketName, current);
  }

  for (const row of signupRows) {
    const source = dimensionValue(row, 0);
    const medium = dimensionValue(row, 1);
    const bucketName = sourceBucketFor(source, medium);
    const current =
      buckets.get(bucketName) ??
      {
        source: bucketName,
        visitors: 0,
        activeUsers: 0,
        sessions: 0,
        engagedSessions: 0,
        signupCompleted: 0,
      };

    current.signupCompleted += metricValue(row, 0);
    buckets.set(bucketName, current);
  }

  const orderedNames = ["Zoho CRM", "Organic", "LinkedIn", "Direct"];
  const orderedRows: JourneySourceRow[] = orderedNames
    .map((name) => buckets.get(name))
    .filter((bucket): bucket is NonNullable<typeof bucket> => Boolean(bucket))
    .map((bucket) => ({
      source: bucket.source,
      visitors: Math.round(bucket.visitors),
      signupRate: percentage(bucket.signupCompleted, bucket.visitors),
      engagementRate: percentage(bucket.engagedSessions, bucket.sessions),
      activeUsers: Math.round(bucket.activeUsers),
    }));

  const otherRows = Array.from(buckets.values())
    .filter((bucket) => !orderedNames.includes(bucket.source))
    .filter((bucket) => bucket.visitors > 0 || bucket.activeUsers > 0)
    .sort((left, right) => right.activeUsers - left.activeUsers || right.visitors - left.visitors)
    .map((bucket) => ({
      source: bucket.source,
      visitors: Math.round(bucket.visitors),
      signupRate: percentage(bucket.signupCompleted, bucket.visitors),
      engagementRate: percentage(bucket.engagedSessions, bucket.sessions),
      activeUsers: Math.round(bucket.activeUsers),
    }));

  return [...orderedRows, ...otherRows];
}

async function fetchPortalInsights(
  startDate: string,
  endDate: string,
  visitors: number
): Promise<{
  base: Pick<
    JourneyPortalInsights,
    | "visitors"
    | "createdUsers"
    | "verifiedUsers"
    | "onboardedUsers"
    | "activePortalUsers"
    | "visitorToAccountRate"
    | "accountToOnboardedRate"
  >;
  accountsBySource: Map<string, number>;
  authCohort:
    | {
        signupCompletedUsers: number;
        dashboardUsers: number;
        returningUsers: number;
      }
    | null;
}> {
  let createdUsers = 0;
  let verifiedUsers = 0;
  let onboardedUsers = 0;
  const accountsBySource = new Map<string, number>();

  try {
    const result = await withDatabaseClient("journey portal insights", async (client) => {
      const [summary, sourceBreakdown] = await Promise.all([
        client.query<{
          created_users: string;
          verified_users: string;
          onboarded_users: string;
        }>(
          `
            SELECT
              COUNT(*) FILTER (
                WHERE created_at::date BETWEEN $1::date AND $2::date
              ) AS created_users,
              COUNT(*) FILTER (
                WHERE created_at::date BETWEEN $1::date AND $2::date
                  AND LOWER(COALESCE(verification_status, '')) = 'verified'
              ) AS verified_users,
              COUNT(*) FILTER (
                WHERE created_at::date BETWEEN $1::date AND $2::date
                  AND onboarding_completed = TRUE
              ) AS onboarded_users
            FROM users
          `,
          [startDate, endDate]
        ),
        client.query<{
          source: string | null;
          medium: string | null;
          total: string;
        }>(
          `
            SELECT
              COALESCE(NULLIF(utm_source, ''), NULLIF(source, ''), 'direct') AS source,
              COALESCE(NULLIF(utm_medium, ''), '') AS medium,
              COUNT(*) AS total
            FROM users
            WHERE created_at::date BETWEEN $1::date AND $2::date
            GROUP BY 1, 2
          `,
          [startDate, endDate]
        ),
      ]);

      return {
        summary: summary.rows[0],
        sourceBreakdown: sourceBreakdown.rows,
      };
    });

    createdUsers = Number.parseInt(result.summary?.created_users ?? "0", 10) || 0;
    verifiedUsers = Number.parseInt(result.summary?.verified_users ?? "0", 10) || 0;
    onboardedUsers = Number.parseInt(result.summary?.onboarded_users ?? "0", 10) || 0;

    result.sourceBreakdown.forEach((row) => {
      const bucket = sourceBucketFor(row.source ?? "", row.medium ?? "");
      accountsBySource.set(
        bucket,
        (accountsBySource.get(bucket) ?? 0) + (Number.parseInt(row.total, 10) || 0)
      );
    });
  } catch (error) {
    console.error("[Journey Intelligence] Portal DB insight fetch failed:", error);
  }

  const startTs = new Date(`${startDate}T00:00:00`).getTime();
  const endTs = new Date(`${endDate}T23:59:59`).getTime();
  let authCohort: {
    signupCompletedUsers: number;
    dashboardUsers: number;
    returningUsers: number;
  } | null = null;

  try {
    const snapshot = await getClerkUsersSnapshot({
      minimumCreatedAtMs: startTs,
      maximumCreatedAtMs: endTs,
      bypassDefaultLookback: true,
    });
    const cohortUsers = snapshot.users;
    const oneDayMs = 24 * 60 * 60 * 1000;

    authCohort = {
      signupCompletedUsers: cohortUsers.length,
      dashboardUsers: cohortUsers.filter(
        (user) =>
          typeof user.lastSignInAt === "number" &&
          user.lastSignInAt >= user.createdAt &&
          user.lastSignInAt <= endTs
      ).length,
      returningUsers: cohortUsers.filter(
        (user) =>
          typeof user.lastSignInAt === "number" &&
          user.lastSignInAt <= endTs &&
          user.lastSignInAt - user.createdAt > oneDayMs
      ).length,
    };
  } catch (error) {
    console.error("[Journey Intelligence] Clerk insight fetch failed:", error);
  }

  const createdUsersFinal = authCohort
    ? Math.max(createdUsers, authCohort.signupCompletedUsers)
    : createdUsers;
  const onboardedUsersFinal = Math.min(
    Math.max(onboardedUsers, 0),
    Math.max(createdUsersFinal, 0)
  );
  const activePortalUsers = Math.min(
    authCohort ? Math.max(authCohort.dashboardUsers, 0) : onboardedUsersFinal,
    Math.max(createdUsersFinal, 0)
  );

  return {
    base: {
      visitors,
      createdUsers: createdUsersFinal,
      verifiedUsers,
      onboardedUsers: onboardedUsersFinal,
      activePortalUsers,
      visitorToAccountRate: percentage(createdUsersFinal, visitors),
      accountToOnboardedRate: percentage(onboardedUsersFinal, createdUsersFinal),
    },
    accountsBySource,
    authCohort,
  };
}

function buildPortalFlowRows(
  landingRows: ReportRow[],
  engagedRows: ReportRow[],
  authRows: ReportRow[],
  sourceRows: JourneySourceRow[],
  accountsBySource: Map<string, number>
): JourneyPortalFlowRow[] {
  const flowMap = new Map<
    string,
    {
      source: string;
      landingPage: string | null;
      landingUsers: number;
      engagedPage: string | null;
      engagedPageTimeSeconds: number;
      authEntryPage: string | null;
      authEntryViews: number;
      authDropPage: string | null;
      authDropScore: number;
      avgSessionDurationSeconds: number;
    }
  >();

  landingRows.forEach((row) => {
    const source = sourceBucketFor(dimensionValue(row, 0), dimensionValue(row, 1));
    const landingPage = normalizePath(dimensionValue(row, 2)) || dimensionValue(row, 2) || null;
    const users = metricValue(row, 1);
    const avgSessionDurationSeconds = metricValue(row, 2);
    const current =
      flowMap.get(source) ??
      {
        source,
        landingPage: null,
        landingUsers: 0,
        engagedPage: null,
        engagedPageTimeSeconds: 0,
        authEntryPage: null,
        authEntryViews: 0,
        authDropPage: null,
        authDropScore: 0,
        avgSessionDurationSeconds: 0,
      };

    if (users >= current.landingUsers) {
      current.landingUsers = users;
      current.landingPage = landingPage;
      current.avgSessionDurationSeconds = avgSessionDurationSeconds;
    }

    flowMap.set(source, current);
  });

  engagedRows.forEach((row) => {
    const source = sourceBucketFor(dimensionValue(row, 0), dimensionValue(row, 1));
    const pagePath = normalizePath(dimensionValue(row, 2));
    const pageTitle = dimensionValue(row, 3);
    const pageViews = metricValue(row, 0);
    const engagementDuration = metricValue(row, 1);
    const avgTime = pageViews > 0 ? engagementDuration / pageViews : 0;
    const current =
      flowMap.get(source) ??
      {
        source,
        landingPage: null,
        landingUsers: 0,
        engagedPage: null,
        engagedPageTimeSeconds: 0,
        authEntryPage: null,
        authEntryViews: 0,
        authDropPage: null,
        authDropScore: 0,
        avgSessionDurationSeconds: 0,
      };

    if (avgTime >= current.engagedPageTimeSeconds) {
      current.engagedPageTimeSeconds = avgTime;
      current.engagedPage = pageTitle || pagePath || null;
    }

    flowMap.set(source, current);
  });

  authRows.forEach((row) => {
    const source = sourceBucketFor(dimensionValue(row, 0), dimensionValue(row, 1));
    const pagePath = normalizePath(dimensionValue(row, 2));
    const pageTitle = dimensionValue(row, 3);
    const pageLabel = pageTitle || pagePath || null;
    const pageViews = metricValue(row, 0);
    const bounceRate = metricValue(row, 1);
    const current =
      flowMap.get(source) ??
      {
        source,
        landingPage: null,
        landingUsers: 0,
        engagedPage: null,
        engagedPageTimeSeconds: 0,
        authEntryPage: null,
        authEntryViews: 0,
        authDropPage: null,
        authDropScore: 0,
        avgSessionDurationSeconds: 0,
      };

    if (pageViews >= current.authEntryViews) {
      current.authEntryViews = pageViews;
      current.authEntryPage = pageLabel;
    }

    const dropScore = pageViews * bounceRate;
    if (dropScore >= current.authDropScore) {
      current.authDropScore = dropScore;
      current.authDropPage = pageLabel;
    }

    flowMap.set(source, current);
  });

  const sourceOrder = sourceRows.map((row) => row.source);

  return sourceOrder
    .map((source) => {
      const current = flowMap.get(source);
      const sourceSummary = sourceRows.find((row) => row.source === source);

      if (!current || !sourceSummary) {
        return null;
      }

      return {
        source,
        landingPage: current.landingPage,
        engagedPage: current.engagedPage,
        engagedPageTimeSeconds: Math.round(current.engagedPageTimeSeconds),
        authEntryPage: current.authEntryPage,
        authDropPage: current.authDropPage,
        avgSessionDurationSeconds: Math.round(current.avgSessionDurationSeconds),
        activeUsers: sourceSummary.activeUsers,
        accountsCreated: accountsBySource.get(source) ?? 0,
      } satisfies JourneyPortalFlowRow;
    })
    .filter((row): row is JourneyPortalFlowRow => Boolean(row));
}

function buildPageInsights(rows: ReportRow[]) {
  const normalizedRows: JourneyPageInsightRow[] = normalizePageInsightRows(rows);

  return {
    mostViewedPages: normalizedRows
      .slice()
      .sort((left, right) => right.views - left.views)
      .slice(0, 10),
    highestDropoffPages: normalizedRows
      .filter((row) => row.views >= 10)
      .sort((left, right) => right.dropoffRate - left.dropoffRate || right.views - left.views)
      .slice(0, 10),
  };
}

function buildPageShareRows(
  rows: ReportRow[],
  labelFor: (row: ReportRow) => string,
  valueIndex: number
): JourneyLabeledShareRow[] {
  const aggregated = new Map<string, number>();

  rows.forEach((row) => {
    const label = labelFor(row).trim() || "Unknown";
    const value = Math.round(metricValue(row, valueIndex));

    if (value <= 0) {
      return;
    }

    aggregated.set(label, (aggregated.get(label) ?? 0) + value);
  });

  const total = Array.from(aggregated.values()).reduce((sum, value) => sum + value, 0);

  return Array.from(aggregated.entries())
    .map(([label, value]) => ({
      label,
      value,
      share: total > 0 ? value / total : 0,
    }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
}

function buildPageFlowRows(
  rows: ReportRow[],
  hostnames: string[],
  direction: "previous" | "next"
): JourneyPageDrilldownFlowRow[] {
  const flowMap = new Map<string, JourneyPageDrilldownFlowRow>();

  rows.forEach((row) => {
    const views = Math.round(metricValue(row, 0));
    const users = Math.round(metricValue(row, 1));

    if (views <= 0 && users <= 0) {
      return;
    }

    if (direction === "previous") {
      const label = normalizeReferrer(dimensionValue(row, 0), hostnames);
      const current =
        flowMap.get(label) ??
        {
          label,
          pagePath: label.startsWith("/") ? label : null,
          pageTitle: null,
          views: 0,
          users: 0,
          share: 0,
        };

      current.views += views;
      current.users += users;
      flowMap.set(label, current);
      return;
    }

    const pagePath = normalizePath(dimensionValue(row, 0)) || dimensionValue(row, 0) || null;
    const pageTitle = dimensionValue(row, 1) || pagePath || "Untitled page";
    const key = pagePath || pageTitle;
    const current =
      flowMap.get(key) ??
      {
        label: pagePath || pageTitle,
        pagePath,
        pageTitle,
        views: 0,
        users: 0,
        share: 0,
      };

    current.views += views;
    current.users += users;
    flowMap.set(key, current);
  });

  const totalUsers = Array.from(flowMap.values()).reduce((sum, row) => sum + row.users, 0);

  return Array.from(flowMap.values())
    .map((row) => ({
      ...row,
      share: totalUsers > 0 ? row.users / totalUsers : 0,
    }))
    .sort((left, right) => right.users - left.users || right.views - left.views)
    .slice(0, 10);
}

function buildPageDrilldown(params: {
  query: string | null | undefined;
  page: ResolvedPageCandidate;
  hostnames: string[];
  overviewReport: ReportResponse | undefined;
  newVsReturningReport: ReportResponse | undefined;
  sourceReport: ReportResponse | undefined;
  deviceReport: ReportResponse | undefined;
  regionReport: ReportResponse | undefined;
  previousReport: ReportResponse | undefined;
  nextReport: ReportResponse | undefined;
  entranceReport: ReportResponse | undefined;
}): JourneyPageDrilldown {
  const overviewRow = params.overviewReport?.rows?.[0];
  let newUsers = 0;
  let returningUsers = 0;

  (params.newVsReturningReport?.rows ?? []).forEach((row) => {
    const label = dimensionValue(row, 0).toLowerCase();
    const users = Math.round(metricValue(row, 0));

    if (label.includes("new")) {
      newUsers += users;
    } else if (label.includes(RETURNING_LABEL)) {
      returningUsers += users;
    }
  });

  const sources = buildPageShareRows(
    params.sourceReport?.rows ?? [],
    (row) => dimensionValue(row, 0) || "Other",
    0
  );
  const devices = buildPageShareRows(
    params.deviceReport?.rows ?? [],
    (row) => normalizeDevice(dimensionValue(row, 0)),
    0
  );
  const regions = buildPageShareRows(
    params.regionReport?.rows ?? [],
    (row) => {
      const country = dimensionValue(row, 0);
      const region = dimensionValue(row, 1);
      return [country, region].filter(Boolean).join(" / ") || "Unknown";
    },
    0
  );
  const previousPages = buildPageFlowRows(
    params.previousReport?.rows ?? [],
    params.hostnames,
    "previous"
  );
  const nextPages = buildPageFlowRows(params.nextReport?.rows ?? [], params.hostnames, "next");
  const pageViews = Math.round(metricValue(overviewRow, 5));
  const users = Math.round(metricValue(overviewRow, 1));
  const nextViews = nextPages.reduce((sum, row) => sum + row.views, 0);
  const exitPageViews = Math.max(pageViews - nextViews, 0);
  const totalAudience = Math.max(users, 1);
  const authUsers = nextPages
    .filter((row) => isAuthPath((row.pagePath || row.label).toLowerCase()))
    .reduce((sum, row) => sum + row.users, 0);
  const signupCompletedUsers = nextPages
    .filter((row) => isSuccessPath((row.pagePath || row.label).toLowerCase()))
    .reduce((sum, row) => sum + row.users, 0);
  const dashboardUsers = nextPages
    .filter((row) => isDashboardPath((row.pagePath || row.label).toLowerCase()))
    .reduce((sum, row) => sum + row.users, 0);
  const totalNewReturningUsers = newUsers + returningUsers;

  return {
    query: params.query?.trim() || null,
    resolvedPath: params.page.pagePath,
    resolvedTitle: params.page.pageTitle,
    searched: Boolean(params.query?.trim()),
    overview: {
      sessions: Math.round(metricValue(overviewRow, 0)),
      users,
      activeUsers: Math.round(metricValue(overviewRow, 2)),
      pageViews,
      avgSessionDurationSeconds: Math.round(metricValue(overviewRow, 3)),
      avgTimeOnPageSeconds:
        pageViews > 0 ? Math.round(metricValue(overviewRow, 6) / pageViews) : 0,
      bounceRate: metricValue(overviewRow, 4),
      exitRate: pageViews > 0 ? exitPageViews / pageViews : 0,
      entrances: Math.round(metricValue(params.entranceReport?.rows?.[0], 0)),
      newUsers,
      returningUsers,
      newUserShare: totalNewReturningUsers > 0 ? newUsers / totalNewReturningUsers : 0,
      returningUserShare:
        totalNewReturningUsers > 0 ? returningUsers / totalNewReturningUsers : 0,
    },
    sources,
    devices,
    regions,
    previousPages,
    nextPages,
    conversion: {
      authUsers,
      authRate: percentage(authUsers, totalAudience),
      signupCompletedUsers,
      signupCompletedRate: percentage(signupCompletedUsers, totalAudience),
      dashboardUsers,
      dashboardRate: percentage(dashboardUsers, totalAudience),
      exitPageViews,
      exitRate: pageViews > 0 ? percentage(exitPageViews, pageViews) : 0,
    },
  };
}

function buildEmptyPageDrilldown(query: string | null | undefined): JourneyPageDrilldown {
  return {
    query: query?.trim() || null,
    resolvedPath: null,
    resolvedTitle: null,
    searched: Boolean(query?.trim()),
    overview: {
      sessions: 0,
      users: 0,
      activeUsers: 0,
      pageViews: 0,
      avgSessionDurationSeconds: 0,
      avgTimeOnPageSeconds: 0,
      bounceRate: 0,
      exitRate: 0,
      entrances: 0,
      newUsers: 0,
      returningUsers: 0,
      newUserShare: 0,
      returningUserShare: 0,
    },
    sources: [],
    devices: [],
    regions: [],
    previousPages: [],
    nextPages: [],
    conversion: {
      authUsers: 0,
      authRate: 0,
      signupCompletedUsers: 0,
      signupCompletedRate: 0,
      dashboardUsers: 0,
      dashboardRate: 0,
      exitPageViews: 0,
      exitRate: 0,
    },
  };
}

function buildDeviceRows(
  summaryRows: ReportRow[],
  signupStartRows: ReportRow[],
  signupCompletedRows: ReportRow[]
) {
  const devices = new Map<
    string,
    {
      device: string;
      visitors: number;
      sessions: number;
      avgSessionDurationSeconds: number;
      signupStarted: number;
      signupCompleted: number;
    }
  >();

  for (const row of summaryRows) {
    const device = normalizeDevice(dimensionValue(row, 0));
    devices.set(device, {
      device,
      visitors: metricValue(row, 0),
      sessions: metricValue(row, 1),
      avgSessionDurationSeconds: metricValue(row, 2),
      signupStarted: devices.get(device)?.signupStarted ?? 0,
      signupCompleted: devices.get(device)?.signupCompleted ?? 0,
    });
  }

  for (const row of signupStartRows) {
    const device = normalizeDevice(dimensionValue(row, 0));
    const current =
      devices.get(device) ??
      {
        device,
        visitors: 0,
        sessions: 0,
        avgSessionDurationSeconds: 0,
        signupStarted: 0,
        signupCompleted: 0,
      };
    current.signupStarted += metricValue(row, 0);
    devices.set(device, current);
  }

  for (const row of signupCompletedRows) {
    const device = normalizeDevice(dimensionValue(row, 0));
    const current =
      devices.get(device) ??
      {
        device,
        visitors: 0,
        sessions: 0,
        avgSessionDurationSeconds: 0,
        signupStarted: 0,
        signupCompleted: 0,
      };
    current.signupCompleted += metricValue(row, 0);
    devices.set(device, current);
  }

  const preferredOrder = ["Mobile", "Desktop", "Tablet"];

  return Array.from(devices.values())
    .map((device): JourneyDeviceRow => ({
      device: device.device,
      visitors: Math.round(device.visitors),
      sessions: Math.round(device.sessions),
      signupRate: percentage(device.signupStarted, device.visitors),
      completionRate: percentage(device.signupCompleted, device.visitors),
      dropOffRate: percentage(
        Math.max(device.signupStarted - device.signupCompleted, 0),
        device.signupStarted
      ),
      avgSessionDurationSeconds: Math.round(device.avgSessionDurationSeconds),
    }))
    .sort((left, right) => {
      const leftIndex = preferredOrder.indexOf(left.device);
      const rightIndex = preferredOrder.indexOf(right.device);

      if (leftIndex >= 0 || rightIndex >= 0) {
        return (leftIndex >= 0 ? leftIndex : preferredOrder.length) -
          (rightIndex >= 0 ? rightIndex : preferredOrder.length);
      }

      return right.visitors - left.visitors;
    });
}

function buildContentRows(
  contentRows: ReportRow[],
  transitionRows: ReportRow[]
) {
  const contentMap = new Map<string, JourneyContentDriverRow>();

  for (const row of contentRows) {
    const pagePath = normalizePath(dimensionValue(row, 0));
    const pageTitle = dimensionValue(row, 1) || pagePath;
    const key = pagePath || pageTitle;

    if (!key || key === "(not set)") {
      continue;
    }

    contentMap.set(key, {
      key,
      label: pageTitle,
      contentType: contentTypeFor(pagePath, pageTitle),
      pagePath,
      readers: Math.round(metricValue(row, 0)),
      signupStarted: 0,
      signupCompleted: 0,
      activatedUsers: 0,
    });
  }

  const transitionMap = new Map<string, ContentTransitionTotals>();

  for (const row of transitionRows) {
    const referrerPath = normalizePath(dimensionValue(row, 0));
    const nextPath = normalizePath(dimensionValue(row, 1));
    const views = metricValue(row, 2);

    if (!referrerPath || !isContentPath(referrerPath)) {
      continue;
    }

    const current =
      transitionMap.get(referrerPath) ?? {
        signupStarted: 0,
        signupCompleted: 0,
        activatedUsers: 0,
      };

    if (isSignupPath(nextPath) || isAuthPath(nextPath)) {
      current.signupStarted += views;
    }

    if (isSuccessPath(nextPath)) {
      current.signupCompleted += views;
    }

    if (isDashboardPath(nextPath)) {
      current.activatedUsers += views;
    }

    transitionMap.set(referrerPath, current);
  }

  for (const [key, row] of contentMap.entries()) {
    const transitions = transitionMap.get(key);

    if (!transitions) {
      continue;
    }

    row.signupStarted = Math.round(transitions.signupStarted);
    row.signupCompleted = Math.round(transitions.signupCompleted);
    row.activatedUsers = Math.round(transitions.activatedUsers);
  }

  return Array.from(contentMap.values())
    .filter((row) => row.readers > 0)
    .sort((left, right) => {
      const rightValue =
        right.signupCompleted * 4 + right.activatedUsers * 3 + right.signupStarted;
      const leftValue =
        left.signupCompleted * 4 + left.activatedUsers * 3 + left.signupStarted;

      return rightValue - leftValue || right.readers - left.readers;
    })
    .slice(0, 12);
}

function buildGa4Timeline(
  rows: ReportRow[],
  query: string | null | undefined
): JourneyGa4TimelineResult {
  const buckets = new Map<string, JourneyGa4TimelineResult["buckets"][number]>();

  rows.forEach((row, index) => {
    const timestamp = dimensionValue(row, 0);
    const pagePath = normalizePath(dimensionValue(row, 1));
    const pageTitle = dimensionValue(row, 2);
    const eventName = dimensionValue(row, 3);
    const source = dimensionValue(row, 4) || null;
    const device = normalizeDevice(dimensionValue(row, 5));
    const eventCount = Math.round(metricValue(row, 0));
    const users = Math.round(metricValue(row, 1));
    const time = formatDateHourMinute(timestamp);
    const bucket =
      buckets.get(timestamp) ??
      {
        id: timestamp,
        label: time.label,
        events: [],
      };

    bucket.events.push({
      id: `${timestamp}-${index}`,
      occurredAt: time.iso,
      timeLabel: time.label,
      label: timelineLabelFor(eventName, pagePath, pageTitle),
      pagePath: pagePath || null,
      pageTitle: pageTitle || null,
      source,
      device: device || null,
      eventCount,
      users,
    });
    buckets.set(timestamp, bucket);
  });

  return {
    query: query?.trim() || null,
    searched: Boolean(query?.trim()),
    buckets: Array.from(buckets.values()).slice(0, 10),
  };
}

function singleMetricCount(response: ReportResponse | undefined) {
  return Math.round(metricValue(response?.rows?.[0], 0));
}

function validateInput(input: BuildGa4JourneyInput) {
  if (!/^\d+$/.test(input.propertyId.trim())) {
    throw new Error("Property ID must be numeric.");
  }

  if (input.credentials.type !== "service_account") {
    throw new Error("The stored GA4 credentials must be a Google service account key.");
  }

  if (!input.credentials.client_email || !input.credentials.private_key) {
    throw new Error("GA4 service account credentials are incomplete.");
  }
}

export async function buildGa4JourneyIntelligenceData(
  input: BuildGa4JourneyInput
): Promise<JourneyIntelligenceData> {
  validateInput(input);

  const property = `properties/${input.propertyId.trim()}`;
  const client = new BetaAnalyticsDataClient({
    credentials: {
      client_email: input.credentials.client_email,
      private_key: input.credentials.private_key,
    },
    fallback: true,
  });

  try {
    const dateRange = await resolveDateRange(client, property, input);
    const contentFilter = orFilters(
      buildPagePathFilter(CONTENT_PATH_REGEX),
      buildPageTitleFilter(CONTENT_TITLE_REGEX),
      buildEventNamesFilter(STEP_EVENT_NAMES.content)
    );
    const signupClickFilter = orFilters(
      buildEventNamesFilter(STEP_EVENT_NAMES.signupClick),
      buildPagePathFilter(SIGNUP_ENTRY_REGEX)
    );
    const signupStartFilter = orFilters(
      buildEventNamesFilter(STEP_EVENT_NAMES.signupStart),
      buildPagePathFilter(AUTH_FLOW_REGEX)
    );
    const otpVerifiedFilter = buildEventNamesFilter(STEP_EVENT_NAMES.otpVerified);
    const signupCompletedFilter = orFilters(
      buildEventNamesFilter(STEP_EVENT_NAMES.signupCompleted),
      buildPagePathFilter(SIGNUP_SUCCESS_REGEX)
    );
    const dashboardFilter = orFilters(
      buildEventNamesFilter(STEP_EVENT_NAMES.dashboard),
      buildPagePathFilter(DASHBOARD_REGEX)
    );
    const behaviorFilter = buildEventNamesFilter(STEP_EVENT_NAMES.behavior);
    const authPageViewFilter = andFilters(
      exactFilter("eventName", "page_view"),
      regexFilter("pagePath", AUTH_FLOW_REGEX)
    );

    const requests: ReportRequest[] = [
      {
        property,
        dateRanges: [dateRange],
        metrics: [
          { name: "totalUsers" },
          { name: "sessions" },
          { name: "averageSessionDuration" },
          { name: "bounceRate" },
          { name: "screenPageViews" },
        ],
      },
      {
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: "newVsReturning" }],
        metrics: [{ name: "totalUsers" }],
      },
      {
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "eventCount" }],
        dimensionFilter: behaviorFilter,
        limit: 50,
      },
      {
        property,
        dateRanges: [dateRange],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: contentFilter,
      },
      {
        property,
        dateRanges: [dateRange],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: signupClickFilter,
      },
      {
        property,
        dateRanges: [dateRange],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: signupStartFilter,
      },
      {
        property,
        dateRanges: [dateRange],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: otpVerifiedFilter,
      },
      {
        property,
        dateRanges: [dateRange],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: signupCompletedFilter,
      },
      {
        property,
        dateRanges: [dateRange],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: dashboardFilter,
      },
      {
        property,
        dateRanges: [dateRange],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: authPageViewFilter,
      },
      {
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [
          { name: "totalUsers" },
          { name: "sessions" },
          { name: "averageSessionDuration" },
        ],
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
        limit: 20,
      },
      {
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: signupStartFilter,
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
        limit: 20,
      },
      {
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: "deviceCategory" }],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: signupCompletedFilter,
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
        limit: 20,
      },
      {
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: "firstUserSource" }, { name: "firstUserMedium" }],
        metrics: [
          { name: "totalUsers" },
          { name: "activeUsers" },
          { name: "sessions" },
          { name: "engagedSessions" },
        ],
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
        limit: 100,
      },
      {
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: "firstUserSource" }, { name: "firstUserMedium" }],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: signupCompletedFilter,
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
        limit: 100,
      },
      {
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: "hostName" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 20,
      },
    ];

    const [
      overviewReport,
      returningReport,
      behaviorReport,
      contentReadersReport,
      signupClicksReport,
      signupStartedReport,
      otpVerifiedReport,
      signupCompletedReport,
      dashboardUsersReport,
      authVisitorsReport,
      deviceSummaryReport,
      deviceSignupStartReport,
      deviceSignupCompletedReport,
      sourceSummaryReport,
      sourceSignupCompletedReport,
      hostnameReport,
    ] = await batchRunReports(client, property, requests);

    const hostnames = (hostnameReport.rows ?? [])
      .map((row) => dimensionValue(row, 0))
      .filter(Boolean);
    const internalReferrerRegex =
      hostnames.length > 0
        ? `^https?://(?:${hostnames
            .map((hostname) => hostname.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|")})(?:/.*)?$`
        : INTERNAL_REFERRER_FALLBACK_REGEX;

    const [
      contentPagesReport,
      transitionsReport,
      timelineReport,
      landingPagesReport,
      engagedPagesReport,
      authPagesReport,
      globalPagesReport,
    ] = await Promise.all([
      runPaginatedReport(client, {
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [{ name: "totalUsers" }],
        dimensionFilter: contentFilter,
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
      }),
      runPaginatedReport(client, {
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: "pageReferrer" }, { name: "pagePath" }, { name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }],
        dimensionFilter: andFilters(
          exactFilter("eventName", "page_view"),
          regexFilter("pageReferrer", internalReferrerRegex)
        ),
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
      }),
      runReport(client, {
        property,
        dateRanges: [dateRange],
        dimensions: [
          { name: "dateHourMinute" },
          { name: "pagePath" },
          { name: "pageTitle" },
          { name: "eventName" },
          { name: "sessionSource" },
          { name: "deviceCategory" },
        ],
        metrics: [{ name: "eventCount" }, { name: "totalUsers" }],
        dimensionFilter: andFilters(
          buildJourneyActivityFilter(),
          buildTimelineSearchFilter(input.query)
        ),
        orderBys: [{ dimension: { dimensionName: "dateHourMinute" }, desc: true }],
        limit: 160,
      }),
      runPaginatedReport(client, {
        property,
        dateRanges: [dateRange],
        dimensions: [
          { name: "sessionSource" },
          { name: "sessionMedium" },
          { name: "landingPagePlusQueryString" },
        ],
        metrics: [
          { name: "sessions" },
          { name: "totalUsers" },
          { name: "averageSessionDuration" },
        ],
        orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
        limit: 250,
      }),
      runPaginatedReport(client, {
        property,
        dateRanges: [dateRange],
        dimensions: [
          { name: "sessionSource" },
          { name: "sessionMedium" },
          { name: "pagePath" },
          { name: "pageTitle" },
        ],
        metrics: [{ name: "screenPageViews" }, { name: "userEngagementDuration" }],
        dimensionFilter: andFilters(
          exactFilter("eventName", "page_view"),
          buildJourneyActivityFilter()
        ),
        orderBys: [{ metric: { metricName: "userEngagementDuration" }, desc: true }],
        limit: 500,
      }),
      runPaginatedReport(client, {
        property,
        dateRanges: [dateRange],
        dimensions: [
          { name: "sessionSource" },
          { name: "sessionMedium" },
          { name: "pagePath" },
          { name: "pageTitle" },
        ],
        metrics: [{ name: "screenPageViews" }, { name: "bounceRate" }],
        dimensionFilter: authPageViewFilter,
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 300,
      }),
      runPaginatedReport(client, {
        property,
        dateRanges: [dateRange],
        dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
        metrics: [{ name: "screenPageViews" }, { name: "bounceRate" }],
        dimensionFilter: exactFilter("eventName", "page_view"),
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: 500,
      }),
    ]);

    const visitors = singleMetricCount(overviewReport);
    const totalSessions = Math.round(metricValue(overviewReport.rows?.[0], 1));
    const avgSessionDurationSeconds = Math.round(metricValue(overviewReport.rows?.[0], 2));
    const bounceRate = metricValue(overviewReport.rows?.[0], 3);
    const pageviews = Math.round(metricValue(overviewReport.rows?.[0], 4));
    let newUsers = 0;
    const returningUsers = (returningReport.rows ?? []).reduce((total, row) => {
      const label = dimensionValue(row, 0).toLowerCase();
      if (label.includes("new")) {
        newUsers += metricValue(row, 0);
      }
      return label.includes(RETURNING_LABEL) ? total + metricValue(row, 0) : total;
    }, 0);
    const authVisitors = singleMetricCount(authVisitorsReport);

    const rawStepCounts: Record<JourneyFunnelStage["key"], number> = {
      visitors,
      content_readers: singleMetricCount(contentReadersReport),
      signup_clicks: singleMetricCount(signupClicksReport),
      signup_started: singleMetricCount(signupStartedReport),
      otp_verified: singleMetricCount(otpVerifiedReport),
      signup_completed: singleMetricCount(signupCompletedReport),
      dashboard_users: singleMetricCount(dashboardUsersReport),
      returning_users: Math.round(returningUsers),
    };
    const { base: portalBase, accountsBySource, authCohort } = await fetchPortalInsights(
      dateRange.startDate,
      dateRange.endDate,
      visitors
    );
    const stepCounts = buildSequentialFunnelStepCounts(rawStepCounts, {
      authVisitors,
      createdUsers: portalBase.createdUsers,
      verifiedUsers: portalBase.verifiedUsers,
      activePortalUsers: portalBase.activePortalUsers,
      signupCompletedOverride: portalBase.createdUsers > 0 ? portalBase.createdUsers : null,
      dashboardUsersOverride:
        portalBase.activePortalUsers > 0 ? portalBase.activePortalUsers : null,
      returningUsersOverride: authCohort?.returningUsers ?? null,
    });
    const funnelStages = buildFunnelStages(stepCounts);
    const behaviorCounts = new Map<string, number>();

    for (const row of behaviorReport.rows ?? []) {
      behaviorCounts.set(dimensionValue(row, 0), metricValue(row, 0));
    }

    const sourceAnalysis = buildSourceRows(
      sourceSummaryReport.rows ?? [],
      sourceSignupCompletedReport.rows ?? []
    );
    const portalFlowRows = buildPortalFlowRows(
      landingPagesReport.rows ?? [],
      engagedPagesReport.rows ?? [],
      authPagesReport.rows ?? [],
      sourceAnalysis,
      accountsBySource
    );
    const pageInsights = buildPageInsights(globalPagesReport.rows ?? []);
    const resolvedPage = resolvePageCandidate(globalPagesReport.rows ?? [], input.pageQuery);
    let pageDrilldown: JourneyPageDrilldown | null = null;

    if (resolvedPage) {
      const [
        pageOverviewReport,
        pageNewVsReturningReport,
        pageSourceReport,
        pageDeviceReport,
        pageRegionReport,
        pagePreviousReport,
        pageNextReport,
        pageEntranceReport,
      ] = await batchRunReports(client, property, [
        {
          property,
          dateRanges: [dateRange],
          dimensionFilter: currentPageFilter(resolvedPage.pagePath),
          metrics: [
            { name: "sessions" },
            { name: "totalUsers" },
            { name: "activeUsers" },
            { name: "averageSessionDuration" },
            { name: "bounceRate" },
            { name: "screenPageViews" },
            { name: "userEngagementDuration" },
          ],
        },
        {
          property,
          dateRanges: [dateRange],
          dimensionFilter: currentPageFilter(resolvedPage.pagePath),
          dimensions: [{ name: "newVsReturning" }],
          metrics: [{ name: "totalUsers" }],
        },
        {
          property,
          dateRanges: [dateRange],
          dimensionFilter: currentPageFilter(resolvedPage.pagePath),
          dimensions: [{ name: "sessionDefaultChannelGroup" }],
          metrics: [{ name: "sessions" }],
          orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
          limit: 100,
        },
        {
          property,
          dateRanges: [dateRange],
          dimensionFilter: currentPageFilter(resolvedPage.pagePath),
          dimensions: [{ name: "deviceCategory" }],
          metrics: [{ name: "totalUsers" }],
          orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
          limit: 20,
        },
        {
          property,
          dateRanges: [dateRange],
          dimensionFilter: currentPageFilter(resolvedPage.pagePath),
          dimensions: [{ name: "country" }, { name: "region" }],
          metrics: [{ name: "totalUsers" }],
          orderBys: [{ metric: { metricName: "totalUsers" }, desc: true }],
          limit: 40,
        },
        {
          property,
          dateRanges: [dateRange],
          dimensionFilter: pageViewPathFilter(resolvedPage.pagePath),
          dimensions: [{ name: "pageReferrer" }],
          metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 250,
        },
        {
          property,
          dateRanges: [dateRange],
          dimensionFilter: andFilters(
            regexFilter(
              "pageReferrer",
              selectedPageReferrerRegex(resolvedPage.pagePath, hostnames)
            ),
            exactFilter("eventName", "page_view")
          ),
          dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
          metrics: [{ name: "screenPageViews" }, { name: "totalUsers" }],
          orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
          limit: 250,
        },
        {
          property,
          dateRanges: [dateRange],
          dimensionFilter: regexFilter(
            "landingPagePlusQueryString",
            landingPageRegex(resolvedPage.pagePath)
          ),
          metrics: [{ name: "sessions" }],
        },
      ]);

      pageDrilldown = buildPageDrilldown({
        query: input.pageQuery,
        page: resolvedPage,
        hostnames,
        overviewReport: pageOverviewReport,
        newVsReturningReport: pageNewVsReturningReport,
        sourceReport: pageSourceReport,
        deviceReport: pageDeviceReport,
        regionReport: pageRegionReport,
        previousReport: pagePreviousReport,
        nextReport: pageNextReport,
        entranceReport: pageEntranceReport,
      });
    } else if (input.pageQuery?.trim()) {
      pageDrilldown = buildEmptyPageDrilldown(input.pageQuery);
    }

    const signupCompleted = stepCounts.signup_completed;
    const authAbandoned = Math.max(authVisitors - signupCompleted, 0);
    const totalNewReturningUsers = Math.round(newUsers + returningUsers);
    const portalInsights: JourneyPortalInsights = {
      sessions: totalSessions,
      totalUsers: visitors,
      avgSessionDurationSeconds,
      bounceRate,
      pageviews,
      newUsers: Math.round(newUsers),
      returningUsers: Math.round(returningUsers),
      newUserShare: totalNewReturningUsers > 0 ? newUsers / totalNewReturningUsers : 0,
      returningUserShare:
        totalNewReturningUsers > 0 ? returningUsers / totalNewReturningUsers : 0,
      authVisitors,
      authAbandoned,
      signupCompleted,
      ...portalBase,
    };

    return {
      dataMode: "ga4",
      generatedAt: new Date().toISOString(),
      windowDays: dateRange.windowDays,
      rangeStart: dateRange.startDate,
      rangeEnd: dateRange.endDate,
      totalEvents: totalSessions,
      trackedVisitors: visitors,
      hasEventData: visitors > 0,
      funnelStages,
      dropoff: buildDropoffSummary(funnelStages, behaviorCounts),
      contentDrivers: buildContentRows(
        contentPagesReport.rows ?? [],
        transitionsReport.rows ?? []
      ),
      deviceAnalysis: buildDeviceRows(
        deviceSummaryReport.rows ?? [],
        deviceSignupStartReport.rows ?? [],
        deviceSignupCompletedReport.rows ?? []
      ),
      sourceAnalysis,
      timeline: {
        query: input.query?.trim() || null,
        searched: Boolean(input.query?.trim()),
        sessions: [],
      },
      ga4Timeline: buildGa4Timeline(timelineReport.rows ?? [], input.query),
      portalFlowRows,
      portalInsights,
      mostViewedPages: pageInsights.mostViewedPages,
      highestDropoffPages: pageInsights.highestDropoffPages,
      pageDrilldown,
      notes: [],
    };
  } finally {
    await client.close();
  }
}
