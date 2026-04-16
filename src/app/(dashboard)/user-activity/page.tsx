import { getDbAnalytics } from "@/lib/db";
import { clerkClient } from "@clerk/nextjs/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  Activity,
  Globe,
  Building2,
  MapPin,
  Clock,
  Mail,
  Phone,
  CheckCircle,
  XCircle,
  Briefcase,
} from "lucide-react";

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

export default async function UserActivityPage() {
  const data = await getActivityData();
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  // Enriched user data
  const enrichedUsers = data.dbUsers.map((u) => {
    const clerkInfo = data.clerkMap.get(u.clerk_id);
    return {
      ...u,
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

      {/* Full User Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-900">
            All Users — Detailed View
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {enrichedUsers.length} users loaded
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 hover:bg-transparent">
                  <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-wider text-gray-400">User</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Organization</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Source</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">State</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Onboarded</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Activity</TableHead>
                  <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedUsers.map((u) => (
                  <TableRow key={u.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50/60">
                    {/* User info */}
                    <TableCell className="pl-6">
                      <div className="min-w-[180px]">
                        <p className="text-sm font-medium text-gray-900">
                          {u.salutation ? `${u.salutation} ` : ""}
                          {u.first_name || ""} {u.last_name || ""}
                          {!u.first_name && !u.last_name && <span className="italic text-gray-400">Unknown</span>}
                        </p>
                        <p className="font-mono text-[11px] text-gray-400 truncate max-w-[200px]">{u.email}</p>
                        {u.job_title && (
                          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-gray-400">
                            <Briefcase className="h-3 w-3" />
                            {u.job_title}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Organization */}
                    <TableCell>
                      <span className="text-xs text-gray-600">{u.organization || "—"}</span>
                    </TableCell>

                    {/* Source */}
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[11px] ${
                          u.source === "zoho_form"
                            ? "bg-violet-50 text-violet-700"
                            : u.source === "website"
                            ? "bg-emerald-50 text-emerald-700"
                            : ""
                        }`}
                      >
                        {u.source || "—"}
                      </Badge>
                    </TableCell>

                    {/* State */}
                    <TableCell>
                      <span className="text-xs text-gray-500">{u.state || "—"}</span>
                    </TableCell>

                    {/* Onboarded */}
                    <TableCell>
                      {u.onboarding_completed ? (
                        <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700">
                          <span className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500" />
                          Yes
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="border border-gray-200 bg-gray-100 text-[11px] text-gray-500">
                          <span className="mr-1 inline-block size-1.5 rounded-full bg-gray-400" />
                          No
                        </Badge>
                      )}
                    </TableCell>

                    {/* Activity */}
                    <TableCell>
                      {u.isActive ? (
                        <Badge variant="secondary" className="border border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700">Active</Badge>
                      ) : u.isRecent ? (
                        <Badge variant="secondary" className="border border-blue-200 bg-blue-50 text-[11px] text-blue-700">Recent</Badge>
                      ) : (
                        <Badge variant="secondary" className="border border-gray-200 bg-gray-100 text-[11px] text-gray-500">Inactive</Badge>
                      )}
                    </TableCell>

                    {/* Joined */}
                    <TableCell className="pr-6 text-right">
                      <span className="text-xs text-gray-500">
                        {u.created_at
                          ? new Date(u.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}

                {enrichedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-sm text-gray-400">
                      No users found in the database.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex items-center justify-between border-t px-6 py-4">
            <p className="text-sm text-gray-500">
              Showing {enrichedUsers.length} of {data.totalDbUsers} users
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
