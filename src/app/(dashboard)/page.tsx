import { clerkClient } from "@clerk/nextjs/server";
import {
  normalizeStrapiArticle,
  strapiFetch,
  StrapiArticle,
  StrapiResponse,
} from "@/lib/strapi";
import { getDbAnalytics } from "@/lib/db";
import { getJourneyDashboardData } from "@/lib/dashboard-journey";
import type { CountRow, DailyCount, DbUser } from "@/lib/db";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = ["bom1", "sin1"];
export const maxDuration = 30;

export interface DailyDataPoint {
  date: string;
  count: number;
}

export interface ContentTypeBreakdown {
  type: string;
  count: number;
}

export interface UserRecord {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  createdAt: number;
  lastSignInAt: number | null;
}

export interface ArticleRecord {
  title: string;
  type: string;
  publishedAt: string | null;
}

export interface DashboardData {
  totalUsers: number;
  newThisMonth: number;
  newPrevMonth: number;
  activeLast7Days: number;
  activePrev7Days: number;
  totalArticles: number;
  articlesPrevMonth: number;
  articlesThisMonth: number;
  growthRate: number;
  growthThisMonth: number;
  growthLastMonth: number;
  dailySignups: DailyDataPoint[];
  dailyContent: DailyDataPoint[];
  contentByType: ContentTypeBreakdown[];
  userJourney: {
    total: number;
    activeWithin30d: number;
    activeWithin7d: number;
    neverSignedIn: number;
  };
  weeklyActivity: { day: string; signups: number; logins: number }[];
  recentUsers: UserRecord[];
  recentArticles: ArticleRecord[];
  dbTotalUsers: number;
  bySource: CountRow[];
  byDataSource: CountRow[];
  bySalutation: CountRow[];
  byIndustry: CountRow[];
  byState: CountRow[];
  dailyRegistrations: DailyCount[];
  recentDbUsers: DbUser[];
  journeyAnalytics: Awaited<ReturnType<typeof getJourneyDashboardData>>;
}

function toDateKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

function getEmptyClerkData() {
  return {
    totalUsers: 0,
    newThisMonth: 0,
    newPrevMonth: 0,
    activeLast7Days: 0,
    activePrev7Days: 0,
    dailySignups: [] as DailyDataPoint[],
    weeklyActivity: [
      { day: "Sun", signups: 0, logins: 0 },
      { day: "Mon", signups: 0, logins: 0 },
      { day: "Tue", signups: 0, logins: 0 },
      { day: "Wed", signups: 0, logins: 0 },
      { day: "Thu", signups: 0, logins: 0 },
      { day: "Fri", signups: 0, logins: 0 },
      { day: "Sat", signups: 0, logins: 0 },
    ],
    userJourney: {
      total: 0,
      activeWithin30d: 0,
      activeWithin7d: 0,
      neverSignedIn: 0,
    },
    recentUsers: [] as UserRecord[],
  };
}

function getEmptyStrapiData() {
  return {
    totalArticles: 0,
    articlesThisMonth: 0,
    articlesPrevMonth: 0,
    dailyContent: [] as DailyDataPoint[],
    contentByType: [] as ContentTypeBreakdown[],
    recentArticles: [] as ArticleRecord[],
  };
}

function getEmptyJourneyData(): Awaited<
  ReturnType<typeof getJourneyDashboardData>
> {
  return {
    generatedAt: new Date().toISOString(),
    completedSignupDefinition:
      "Verified users who also selected at least one category or industry.",
    abandonedDefinition:
      "Users still unverified after repeated reminders or more than 30 days in the reminder funnel.",
    cohorts: [],
    pageInsights: {
      available: false,
      note: "Journey analytics are unavailable in this environment.",
      mostVisitedPage: null,
      dropoffPage: null,
    },
  };
}

async function getDashboardData(): Promise<DashboardData> {
  const clerkUsersPromise = getClerkUsers();
  const [clerkUsersResult, strapiResult, dbResult] = await Promise.allSettled([
    clerkUsersPromise,
    getStrapiData(),
    getDbAnalytics(),
  ]);

  if (clerkUsersResult.status === "rejected") {
    console.error("Clerk dashboard data failed:", clerkUsersResult.reason);
  }

  if (strapiResult.status === "rejected") {
    console.error("Strapi dashboard data failed:", strapiResult.reason);
  }

  if (dbResult.status === "rejected") {
    console.error("DB analytics failed:", dbResult.reason);
  }

  const clerkData =
    clerkUsersResult.status === "fulfilled"
      ? buildClerkData(clerkUsersResult.value)
      : getEmptyClerkData();
  const strapiData =
    strapiResult.status === "fulfilled"
      ? strapiResult.value
      : getEmptyStrapiData();
  const dbData = dbResult.status === "fulfilled" ? dbResult.value : null;
  const databaseUnavailable =
    dbData?.queryErrors.some((error) => error.startsWith("database:")) ?? false;

  let journeyAnalytics = getEmptyJourneyData();

  if (clerkUsersResult.status === "fulfilled" && !databaseUnavailable) {
    try {
      journeyAnalytics = await getJourneyDashboardData(clerkUsersResult.value);
    } catch (error) {
      console.error("Journey analytics failed:", error);
    }
  }

  return {
    ...clerkData,
    ...strapiData,
    dbTotalUsers: dbData?.totalDbUsers ?? 0,
    bySource: dbData?.bySource ?? [],
    byDataSource: dbData?.byDataSource ?? [],
    bySalutation: dbData?.bySalutation ?? [],
    byIndustry: dbData?.byIndustry ?? [],
    byState: dbData?.byState ?? [],
    dailyRegistrations: dbData?.dailyRegistrations ?? [],
    recentDbUsers: dbData?.recentDbUsers ?? [],
    growthRate: dbData?.growthRate ?? 0,
    growthThisMonth: dbData?.thisMonthCount ?? 0,
    growthLastMonth: dbData?.lastMonthCount ?? 0,
    journeyAnalytics,
  };
}

