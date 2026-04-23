"use client";

import { useMemo, useState, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  BarChart3,
  Database,
  Mail,
  MousePointerClick,
  Send,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type {
  BrevoAnalyticsData,
  BrevoBreakdownItem,
  BrevoBreakdownWithContacts,
  BrevoBreakdownContactRecord,
  BrevoCampaignPerformance,
  BrevoDailyMetric,
} from "@/lib/brevo";

const CHART_COLORS = [
  "#0f766e",
  "#2563eb",
  "#7c3aed",
  "#ea580c",
  "#dc2626",
  "#0891b2",
  "#65a30d",
  "#db2777",
];

function formatCount(value: number) {
  return value.toLocaleString("en-IN");
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function formatDate(value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    ...options,
  });
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-IN", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatRangeLabel(rangeLabel: string | null) {
  if (!rangeLabel || !rangeLabel.includes("|")) {
    return rangeLabel ?? "Last 90 days";
  }

  const [start, end] = rangeLabel.split("|");
  return `${formatDate(start, { year: "numeric" })} to ${formatDate(end, {
    year: "numeric",
  })}`;
}

function clampLabel(label: string, maxLength = 26) {
  if (label.length <= maxLength) {
    return label;
  }

  return `${label.slice(0, maxLength - 1)}...`;
}

function sectionHeading(
  eyebrow: string,
  title: string,
  description: string
) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
        {eyebrow}
      </p>
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function emptyChart(label: string) {
  return (
    <div className="flex h-full items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 px-4 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function buildLineOption(points: BrevoDailyMetric[]): EChartsOption {
  return {
    tooltip: { trigger: "axis" },
    color: ["#0f766e"],
    grid: { left: "3%", right: "4%", top: "8%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "category",
      data: points.map((point) =>
        new Date(point.date).toLocaleDateString("en-IN", {
          month: "short",
          day: "numeric",
        })
      ),
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLine: { show: false },
    },
    series: [
      {
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: { width: 3, color: "#0f766e" },
        itemStyle: { color: "#0f766e" },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(15,118,110,0.28)" },
              { offset: 1, color: "rgba(15,118,110,0.03)" },
            ],
          },
        },
        data: points.map((point) => point.count),
      },
    ],
  };
}

function buildDonutOption(items: BrevoBreakdownItem[]): EChartsOption {
  return {
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    color: CHART_COLORS,
    legend: {
      bottom: 0,
      icon: "circle",
      itemWidth: 8,
      textStyle: { fontSize: 10, color: "#64748b" },
    },
    series: [
      {
        type: "pie",
        radius: ["42%", "70%"],
        center: ["50%", "42%"],
        label: { show: false },
        emphasis: { scale: true, scaleSize: 6, label: { show: true, fontWeight: "bold" } },
        data: items.map((item) => ({ name: item.label, value: item.count })),
      },
    ],
  };
}

function buildHorizontalBarOption(
  items: BrevoBreakdownItem[],
  color = "#2563eb"
): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: "3%", right: "5%", top: "5%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLine: { show: false },
    },
    yAxis: {
      type: "category",
      data: items.map((item) => clampLabel(item.label, 20)),
      axisLabel: { color: "#64748b", fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: items.map((item) => ({
          value: item.count,
          itemStyle: { color, borderRadius: [0, 6, 6, 0] },
        })),
        barMaxWidth: 18,
      },
    ],
  };
}

function buildCoverageOption(items: BrevoAnalyticsData["contacts"]["profileCoverage"]): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    grid: { left: "3%", right: "5%", top: "5%", bottom: "3%", containLabel: true },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: {
        color: "#94a3b8",
        fontSize: 10,
        formatter: "{value}%",
      },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLine: { show: false },
    },
    yAxis: {
      type: "category",
      data: items.map((item) => item.label),
      axisLabel: { color: "#64748b", fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: items.map((item, index) => ({
          value: item.share,
          itemStyle: {
            color: CHART_COLORS[index % CHART_COLORS.length],
            borderRadius: [0, 6, 6, 0],
          },
        })),
        barMaxWidth: 18,
      },
    ],
  };
}

