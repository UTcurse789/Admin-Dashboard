import { clerkClient } from "@clerk/nextjs/server";
import { strapiFetch, StrapiResponse, StrapiArticle } from "@/lib/strapi";
import { getDbAnalytics } from "@/lib/db";
import type { DbAnalytics, CountRow, DailyCount, DbUser } from "@/lib/db";
import { DashboardClient } from "./DashboardClient";

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
  // KPI
  totalUsers: number;
  newThisMonth: number;
  newPrevMonth: number;
  activeLast7Days: number;
  activePrev7Days: number;
  totalArticles: number;
  articlesPrevMonth: number;
  articlesThisMonth: number;
  // Growth
  growthRate: number;
  growthThisMonth: number;
  growthLastMonth: number;
  // Time-series
  dailySignups: DailyDataPoint[];
  dailyContent: DailyDataPoint[];
  // Breakdowns
  contentByType: ContentTypeBreakdown[];
  // User journey
  userJourney: {
    total: number;
    activeWithin30d: number;
    activeWithin7d: number;
    neverSignedIn: number;
  };
  // Weekly activity
  weeklyActivity: { day: string; signups: number; logins: number }[];
  // Recent lists
  recentUsers: UserRecord[];
  recentArticles: ArticleRecord[];
  // ── Database analytics ──
  dbTotalUsers: number;
  bySource: CountRow[];
  byDataSource: CountRow[];
  bySalutation: CountRow[];
  byIndustry: CountRow[];
  byState: CountRow[];
  dailyRegistrations: DailyCount[];
  recentDbUsers: DbUser[];
}

function toDateKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

async function getDashboardData(): Promise<DashboardData> {
  // ── Run Clerk, Strapi, and DB queries in parallel ────────────
  const [clerkData, strapiData, dbData] = await Promise.all([
    getClerkData(),
    getStrapiData(),
    getDbAnalytics().catch((e) => {
      console.error("DB analytics failed:", e);
      return null;
    }),
  ]);

  return {
    ...clerkData,
    ...strapiData,
    // DB analytics (with safe fallbacks)
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
  };
}

async function getClerkData() {
  const client = await clerkClient();
  const userRes = await client.users.getUserList({
    limit: 500,
    orderBy: "-created_at",
  });

  const users: UserRecord[] = userRes.data.map((user) => ({
    id: user.id,
    email: user.emailAddresses[0]?.emailAddress || "No email",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    createdAt: user.createdAt,
    lastSignInAt: user.lastSignInAt,
  }));

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const fourteenDaysAgo = now - 14 * 24 * 60 * 60 * 1000;

  const totalUsers = userRes.totalCount;
  const newThisMonth = users.filter((u) => u.createdAt >= thirtyDaysAgo).length;
  const newPrevMonth = users.filter(
    (u) => u.createdAt >= sixtyDaysAgo && u.createdAt < thirtyDaysAgo
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

  // Daily signups
  const signupMap = new Map<string, number>();
  users.forEach((u) => {
    const key = toDateKey(u.createdAt);
    signupMap.set(key, (signupMap.get(key) || 0) + 1);
  });
  const dailySignups: DailyDataPoint[] = Array.from(signupMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Weekly activity
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklySignups = [0, 0, 0, 0, 0, 0, 0];
  const weeklyLogins = [0, 0, 0, 0, 0, 0, 0];
  users.forEach((u) => {
    weeklySignups[new Date(u.createdAt).getDay()]++;
    if (u.lastSignInAt) weeklyLogins[new Date(u.lastSignInAt).getDay()]++;
  });
  const weeklyActivity = dayNames.map((day, i) => ({
    day,
    signups: weeklySignups[i],
    logins: weeklyLogins[i],
  }));

  // User journey funnel
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
  let allArticles: ArticleRecord[] = [];
  try {
    const data = await strapiFetch<StrapiResponse<StrapiArticle>>(
      "/api/contents?populate=*&sort=publishedAt:desc&pagination[limit]=500"
    );
    totalArticles = data.meta.pagination.total;
    allArticles = data.data.map((article) => {
      const attrs = (article as any).attributes ?? article;
      return {
        title: attrs.Title ?? "Untitled",
        type:
          attrs.type_of_content?.data?.attributes?.name ??
          attrs.type_of_content?.name ??
          "Article",
        publishedAt: attrs.publishedAt ?? null,
      };
    });
  } catch (e) {
    console.error("Failed to fetch Strapi data:", e);
  }

  // Daily content
  const contentMap = new Map<string, number>();
  allArticles.forEach((a) => {
    if (a.publishedAt) {
      const key = a.publishedAt.slice(0, 10);
      contentMap.set(key, (contentMap.get(key) || 0) + 1);
    }
  });
  const dailyContent: DailyDataPoint[] = Array.from(contentMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Content by type
  const typeMap = new Map<string, number>();
  allArticles.forEach((a) => typeMap.set(a.type, (typeMap.get(a.type) || 0) + 1));
  const contentByType: ContentTypeBreakdown[] = Array.from(typeMap.entries())
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  // Month comparisons
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const startOfPrevMonth = new Date(startOfMonth);
  startOfPrevMonth.setMonth(startOfPrevMonth.getMonth() - 1);

  const articlesThisMonth = allArticles.filter(
    (a) => a.publishedAt && new Date(a.publishedAt) >= startOfMonth
  ).length;
  const articlesPrevMonth = allArticles.filter(
    (a) =>
      a.publishedAt &&
      new Date(a.publishedAt) >= startOfPrevMonth &&
      new Date(a.publishedAt) < startOfMonth
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
