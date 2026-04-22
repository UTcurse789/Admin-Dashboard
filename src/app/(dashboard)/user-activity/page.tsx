import { getDatabaseUnavailableMessage, getDbAnalytics } from "@/lib/db";
import {
  buildDailyRegistrationsFromClerkUsers,
  getClerkUsersSnapshot,
  mapClerkUsersToDbUsers,
} from "@/lib/clerk-users";
import { UserActivityClient } from "./UserActivityClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = ["bom1", "sin1"];
export const maxDuration = 30;

async function getActivityData() {
  const [dbData, clerkData] = await Promise.all([
    getDbAnalytics().catch(() => null),
    getClerkUsersSnapshot().catch((error) => {
      console.error("Failed to fetch Clerk activity data:", error);
      return { users: [], totalCount: 0 };
    }),
  ]);
  const databaseStatusMessage = dbData
    ? getDatabaseUnavailableMessage(dbData.queryErrors)
    : "Database analytics could not be loaded.";
  const usingClerkFallback =
    Boolean(databaseStatusMessage) && clerkData.users.length > 0;

  // Merge Clerk sign-in data with DB user data
  const clerkMap = new Map<string, { lastSignIn: number | null }>();
  clerkData.users.forEach((u) => {
    clerkMap.set(u.id, {
      lastSignIn: u.lastSignInAt,
    });
  });

  return {
    dbUsers: usingClerkFallback
      ? mapClerkUsersToDbUsers(clerkData.users)
      : dbData?.recentDbUsers ?? [],
    totalDbUsers: usingClerkFallback
      ? clerkData.totalCount
      : dbData?.totalDbUsers ?? 0,
    bySource: dbData?.bySource ?? [],
    byDataSource: dbData?.byDataSource ?? [],
    byIndustry: dbData?.byIndustry ?? [],
    byState: dbData?.byState ?? [],
    bySalutation: dbData?.bySalutation ?? [],
    dailyRegistrations: usingClerkFallback
      ? buildDailyRegistrationsFromClerkUsers(clerkData.users)
      : dbData?.dailyRegistrations ?? [],
    clerkMap,
    growthRate: dbData?.growthRate ?? 0,
    thisMonthCount: dbData?.thisMonthCount ?? 0,
    lastMonthCount: dbData?.lastMonthCount ?? 0,
    queryErrors:
      dbData?.queryErrors ??
      (databaseStatusMessage ? [`database: ${databaseStatusMessage}`] : []),
  };
}

function buildActivityViewModel(data: Awaited<ReturnType<typeof getActivityData>>) {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // Enriched user data
  const enrichedUsers = data.dbUsers.map((u) => {
    const clerkInfo = data.clerkMap.get(u.clerk_id);
    const populatedProfileFields = [
      u.organization,
      u.state,
      u.job_title,
      u.phone,
    ].filter(Boolean).length;
    const profileState: "complete" | "partial" | "sparse" =
      populatedProfileFields >= 4
        ? "complete"
        : populatedProfileFields >= 2
        ? "partial"
        : "sparse";

    return {
      ...u,
      id: String(u.id),
      lastSignIn: clerkInfo?.lastSignIn ?? null,
      isActive: clerkInfo?.lastSignIn ? clerkInfo.lastSignIn >= sevenDaysAgo : false,
      isRecent: clerkInfo?.lastSignIn ? clerkInfo.lastSignIn >= thirtyDaysAgo : false,
      profileState,
    };
  });

  const onboarded = enrichedUsers.filter((u) => u.onboarding_completed).length;
  const withPhone = enrichedUsers.filter((u) => u.phone).length;
  const withOrganization = enrichedUsers.filter((u) => u.organization).length;
  const active7d = enrichedUsers.filter((u) => u.isActive).length;
  const active30d = enrichedUsers.filter((u) => u.isRecent).length;
  const inactive = enrichedUsers.length - active30d;
  const completeProfiles = enrichedUsers.filter(
    (u) => u.profileState === "complete"
  ).length;

  return {
    enrichedUsers,
    summary: {
      onboarded,
      withPhone,
      withOrganization,
      active7d,
      active30d,
      inactive,
      completeProfiles,
    },
  };
}

export default async function UserActivityPage() {
  const data = await getActivityData();
  const { enrichedUsers, summary } = buildActivityViewModel(data);

  return (
    <UserActivityClient
      enrichedUsers={enrichedUsers}
      totalDbUsers={data.totalDbUsers}
      bySource={data.bySource}
      byDataSource={data.byDataSource}
      byIndustry={data.byIndustry}
      byState={data.byState}
      dailyRegistrations={data.dailyRegistrations}
      growthRate={data.growthRate}
      thisMonthCount={data.thisMonthCount}
      lastMonthCount={data.lastMonthCount}
      queryErrors={data.queryErrors}
      summary={summary}
    />
  );
}