function buildCampaignRateOption(items: BrevoCampaignPerformance[]): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    color: ["#2563eb", "#0f766e"],
    legend: {
      top: 0,
      icon: "circle",
      itemWidth: 8,
      textStyle: { fontSize: 11, color: "#64748b" },
    },
    grid: { left: "3%", right: "4%", top: "38px", bottom: "3%", containLabel: true },
    xAxis: {
      type: "category",
      data: items.map((item) => clampLabel(item.name, 18)),
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", fontSize: 10, formatter: "{value}%" },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLine: { show: false },
    },
    series: [
      {
        name: "Open rate",
        type: "bar",
        data: items.map((item) => item.openRate),
        barMaxWidth: 18,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
      },
      {
        name: "Click-to-open",
        type: "bar",
        data: items.map((item) => item.clickToOpenRate),
        barMaxWidth: 18,
        itemStyle: { borderRadius: [6, 6, 0, 0] },
      },
    ],
  };
}

function metricCards(data: BrevoAnalyticsData) {
  return [
    {
      label: "Total contacts",
      value: formatCount(data.metrics.totalContacts),
      detail: `${formatCount(data.metrics.totalLists)} Brevo lists`,
      icon: Users,
      tone: "text-slate-900",
    },
    {
      label: "New contacts (30d)",
      value: formatCount(data.metrics.contactsLast30Days),
      detail: `${formatPercent(data.metrics.contactGrowthRate)} vs prior 30 days`,
      icon: ArrowUpRight,
      tone:
        data.metrics.contactGrowthRate >= 0 ? "text-emerald-700" : "text-rose-700",
    },
    {
      label: "Email blacklist",
      value: formatCount(data.metrics.emailBlacklistCount),
      detail: `${formatPercent(data.metrics.emailBlacklistRate)} of contact base`,
      icon: ShieldAlert,
      tone: "text-amber-700",
    },
    {
      label: "90d delivery rate",
      value: formatPercent(data.metrics.deliveryRate90d),
      detail: `${formatCount(data.transactional.delivered)} delivered`,
      icon: Send,
      tone: "text-slate-900",
    },
    {
      label: "90d unique open rate",
      value: formatPercent(data.metrics.uniqueOpenRate90d),
      detail: `${formatCount(data.transactional.uniqueOpens)} unique opens`,
      icon: Mail,
      tone: "text-slate-900",
    },
    {
      label: "Send credits left",
      value: formatCount(data.account.sendCreditsRemaining),
      detail: data.account.planNames.join(", ") || "No plan metadata",
      icon: Database,
      tone:
        data.account.sendCreditsRemaining < 250 ? "text-amber-700" : "text-slate-900",
    },
  ];
}

