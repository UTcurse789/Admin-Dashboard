import { clerkClient } from "@clerk/nextjs/server";
import { getFunnelAnalytics, getDbAnalytics } from "@/lib/db";
import { FunnelsClient } from "./FunnelsClient";

export const dynamic = "force-dynamic";

async function getClerkUsers() {
  try {
    const client = await clerkClient();
    const users: Awaited<ReturnType<typeof client.users.getUserList>>["data"] =
      [];
    let offset = 0;
    const limit = 500;

    while (true) {
      const response = await client.users.getUserList({
        limit,
        offset,
        orderBy: "-created_at",
      });

      users.push(...response.data);

      if (response.data.length < limit) {
        break;
      }

      offset += limit;
    }

    return users;
  } catch (error) {
    console.error("[Funnels] Clerk fetch failed:", error);
    return [];
  }
}

async function getFunnelData() {
  const [funnelDb, basicDb, clerkRes] = await Promise.all([
    getFunnelAnalytics().catch((e) => {
      console.error("[Funnels] getFunnelAnalytics failed:", e?.message ?? e);
      return null;
    }),
    getDbAnalytics().catch((e) => {
      console.error("[Funnels] getDbAnalytics failed:", e?.message ?? e);
      return null;
    }),
    getClerkUsers(),
  ]);

  const now = Date.now();
  const sevenDaysAgo  = now - 7  * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  const clerkUsers    = clerkRes;
  const totalClerk    = clerkUsers.length;
  const activeWithin7d  = clerkUsers.filter((u) => u.lastSignInAt && u.lastSignInAt >= sevenDaysAgo).length;
  const activeWithin30d = clerkUsers.filter((u) => u.lastSignInAt && u.lastSignInAt >= thirtyDaysAgo).length;
  const neverSignedIn   = clerkUsers.filter((u) => !u.lastSignInAt).length;
  const everSignedIn    = clerkUsers.filter((u) => Boolean(u.lastSignInAt)).length;

  // ── Source conversion: prefer funnelDb, fallback to basicDb.bySource ──
  const sourceConversion =
    funnelDb?.sourceConversion && funnelDb.sourceConversion.length > 0
      ? funnelDb.sourceConversion
      : (basicDb?.bySource ?? []).map((s) => ({
          source: s.label,
          total: s.count,
          onboarded: 0, // not available from basic analytics
        }));

  return {
    totalRegistered: funnelDb?.totalRegistered ?? basicDb?.totalDbUsers ?? totalClerk,
    totalOnboarded:  funnelDb?.totalOnboarded  ?? 0,
    everSignedIn,
    activeWithin30d,
    activeWithin7d,
    neverSignedIn,
    sourceConversion,
    utmPerformance:  funnelDb?.utmPerformance  ?? [],
    monthlyCohorts:  funnelDb?.monthlyCohorts  ?? [],
  };
}

export default async function FunnelsPage() {
  const data = await getFunnelData();
  return <FunnelsClient data={data} />;
}
