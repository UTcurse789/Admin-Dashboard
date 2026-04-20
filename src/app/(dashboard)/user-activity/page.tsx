import { getDbAnalytics } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { UserActivityClient } from "./UserActivityClient";
import {
  Users,
  Activity,
  Globe,
  Phone,
  CheckCircle,
  XCircle,
} from "lucide-react";

export const dynamic = "force-dynamic";

async function getActivityData() {
  const [dbData, clerkData] = await Promise.all([
    getDbAnalytics().catch(() => null),
    (async () => {
      const client = await clerkClient();
      const res = await client.users.getUserList({
        limit: 500,
        orderBy: "-created_at",
      });
      return res;
    })(),
  ]);

  // Merge Clerk sign-in data with DB user data
  const clerkMap = new Map<string, { lastSignIn: number | null; signInCount: number }>();
  clerkData.data.forEach((u) => {
    clerkMap.set(u.id, {
      lastSignIn: u.lastSignInAt,
      signInCount: u.externalAccounts?.length || 0,
    });
  });

  return {
    dbUsers: dbData?.recentDbUsers ?? [],
    totalDbUsers: dbData?.totalDbUsers ?? 0,
    bySource: dbData?.bySource ?? [],
    byIndustry: dbData?.byIndustry ?? [],
    byState: dbData?.byState ?? [],
    bySalutation: dbData?.bySalutation ?? [],
    dailyRegistrations: dbData?.dailyRegistrations ?? [],
    clerkMap,
    growthRate: dbData?.growthRate ?? 0,
  };
}

function buildActivityViewModel(data: Awaited<ReturnType<typeof getActivityData>>) {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // Enriched user data
  const enrichedUsers = data.dbUsers.map((u) => {
    const clerkInfo = data.clerkMap.get(u.clerk_id);
    return {
      ...u,
      id: String(u.id),
      lastSignIn: clerkInfo?.lastSignIn ?? null,
      isActive: clerkInfo?.lastSignIn ? clerkInfo.lastSignIn >= sevenDaysAgo : false,
      isRecent: clerkInfo?.lastSignIn ? clerkInfo.lastSignIn >= thirtyDaysAgo : false,
    };
  });

  // Stats
  const onboarded = data.dbUsers.filter((u) => u.onboarding_completed).length;
  const notOnboarded = data.dbUsers.length - onboarded;
  const withPhone = data.dbUsers.filter((u) => u.phone).length;
  const fromZoho = data.bySource.find((s) => s.label === "zoho_form")?.count ?? 0;
  const fromWebsite = data.bySource.find((s) => s.label === "website")?.count ?? 0;

  return {
    enrichedUsers,
    onboarded,
    notOnboarded,
    withPhone,
    fromZoho,
    fromWebsite,
  };
}

export default async function UserActivityPage() {
  const data = await getActivityData();
  const {
    enrichedUsers,
    onboarded,
    notOnboarded,
    withPhone,
    fromZoho,
    fromWebsite,
  } = buildActivityViewModel(data);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          User Activity
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Detailed user profiles, journey tracking, and activity overview from the database.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: "Total Users", value: data.totalDbUsers, icon: Users, color: "text-emerald-600", border: "border-l-emerald-500" },
          { label: "Onboarded", value: onboarded, icon: CheckCircle, color: "text-blue-600", border: "border-l-blue-500" },
          { label: "Not Onboarded", value: notOnboarded, icon: XCircle, color: "text-red-500", border: "border-l-red-500" },
          { label: "From Zoho", value: fromZoho, icon: Globe, color: "text-violet-600", border: "border-l-violet-500" },
          { label: "From Website", value: fromWebsite, icon: Activity, color: "text-amber-600", border: "border-l-amber-500" },
          { label: "With Phone", value: withPhone, icon: Phone, color: "text-cyan-600", border: "border-l-cyan-500" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className={`border-l-4 ${s.border}`}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400">{s.label}</p>
                  <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                </div>
                <p className="mt-1 font-mono text-xl font-bold text-gray-900">{s.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <UserActivityClient enrichedUsers={enrichedUsers} totalDbUsers={data.totalDbUsers} />
    </div>
  );
}
