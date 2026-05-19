"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { EChartsOption } from "echarts";
import ReactECharts from "echarts-for-react";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Clock3,
  Monitor,
  Route,
  Search,
  Smartphone,
  Tablet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  JourneyContentDriverRow,
  JourneyDeviceRow,
  JourneyFunnelStage,
  JourneyGa4TimelineResult,
  JourneyIntelligenceData,
  JourneyLabeledShareRow,
  JourneyPageDrilldown,
  JourneyPageDrilldownFlowRow,
  JourneyPortalFlowRow,
  JourneySourceRow,
  JourneyTimelineEvent,
} from "@/lib/journey-intelligence";

function formatCount(value: number) {
  return value.toLocaleString("en-IN");
}

function formatPercent(value: number | null) {
  if (value == null) {
    return "-";
  }

  return `${value.toFixed(1)}%`;
}

function formatRatioPercent(value: number | null) {
  if (value == null) {
    return "-";
  }

  return `${(value * 100).toFixed(1)}%`;
}

type FunnelFormatterParams = {
  data?: {
    share?: number;
  };
  name?: string;
  value?: number | string | null;
};

function formatDuration(seconds: number) {
  if (seconds <= 0) {
    return "0m";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours <= 0) {
    return `${Math.max(minutes, 1)}m`;
  }

  if (minutes <= 0) {
    return `${hours}h`;
  }

  return `${hours}h ${minutes}m`;
}

function getStageCount(
  stages: JourneyFunnelStage[],
  key: JourneyFunnelStage["key"]
) {
  return stages.find((stage) => stage.key === key)?.count ?? 0;
}

function getDeviceIcon(device: string) {
  if (device === "Mobile") {
    return Smartphone;
  }

  if (device === "Tablet") {
    return Tablet;
  }

  return Monitor;
}

function buildEventDetail(event: JourneyTimelineEvent) {
  const details: string[] = [];
  const metadata = event.metadata;

  if (event.pagePath) {
    details.push(event.pagePath);
  }

  const step = typeof metadata.step === "string" ? metadata.step : null;
  const field =
    typeof metadata.field === "string"
      ? metadata.field
      : typeof metadata.fieldName === "string"
      ? metadata.fieldName
      : null;
  const reason = typeof metadata.reason === "string" ? metadata.reason : null;
  const contentTitle =
    typeof metadata.content_title === "string"
      ? metadata.content_title
      : typeof metadata.title === "string"
      ? metadata.title
      : null;

  if (contentTitle && !details.includes(contentTitle)) {
    details.push(contentTitle);
  }

  if (step) {
    details.push(`Step: ${step}`);
  }

  if (field) {
    details.push(`Field: ${field}`);
  }

  if (reason) {
    details.push(reason);
  }

  return details.join(" | ");
}

