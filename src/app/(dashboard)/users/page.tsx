import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Building2, UserCheck, Users } from "lucide-react";
import { getDbAnalytics, getDbUsersDirectory } from "@/lib/db";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

function percentOf(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export default async function UsersPage() {
  const [users, analytics] = await Promise.all([
    getDbUsersDirectory(),
    getDbAnalytics(),
  ]);

  const totalUsers = analytics.totalDbUsers || users.length;
  const latestKnownCreatedAt = users.find((user) => user.created_at)?.created_at;
  const onboardedUsers = users.filter((user) => user.onboarding_completed).length;
  const recentUsers = users.filter((user) => {
    if (!user.created_at || !latestKnownCreatedAt) {
      return false;
    }

    const cutoffDate = new Date(latestKnownCreatedAt);
    cutoffDate.setDate(cutoffDate.getDate() - 30);

    return new Date(user.created_at) >= cutoffDate;
  }).length;
  const completeProfiles = users.filter(
    (user) => user.organization && user.state && user.job_title
  ).length;
  const sourceTaggedUsers = users.filter((user) => user.source).length;
  const topSource = analytics.bySource[0];
  const topState = analytics.byState[0];
  const topIndustry = analytics.byIndustry[0];

  const heroCards = [
    {
      label: "Total users",
      value: totalUsers.toLocaleString("en-IN"),
      detail: `${recentUsers.toLocaleString("en-IN")} joined in the last 30 days`,
      icon: Users,
      accent: "border-emerald-200 bg-emerald-50/80 text-emerald-700",
    },
    {
      label: "Onboarding complete",
      value: percentOf(onboardedUsers, totalUsers),
      detail: `${onboardedUsers.toLocaleString("en-IN")} profiles completed onboarding`,
      icon: UserCheck,
      accent: "border-blue-200 bg-blue-50/80 text-blue-700",
    },
    {
      label: "Profile completeness",
      value: percentOf(completeProfiles, totalUsers),
      detail: `${completeProfiles.toLocaleString("en-IN")} users have org, state, and title`,
      icon: Building2,
      accent: "border-violet-200 bg-violet-50/80 text-violet-700",
    },
    {
      label: "Source coverage",
      value: percentOf(sourceTaggedUsers, totalUsers),
      detail: `${sourceTaggedUsers.toLocaleString("en-IN")} users have a recorded source`,
      icon: Activity,
      accent: "border-amber-200 bg-amber-50/80 text-amber-700",
    },
  ];

  const overviewBullets = [
    topSource
      ? `${topSource.label} is the leading acquisition source with ${percentOf(topSource.count, totalUsers)} of recorded users.`
      : "Source tagging is still sparse, so acquisition leadership is not yet reliable.",
    topState
      ? `${topState.label} is the strongest geography with ${topState.count.toLocaleString("en-IN")} users in the directory.`
      : "Geographic concentration will appear here once state data is populated consistently.",
    topIndustry
      ? `${topIndustry.label} is the largest industry segment in the current database snapshot.`
      : "Industry enrichment is not available for enough users yet.",
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-8 pb-8">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.16),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-sm sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_420px]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              User intelligence
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                A database-native view of user quality, coverage, and segmentation.
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
                This page now reads directly from the database so the user directory reflects
                the real operational fields available across registration source, onboarding
                status, organization, geography, and profile completeness.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {overviewBullets.map((bullet, index) => (
                <div
                  key={bullet}
                  className="rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)] backdrop-blur"
                >
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold tracking-[0.16em] text-white shadow-sm">
                        0{index + 1}
                      </div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                        Directory signal
                      </p>
                    </div>
                    <p className="pr-2 text-base leading-8 text-slate-600">{bullet}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.4)] backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Current lens
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              Directory pulse
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {heroCards.map((card) => {
                const Icon = card.icon;

                return (
                  <div
                    key={card.label}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          {card.label}
                        </p>
                        <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                          {card.value}
                        </p>
                      </div>
                      <div className={`rounded-2xl border px-3 py-2 ${card.accent}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">{card.detail}</p>
                  </div>
                );
              })}
            </div>

            <Card className="mt-5 border-slate-200 bg-white/90 shadow-none">
              <CardContent className="p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Highest-coverage segments
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                    {topSource ? `Top source: ${topSource.label}` : "No source leader"}
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                    {topState ? `Top state: ${topState.label}` : "No state leader"}
                  </Badge>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                    {topIndustry ? `Top industry: ${topIndustry.label}` : "No industry leader"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <UsersClient
        users={users}
        totalCount={totalUsers}
        dailyRegistrations={analytics.dailyRegistrations}
      />
    </div>
  );
}
