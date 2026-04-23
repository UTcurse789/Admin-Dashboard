const BREVO_BASE_URL = "https://api.brevo.com/v3";
const CONTACT_PAGE_SIZE = 500;
const EVENTS_LIMIT = 200;
const CAMPAIGN_LIMIT = 25;
const LIST_LIMIT = 50;

const CONTACT_COVERAGE_FIELDS = [
  { key: "FIRSTNAME", label: "First name" },
  { key: "LASTNAME", label: "Last name" },
  { key: "JOB_TITLE", label: "Job title" },
  { key: "ORGANISATION", label: "Organisation" },
  { key: "INDUSTRY", label: "Industry" },
  { key: "COMMUNITY", label: "Community" },
  { key: "SOURCE", label: "Source" },
  { key: "FREQUENCY", label: "Frequency" },
  { key: "PREFERENCE", label: "Preference" },
  { key: "UTM_SOURCE", label: "UTM source" },
  { key: "UTM_MEDIUM", label: "UTM medium" },
  { key: "UTM_CAMPAIGN", label: "UTM campaign" },
  { key: "PHONE", label: "Phone" },
  { key: "LINKEDIN", label: "LinkedIn" },
] as const;

type BrevoAttributeValue =
  | string
  | number
  | boolean
  | null
  | Array<string | number | boolean | null>;

interface BrevoContactRecord {
  id: number;
  email: string | null;
  createdAt: string;
  emailBlacklisted: boolean;
  smsBlacklisted: boolean;
  listIds?: number[];
  attributes?: Record<string, BrevoAttributeValue>;
}

interface BrevoContactsResponse {
  contacts: BrevoContactRecord[];
  count: number;
}

interface BrevoListRecord {
  id: number;
  name: string;
  uniqueSubscribers: number;
  totalSubscribers?: number;
  totalBlacklisted?: number;
}

interface BrevoListsResponse {
  lists: BrevoListRecord[];
  count: number;
}

interface BrevoCampaignListItem {
  id: number;
  name: string;
  status: string;
  subject?: string;
  sentDate?: string | null;
  sender?: {
    email?: string;
    name?: string;
  };
}

interface BrevoCampaignsResponse {
  campaigns: BrevoCampaignListItem[];
  count: number;
}

interface BrevoCampaignStatsByList {
  listId: number;
  uniqueClicks?: number;
  delivered?: number;
  sent?: number;
  softBounces?: number;
  hardBounces?: number;
  uniqueViews?: number;
  unsubscriptions?: number;
  viewed?: number;
  deferred?: number;
}

interface BrevoCampaignReport {
  id: number;
  name: string;
  subject?: string;
  status: string;
  sentDate?: string | null;
  sender?: {
    email?: string;
    name?: string;
  };
  recipients?: {
    lists?: number[];
  };
  statistics?: {
    campaignStats?: BrevoCampaignStatsByList[];
  };
}

interface BrevoPlanRecord {
  type?: string;
  credits?: number;
  creditsType?: string;
}

interface BrevoAccountResponse {
  companyName?: string;
  email?: string;
  dateTimePreferences?: {
    timezone?: string;
  };
  relay?: {
    enabled?: boolean;
  };
  marketingAutomation?: {
    enabled?: boolean;
  };
  plan?: BrevoPlanRecord[];
}

interface BrevoSmtpAggregatedReport {
  range?: string;
  requests?: number;
  delivered?: number;
  hardBounces?: number;
  softBounces?: number;
  clicks?: number;
  uniqueClicks?: number;
  opens?: number;
  uniqueOpens?: number;
  spamReports?: number;
  blocked?: number;
  invalid?: number;
  unsubscribed?: number;
  loadedByProxy?: number;
  deferred?: number;
  error?: number;
}

interface BrevoEventRecord {
  date: string;
  event: string;
  email: string | null;
  subject: string | null;
  tag?: string | null;
  messageId?: string | null;
}

interface BrevoEventsResponse {
  events: BrevoEventRecord[];
  count?: number | null;
}

export interface BrevoDailyMetric {
  date: string;
  count: number;
}

export interface BrevoBreakdownItem {
  label: string;
  count: number;
  share: number;
}

export interface BrevoCoverageField {
  label: string;
  key: string;
  populated: number;
  share: number;
}