async function getClerkUsers(): Promise<UserRecord[]> {
  const client = await clerkClient();
  const users: UserRecord[] = [];
  let offset = 0;
  const limit = 500;

  while (true) {
    const response = await client.users.getUserList({
      limit,
      offset,
      orderBy: "-created_at",
    });

    users.push(
      ...response.data.map((user) => ({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || "No email",
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        createdAt: user.createdAt,
        lastSignInAt: user.lastSignInAt,
      }))
    );

    if (response.data.length < limit) {
      break;
    }

    offset += limit;
  }

  return users;
}

function buildClerkData(users: UserRecord[]) {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfPrevMonth = new Date(startOfMonth);
  startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1);
  const monthStartTs = startOfMonth.getTime();
  const prevMonthStartTs = startOfPrevMonth.getTime();

  const totalUsers = users.length;
  const newThisMonth = users.filter((u) => u.createdAt >= monthStartTs).length;
  const newPrevMonth = users.filter(
    (u) => u.createdAt >= prevMonthStartTs && u.createdAt < monthStartTs
  ).length;
  const activeLast7Days = users.filter(
    (u) => u.lastSignInAt && u.lastSignInAt >= sevenDaysAgo
  ).length;
  const activePrev7Days = users.filter(
    (u) =>
      u.lastSignInAt &&
      u.lastSignInAt >= fourteenDaysAgo &&
      u.lastSignInAt < sevenDaysAgo
  ).length;

  const signupMap = new Map<string, number>();
  users.forEach((u) => {
    const key = toDateKey(u.createdAt);
    signupMap.set(key, (signupMap.get(key) || 0) + 1);
  });
  const dailySignups: DailyDataPoint[] = Array.from(signupMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklySignups = [0, 0, 0, 0, 0, 0, 0];
  const weeklyLogins = [0, 0, 0, 0, 0, 0, 0];
  users.forEach((u) => {
    weeklySignups[new Date(u.createdAt).getDay()]++;
    if (u.lastSignInAt) {
      weeklyLogins[new Date(u.lastSignInAt).getDay()]++;
    }
  });
  const weeklyActivity = dayNames.map((day, index) => ({
    day,
    signups: weeklySignups[index],
    logins: weeklyLogins[index],
  }));

  const activeWithin30d = users.filter(
    (u) => u.lastSignInAt && u.lastSignInAt >= thirtyDaysAgo
  ).length;
  const neverSignedIn = users.filter((u) => !u.lastSignInAt).length;

  return {
    totalUsers,
    newThisMonth,
    newPrevMonth,
    activeLast7Days,
    activePrev7Days,
    dailySignups,
    weeklyActivity,
    userJourney: {
      total: totalUsers,
      activeWithin30d,
      activeWithin7d: activeLast7Days,
      neverSignedIn,
    },
    recentUsers: users.slice(0, 5),
  };
}

async function getStrapiData() {
  let totalArticles = 0;
  const allArticles: ArticleRecord[] = [];

  try {
    let page = 1;
    let pageCount = 1;

    while (page <= pageCount) {
      const data = await strapiFetch<StrapiResponse<StrapiArticle>>(
        `/api/contents?populate=*&sort=publishedAt:desc&pagination[page]=${page}&pagination[pageSize]=100`
      );

      totalArticles = data.meta.pagination.total;
      pageCount = data.meta.pagination.pageCount;
      allArticles.push(
        ...data.data.map((article) => {
          const normalized = normalizeStrapiArticle(article);
          return {
            title: normalized.title,
            type: normalized.category,
            publishedAt: normalized.publishedAt,
          };
        })
      );
      page += 1;
    }
  } catch (error) {
    console.error("Failed to fetch Strapi data:", error);
  }

  const contentMap = new Map<string, number>();
  allArticles.forEach((article) => {
    if (article.publishedAt) {
      const key = article.publishedAt.slice(0, 10);
      contentMap.set(key, (contentMap.get(key) || 0) + 1);
    }
  });
  const dailyContent: DailyDataPoint[] = Array.from(contentMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const typeMap = new Map<string, number>();
  allArticles.forEach((article) => {
    typeMap.set(article.type, (typeMap.get(article.type) || 0) + 1);
  });
  const contentByType: ContentTypeBreakdown[] = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfPrevMonth = new Date(startOfMonth);
  startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1);

  const articlesThisMonth = allArticles.filter(
    (article) => article.publishedAt && new Date(article.publishedAt) >= startOfMonth
  ).length;
  const articlesPrevMonth = allArticles.filter(
    (article) =>
      article.publishedAt &&
      new Date(article.publishedAt) >= startOfPrevMonth &&
      new Date(article.publishedAt) < startOfMonth
  ).length;

  return {
    totalArticles,
    articlesThisMonth,
    articlesPrevMonth,
    dailyContent,
    contentByType,
    recentArticles: allArticles.slice(0, 5),
  };
}

export default async function DashboardHome() {
  const data = await getDashboardData();
  return <DashboardClient data={data} />;
}