export function BrevoAnalyticsClient({ data }: { data: BrevoAnalyticsData }) {
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState("");
  const [drilldownContacts, setDrilldownContacts] = useState<BrevoBreakdownContactRecord[]>([]);

  const openDrilldown = useCallback(
    (title: string, contacts: BrevoBreakdownContactRecord[]) => {
      setDrilldownTitle(title);
      setDrilldownContacts(contacts);
      setDrilldownOpen(true);
    },
    []
  );

  const handleChartClick = useCallback(
    (items: BrevoBreakdownWithContacts[], sectionLabel: string) =>
      (params: { name?: string }) => {
        const clicked = items.find(
          (item) => item.label === params.name || clampLabel(item.label, 20) === params.name
        );
        if (clicked) {
          openDrilldown(`${sectionLabel} — ${clicked.label}`, clicked.contacts);
        }
      },
    [openDrilldown]
  );

  const heroMetrics = useMemo(() => metricCards(data), [data]);
  const topLists = data.contacts.listBreakdown.slice(0, 5);
  const topDomains = data.contacts.domainBreakdown.slice(0, 6);
  const topIndustries = data.contacts.industryBreakdown.slice(0, 6);
  const topCommunities = data.contacts.communityBreakdown.slice(0, 6);
  const topCampaigns = data.campaigns.recentSent.slice(0, 5);
  const topEvents = data.transactional.eventBreakdown.slice(0, 6);

  const topFrequency = data.contacts.frequencyBreakdown.slice(0, 6);
  const topPreference = data.contacts.preferenceBreakdown.slice(0, 6);
  const topUtmCampaign = data.contacts.utmCampaignBreakdown.slice(0, 6);
  const topUtmMedium = data.contacts.utmMediumBreakdown.slice(0, 6);
  const topUtmSource = data.contacts.utmSourceBreakdown.slice(0, 6);

  const contactTrendOption = useMemo(
    () => buildLineOption(data.contacts.trend30d),
    [data.contacts.trend30d]
  );
  const listMixOption = useMemo(() => buildDonutOption(topLists), [topLists]);
  const domainOption = useMemo(
    () => buildHorizontalBarOption(topDomains, "#2563eb"),
    [topDomains]
  );
  const industryOption = useMemo(
    () => buildHorizontalBarOption(topIndustries, "#0f766e"),
    [topIndustries]
  );
  const communityOption = useMemo(
    () => buildHorizontalBarOption(topCommunities, "#7c3aed"),
    [topCommunities]
  );
  const coverageOption = useMemo(
    () => buildCoverageOption(data.contacts.profileCoverage),
    [data.contacts.profileCoverage]
  );
  const campaignRateOption = useMemo(
    () => buildCampaignRateOption(topCampaigns),
    [topCampaigns]
  );
  const eventMixOption = useMemo(
    () => buildHorizontalBarOption(topEvents, "#ea580c"),
    [topEvents]
  );
  const frequencyOption = useMemo(
    () => buildHorizontalBarOption(topFrequency, "#0891b2"),
    [topFrequency]
  );
  const preferenceOption = useMemo(
    () => buildDonutOption(topPreference),
    [topPreference]
  );
  const utmCampaignOption = useMemo(
    () => buildHorizontalBarOption(topUtmCampaign, "#7c3aed"),
    [topUtmCampaign]
  );
  const utmMediumOption = useMemo(
    () => buildDonutOption(topUtmMedium),
    [topUtmMedium]
  );
  const utmSourceOption = useMemo(
    () => buildHorizontalBarOption(topUtmSource, "#65a30d"),
    [topUtmSource]
  );

  if (!data.available) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-10">
        <Card className="overflow-hidden rounded-[32px] border border-amber-200 bg-[linear-gradient(180deg,#fffdf6_0%,#fff7e8_100%)] shadow-sm">
          <CardHeader className="space-y-3">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5" />
              Brevo unavailable
            </div>
            <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950">
              Brevo analytics could not be loaded for this deployment.
            </CardTitle>
            <p className="max-w-3xl text-sm leading-relaxed text-slate-600">
              {data.statusMessage ??
                "The Brevo API key is missing or the account could not be reached from the server runtime."}
            </p>
          </CardHeader>
          <CardContent>
            <div className="rounded-[24px] border border-white/70 bg-white/80 p-5 text-sm leading-relaxed text-slate-600">
              Configure <code className="font-mono text-xs">BREVO_API_KEY</code> in the
              server environment and reload the page. The route already uses a server-only
              fetch path, so no secret is exposed to the browser.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1520px] space-y-8 pb-10">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.13),transparent_24%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-sm sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_420px]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
              <Sparkles className="h-3.5 w-3.5" />
              Brevo operator dashboard
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Live audience, campaign, and deliverability data from Brevo.
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
                This page stays factual and operational: contact growth, audience mix, field
                coverage, campaign efficiency, and recent transactional delivery issues pulled
                server-side from the live Brevo account.
              </p>
            </div>

            <div className="rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                What this page answers
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-600">
                How quickly the Brevo audience is growing, how concentrated it is across
                lists, whether profile fields are complete enough for segmentation, which
                campaigns are performing, and where delivery issues are appearing.
              </p>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.4)] backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Account snapshot
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              {data.account.companyName ?? "Brevo account"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{data.account.email ?? "-"}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Plan types
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(data.account.planNames.length > 0 ? data.account.planNames : ["unknown"]).map(
                    (plan) => (
                      <Badge key={plan} variant="secondary" className="capitalize">
                        {plan}
                      </Badge>
                    )
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Routing health
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={
                      data.account.relayEnabled
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }
                  >
                    Relay {data.account.relayEnabled ? "enabled" : "off"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      data.account.marketingAutomationEnabled
                        ? "border-blue-200 bg-blue-50 text-blue-700"
                        : "border-slate-200 bg-slate-50 text-slate-600"
                    }
                  >
                    Automation{" "}
                    {data.account.marketingAutomationEnabled ? "enabled" : "off"}
                  </Badge>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Active senders
                </p>
                <div className="mt-3 space-y-2">
                  {data.account.activeSenders.length > 0 ? (
                    data.account.activeSenders.map((sender) => (
                      <p key={sender} className="truncate text-sm text-slate-700">
                        {sender}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No sender metadata found.</p>
                  )}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Generated
                </p>
                <p className="mt-3 text-sm text-slate-700">
                  {formatDateTime(data.generatedAt)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Timezone: {data.account.timezone ?? "n/a"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {data.statusMessage ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-800">
          {data.statusMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        {heroMetrics.map((card) => {
          const Icon = card.icon;

          return (
            <Card
              key={card.label}
              className="border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {card.label}
                </CardTitle>
                <div className="rounded-2xl bg-slate-50 p-2">
                  <Icon className={`h-4 w-4 ${card.tone}`} />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tracking-tight text-slate-950">
                  {card.value}
                </p>
                <p className={`mt-2 text-sm ${card.tone}`}>{card.detail}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="space-y-5">
        {sectionHeading(
          "Audience intelligence",
          "See who is entering Brevo and how concentrated the database has become",
          "The first layer focuses on contact intake, list concentration, domain mix, and whether the audience profile is rich enough to support segmented campaigns."
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Contact growth over the last 30 days
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Daily contact creation pulled from Brevo contact timestamps.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Last 30 days
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatCount(data.metrics.contactsLast30Days)}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Previous 30 days
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatCount(data.metrics.contactsPrev30Days)}
                  </p>
                </div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Growth delta
                  </p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                    {formatPercent(data.metrics.contactGrowthRate)}
                  </p>
                </div>
              </div>
              <div className="h-[310px] w-full">
                {data.contacts.trend30d.length > 0 ? (
                  <ReactECharts
                    option={contactTrendOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                ) : (
                  emptyChart("No recent contact growth was available from Brevo.")
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  List concentration
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Track which Brevo lists actually hold the audience.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="h-[260px] w-full">
                {topLists.length > 0 ? (
                  <ReactECharts
                    option={listMixOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                ) : (
                  emptyChart("No Brevo lists were returned for this account.")
                )}
              </div>
              <div className="space-y-3">
                {topLists.map((item, index) => (
                  <div
                    key={item.label}
                    className="rounded-[20px] border border-slate-200 bg-slate-50/70 px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-medium text-slate-800">
                        {index + 1}. {item.label}
                      </p>
                      <Badge variant="secondary">{formatPercent(item.share)}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatCount(item.count)} subscribers in this list
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Email domain mix
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {topDomains.length > 0 ? (
                  <ReactECharts
                    option={domainOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                ) : (
                  emptyChart("No contact domains were available.")
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Industry mix
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {topIndustries.length > 0 ? (
                  <ReactECharts
                    option={industryOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                ) : (
                  emptyChart("No industry attributes were available.")
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-violet-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Community interests
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Multi-select values are split into individual interests.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {topCommunities.length > 0 ? (
                  <ReactECharts
                    option={communityOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                ) : (
                  emptyChart("Community selections have not been captured yet.")
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        {sectionHeading(
          "Data quality",
          "Judge whether the Brevo audience is ready for real segmentation",
          "These fields indicate whether the contact model is mature enough for campaign attribution, industry targeting, and higher-quality email personalisation."
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-slate-700" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Profile field coverage
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                High core coverage and low UTM coverage is the current quality pattern.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-[330px] w-full">
                {data.contacts.profileCoverage.length > 0 ? (
                  <ReactECharts
                    option={coverageOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                ) : (
                  emptyChart("No field coverage summary is available.")
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-700" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Latest contacts
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 hover:bg-transparent">
                    <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Contact
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Organisation
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Source
                    </TableHead>
                    <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Added
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.contacts.recentContacts.length > 0 ? (
                    data.contacts.recentContacts.map((contact) => (
                      <TableRow
                        key={contact.id}
                        className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                      >
                        <TableCell className="pl-6">
                          <div>
                            <p className="text-sm font-medium text-slate-950">
                              {contact.firstName ?? "Unknown"}
                            </p>
                            <p className="font-mono text-[11px] text-slate-400">
                              {contact.email ?? "No email"}
                            </p>
                            {contact.industry ? (
                              <p className="mt-1 text-[11px] text-slate-500">
                                {contact.industry}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {contact.organisation ?? "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[11px]">
                            {contact.source ?? "Unknown"}
                          </Badge>
                        </TableCell>
                        <TableCell className="pr-6 text-right text-xs text-slate-500">
                          {formatDate(contact.createdAt, { year: "numeric" })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={4}
                        className="py-10 text-center text-sm text-slate-500"
                      >
                        No recent contacts are available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        {sectionHeading(
          "Engagement profiling",
          "Frequency and content preference distribution across the contact base",
          "These attribute-level breakdowns reveal how contacts self-select into frequency tiers and content preference categories. Click any bar or segment to drill into the underlying contacts."
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Frequency values",
              value: formatCount(topFrequency.reduce((s, i) => s + i.count, 0)),
              detail: `${topFrequency.length} distinct values captured`,
              icon: BarChart3,
            },
            {
              label: "Top frequency",
              value: topFrequency[0]?.label ?? "-",
              detail: topFrequency[0]
                ? `${formatCount(topFrequency[0].count)} contacts (${formatPercent(topFrequency[0].share)})`
                : "No data",
              icon: Activity,
            },
            {
              label: "Preference values",
              value: formatCount(topPreference.reduce((s, i) => s + i.count, 0)),
              detail: `${topPreference.length} distinct values captured`,
              icon: BadgeCheck,
            },
            {
              label: "Top preference",
              value: topPreference[0]?.label ?? "-",
              detail: topPreference[0]
                ? `${formatCount(topPreference[0].count)} contacts (${formatPercent(topPreference[0].share)})`
                : "No data",
              icon: Sparkles,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="border border-slate-200 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {item.label}
                  </CardTitle>
                  <div className="rounded-2xl bg-slate-50 p-2">
                    <Icon className="h-4 w-4 text-slate-700" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tracking-tight text-slate-950 truncate">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-cyan-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Frequency distribution
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Click any bar to see the contacts in that frequency tier.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                {topFrequency.length > 0 ? (
                  <ReactECharts
                    option={frequencyOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                    onEvents={{
                      click: handleChartClick(topFrequency, "Frequency"),
                    }}
                  />
                ) : (
                  emptyChart("No frequency data has been captured yet.")
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-rose-500" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Preference breakdown
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Click any segment to see the contacts with that preference.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                {topPreference.length > 0 ? (
                  <ReactECharts
                    option={preferenceOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                    onEvents={{
                      click: handleChartClick(topPreference, "Preference"),
                    }}
                  />
                ) : (
                  emptyChart("No preference data has been captured yet.")
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        {sectionHeading(
          "UTM attribution",
          "Understand which campaigns, mediums, and sources are driving contact acquisition",
          "UTM fields show how contacts arrived. Click any chart element to reveal the contacts tagged with that UTM value."
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            {
              label: "UTM campaigns tagged",
              value: formatCount(topUtmCampaign.reduce((s, i) => s + i.count, 0)),
              detail: `${topUtmCampaign.length} distinct campaigns`,
              icon: Send,
            },
            {
              label: "UTM mediums tagged",
              value: formatCount(topUtmMedium.reduce((s, i) => s + i.count, 0)),
              detail: `${topUtmMedium.length} distinct mediums`,
              icon: Mail,
            },
            {
              label: "UTM sources tagged",
              value: formatCount(topUtmSource.reduce((s, i) => s + i.count, 0)),
              detail: `${topUtmSource.length} distinct sources`,
              icon: MousePointerClick,
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="border border-slate-200 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {item.label}
                  </CardTitle>
                  <div className="rounded-2xl bg-slate-50 p-2">
                    <Icon className="h-4 w-4 text-slate-700" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight text-slate-950">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Send className="h-4 w-4 text-violet-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  UTM Campaign
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Click a bar to drill into contacts.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                {topUtmCampaign.length > 0 ? (
                  <ReactECharts
                    option={utmCampaignOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                    onEvents={{
                      click: handleChartClick(topUtmCampaign, "UTM Campaign"),
                    }}
                  />
                ) : (
                  emptyChart("No UTM campaign values captured.")
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  UTM Medium
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Click a segment to drill into contacts.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                {topUtmMedium.length > 0 ? (
                  <ReactECharts
                    option={utmMediumOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                    onEvents={{
                      click: handleChartClick(topUtmMedium, "UTM Medium"),
                    }}
                  />
                ) : (
                  emptyChart("No UTM medium values captured.")
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-green-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  UTM Source
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Click a bar to drill into contacts.
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                {topUtmSource.length > 0 ? (
                  <ReactECharts
                    option={utmSourceOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                    onEvents={{
                      click: handleChartClick(topUtmSource, "UTM Source"),
                    }}
                  />
                ) : (
                  emptyChart("No UTM source values captured.")
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        {sectionHeading(
          "Campaign intelligence",
          "Evaluate recent Brevo email campaigns beyond send counts",
          "The campaign layer compares delivered volume, open rate, click-through depth, and bounce pressure to show which messages actually worked."
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Sent campaigns",
              value: formatCount(data.metrics.sentCampaigns),
              detail: `${formatCount(data.metrics.draftCampaigns)} drafts still open`,
              icon: Send,
            },
            {
              label: "Weighted open rate",
              value: formatPercent(data.campaigns.weightedOpenRate),
              detail: `${formatCount(data.campaigns.totalDelivered)} delivered across recent sends`,
              icon: Mail,
            },
            {
              label: "Weighted click rate",
              value: formatPercent(data.campaigns.weightedClickRate),
              detail: `${formatPercent(data.campaigns.weightedClickToOpenRate)} click-to-open`,
              icon: MousePointerClick,
            },
            {
              label: "Best open performer",
              value: data.campaigns.bestOpenCampaign
                ? formatPercent(data.campaigns.bestOpenCampaign.openRate)
                : "-",
              detail: data.campaigns.bestOpenCampaign?.name ?? "No sent campaign data",
              icon: BadgeCheck,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.label} className="border border-slate-200 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {item.label}
                  </CardTitle>
                  <div className="rounded-2xl bg-slate-50 p-2">
                    <Icon className="h-4 w-4 text-slate-700" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight text-slate-950">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Open rate vs click-to-open
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[340px] w-full">
                {topCampaigns.length > 0 ? (
                  <ReactECharts
                    option={campaignRateOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                ) : (
                  emptyChart("No sent campaigns are available for comparison.")
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-slate-700" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Recent sent campaigns
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 hover:bg-transparent">
                    <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Campaign
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Delivered
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Open
                    </TableHead>
                    <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      CTO
                    </TableHead>
                    <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Sent
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topCampaigns.length > 0 ? (
                    topCampaigns.map((campaign) => (
                      <TableRow
                        key={campaign.id}
                        className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                      >
                        <TableCell className="pl-6">
                          <div className="max-w-[320px]">
                            <p className="truncate text-sm font-medium text-slate-950">
                              {campaign.name}
                            </p>
                            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-slate-500">
                              {campaign.subject}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-1">
                              {campaign.lists.slice(0, 2).map((list) => (
                                <Badge
                                  key={`${campaign.id}-${list.listId}`}
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  {list.listName}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-700">
                          {formatCount(campaign.delivered)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-700">
                          {formatPercent(campaign.openRate)}
                        </TableCell>
                        <TableCell className="text-right text-sm text-slate-700">
                          {formatPercent(campaign.clickToOpenRate)}
                        </TableCell>
                        <TableCell className="pr-6 text-right text-xs text-slate-500">
                          {formatDate(campaign.sentDate, { year: "numeric" })}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className="py-10 text-center text-sm text-slate-500"
                      >
                        No sent campaigns are available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        {sectionHeading(
          "Transactional operations",
          "Monitor delivery friction, subject activity, and current email issues",
          "This layer uses Brevo's aggregated SMTP reporting and recent event feed to highlight whether reminder flows and verification emails are healthy."
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {[
            {
              label: "90d delivered",
              value: formatCount(data.transactional.delivered),
              detail: formatRangeLabel(data.transactional.rangeLabel),
              icon: Send,
            },
            {
              label: "Issue rate",
              value: formatPercent(data.transactional.issueRate),
              detail: `${formatCount(
                data.transactional.blocked +
                  data.transactional.hardBounces +
                  data.transactional.softBounces +
                  data.transactional.deferred +
                  data.transactional.errors
              )} issue events`,
              icon: AlertTriangle,
            },
            {
              label: "Unique opens",
              value: formatCount(data.transactional.uniqueOpens),
              detail: `${formatPercent(data.transactional.uniqueOpenRate)} of delivered mail`,
              icon: Mail,
            },
            {
              label: "Unique clicks",
              value: formatCount(data.transactional.uniqueClicks),
              detail: `${formatPercent(data.transactional.uniqueClickRate)} of delivered mail`,
              icon: MousePointerClick,
            },
            {
              label: "Unsubscribed",
              value: formatCount(data.transactional.unsubscribed),
              detail: "Raw opt-out count over the 90-day window",
              icon: ShieldAlert,
            },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <Card key={item.label} className="border border-slate-200 bg-white shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    {item.label}
                  </CardTitle>
                  <div className="rounded-2xl bg-slate-50 p-2">
                    <Icon className="h-4 w-4 text-slate-700" />
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-semibold tracking-tight text-slate-950">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{item.detail}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Recent event mix
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                {topEvents.length > 0 ? (
                  <ReactECharts
                    option={eventMixOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                ) : (
                  emptyChart("No recent SMTP events were returned.")
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-700" />
                  <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                    Most active transactional subjects
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent">
                      <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Subject
                      </TableHead>
                      <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Events
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactional.topSubjects.length > 0 ? (
                      data.transactional.topSubjects.map((subject) => (
                        <TableRow
                          key={subject.label}
                          className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                        >
                          <TableCell className="pl-6 text-sm text-slate-700">
                            {subject.label}
                          </TableCell>
                          <TableCell className="pr-6 text-right text-sm text-slate-700">
                            {formatCount(subject.count)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={2}
                          className="py-8 text-center text-sm text-slate-500"
                        >
                          No subject activity is available.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                    Recent delivery issues
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b border-slate-100 hover:bg-transparent">
                      <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Event
                      </TableHead>
                      <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Email
                      </TableHead>
                      <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Time
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.transactional.recentIssues.length > 0 ? (
                      data.transactional.recentIssues.map((issue, index) => (
                        <TableRow
                          key={`${issue.email}-${issue.date}-${index}`}
                          className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                        >
                          <TableCell className="pl-6">
                            <Badge
                              variant="outline"
                              className="border-amber-200 bg-amber-50 text-amber-700"
                            >
                              {issue.event}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-700">
                            <div>
                              <p>{issue.email ?? "Unknown recipient"}</p>
                              <p className="mt-1 text-[11px] text-slate-500">
                                {issue.subject ?? "No subject"}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="pr-6 text-right text-xs text-slate-500">
                            {formatDateTime(issue.date)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={3}
                          className="py-8 text-center text-sm text-slate-500"
                        >
                          No recent blocked, deferred, or error events were found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="space-y-3 pb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-700" />
              <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                Recent transactional activity
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-100 hover:bg-transparent">
                  <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Event
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Subject
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Recipient
                  </TableHead>
                  <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Time
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.transactional.recentActivity.length > 0 ? (
                  data.transactional.recentActivity.map((event, index) => (
                    <TableRow
                      key={`${event.date}-${event.email}-${index}`}
                      className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                    >
                      <TableCell className="pl-6">
                        <Badge variant="secondary" className="capitalize">
                          {event.event}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {event.subject ?? "No subject"}
                      </TableCell>
                      <TableCell className="text-sm text-slate-700">
                        {event.email ?? "Unknown recipient"}
                      </TableCell>
                      <TableCell className="pr-6 text-right text-xs text-slate-500">
                        {formatDateTime(event.date)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={4}
                      className="py-8 text-center text-sm text-slate-500"
                    >
                      No recent transactional activity is available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <Dialog open={drilldownOpen} onOpenChange={setDrilldownOpen}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold tracking-tight text-slate-950">
              {drilldownTitle}
            </DialogTitle>
            <DialogDescription>
              {drilldownContacts.length} contact{drilldownContacts.length !== 1 ? "s" : ""} in this
              segment. Showing up to 50 records.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto flex-1 -mx-4 px-4">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-slate-100 hover:bg-transparent">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Contact
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Organisation
                  </TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Value
                  </TableHead>
                  <TableHead className="text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Added
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drilldownContacts.length > 0 ? (
                  drilldownContacts.map((contact) => (
                    <TableRow
                      key={contact.id}
                      className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                    >
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-slate-950">
                            {contact.firstName ?? "Unknown"}
                          </p>
                          <p className="font-mono text-[11px] text-slate-400">
                            {contact.email ?? "No email"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {contact.organisation ?? "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[11px]">
                          {contact.value}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-slate-500">
                        {formatDate(contact.createdAt, { year: "numeric" })}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={4}
                      className="py-10 text-center text-sm text-slate-500"
                    >
                      No contacts found for this segment.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
