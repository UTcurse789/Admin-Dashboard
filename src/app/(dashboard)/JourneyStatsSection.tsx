import {
  Activity,
  Clock3,
  Link2,
  Mail,
  MailX,
  MousePointerClick,
  RefreshCcw,
  Route,
  UserCheck,
  UserRoundX,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  JourneyCohortSummary,
  JourneyWeeklySummary,
} from "@/lib/dashboard-journey";
import type { DashboardData } from "./page";

function formatCount(value: number) {
  return value.toLocaleString("en-IN");
}

function formatAverage(value: number | null, suffix: string) {
  if (value == null) {
    return "NA";
  }

  return `${value.toFixed(1)}${suffix}`;
}

function formatDelta(current: number, previous: number) {
  const delta = current - previous;

  if (delta === 0) {
    return "Flat vs prev 7d";
  }

  return `${delta > 0 ? "+" : ""}${delta.toLocaleString(
    "en-IN"
  )} vs prev 7d`;
}

function WeeklyMetricRow({
  label,
  crm,
  native,
}: {
  label: string;
  crm: { current: number; previous: number };
  native: { current: number; previous: number };
}) {
  return (
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[220px_minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <p className="text-sm font-medium text-slate-900">{label}</p>
        <p className="mt-1 text-xs text-slate-500">Current 7 days vs previous 7 days</p>
      </div>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">
          CRM invited
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="text-2xl font-semibold tracking-tight text-slate-950">
            {formatCount(crm.current)}
          </p>
          <Badge variant="outline" className="border-emerald-200 bg-white text-emerald-700">
            {formatDelta(crm.current, crm.previous)}
          </Badge>
        </div>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-700">
          Native sign-up
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <p className="text-2xl font-semibold tracking-tight text-slate-950">
            {formatCount(native.current)}
          </p>
          <Badge variant="outline" className="border-blue-200 bg-white text-blue-700">
            {formatDelta(native.current, native.previous)}
          </Badge>
        </div>
      </div>
    </div>
  );
}

function CohortCard({ cohort }: { cohort: JourneyCohortSummary }) {
  const accentClass =
    cohort.key === "crm"
      ? "border-emerald-200 bg-emerald-50/70 text-emerald-700"
      : "border-blue-200 bg-blue-50/70 text-blue-700";
  const metricTiles = [
    { label: "Invited / entered funnel", value: formatCount(cohort.invitedUsers), icon: Mail },
    { label: "Signed up", value: formatCount(cohort.completedSignups), icon: UserCheck },
    {
      label: "Reminder opt-out",
      value: formatCount(cohort.optedOutFromReminders),
      icon: MailX,
    },
    {
      label: "Still in reminders loop",
      value: formatCount(cohort.stillInReminderLoop),
      icon: RefreshCcw,
    },
    {
      label: "Avg days to convert",
      value: formatAverage(cohort.avgDaysToConvert, "d"),
      icon: Clock3,
    },
    {
      label: "Avg reminder emails",
      value: formatAverage(cohort.avgReminderEmailsToConvert, ""),
      icon: Link2,
    },
    {
      label: "Active in last 30d",
      value: formatCount(cohort.activeUsers30d),
      icon: Activity,
    },
    {
      label: "Re-logged in",
      value: formatCount(cohort.reLoggedUsers),
      icon: Users,
    },
    {
      label: "Deleted account",
      value: formatCount(cohort.deletedAccounts),
      icon: UserRoundX,
    },
    {
      label: "Abandoned by us",
      value: formatCount(cohort.abandonedUsers),
      icon: Route,
    },
  ];

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
              {cohort.label}
            </CardTitle>
            <p className="mt-2 text-sm text-slate-500">
              Completion rate is {cohort.completionRate.toFixed(1)}% from invited users to
              completed sign-up.
            </p>
          </div>
          <Badge variant="outline" className={accentClass}>
            {cohort.key === "crm" ? "CRM lead lens" : "Referral lens"}
          </Badge>
        </div>

        <div className="overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-2 rounded-full ${
              cohort.key === "crm" ? "bg-emerald-500" : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(Math.max(cohort.completionRate, 2), 100)}%` }}
          />
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {metricTiles.map((metric) => {
            const Icon = metric.icon;

            return (
              <div
                key={metric.label}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {metric.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      {metric.value}
                    </p>
                  </div>
                  <div className={`rounded-2xl border px-3 py-2 ${accentClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {cohort.referralSources.length > 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Referral source
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Native sign-ups ranked by recorded referral source.
                </p>
              </div>
              <MousePointerClick className="h-4 w-4 text-slate-400" />
            </div>
            <div className="mt-4 space-y-3">
              {cohort.referralSources.map((source, index) => (
                <div
                  key={source.label}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-white bg-white px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {index + 1}. {source.label}
                    </p>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                    {formatCount(source.count)}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WeeklyOverview({ crm, native }: { crm: JourneyWeeklySummary; native: JourneyWeeklySummary }) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
          Weekly movement
        </CardTitle>
        <p className="text-sm text-slate-500">
          Compare this week against the previous 7-day window for both acquisition paths.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <WeeklyMetricRow label="Invited / entered funnel" crm={crm.invited} native={native.invited} />
        <WeeklyMetricRow
          label="Completed sign-ups"
          crm={crm.completedSignups}
          native={native.completedSignups}
        />
        <WeeklyMetricRow
          label="Reminder opt-outs"
          crm={crm.reminderOptOuts}
          native={native.reminderOptOuts}
        />
        <WeeklyMetricRow
          label="Reminder-led conversions"
          crm={crm.reminderConversions}
          native={native.reminderConversions}
        />
        <WeeklyMetricRow label="Active users" crm={crm.activeUsers} native={native.activeUsers} />
        <WeeklyMetricRow
          label="Re-logged in users"
          crm={crm.reLoggedUsers}
          native={native.reLoggedUsers}
        />
      </CardContent>
    </Card>
  );
}

function PageInsightsCard({
  available,
  note,
  mostVisitedPage,
  dropoffPage,
}: DashboardData["journeyAnalytics"]["pageInsights"]) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
          Signed-in page insights
        </CardTitle>
        <p className="text-sm text-slate-500">
          Most visited and highest drop-off page for authenticated users.
        </p>
      </CardHeader>
      <CardContent>
        {available && mostVisitedPage && dropoffPage ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Most visited page
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {mostVisitedPage.page}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {formatCount(mostVisitedPage.count)} signed-in visits
              </p>
            </div>
            <div className="rounded-2xl border border-rose-100 bg-rose-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-700">
                Drop-off page
              </p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {dropoffPage.page}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {formatCount(dropoffPage.count)} drop-off events
              </p>
            </div>
          </div>
        ) : (
          <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 px-6 text-center">
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">Page analytics unavailable</p>
              <p className="max-w-sm text-sm leading-relaxed text-slate-500">
                {note ?? "This environment is not connected to a queryable product analytics source."}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function JourneyStatsSection({ data }: { data: DashboardData }) {
  const crm = data.journeyAnalytics.cohorts.find((cohort) => cohort.key === "crm");
  const native = data.journeyAnalytics.cohorts.find(
    (cohort) => cohort.key === "native"
  );

  if (!crm || !native) {
    return null;
  }

  return (
    <section className="space-y-5">
      <div className="space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
          User journey
        </p>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            CRM and native funnel movement on one screen
          </h2>
          <p className="max-w-4xl text-sm leading-relaxed text-slate-500">
            Completed sign-up is based on verified users with at least one selected
            category or industry. Abandoned users are the unresolved reminder cases
            that have aged out or exhausted reminder attempts.
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <CohortCard cohort={crm} />
        <CohortCard cohort={native} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_360px]">
        <WeeklyOverview crm={crm.weekly} native={native.weekly} />
        <PageInsightsCard {...data.journeyAnalytics.pageInsights} />
      </div>
    </section>
  );
}