function buildGa4TimelineDetail(event: JourneyGa4TimelineResult["buckets"][number]["events"][number]) {
  const details: string[] = [];

  if (event.pagePath) {
    details.push(event.pagePath);
  }

  if (event.pageTitle && !details.includes(event.pageTitle)) {
    details.push(event.pageTitle);
  }

  if (event.source) {
    details.push(event.source);
  }

  if (event.device) {
    details.push(event.device);
  }

  details.push(`${formatCount(event.users)} users`);
  details.push(`${formatCount(event.eventCount)} events`);

  return details.join(" - ");
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
        {eyebrow}
      </p>
      <h2 className="text-xl font-semibold tracking-tight text-slate-950">{title}</h2>
      <p className="max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}

function formatIsoDate(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buildJourneyHref(params: {
  query?: string | null;
  pageQuery?: string | null;
  rangePreset?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}) {
  const searchParams = new URLSearchParams();

  if (params.query?.trim()) {
    searchParams.set("q", params.query.trim());
  }

  if (params.pageQuery?.trim()) {
    searchParams.set("page", params.pageQuery.trim());
  }

  if (params.rangePreset?.trim()) {
    searchParams.set("range", params.rangePreset.trim());
  }

  if (params.startDate?.trim()) {
    searchParams.set("start", params.startDate.trim());
  }

  if (params.endDate?.trim()) {
    searchParams.set("end", params.endDate.trim());
  }

  const query = searchParams.toString();
  return query ? `/journey-intelligence?${query}` : "/journey-intelligence";
}

function DateRangeFilters({
  query,
  pageQuery,
  startDate,
  endDate,
  rangePreset,
}: {
  query: string | null;
  pageQuery: string | null;
  startDate: string | null;
  endDate: string | null;
  rangePreset: string | null;
}) {
  const quickRanges = [
    { label: "Today", value: "today" },
    { label: "7 days", value: "7d" },
    { label: "30 days", value: "30d" },
    { label: "90 days", value: "90d" },
    { label: "All time", value: "all" },
  ] as const;

  const activePreset =
    rangePreset ?? (!startDate && !endDate ? "90d" : "custom");

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardContent className="space-y-5 p-5">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            Quick Range
          </p>
          <div className="flex flex-wrap gap-2">
            {quickRanges.map((item) => {
              const isActive = activePreset === item.value;

              return (
                <Button
                  key={item.value}
                  asChild
                  variant={isActive ? "default" : "outline"}
                  className={isActive ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-white"}
                >
                  <Link
                    href={buildJourneyHref({
                      query,
                      pageQuery,
                      rangePreset: item.value,
                    })}
                  >
                    {item.label}
                  </Link>
                </Button>
              );
            })}
          </div>
        </div>

        <form action="/journey-intelligence" method="get" className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          {query ? <input type="hidden" name="q" value={query} /> : null}
          {pageQuery ? <input type="hidden" name="page" value={pageQuery} /> : null}
          <input type="hidden" name="range" value="custom" />
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="journey-start-date">
              Start date
            </label>
            <Input
              id="journey-start-date"
              name="start"
              type="date"
              defaultValue={startDate ?? ""}
              className="h-11"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400" htmlFor="journey-end-date">
              End date
            </label>
            <Input
              id="journey-end-date"
              name="end"
              type="date"
              defaultValue={endDate ?? ""}
              className="h-11"
            />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="h-11 min-w-32 bg-slate-900 text-white hover:bg-slate-800">
              Apply range
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Ga4OverviewKpiCards({
  insights,
}: {
  insights: JourneyIntelligenceData["portalInsights"];
}) {
  if (!insights) {
    return null;
  }

  const cards = [
    {
      label: "Total Users",
      value: formatCount(insights.totalUsers),
      detail: `${formatCount(insights.totalUsers)} users reached this journey in the selected range.`,
    },
    {
      label: "Avg Session Duration",
      value: formatDuration(insights.avgSessionDurationSeconds),
      detail: "Average session duration across the selected date range.",
    },
    {
      label: "Bounce Rate",
      value: formatRatioPercent(insights.bounceRate),
      detail: "Share of sessions that bounced during the selected range.",
    },
    {
      label: "Pageviews",
      value: formatCount(insights.pageviews),
      detail: `${formatCount(insights.pageviews)} total journey pageviews in range.`,
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,1.2fr)]">
      {cards.map((card) => (
        <Card key={card.label} className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {card.label}
            </p>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-slate-950">
              {card.value}
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">{card.detail}</p>
          </CardContent>
        </Card>
      ))}

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Audience Mix
          </p>
          <div className="mt-4 space-y-4">
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div className="flex h-full w-full">
                <div
                  className="h-full bg-slate-900"
                  style={{
                    width: `${Math.max(
                      insights.newUserShare * 100,
                      insights.newUsers > 0 ? 8 : 0
                    )}%`,
                  }}
                />
                <div
                  className="h-full bg-slate-300"
                  style={{
                    width: `${Math.max(
                      insights.returningUserShare * 100,
                      insights.returningUsers > 0 ? 8 : 0
                    )}%`,
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">New visitors</p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {formatRatioPercent(insights.newUserShare)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">
                  Returning visitors
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-950">
                  {formatRatioPercent(insights.returningUserShare)}
                </p>
              </div>
            </div>
            <p className="text-sm leading-relaxed text-slate-500">
              {formatCount(insights.returningUsers)} returning visitors and{" "}
              {formatCount(insights.newUsers)} new visitors in the active filter.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PortalInsightsCards({
  insights,
  stages,
}: {
  insights: JourneyIntelligenceData["portalInsights"];
  stages: JourneyIntelligenceData["funnelStages"];
}) {
  if (!insights) {
    return null;
  }

  const authVisitors = getStageCount(stages, "signup_started");
  const signupCompleted = getStageCount(stages, "signup_completed");
  const dashboardUsers = getStageCount(stages, "dashboard_users");
  const authAbandoned = Math.max(authVisitors - signupCompleted, 0);

  const items = [
    {
      label: "Auth page visitors",
      value: formatCount(authVisitors),
      detail: `${formatCount(authVisitors)} users reached signup or verification pages in this range.`,
    },
    {
      label: "Left without signup",
      value: formatCount(authAbandoned),
      detail: `${formatPercent(
        authVisitors > 0
          ? (authAbandoned / authVisitors) * 100
          : 0
      )} dropped after hitting auth pages.`,
    },
    {
      label: "Accounts created",
      value: formatCount(signupCompleted),
      detail: `${formatCount(signupCompleted)} accounts were created after auth completion in the selected range.`,
    },
    {
      label: "Signed in after signup",
      value: formatCount(dashboardUsers),
      detail: `${formatPercent(
        signupCompleted > 0 ? (dashboardUsers / signupCompleted) * 100 : 0
      )} of created accounts signed in at least once by the end of this range.`,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {item.label}
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              {item.value}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PortalFlowCard({
  rows,
}: {
  rows: JourneyPortalFlowRow[];
}) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
          User Journey on Portal
        </CardTitle>
        <p className="text-sm text-slate-500">
          Read each row left to right: where users came from, the first page they saw, the
          page that held attention the longest, where signup began, where they dropped, and
          how many became accounts.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 pl-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Source
                  </th>
                  <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    First page
                  </th>
                  <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Highest attention page
                  </th>
                  <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Signup started on
                  </th>
                  <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Left on
                  </th>
                  <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Avg time
                  </th>
                  <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Active users
                  </th>
                  <th className="py-3 pr-4 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Accounts created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row) => (
                  <tr key={row.source} className="hover:bg-slate-50/60">
                    <td className="py-3 pl-4 font-medium text-slate-900">{row.source}</td>
                    <td className="py-3 text-slate-600">{row.landingPage ?? "-"}</td>
                    <td className="py-3 text-slate-600">{row.engagedPage ?? "-"}</td>
                    <td className="py-3 text-slate-600">{row.authEntryPage ?? "-"}</td>
                    <td className="py-3 text-slate-600">{row.authDropPage ?? "-"}</td>
                    <td className="py-3 text-right font-mono text-slate-700">
                      {formatDuration(row.engagedPageTimeSeconds || row.avgSessionDurationSeconds)}
                    </td>
                    <td className="py-3 text-right font-mono text-slate-700">
                      {formatCount(row.activeUsers)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-slate-700">
                      {formatCount(row.accountsCreated)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 pb-6">
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-900">No portal flow rows yet</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                This fills once the connected analytics source returns landing, engagement,
                and signup-page path data for the selected range.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PageInsightsCard({
  title,
  description,
  rows,
  mode,
  query,
  activePageQuery,
  startDate,
  endDate,
  rangePreset,
}: {
  title: string;
  description: string;
  rows: JourneyIntelligenceData["mostViewedPages"];
  mode: "views" | "dropoff";
  query: string | null;
  activePageQuery: string | null;
  startDate: string | null;
  endDate: string | null;
  rangePreset: string | null;
}) {
  const safeRows = rows ?? [];

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
          {title}
        </CardTitle>
        <p className="text-sm text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="p-0">
        {safeRows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 pl-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Page
                  </th>
                  {mode === "dropoff" ? (
                    <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Drop-off
                    </th>
                  ) : null}
                  <th className="py-3 pr-4 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Views
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {safeRows.map((row) => (
                  <tr
                    key={`${mode}-${row.pagePath}-${row.pageTitle}`}
                    className={
                      row.pagePath === activePageQuery
                        ? "bg-slate-50/90"
                        : "hover:bg-slate-50/60"
                    }
                  >
                    <td className="py-3 pl-4 align-top">
                      <div className="min-w-[260px]">
                        <Link
                          href={buildJourneyHref({
                            query,
                            pageQuery: row.pagePath,
                            rangePreset,
                            startDate,
                            endDate,
                          })}
                          className="font-medium text-slate-900 underline-offset-4 hover:underline"
                        >
                          {row.pagePath}
                        </Link>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                          {row.pageTitle}
                        </p>
                      </div>
                    </td>
                    {mode === "dropoff" ? (
                      <td className="py-3 text-right font-mono text-slate-700">
                        {formatRatioPercent(row.dropoffRate)}
                      </td>
                    ) : null}
                    <td className="py-3 pr-4 text-right font-mono text-slate-700">
                      {formatCount(row.views)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 pb-6">
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-900">No page insights yet</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Page-level traffic and drop-off rows will appear once the selected date range
                returns enough page activity.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShareRowsCard({
  title,
  description,
  rows,
  valueLabel,
}: {
  title: string;
  description: string;
  rows: JourneyLabeledShareRow[];
  valueLabel: string;
}) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight text-slate-950">
          {title}
        </CardTitle>
        <p className="text-sm text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length > 0 ? (
          rows.map((row) => (
            <div key={row.label} className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium text-slate-900">{row.label}</p>
                <div className="text-right">
                  <p className="text-sm font-semibold text-slate-950">{formatCount(row.value)}</p>
                  <p className="text-xs text-slate-500">{formatRatioPercent(row.share)} {valueLabel}</p>
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-slate-900"
                  style={{ width: `${Math.max(row.share * 100, row.value > 0 ? 6 : 0)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center">
            <p className="text-sm font-medium text-slate-900">No rows for this page yet</p>
            <p className="mt-2 text-sm text-slate-500">
              This slice fills when the selected page has enough segmented traffic in GA4.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PageFlowTable({
  title,
  description,
  rows,
  emptyTitle,
}: {
  title: string;
  description: string;
  rows: JourneyPageDrilldownFlowRow[];
  emptyTitle: string;
}) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold tracking-tight text-slate-950">
          {title}
        </CardTitle>
        <p className="text-sm text-slate-500">{description}</p>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 pl-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Page
                  </th>
                  <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Users
                  </th>
                  <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Share
                  </th>
                  <th className="py-3 pr-4 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Views
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row) => (
                  <tr key={`${title}-${row.label}-${row.pageTitle ?? ""}`} className="hover:bg-slate-50/60">
                    <td className="py-3 pl-4 align-top">
                      <div className="min-w-[220px]">
                        <p className="font-medium text-slate-900">{row.label}</p>
                        {row.pageTitle && row.pageTitle !== row.label ? (
                          <p className="mt-1 text-xs text-slate-500">{row.pageTitle}</p>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-3 text-right font-mono text-slate-700">
                      {formatCount(row.users)}
                    </td>
                    <td className="py-3 text-right font-mono text-slate-700">
                      {formatRatioPercent(row.share)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-slate-700">
                      {formatCount(row.views)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 pb-6">
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center">
              <p className="text-sm font-medium text-slate-900">{emptyTitle}</p>
              <p className="mt-2 text-sm text-slate-500">
                No reliable page-referrer relationship came back for this page in the current range.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PageDrilldownCard({
  query,
  pageQuery,
  data,
  suggestions,
  startDate,
  endDate,
  rangePreset,
}: {
  query: string | null;
  pageQuery: string | null;
  data: JourneyPageDrilldown | null | undefined;
  suggestions: JourneyIntelligenceData["mostViewedPages"];
  startDate: string | null;
  endDate: string | null;
  rangePreset: string | null;
}) {
  const selectedPath = data?.resolvedPath ?? pageQuery ?? "";
  const selectedTitle = data?.resolvedTitle ?? null;
  const searched = Boolean(pageQuery?.trim());
  const hasResolvedPage = Boolean(data?.resolvedPath);
  const safeSuggestions = useMemo(() => {
    const seenPaths = new Set<string>();

    return (suggestions ?? [])
      .filter((row) => {
        const normalizedPath = row.pagePath?.trim() || "/";

        if (seenPaths.has(normalizedPath)) {
          return false;
        }

        seenPaths.add(normalizedPath);
        return true;
      })
      .slice(0, 6);
  }, [suggestions]);
  const summaryCards = hasResolvedPage && data
    ? [
        {
          label: "Page viewers",
          value: formatCount(data.overview.users),
          detail: `${formatCount(data.overview.pageViews)} views in the selected range.`,
        },
        {
          label: "Active users",
          value: formatCount(data.overview.activeUsers),
          detail: `${formatRatioPercent(data.overview.users > 0 ? data.overview.activeUsers / data.overview.users : 0)} of page viewers were active users.`,
        },
        {
          label: "Returning users",
          value: formatCount(data.overview.returningUsers),
          detail: `${formatRatioPercent(data.overview.returningUserShare)} of the page audience was returning.`,
        },
        {
          label: "Auth from this page",
          value: formatCount(data.conversion.authUsers),
          detail: `${formatPercent(data.conversion.authRate)} moved directly from this page into auth/signup.`,
        },
        {
          label: "Signup completed",
          value: formatCount(data.conversion.signupCompletedUsers),
          detail: `${formatPercent(data.conversion.signupCompletedRate)} hit a success page directly after this page.`,
        },
        {
          label: "Exit pageviews",
          value: formatCount(data.conversion.exitPageViews),
          detail: `${formatPercent(data.conversion.exitRate)} of this page's pageviews ended here. This can be higher than unique viewers because one user can generate multiple views.`,
        },
      ]
    : [];

  return (
    <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-4 border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(15,23,42,0.06),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)]">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
            Per-Page Journey Analysis
          </CardTitle>
          <p className="max-w-3xl text-sm text-slate-500">
            Search a page path or title to inspect who reached it, where they came from,
            where they went next, the direct auth movement it created, and the source,
            device, and region split behind it.
          </p>
        </div>

        <form action="/journey-intelligence" method="get" className="flex flex-col gap-3 xl:flex-row">
          {query ? <input type="hidden" name="q" value={query} /> : null}
          {startDate ? <input type="hidden" name="start" value={startDate} /> : null}
          {endDate ? <input type="hidden" name="end" value={endDate} /> : null}
          {rangePreset ? <input type="hidden" name="range" value={rangePreset} /> : null}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="page"
              defaultValue={pageQuery ?? ""}
              placeholder="Search /energclub, /auth, /reports, or a page title..."
              className="h-11 rounded-2xl pl-9"
            />
          </div>
          <Button type="submit" className="h-11 rounded-2xl bg-slate-900 text-white hover:bg-slate-800">
            Analyze page
          </Button>
          {pageQuery ? (
            <Button asChild variant="ghost" className="h-11 rounded-2xl">
              <Link
                href={buildJourneyHref({
                  query,
                  rangePreset,
                  startDate,
                  endDate,
                })}
              >
                Clear page
              </Link>
            </Button>
          ) : null}
        </form>

        <div className="flex flex-wrap gap-2">
          {safeSuggestions.map((row, index) => (
            <Button
              key={`page-chip-${row.pagePath}-${index}`}
              asChild
              variant={row.pagePath === selectedPath ? "default" : "outline"}
              className={row.pagePath === selectedPath ? "bg-slate-900 text-white hover:bg-slate-800" : "bg-white"}
            >
              <Link
                href={buildJourneyHref({
                  query,
                  pageQuery: row.pagePath,
                  rangePreset,
                  startDate,
                  endDate,
                })}
              >
                {row.pagePath}
              </Link>
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="space-y-6 p-5">
        {searched && !hasResolvedPage ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-900">No matching page found</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Try a broader path fragment like <code className="rounded bg-white px-1 py-0.5 text-xs">energclub</code> or select one of the suggested pages above.
            </p>
          </div>
        ) : null}

        {!searched ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-900">Search a page to open the drilldown</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              Start with a high-traffic path like <code className="rounded bg-white px-1 py-0.5 text-xs">/energclub</code> or click a suggestion to load the page-level flow instantly.
            </p>
          </div>
        ) : null}

        {hasResolvedPage && data ? (
          <>
            <div className="rounded-3xl border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Selected page
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {data.resolvedPath}
                  </h3>
                  <p className="mt-2 text-sm text-slate-500">
                    {selectedTitle || "Untitled page"}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Entrances
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">
                      {formatCount(data.overview.entrances)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Avg time
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">
                      {formatDuration(data.overview.avgTimeOnPageSeconds)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white bg-white px-4 py-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Bounce rate
                    </p>
                    <p className="mt-2 text-xl font-semibold text-slate-950">
                      {formatRatioPercent(data.overview.bounceRate)}
                    </p>
                  </div>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Previous and next pages come from GA4 <code className="rounded bg-white px-1 py-0.5 text-xs">pageReferrer</code> relationships, so the conversion tiles below describe direct next-step movement from this page.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                Exit pageviews are pageview-level exits, not unique users, so they can be higher than page viewers or active users when the same person views the page multiple times.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {summaryCards.map((card) => (
                <div key={card.label} className="rounded-3xl border border-slate-200 bg-slate-50/70 p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {card.label}
                  </p>
                  <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                    {card.value}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{card.detail}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-6 xl:grid-cols-3">
              <ShareRowsCard
                title="Source mix"
                description="Channel groups driving this page."
                rows={data.sources}
                valueLabel="sessions"
              />
              <ShareRowsCard
                title="Device mix"
                description="Where this page's audience is browsing from."
                rows={data.devices}
                valueLabel="users"
              />
              <ShareRowsCard
                title="Region mix"
                description="Top geography slices for this page."
                rows={data.regions}
                valueLabel="users"
              />
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <PageFlowTable
                title="Users Came From"
                description="Top previous pages and referrers feeding this page."
                rows={data.previousPages}
                emptyTitle="No previous-page rows returned"
              />
              <PageFlowTable
                title="Users Went To"
                description="Top direct next pages seen after this page."
                rows={data.nextPages}
                emptyTitle="No next-page rows returned"
              />
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function SummaryCards({
  dataMode,
  stages,
  dropoff,
  sources,
}: {
  dataMode: JourneyIntelligenceData["dataMode"];
  stages: JourneyFunnelStage[];
  dropoff: JourneyIntelligenceData["dropoff"];
  sources: JourneySourceRow[];
}) {
  const visitors = stages[0]?.count ?? 0;
  const completed = stages.find((stage) => stage.key === "signup_completed")?.count ?? 0;
  const dashboardUsers =
    stages.find((stage) => stage.key === "dashboard_users")?.count ?? 0;
  const completionRate = visitors > 0 ? (completed / visitors) * 100 : 0;
  const topSource =
    sources.reduce<JourneySourceRow | null>((best, row) => {
      if (!best) {
        return row;
      }

      if (row.activeUsers !== best.activeUsers) {
        return row.activeUsers > best.activeUsers ? row : best;
      }

      if (row.signupRate !== best.signupRate) {
        return row.signupRate > best.signupRate ? row : best;
      }

      return row.engagementRate > best.engagementRate ? row : best;
    }, null)?.source ?? "Waiting for source data";

  const cards = [
    {
      label: "Tracked visitors",
      value: formatCount(visitors),
      detail:
        dataMode === "ga4"
          ? "Distinct users seen in the current reporting window."
          : dataMode === "derived"
          ? "Distinct signup identities derived from existing users and pending verifications."
          : "Distinct visitor IDs with custom events in the current window.",
    },
    {
      label: "Signup completion",
      value: `${completionRate.toFixed(1)}%`,
      detail: `${formatCount(completed)} visitors reached signup completion.`,
    },
    {
      label: "Biggest leak",
      value: formatCount(dropoff.biggestAbandonmentCount),
      detail: `${dropoff.biggestAbandonmentStage} is the largest abandonment step.`,
    },
    {
      label: "Strongest source",
      value: topSource,
      detail: `${formatCount(dashboardUsers)} visitors have reached the dashboard.`,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label} className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {card.label}
            </p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
              {card.value}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{card.detail}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getFunnelStageCopy(
  stage: JourneyFunnelStage,
  dataMode: JourneyIntelligenceData["dataMode"]
) {
  if (stage.key === "signup_clicks") {
    return {
      label: dataMode === "ga4" ? "Signup Intent" : stage.label,
      detail:
        dataMode === "ga4"
          ? "Direct signup clicks when tracked, with auth-page visits used as the fallback intent signal."
          : "Users who clicked into the signup journey.",
    };
  }

  if (stage.key === "signup_started") {
    return {
      label: dataMode === "ga4" ? "Auth Reached" : stage.label,
      detail:
        dataMode === "ga4"
          ? "Users who hit auth, signup, verify, or OTP pages in the selected range."
          : "Users who entered the auth flow.",
    };
  }

  if (stage.key === "otp_verified") {
    return {
      label: "OTP Verified",
      detail: "Users who reached a verified auth state before account creation.",
    };
  }

  if (stage.key === "signup_completed") {
    return {
      label: dataMode === "ga4" ? "Account Created" : stage.label,
      detail:
        dataMode === "ga4"
          ? "Accounts created in the selected range after the auth flow completed."
          : "Users who completed signup.",
    };
  }

  if (stage.key === "dashboard_users") {
    return {
      label: dataMode === "ga4" ? "Signed In After Signup" : stage.label,
      detail:
        dataMode === "ga4"
          ? "Created accounts from this range that signed in at least once by the range end. This is why this number can be lower than account-created."
          : "Users who reached the dashboard.",
    };
  }

  if (stage.key === "returning_users") {
    return {
      label: dataMode === "ga4" ? "Returned Later" : stage.label,
      detail:
        dataMode === "ga4"
          ? "Signed-in users who came back after their initial signup day."
          : "Users who returned after their first visit.",
    };
  }

  if (stage.key === "content_readers") {
    return {
      label: "Content Readers",
      detail: "Visitors who consumed content before moving toward signup.",
    };
  }

  return {
    label: stage.label,
    detail: "Top-of-funnel audience captured in the current range.",
  };
}

function FunnelCard({
  stages,
  dataMode,
}: {
  stages: JourneyFunnelStage[];
  dataMode: JourneyIntelligenceData["dataMode"];
}) {
  const funnelPalette = [
    "#5B5DF0",
    "#4A8DEE",
    "#16B6C4",
    "#18B36B",
    "#F59E0B",
    "#F97316",
    "#F43F5E",
    "#A855F7",
  ];
  const stageRows = stages.map((stage, index) => {
    const stageCopy = getFunnelStageCopy(stage, dataMode);

    return {
      stage,
      stageCopy,
      chartItem: {
        value: stage.count,
        label: stageCopy.label,
        color: funnelPalette[index % funnelPalette.length],
      },
    };
  });
  const chartHeight = Math.max(stageRows.length * 52, 420);
  const chartOption = useMemo((): EChartsOption => {
    const baseCount = stages[0]?.count ?? 0;
    const chartSeriesData = stageRows.map((row) => ({
      name: row.stageCopy.label,
      value: row.chartItem.value,
      share: baseCount > 0 ? Number(((row.chartItem.value / baseCount) * 100).toFixed(1)) : 0,
      itemStyle: { color: row.chartItem.color },
    }));

    return {
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        formatter: (params: unknown) => {
          const point = params as FunnelFormatterParams;

          return (
            `<div style="font-size:13px"><strong>${point.name ?? ""}</strong></div>` +
            `<div>Users: <strong>${formatCount(Number(point.value ?? 0))}</strong></div>` +
            `<div style="color:#10b981;font-weight:600">${Number(point.data?.share ?? 0)}% of visitors</div>`
          );
        },
      },
      series: [
        {
          name: "Journey",
          type: "funnel",
          left: "4%",
          right: "14%",
          top: 12,
          bottom: 8,
          min: 0,
          max: Math.max(baseCount, 1),
          minSize: "22%",
          maxSize: "100%",
          sort: "descending",
          gap: 4,
          funnelAlign: "center",
          itemStyle: {
            borderColor: "#ffffff",
            borderWidth: 4,
          },
          label: {
            show: true,
            position: "right",
            color: "#334155",
            fontSize: 12,
            lineHeight: 18,
            formatter: (params: any) =>
              `{title|${params.name}}\n{meta|${formatCount(Number(params.value ?? 0))}  |  ${Number(params.data?.share ?? 0)}%}`,
            rich: {
              title: { fontSize: 12, fontWeight: 700, color: "#334155", lineHeight: 18 },
              meta: { fontSize: 11, fontWeight: 600, color: "#64748b", lineHeight: 16 },
            },
          },
          labelLine: {
            show: true,
            length: 24,
            lineStyle: { color: "#cbd5e1", width: 1.2 },
          },
          emphasis: {
            itemStyle: { opacity: 0.92 },
          },
          data: chartSeriesData,
        },
      ],
    };
  }, [stageRows, stages]);

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
          User Journey Funnel
        </CardTitle>
        <p className="text-sm text-slate-500">
          Sequential funnel for the selected range, with the late-stage auth steps renamed so
          account creation, sign-in, and return usage are easy to separate.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-3xl border border-slate-200 bg-[linear-gradient(135deg,rgba(15,23,42,0.05),rgba(255,255,255,0.92))] p-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Account created
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                This stage tracks successful account creation after auth completion.
              </p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Signed in after signup
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {dataMode === "ga4"
                  ? "This is not DB onboarding-complete. It means the created account logged in at least once."
                  : "This stage sits after account creation and highlights actual post-signup usage."}
              </p>
            </div>
            <div className="rounded-2xl border border-white/80 bg-white/90 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Range logic
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                GA4 stage counts stay in sequence and inherit the selected date range across the full journey.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_35%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4">
            <div className="h-[420px] w-full lg:h-[460px]">
              <ReactECharts
                option={chartOption}
                style={{ height: `${chartHeight}px`, width: "100%" }}
                notMerge
              />
            </div>

            <p className="mt-3 text-center text-xs text-slate-500">
              Exact counts stay proportional to the selected range, while the stage cards below
              explain the conversion and drop-off at each step.
            </p>
          </div>

          <div className="grid gap-3 xl:grid-cols-2">
            {stageRows.map(({ stage, stageCopy }) => {
              const shareOfVisitors =
                stages[0]?.count && stages[0].count > 0
                  ? (stage.count / stages[0].count) * 100
                  : 0;

              return (
                <div
                  key={`${stage.key}-summary`}
                  className="rounded-3xl border border-slate-200 bg-slate-50/80 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{stageCopy.label}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatRatioPercent(shareOfVisitors / 100)} of visitors
                      </p>
                    </div>
                    <p className="text-xl font-semibold tracking-tight text-slate-950">
                      {formatCount(stage.count)}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    {stage.conversionRate != null ? (
                      <Badge
                        variant="outline"
                        className="border-emerald-200 bg-emerald-50 text-emerald-700"
                      >
                        {formatPercent(stage.conversionRate)} continued
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="border-slate-200 bg-white text-slate-600"
                      >
                        Base audience
                      </Badge>
                    )}

                    {stage.dropRate != null ? (
                      <Badge
                        variant="outline"
                        className="border-rose-200 bg-rose-50 text-rose-700"
                      >
                        {formatPercent(stage.dropRate)} dropped
                      </Badge>
                    ) : null}
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-slate-500">
                    {stageCopy.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DropoffCard({
  data,
  dataMode,
}: {
  data: JourneyIntelligenceData["dropoff"];
  dataMode: JourneyIntelligenceData["dataMode"];
}) {
  const items = [
    {
      label: "Biggest abandonment stage",
      value: data.biggestAbandonmentStage,
      detail: `${formatCount(data.biggestAbandonmentCount)} visitors | ${data.biggestAbandonmentRate.toFixed(1)}%`,
    },
    {
      label: "Auth drop",
      value: `${data.authDropRate.toFixed(1)}%`,
      detail: "Visitors who started auth but never completed signup.",
    },
    {
      label:
        dataMode === "ga4"
          ? "OTP drop"
          : data.otpFailures > 0
          ? "OTP failures"
          : "OTP unresolved",
      value: formatCount(data.otpFailures),
      detail:
        dataMode === "ga4"
          ? "Users who entered auth but never reached the verification completion signal."
          : data.otpFailures > 0
          ? "Sessions with OTP-step form errors."
          : "Signup records still pending verification in the existing auth tables.",
    },
  ];

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
          Drop-Off Analysis
        </CardTitle>
        <p className="text-sm text-slate-500">
          Focus the team on the most expensive points of friction first.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              {item.label}
            </p>
            <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
              {item.value}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.detail}</p>
          </div>
        ))}

      </CardContent>
    </Card>
  );
}

function Ga4TimelineCard({
  query,
  pageQuery,
  timeline,
  startDate,
  endDate,
  rangePreset,
}: {
  query: string | null;
  pageQuery: string | null;
  timeline: JourneyGa4TimelineResult | null | undefined;
  startDate: string | null;
  endDate: string | null;
  rangePreset: string | null;
}) {
  const buckets = timeline?.buckets ?? [];

  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
            User Timeline Viewer
          </CardTitle>
          <p className="text-sm text-slate-500">
            Search by page path, page title, source, or event name to inspect the recent
            grouped activity trail.
          </p>
        </div>

        <form action="/journey-intelligence" method="get" className="flex flex-col gap-3 md:flex-row">
          {pageQuery ? <input type="hidden" name="page" value={pageQuery} /> : null}
          {startDate ? <input type="hidden" name="start" value={startDate} /> : null}
          {endDate ? <input type="hidden" name="end" value={endDate} /> : null}
          {rangePreset ? <input type="hidden" name="range" value={rangePreset} /> : null}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={query ?? ""}
              placeholder="Search path, title, source, or event..."
              className="h-10 pl-9"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Search
          </Button>
          {query ? (
            <Button asChild variant="ghost" className="h-10">
              <Link
                href={buildJourneyHref({
                  pageQuery,
                  rangePreset,
                  startDate,
                  endDate,
                })}
              >
                Clear
              </Link>
            </Button>
          ) : null}
        </form>
      </CardHeader>
      <CardContent className="space-y-4">
        {buckets.length > 0 ? (
          buckets.map((bucket) => (
            <div key={bucket.id} className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
                <div>
                  <p className="text-sm font-semibold text-slate-950">{bucket.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatCount(bucket.events.reduce((sum, event) => sum + event.users, 0))} users across{" "}
                    {formatCount(bucket.events.reduce((sum, event) => sum + event.eventCount, 0))} events
                  </p>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                  Grouped activity
                </Badge>
              </div>

              <div className="mt-4 space-y-4">
                {bucket.events.map((event) => (
                  <div
                    key={event.id}
                    className="grid gap-3 rounded-2xl border border-white bg-white p-4 md:grid-cols-[112px_minmax(0,1fr)]"
                  >
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                      {event.timeLabel}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-slate-900">{event.label}</p>
                      <p className="text-sm text-slate-500">
                        {buildGa4TimelineDetail(event)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-900">
              {timeline?.searched ? "No matching activity found" : "No recent journey rows yet"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {timeline?.searched
                ? "Try a broader path, title, source, or event-name search."
                : "Recent activity buckets will appear here once the selected range returns matching page or event rows."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineCard({
  dataMode,
  query,
  pageQuery,
  timeline,
  startDate,
  endDate,
  rangePreset,
}: {
  dataMode: JourneyIntelligenceData["dataMode"];
  query: string | null;
  pageQuery: string | null;
  timeline: JourneyIntelligenceData["timeline"];
  startDate: string | null;
  endDate: string | null;
  rangePreset: string | null;
}) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
            User Timeline Viewer
          </CardTitle>
          <p className="text-sm text-slate-500">
            Search by email, visitor ID, session ID, database user ID, or Clerk ID.
          </p>
        </div>

        <form action="/journey-intelligence" method="get" className="flex flex-col gap-3 md:flex-row">
          {pageQuery ? <input type="hidden" name="page" value={pageQuery} /> : null}
          {startDate ? <input type="hidden" name="start" value={startDate} /> : null}
          {endDate ? <input type="hidden" name="end" value={endDate} /> : null}
          {rangePreset ? <input type="hidden" name="range" value={rangePreset} /> : null}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="q"
              defaultValue={query ?? ""}
              placeholder="Search user or session..."
              className="h-10 pl-9"
            />
          </div>
          <Button type="submit" variant="outline" className="h-10">
            Search
          </Button>
          {query ? (
            <Button asChild variant="ghost" className="h-10">
              <Link
                href={buildJourneyHref({
                  pageQuery,
                  rangePreset,
                  startDate,
                  endDate,
                })}
              >
                Clear
              </Link>
            </Button>
          ) : null}
        </form>
      </CardHeader>
      <CardContent className="space-y-4">
        {timeline.sessions.length > 0 ? (
          timeline.sessions.map((session) => (
            <div key={session.sessionId} className="space-y-4">
              {session.gapFromPreviousSeconds && session.gapFromPreviousSeconds > 0 ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                  <Clock3 className="h-3.5 w-3.5" />
                  Returned after {formatDuration(session.gapFromPreviousSeconds)}
                </div>
              ) : null}

              <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">
                      {session.name || session.email || session.visitorId || session.sessionId}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Session {session.sessionId}
                      {session.visitorId ? ` | Visitor ${session.visitorId}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {session.source ? (
                      <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                        {session.source}
                      </Badge>
                    ) : null}
                    {session.device ? (
                      <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                        {session.device}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                      {formatDuration(session.durationSeconds)}
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  {session.events.map((event) => {
                    const detail = buildEventDetail(event);

                    return (
                      <div
                        key={event.id}
                        className="grid gap-3 rounded-2xl border border-white bg-white p-4 md:grid-cols-[72px_minmax(0,1fr)]"
                      >
                        <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
                          {event.timeLabel}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-900">{event.label}</p>
                          <p className="text-sm text-slate-500">{detail || "Context not provided"}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-900">
              {timeline.searched
                ? "No matching timeline found"
                : dataMode === "derived"
                ? "No derived signup journeys yet"
                : "No tracked sessions yet"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {timeline.searched
                ? "Try a different identifier or wait for new events to reach the event store."
                : dataMode === "derived"
                ? "Recent signup and sign-in journeys will appear here once matching records exist in the current dashboard data window."
                : "Recent sessions will appear here after the website or product starts calling the tracking helper."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContentDriversCard({
  dataMode,
  rows,
}: {
  dataMode: JourneyIntelligenceData["dataMode"];
  rows: JourneyContentDriverRow[];
}) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
          Content to Signup Analysis
        </CardTitle>
        <p className="text-sm text-slate-500">
          Last-touch content reads attributed to later signup and activation events.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 pl-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Content
                  </th>
                  <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Readers
                  </th>
                  <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Started
                  </th>
                  <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Completed
                  </th>
                  <th className="py-3 pr-4 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Activated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row) => (
                  <tr key={row.key} className="hover:bg-slate-50/60">
                    <td className="py-3 pl-4 align-top">
                      <div className="min-w-[240px]">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{row.label}</p>
                          <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                            {row.contentType}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{row.pagePath ?? row.key}</p>
                      </div>
                    </td>
                    <td className="py-3 text-right font-mono text-slate-700">
                      {formatCount(row.readers)}
                    </td>
                    <td className="py-3 text-right font-mono text-slate-700">
                      {formatCount(row.signupStarted)}
                    </td>
                    <td className="py-3 text-right font-mono text-slate-700">
                      {formatCount(row.signupCompleted)}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-slate-700">
                      {formatCount(row.activatedUsers)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 pb-6">
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-900">
                {dataMode === "ga4"
                  ? "No content to signup paths found yet"
                  : dataMode === "derived"
                  ? "Content attribution needs page-level event tracking"
                  : "No content-driven conversions yet"}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {dataMode === "ga4"
                  ? "This section fills when article or report pages can be tied to later signup, success, or dashboard steps."
                  : dataMode === "derived"
                  ? "Existing signup and auth tables do not contain article or report touchpoints, so this section will fill once content events are wired."
                  : "This fills once article or report events happen before signup starts."}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeviceCard({
  dataMode,
  rows,
}: {
  dataMode: JourneyIntelligenceData["dataMode"];
  rows: JourneyDeviceRow[];
}) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
          Device Analysis
        </CardTitle>
        <p className="text-sm text-slate-500">
          Compare conversion, drop-offs, and session depth across devices.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length > 0 ? (
          rows.map((row) => {
            const Icon = getDeviceIcon(row.device);

            return (
              <div
                key={row.device}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-slate-500" />
                      <p className="font-medium text-slate-900">{row.device}</p>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatCount(row.visitors)} visitors | {formatCount(row.sessions)} sessions
                    </p>
                  </div>
                  <Badge variant="outline" className="border-slate-200 bg-white text-slate-700">
                    {formatDuration(row.avgSessionDurationSeconds)}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Signup
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {row.signupRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Completed
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {row.completionRate.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Drop-off
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-950">
                      {row.dropOffRate.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
            <p className="text-sm font-medium text-slate-900">
              {dataMode === "ga4"
                ? "No device split returned for this range"
                : dataMode === "derived"
                ? "Device split needs session events"
                : "No device split yet"}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              {dataMode === "ga4"
                ? "The connected property did not return enough device-segmented rows for this window."
                : dataMode === "derived"
                ? "The existing signup and auth tables do not record reliable mobile vs desktop context."
                : "Device comparisons appear once sessions start posting custom events."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SourceCard({
  dataMode,
  rows,
}: {
  dataMode: JourneyIntelligenceData["dataMode"];
  rows: JourneySourceRow[];
}) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
          Source Analysis
        </CardTitle>
        <p className="text-sm text-slate-500">
          {dataMode === "ga4"
            ? "Compare first-touch acquisition buckets so the same user does not get counted across multiple source rows."
            : "Compare acquisition quality without depending on a separate analytics platform."}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="py-3 pl-4 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Source
                  </th>
                  <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Users
                  </th>
                  <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Signup %
                  </th>
                  <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Engagement
                  </th>
                  <th className="py-3 pr-4 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Active Users
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map((row) => (
                  <tr key={row.source} className="hover:bg-slate-50/60">
                    <td className="py-3 pl-4 font-medium text-slate-900">{row.source}</td>
                    <td className="py-3 text-right font-mono text-slate-700">
                      {formatCount(row.visitors)}
                    </td>
                    <td className="py-3 text-right font-mono text-slate-700">
                      {row.signupRate.toFixed(1)}%
                    </td>
                    <td className="py-3 text-right font-mono text-slate-700">
                      {row.engagementRate.toFixed(1)}%
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-slate-700">
                      {formatCount(row.activeUsers)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-4 pb-6">
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-900">No source comparison yet</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {dataMode === "ga4"
                  ? "The selected range did not return source rows that could be mapped into the requested comparison buckets."
                  : "Source quality appears once journey events include source context or map to an existing user."}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function JourneyIntelligenceView({
  data,
  query,
  pageQuery,
  startDate,
  endDate,
  rangePreset,
}: {
  data: JourneyIntelligenceData;
  query: string | null;
  pageQuery: string | null;
  startDate: string | null;
  endDate: string | null;
  rangePreset: string | null;
}) {
  const headerMetricLabel =
    data.dataMode === "ga4"
      ? "users tracked"
      : data.dataMode === "derived"
      ? "journey records derived"
      : "events tracked";
  const resolvedStartDate = startDate ?? data.rangeStart ?? null;
  const resolvedEndDate = endDate ?? data.rangeEnd ?? null;

  return (
    <div className="mx-auto max-w-[1400px] space-y-8 pb-8">
      <section className="space-y-4">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
                Journey Intelligence
              </Badge>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {resolvedStartDate && resolvedEndDate
                  ? `${formatIsoDate(resolvedStartDate)} - ${formatIsoDate(resolvedEndDate)}`
                  : `Last ${data.windowDays} days`}
              </Badge>
              {data.dataMode === "ga4" ? (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  Connected analytics
                </Badge>
              ) : null}
              {data.dataMode === "derived" ? (
                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
                  Existing DB fallback
                </Badge>
              ) : null}
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
                {data.dataMode === "ga4"
                  ? "Clear visibility into how users move, drop, and return"
                  : "Event-based visibility into how users move, drop, and return"}
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
                {data.dataMode === "ga4"
                  ? "This module pulls the connected analytics data into one native operator view for funnel, source, device, page, and signup insight."
                  : data.dataMode === "derived"
                  ? "This module is currently deriving the journey from existing signup, verification, and sign-in records so the dashboard stays useful before full product event wiring lands."
                  : "This module stays inside the current admin system and reads from one lightweight event stream instead of leaning on a separate analytics platform as the primary product layer."}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-sm text-slate-600">
            <div className="flex items-center gap-2 font-medium text-slate-900">
              <Activity className="h-4 w-4" />
              {formatCount(
                data.dataMode === "ga4"
                  ? data.trackedVisitors
                  : data.dataMode === "derived"
                  ? data.trackedVisitors
                  : data.totalEvents
              )}{" "}
              {headerMetricLabel}
            </div>
            <p className="mt-1">
              Generated {new Date(data.generatedAt).toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        {data.dataMode !== "ga4" &&
          data.notes.map((note) => (
          <div
            key={note}
            className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="leading-relaxed">{note}</p>
          </div>
          ))}
      </section>

      {data.dataMode === "ga4" ? (
        <DateRangeFilters
          query={query}
          pageQuery={pageQuery}
          startDate={resolvedStartDate}
          endDate={resolvedEndDate}
          rangePreset={rangePreset}
        />
      ) : null}

      {data.dataMode === "ga4" ? (
        <Ga4OverviewKpiCards insights={data.portalInsights} />
      ) : null}

      <SummaryCards
        dataMode={data.dataMode}
        stages={data.funnelStages}
        dropoff={data.dropoff}
        sources={data.sourceAnalysis}
      />

      {data.dataMode === "ga4" ? (
        <section className="space-y-4">
          <SectionHeading
            eyebrow="Portal journey"
            title="User Journey on Portal"
            description="Track how many users arrive, where attention holds, which page starts signup, where visitors leave without completing, and how many accounts get created."
          />
          <PortalInsightsCards insights={data.portalInsights} stages={data.funnelStages} />
          <PortalFlowCard rows={data.portalFlowRows ?? []} />
        </section>
      ) : null}

      {data.dataMode === "ga4" ? (
        <section className="space-y-4">
          <SectionHeading
            eyebrow="Page performance"
            title="Search one page, then read who entered, where they came from, and what happened next"
            description="Use this to inspect a specific page path like /energclub or /auth, then compare it against the broader high-volume and high-dropoff list."
          />
          <PageDrilldownCard
            query={query}
            pageQuery={pageQuery}
            data={data.pageDrilldown}
            suggestions={data.mostViewedPages}
            startDate={resolvedStartDate}
            endDate={resolvedEndDate}
            rangePreset={rangePreset}
          />
          <div className="grid gap-6 xl:grid-cols-2">
            <PageInsightsCard
              title="Most Viewed Pages"
              description="Top pages in the selected range by total views."
              rows={data.mostViewedPages}
              mode="views"
              query={query}
              activePageQuery={data.pageDrilldown?.resolvedPath ?? pageQuery}
              startDate={resolvedStartDate}
              endDate={resolvedEndDate}
              rangePreset={rangePreset}
            />
            <PageInsightsCard
              title="Highest Drop-off Pages"
              description="Pages where the largest share of visits ended without moving deeper."
              rows={data.highestDropoffPages}
              mode="dropoff"
              query={query}
              activePageQuery={data.pageDrilldown?.resolvedPath ?? pageQuery}
              startDate={resolvedStartDate}
              endDate={resolvedEndDate}
              rangePreset={rangePreset}
            />
          </div>
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
        <div className="space-y-4">
          <SectionHeading
            eyebrow="Conversion flow"
            title="Track the journey from anonymous visit to repeat usage"
            description="Counts, conversion percentages, and drop percentages stay visible in one clean funnel instead of being split across multiple dashboards."
          />
          <FunnelCard stages={data.funnelStages} dataMode={data.dataMode} />
        </div>

        <div className="space-y-4">
          <SectionHeading
            eyebrow="Friction"
            title="See where the journey breaks"
            description={
              data.dataMode === "ga4"
                ? "The right rail turns journey leakage, auth-stage drag, and behavior signals into one operator-friendly read."
                : "The right rail keeps abandonment, auth friction, and behavior errors readable at operator speed."
            }
          />
          <DropoffCard data={data.dropoff} dataMode={data.dataMode} />
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Timeline"
          title={
            data.dataMode === "ga4"
              ? "Inspect recent movement across the connected traffic"
              : "Inspect user and session-level movement"
          }
          description={
            data.dataMode === "ga4"
              ? "Search recent path, source, and event movement without leaving the admin dashboard."
              : "Open a recent session by default or search for a specific user to read the flow chronologically, including gaps between visits."
          }
        />
        {data.dataMode === "ga4" ? (
          <Ga4TimelineCard
            query={query}
            pageQuery={pageQuery}
            timeline={data.ga4Timeline}
            startDate={resolvedStartDate}
            endDate={resolvedEndDate}
            rangePreset={rangePreset}
          />
        ) : (
          <TimelineCard
            dataMode={data.dataMode}
            query={query}
            pageQuery={pageQuery}
            timeline={data.timeline}
            startDate={resolvedStartDate}
            endDate={resolvedEndDate}
            rangePreset={rangePreset}
          />
        )}
      </section>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Content influence"
          title="Find which articles and reports lead to signup"
          description={
            data.dataMode === "ga4"
              ? "Content pages are tied to downstream signup and dashboard paths inside the same connected reporting view."
              : "Content touches are attributed to later signup starts, completions, and dashboard activation without adding a second analytics platform."
          }
        />
        <ContentDriversCard dataMode={data.dataMode} rows={data.contentDrivers} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(320px,0.92fr)_minmax(0,1.08fr)]">
        <div className="space-y-4">
          <SectionHeading
            eyebrow="Device quality"
            title="Compare mobile against desktop"
            description="Look for mobile-specific conversion drag or shorter sessions before deciding whether UX work belongs at the top of the queue."
          />
          <DeviceCard dataMode={data.dataMode} rows={data.deviceAnalysis} />
        </div>

        <div className="space-y-4">
          <SectionHeading
            eyebrow="Acquisition quality"
            title="Compare source volume against downstream value"
            description={
              data.dataMode === "ga4"
                ? "Source buckets stay inside this dashboard, with engagement and signup value placed in one operator view."
                : "Source analysis stays lightweight and uses custom event outcomes plus existing user attribution fields rather than heavy joins."
            }
          />
          <SourceCard dataMode={data.dataMode} rows={data.sourceAnalysis} />
        </div>
      </section>

      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardContent className="flex flex-col gap-3 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-900">
              {data.dataMode === "ga4"
                ? "Using the current page analytics connection"
                : "Tracking helper ready for product touchpoints"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {data.dataMode === "ga4" ? (
                <>
                  This page reads the same stored property and credentials as{" "}
                  <a
                    href="/ga4-dashboard.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-slate-700 underline underline-offset-4"
                  >
                    Page Intelligence
                  </a>
                  , then places those insights directly inside Journey Intelligence.
                </>
              ) : (
                <>
                  Use{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                    {'trackEvent("signup_started")'}
                  </code>{" "}
                  from{" "}
                  <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs">
                    src/lib/journey-tracker.ts
                  </code>{" "}
                  to feed this module.
                </>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Route className="h-4 w-4" />
            {data.dataMode === "ga4" ? "Native journey view" : "Native admin module"}
            <ArrowUpRight className="h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