export interface BrevoRecentContact {
  id: number;
  email: string | null;
  createdAt: string;
  firstName: string | null;
  organisation: string | null;
  industry: string | null;
  source: string | null;
  lists: string[];
}

export interface BrevoCampaignListPerformance {
  listId: number;
  listName: string;
  sent: number;
  delivered: number;
  uniqueViews: number;
  uniqueClicks: number;
  openRate: number;
  clickRate: number;
  deferred: number;
}

export interface BrevoCampaignPerformance {
  id: number;
  name: string;
  subject: string;
  senderEmail: string | null;
  sentDate: string | null;
  sent: number;
  delivered: number;
  uniqueViews: number;
  uniqueClicks: number;
  hardBounces: number;
  softBounces: number;
  deferred: number;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  lists: BrevoCampaignListPerformance[];
}

export interface BrevoRecentEvent {
  date: string;
  event: string;
  email: string | null;
  subject: string | null;
}

export interface BrevoInsight {
  tone: "positive" | "warning" | "neutral";
  title: string;
  detail: string;
}

export interface BrevoBreakdownContactRecord {
  id: number;
  email: string | null;
  firstName: string | null;
  organisation: string | null;
  createdAt: string;
  value: string;
}

export interface BrevoBreakdownWithContacts extends BrevoBreakdownItem {
  contacts: BrevoBreakdownContactRecord[];
}

export interface BrevoAnalyticsData {
  available: boolean;
  statusMessage: string | null;
  generatedAt: string;
  account: {
    companyName: string | null;
    email: string | null;
    timezone: string | null;
    relayEnabled: boolean;
    marketingAutomationEnabled: boolean;
    sendCreditsRemaining: number;
    planNames: string[];
    activeSenders: string[];
  };
  metrics: {
    totalContacts: number;
    contactsLast30Days: number;
    contactsPrev30Days: number;
    contactGrowthRate: number;
    emailBlacklistCount: number;
    emailBlacklistRate: number;
    totalLists: number;
    totalCampaigns: number;
    sentCampaigns: number;
    draftCampaigns: number;
    deliveryRate90d: number;
    uniqueOpenRate90d: number;
    uniqueClickRate90d: number;
    clickToOpenRate90d: number;
    issueRate90d: number;
  };
  contacts: {
    trend30d: BrevoDailyMetric[];
    listBreakdown: BrevoBreakdownItem[];
    domainBreakdown: BrevoBreakdownItem[];
    industryBreakdown: BrevoBreakdownItem[];
    sourceBreakdown: BrevoBreakdownItem[];
    communityBreakdown: BrevoBreakdownItem[];
    frequencyBreakdown: BrevoBreakdownWithContacts[];
    preferenceBreakdown: BrevoBreakdownWithContacts[];
    utmCampaignBreakdown: BrevoBreakdownWithContacts[];
    utmMediumBreakdown: BrevoBreakdownWithContacts[];
    utmSourceBreakdown: BrevoBreakdownWithContacts[];
    profileCoverage: BrevoCoverageField[];
    recentContacts: BrevoRecentContact[];
  };
  campaigns: {
    recentSent: BrevoCampaignPerformance[];
    weightedOpenRate: number;
    weightedClickRate: number;
    weightedClickToOpenRate: number;
    totalDelivered: number;
    bestOpenCampaign: BrevoCampaignPerformance | null;
    bestClickCampaign: BrevoCampaignPerformance | null;
    highestBounceCampaign: BrevoCampaignPerformance | null;
  };
  transactional: {
    rangeLabel: string | null;
    requests: number;
    delivered: number;
    blocked: number;
    hardBounces: number;
    softBounces: number;
    deferred: number;
    errors: number;
    uniqueOpens: number;
    uniqueClicks: number;
    unsubscribed: number;
    deliveryRate: number;
    uniqueOpenRate: number;
    uniqueClickRate: number;
    clickToOpenRate: number;
    issueRate: number;
    eventBreakdown: BrevoBreakdownItem[];
    topSubjects: BrevoBreakdownItem[];
    recentIssues: BrevoRecentEvent[];
    recentActivity: BrevoRecentEvent[];
  };
  insights: BrevoInsight[];
}

function toNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function percentage(value: number, total: number, digits = 1) {
  if (total <= 0) {
    return 0;
  }

  return round((value / total) * 100, digits);
}

function isFilledText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function getTextAttribute(contact: BrevoContactRecord, key: string) {
  const value = contact.attributes?.[key];

  if (Array.isArray(value)) {
    const entries = value
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry ?? "")))
      .filter(Boolean);

    return entries.length > 0 ? entries.join(", ") : null;
  }

  if (typeof value === "string") {
    return value.trim() || null;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return null;
}

function sum(values: Array<number | null | undefined>) {
  return values.reduce<number>((total, value) => total + (value ?? 0), 0);
}

function countSince(dateValue: string, sinceTimestamp: number) {
  const parsed = Date.parse(dateValue);
  return Number.isFinite(parsed) && parsed >= sinceTimestamp;
}

function buildLastThirtyDaySeries(contacts: BrevoContactRecord[]): BrevoDailyMetric[] {
  const counts = new Map<string, number>();

  contacts.forEach((contact) => {
    if (!contact.createdAt) {
      return;
    }

    const key = contact.createdAt.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  const dates: BrevoDailyMetric[] = [];

  for (let dayOffset = 29; dayOffset >= 0; dayOffset -= 1) {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - dayOffset);
    const key = date.toISOString().slice(0, 10);
    dates.push({
      date: key,
      count: counts.get(key) ?? 0,
    });
  }

  return dates;
}

function groupToBreakdown(
  values: Array<string | null | undefined>,
  total: number,
  limit = 8,
  includeBlank = false
) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const normalized = isFilledText(value) ? value : includeBlank ? "(blank)" : null;

    if (!normalized) {
      return;
    }

    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({
      label,
      count,
      share: percentage(count, total),
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limit);
}

function groupToBreakdownWithContacts(
  contacts: BrevoContactRecord[],
  attrKey: string,
  total: number,
  limit = 8
): BrevoBreakdownWithContacts[] {
  const buckets = new Map<string, BrevoContactRecord[]>();

  contacts.forEach((contact) => {
    const raw = getTextAttribute(contact, attrKey);
    const values = attrKey === "COMMUNITY"
      ? splitMultiValue(raw)
      : raw
        ? [raw]
        : [];

    values.forEach((value) => {
      const normalized = value.trim();
      if (!normalized) return;
      if (!buckets.has(normalized)) buckets.set(normalized, []);
      buckets.get(normalized)!.push(contact);
    });
  });

  return Array.from(buckets.entries())
    .map(([label, matched]) => ({
      label,
      count: matched.length,
      share: percentage(matched.length, total),
      contacts: matched.slice(0, 50).map((c) => ({
        id: c.id,
        email: c.email,
        firstName: getTextAttribute(c, "FIRSTNAME"),
        organisation: getTextAttribute(c, "ORGANISATION"),
        createdAt: c.createdAt,
        value: label,
      })),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function splitMultiValue(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function brevoFetch<T>(path: string): Promise<T> {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured.");
  }

  const response = await fetch(`${BREVO_BASE_URL}${path}`, {
    headers: {
      "api-key": apiKey,
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    let message = response.statusText;

    try {
      const errorBody = (await response.json()) as { message?: string };
      message = errorBody.message ?? message;
    } catch {
      // Ignore JSON parse failures and keep the HTTP status text.
    }

    throw new Error(`[Brevo] ${path} failed (${response.status}): ${message}`);
  }

  return (await response.json()) as T;
}

async function getAllContacts() {
  let offset = 0;
  let total = 0;
  const contacts: BrevoContactRecord[] = [];

  while (true) {
    const response = await brevoFetch<BrevoContactsResponse>(
      `/contacts?limit=${CONTACT_PAGE_SIZE}&offset=${offset}&sort=desc`
    );

    total = response.count;
    contacts.push(...response.contacts);

    if (response.contacts.length < CONTACT_PAGE_SIZE || contacts.length >= response.count) {
      break;
    }

    offset += CONTACT_PAGE_SIZE;
  }

  return {
    count: total,
    contacts,
  };
}

function summarizeCampaign(
  report: BrevoCampaignReport,
  listNameMap: Map<number, string>
): BrevoCampaignPerformance {
  const listStats = report.statistics?.campaignStats ?? [];
  const sent = sum(listStats.map((row) => row.sent));
  const delivered = sum(listStats.map((row) => row.delivered));
  const uniqueViews = sum(listStats.map((row) => row.uniqueViews));
  const uniqueClicks = sum(listStats.map((row) => row.uniqueClicks));
  const hardBounces = sum(listStats.map((row) => row.hardBounces));
  const softBounces = sum(listStats.map((row) => row.softBounces));
  const deferred = sum(listStats.map((row) => row.deferred));

  return {
    id: report.id,
    name: report.name,
    subject: report.subject ?? report.name,
    senderEmail: report.sender?.email ?? null,
    sentDate: report.sentDate ?? null,
    sent,
    delivered,
    uniqueViews,
    uniqueClicks,
    hardBounces,
    softBounces,
    deferred,
    openRate: percentage(uniqueViews, delivered),
    clickRate: percentage(uniqueClicks, delivered),
    clickToOpenRate: percentage(uniqueClicks, uniqueViews),
    lists: listStats
      .map((row) => {
        const rowSent = toNumber(row.sent);
        const rowDelivered = toNumber(row.delivered);
        const rowUniqueViews = toNumber(row.uniqueViews);
        const rowUniqueClicks = toNumber(row.uniqueClicks);

        return {
          listId: row.listId,
          listName: listNameMap.get(row.listId) ?? `List ${row.listId}`,
          sent: rowSent,
          delivered: rowDelivered,
          uniqueViews: rowUniqueViews,
          uniqueClicks: rowUniqueClicks,
          openRate: percentage(rowUniqueViews, rowDelivered),
          clickRate: percentage(rowUniqueClicks, rowDelivered),
          deferred: toNumber(row.deferred),
        };
      })
      .sort((left, right) => right.delivered - left.delivered),
  };
}

function buildUnavailableData(statusMessage: string): BrevoAnalyticsData {
  return {
    available: false,
    statusMessage,
    generatedAt: new Date().toISOString(),
    account: {
      companyName: null,
      email: null,
      timezone: null,
      relayEnabled: false,
      marketingAutomationEnabled: false,
      sendCreditsRemaining: 0,
      planNames: [],
      activeSenders: [],
    },
    metrics: {
      totalContacts: 0,
      contactsLast30Days: 0,
      contactsPrev30Days: 0,
      contactGrowthRate: 0,
      emailBlacklistCount: 0,
      emailBlacklistRate: 0,
      totalLists: 0,
      totalCampaigns: 0,
      sentCampaigns: 0,
      draftCampaigns: 0,
      deliveryRate90d: 0,
      uniqueOpenRate90d: 0,
      uniqueClickRate90d: 0,
      clickToOpenRate90d: 0,
      issueRate90d: 0,
    },
    contacts: {
      trend30d: [],
      listBreakdown: [],
      domainBreakdown: [],
      industryBreakdown: [],
      sourceBreakdown: [],
      communityBreakdown: [],
      frequencyBreakdown: [],
      preferenceBreakdown: [],
      utmCampaignBreakdown: [],
      utmMediumBreakdown: [],
      utmSourceBreakdown: [],
      profileCoverage: [],
      recentContacts: [],
    },
    campaigns: {
      recentSent: [],
      weightedOpenRate: 0,
      weightedClickRate: 0,
      weightedClickToOpenRate: 0,
      totalDelivered: 0,
      bestOpenCampaign: null,
      bestClickCampaign: null,
      highestBounceCampaign: null,
    },
    transactional: {
      rangeLabel: null,
      requests: 0,
      delivered: 0,
      blocked: 0,
      hardBounces: 0,
      softBounces: 0,
      deferred: 0,
      errors: 0,
      uniqueOpens: 0,
      uniqueClicks: 0,
      unsubscribed: 0,
      deliveryRate: 0,
      uniqueOpenRate: 0,
      uniqueClickRate: 0,
      clickToOpenRate: 0,
      issueRate: 0,
      eventBreakdown: [],
      topSubjects: [],
      recentIssues: [],
      recentActivity: [],
    },
    insights: [],
  };
}

export async function getBrevoAnalytics(): Promise<BrevoAnalyticsData> {
  if (!process.env.BREVO_API_KEY) {
    return buildUnavailableData("BREVO_API_KEY is not configured.");
  }

  try {
    const warnings: string[] = [];

    const [
      accountResult,
      contactsResult,
      listsResult,
      campaignsResult,
      smtpResult,
      eventsResult,
    ] = await Promise.allSettled([
      brevoFetch<BrevoAccountResponse>("/account"),
      getAllContacts(),
      brevoFetch<BrevoListsResponse>(
        `/contacts/lists?limit=${LIST_LIMIT}&offset=0&sort=desc`
      ),
      brevoFetch<BrevoCampaignsResponse>(
        `/emailCampaigns?limit=${CAMPAIGN_LIMIT}&offset=0&sort=desc`
      ),
      brevoFetch<BrevoSmtpAggregatedReport>("/smtp/statistics/aggregatedReport?days=90"),
      brevoFetch<BrevoEventsResponse>(
        `/smtp/statistics/events?limit=${EVENTS_LIMIT}&offset=0&sort=desc`
      ),
    ]);

    if (accountResult.status === "rejected") {
      warnings.push("Account metadata could not be loaded.");
    }

    if (eventsResult.status === "rejected") {
      warnings.push("Recent SMTP event activity could not be loaded.");
    }

    if (
      contactsResult.status === "rejected" ||
      listsResult.status === "rejected" ||
      campaignsResult.status === "rejected" ||
      smtpResult.status === "rejected"
    ) {
      let blockingError: unknown = "Brevo analytics could not be loaded.";

      if (contactsResult.status === "rejected") {
        blockingError = contactsResult.reason;
      } else if (listsResult.status === "rejected") {
        blockingError = listsResult.reason;
      } else if (campaignsResult.status === "rejected") {
        blockingError = campaignsResult.reason;
      } else if (smtpResult.status === "rejected") {
        blockingError = smtpResult.reason;
      }

      return buildUnavailableData(
        blockingError instanceof Error
          ? blockingError.message
          : "Brevo analytics could not be loaded."
      );
    }

    const account = accountResult.status === "fulfilled" ? accountResult.value : null;
    const contactsPayload = contactsResult.value;
    const listsPayload = listsResult.value;
    const campaignsPayload = campaignsResult.value;
    const smtp = smtpResult.value;
    const events = eventsResult.status === "fulfilled" ? eventsResult.value.events : [];

    const contacts = contactsPayload.contacts;
    const lists = listsPayload.lists;
    const campaigns = campaignsPayload.campaigns;
    const listNameMap = new Map(lists.map((list) => [list.id, list.name]));

    const recentSentCampaigns = campaigns.filter((campaign) => campaign.status === "sent");
    const sentCampaignReports = await Promise.allSettled(
      recentSentCampaigns.map((campaign) =>
        brevoFetch<BrevoCampaignReport>(`/emailCampaigns/${campaign.id}?excludeHtmlContent=true`)
      )
    );

    const recentSent = sentCampaignReports
      .filter(
        (result): result is PromiseFulfilledResult<BrevoCampaignReport> =>
          result.status === "fulfilled"
      )
      .map((result) => summarizeCampaign(result.value, listNameMap))
      .sort((left, right) =>
        (right.sentDate ?? "").localeCompare(left.sentDate ?? "")
      );

    if (sentCampaignReports.some((result) => result.status === "rejected")) {
      warnings.push("One or more campaign reports could not be loaded.");
    }

    const now = Date.now();
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;

    const totalContacts = contactsPayload.count;
    const contactsLast30Days = contacts.filter((contact) =>
      countSince(contact.createdAt, thirtyDaysAgo)
    ).length;
    const contactsPrev30Days = contacts.filter((contact) => {
      const createdAt = Date.parse(contact.createdAt);
      return Number.isFinite(createdAt) && createdAt >= sixtyDaysAgo && createdAt < thirtyDaysAgo;
    }).length;
    const emailBlacklistCount = contacts.filter((contact) => contact.emailBlacklisted).length;

    const listBreakdown = lists
      .map((list) => ({
        label: list.name,
        count: list.uniqueSubscribers,
        share: percentage(list.uniqueSubscribers, Math.max(totalContacts, 1)),
      }))
      .sort((left, right) => right.count - left.count);

    const domainBreakdown = groupToBreakdown(
      contacts.map((contact) => {
        if (!contact.email || !contact.email.includes("@")) {
          return null;
        }

        return contact.email.split("@")[1]?.toLowerCase() ?? null;
      }),
      Math.max(totalContacts, 1),
      8
    );

    const industryBreakdown = groupToBreakdown(
      contacts.map((contact) => getTextAttribute(contact, "INDUSTRY")),
      Math.max(totalContacts, 1),
      8,
      true
    );

    const sourceBreakdown = groupToBreakdown(
      contacts.map((contact) => getTextAttribute(contact, "SOURCE")),
      Math.max(totalContacts, 1),
      8,
      true
    );

    const communityBreakdown = groupToBreakdown(
      contacts.flatMap((contact) => splitMultiValue(getTextAttribute(contact, "COMMUNITY"))),
      Math.max(totalContacts, 1),
      8
    );

    const frequencyBreakdown = groupToBreakdownWithContacts(
      contacts,
      "FREQUENCY",
      Math.max(totalContacts, 1),
      8
    );

    const preferenceBreakdown = groupToBreakdownWithContacts(
      contacts,
      "PREFERENCE",
      Math.max(totalContacts, 1),
      8
    );

    const utmCampaignBreakdown = groupToBreakdownWithContacts(
      contacts,
      "UTM_CAMPAIGN",
      Math.max(totalContacts, 1),
      8
    );

    const utmMediumBreakdown = groupToBreakdownWithContacts(
      contacts,
      "UTM_MEDIUM",
      Math.max(totalContacts, 1),
      8
    );

    const utmSourceBreakdown = groupToBreakdownWithContacts(
      contacts,
      "UTM_SOURCE",
      Math.max(totalContacts, 1),
      8
    );

    const profileCoverage = CONTACT_COVERAGE_FIELDS.map((field) => {
      const populated = contacts.filter((contact) =>
        isFilledText(getTextAttribute(contact, field.key))
      ).length;

      return {
        label: field.label,
        key: field.key,
        populated,
        share: percentage(populated, Math.max(totalContacts, 1)),
      };
    });

    const recentContacts = contacts.slice(0, 8).map((contact) => ({
      id: contact.id,
      email: contact.email,
      createdAt: contact.createdAt,
      firstName: getTextAttribute(contact, "FIRSTNAME"),
      organisation: getTextAttribute(contact, "ORGANISATION"),
      industry: getTextAttribute(contact, "INDUSTRY"),
      source: getTextAttribute(contact, "SOURCE"),
      lists: (contact.listIds ?? []).map(
        (listId) => listNameMap.get(listId) ?? `List ${listId}`
      ),
    }));

    const totalDeliveredAcrossCampaigns = sum(recentSent.map((campaign) => campaign.delivered));
    const totalUniqueViewsAcrossCampaigns = sum(
      recentSent.map((campaign) => campaign.uniqueViews)
    );
    const totalUniqueClicksAcrossCampaigns = sum(
      recentSent.map((campaign) => campaign.uniqueClicks)
    );

    const bestOpenCampaign =
      recentSent.length > 0
        ? [...recentSent].sort((left, right) => right.openRate - left.openRate)[0]
        : null;
    const bestClickCampaign =
      recentSent.length > 0
        ? [...recentSent].sort(
            (left, right) => right.clickToOpenRate - left.clickToOpenRate
          )[0]
        : null;
    const highestBounceCampaign =
      recentSent.length > 0
        ? [...recentSent].sort(
            (left, right) =>
              right.hardBounces +
              right.softBounces -
              (left.hardBounces + left.softBounces)
          )[0]
        : null;

    const requests = toNumber(smtp.requests);
    const delivered = toNumber(smtp.delivered);
    const blocked = toNumber(smtp.blocked);
    const hardBounces = toNumber(smtp.hardBounces);
    const softBounces = toNumber(smtp.softBounces);
    const deferred = toNumber(smtp.deferred);
    const errors = toNumber(smtp.error);
    const uniqueOpens = toNumber(smtp.uniqueOpens);
    const uniqueClicks = toNumber(smtp.uniqueClicks);
    const unsubscribed = toNumber(smtp.unsubscribed);
    const issueCount = blocked + hardBounces + softBounces + deferred + errors;

    const eventBreakdown = groupToBreakdown(
      events.map((event) => event.event),
      Math.max(events.length, 1),
      8
    );

    const topSubjects = groupToBreakdown(
      events.map((event) => event.subject ?? "No subject"),
      Math.max(events.length, 1),
      6
    );

    const recentIssues = events
      .filter((event) => ["blocked", "deferred", "error"].includes(event.event))
      .slice(0, 8)
      .map((event) => ({
        date: event.date,
        event: event.event,
        email: event.email,
        subject: event.subject,
      }));

    const recentActivity = events.slice(0, 10).map((event) => ({
      date: event.date,
      event: event.event,
      email: event.email,
      subject: event.subject,
    }));

    const activeSenders = Array.from(
      new Set(
        campaigns
          .map((campaign) => campaign.sender?.email)
          .filter((value): value is string => Boolean(value))
      )
    );

    const sendCreditsRemaining = sum(
      (account?.plan ?? [])
        .filter((plan) => plan.creditsType === "sendLimit")
        .map((plan) => plan.credits)
    );

    const dominantList = listBreakdown[0] ?? null;
    const dominantSource = sourceBreakdown[0] ?? null;
    const utmCampaignCoverage =
      profileCoverage.find((field) => field.key === "UTM_CAMPAIGN")?.share ?? 0;
    const industryBlankShare =
      industryBreakdown.find((entry) => entry.label === "(blank)")?.share ?? 0;

    const insights: BrevoInsight[] = [];

    if (dominantList) {
      insights.push({
        tone: dominantList.share >= 70 ? "warning" : "positive",
        title: `${dominantList.label} is the center of gravity`,
        detail: `${dominantList.count} of ${totalContacts} contacts (${dominantList.share}%) are concentrated in that list, which makes it the primary Brevo audience for the brand right now.`,
      });
    }

    if (dominantSource) {
      insights.push({
        tone: dominantSource.label === "Portal" ? "neutral" : "positive",
        title: `${dominantSource.label} drives most captured contacts`,
        detail: `${dominantSource.count} contacts (${dominantSource.share}%) arrived with that source value. Source diversity is still thin, so Brevo attribution will stay narrow until more acquisition channels are tagged cleanly.`,
      });
    }

    insights.push({
      tone: utmCampaignCoverage < 25 ? "warning" : "positive",
      title:
        utmCampaignCoverage < 25
          ? "Attribution fields are the weakest part of the contact model"
          : "Campaign attribution is showing up reliably",
      detail: `${utmCampaignCoverage}% of contacts currently carry a UTM campaign value. Core profile fields are strong, but campaign-source analytics will stay shallow until UTM fields are captured more consistently in Brevo.`,
    });

    if (bestOpenCampaign) {
      insights.push({
        tone: bestOpenCampaign.openRate >= 40 ? "positive" : "neutral",
        title: `${bestOpenCampaign.name} is the strongest opener`,
        detail: `${bestOpenCampaign.openRate}% of delivered recipients opened it, while ${bestOpenCampaign.clickToOpenRate}% of openers clicked through. That makes it the best recent benchmark for editorial newsletter performance.`,
      });
    }

    insights.push({
      tone: percentage(issueCount, Math.max(requests, 1)) > 8 ? "warning" : "positive",
      title:
        percentage(issueCount, Math.max(requests, 1)) > 8
          ? "Transactional deliverability needs active cleanup"
          : "Transactional mail is broadly healthy",
      detail: `${delivered} of ${requests} transactional requests were delivered over the last 90 days, while ${issueCount} were blocked, bounced, deferred, or errored. The blended issue rate is ${percentage(issueCount, Math.max(requests, 1))}%.`,
    });

    if (sendCreditsRemaining > 0) {
      insights.push({
        tone: sendCreditsRemaining < 250 ? "warning" : "neutral",
        title:
          sendCreditsRemaining < 250
            ? "Send credits are getting tight"
            : "Send credits are not an immediate bottleneck",
        detail: `${sendCreditsRemaining} Brevo send credits remain on the current plan snapshot. That should be watched closely if newsletter or reminder volume increases.`,
      });
    }

    if (industryBlankShare > 0) {
      insights.push({
        tone: industryBlankShare > 20 ? "warning" : "neutral",
        title: "Industry segmentation is mostly usable",
        detail: `${round(100 - industryBlankShare, 1)}% of contacts already have an industry filled in. The remaining ${industryBlankShare}% are the segment gap to close before industry-level campaigns can be trusted fully.`,
      });
    }

    return {
      available: true,
      statusMessage: warnings.length > 0 ? warnings.join(" ") : null,
      generatedAt: new Date().toISOString(),
      account: {
        companyName: account?.companyName ?? null,
        email: account?.email ?? null,
        timezone: account?.dateTimePreferences?.timezone ?? null,
        relayEnabled: Boolean(account?.relay?.enabled),
        marketingAutomationEnabled: Boolean(account?.marketingAutomation?.enabled),
        sendCreditsRemaining,
        planNames: (account?.plan ?? [])
          .map((plan) => plan.type)
          .filter((value): value is string => Boolean(value)),
        activeSenders,
      },
      metrics: {
        totalContacts,
        contactsLast30Days,
        contactsPrev30Days,
        contactGrowthRate: percentage(
          contactsLast30Days - contactsPrev30Days,
          Math.max(contactsPrev30Days, 1)
        ),
        emailBlacklistCount,
        emailBlacklistRate: percentage(emailBlacklistCount, Math.max(totalContacts, 1)),
        totalLists: listsPayload.count,
        totalCampaigns: campaignsPayload.count,
        sentCampaigns: recentSentCampaigns.length,
        draftCampaigns: campaigns.filter((campaign) => campaign.status === "draft").length,
        deliveryRate90d: percentage(delivered, Math.max(requests, 1)),
        uniqueOpenRate90d: percentage(uniqueOpens, Math.max(delivered, 1)),
        uniqueClickRate90d: percentage(uniqueClicks, Math.max(delivered, 1)),
        clickToOpenRate90d: percentage(uniqueClicks, Math.max(uniqueOpens, 1)),
        issueRate90d: percentage(issueCount, Math.max(requests, 1)),
      },
      contacts: {
        trend30d: buildLastThirtyDaySeries(contacts),
        listBreakdown,
        domainBreakdown,
        industryBreakdown,
        sourceBreakdown,
        communityBreakdown,
        frequencyBreakdown,
        preferenceBreakdown,
        utmCampaignBreakdown,
        utmMediumBreakdown,
        utmSourceBreakdown,
        profileCoverage,
        recentContacts,
      },
      campaigns: {
        recentSent,
        weightedOpenRate: percentage(
          totalUniqueViewsAcrossCampaigns,
          Math.max(totalDeliveredAcrossCampaigns, 1)
        ),
        weightedClickRate: percentage(
          totalUniqueClicksAcrossCampaigns,
          Math.max(totalDeliveredAcrossCampaigns, 1)
        ),
        weightedClickToOpenRate: percentage(
          totalUniqueClicksAcrossCampaigns,
          Math.max(totalUniqueViewsAcrossCampaigns, 1)
        ),
        totalDelivered: totalDeliveredAcrossCampaigns,
        bestOpenCampaign,
        bestClickCampaign,
        highestBounceCampaign,
      },
      transactional: {
        rangeLabel: smtp.range ?? null,
        requests,
        delivered,
        blocked,
        hardBounces,
        softBounces,
        deferred,
        errors,
        uniqueOpens,
        uniqueClicks,
        unsubscribed,
        deliveryRate: percentage(delivered, Math.max(requests, 1)),
        uniqueOpenRate: percentage(uniqueOpens, Math.max(delivered, 1)),
        uniqueClickRate: percentage(uniqueClicks, Math.max(delivered, 1)),
        clickToOpenRate: percentage(uniqueClicks, Math.max(uniqueOpens, 1)),
        issueRate: percentage(issueCount, Math.max(requests, 1)),
        eventBreakdown,
        topSubjects,
        recentIssues,
        recentActivity,
      },
      insights: insights.slice(0, 6),
    };
  } catch (error) {
    return buildUnavailableData(
      error instanceof Error ? error.message : "Brevo analytics could not be loaded."
    );
  }
}
