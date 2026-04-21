"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle,
  Filter,
  Globe,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import type {
  MonthlyCoHortRow,
  SourceConversionRow,
  UtmPerformanceRow,
} from "@/lib/db";

interface FunnelData {
  totalRegistered: number;
  totalOnboarded: number;
  everSignedIn: number;
  activeWithin30d: number;
  activeWithin7d: number;
  neverSignedIn: number;
  sourceConversion: SourceConversionRow[];
  utmPerformance: UtmPerformanceRow[];
  monthlyCohorts: MonthlyCoHortRow[];
}

interface ChartFormatterParams {
  name?: string;
  value?: number | string | null;
  data?: {
    share?: number;
  };
}

function pct(num: number, denom: number): number {
  if (!denom) return 0;
  return Math.round((num / denom) * 100);
}

function formatCount(value: number) {
  return value.toLocaleString("en-IN");
}

function toneClass(rate: number) {
  if (rate >= 70) return "bg-emerald-50 text-emerald-700";
  if (rate >= 40) return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
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

function ProgressBar({
  value,
  max,
  color = "#10b981",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const width = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}

export function FunnelsClient({ data }: { data: FunnelData }) {
  const {
    totalRegistered,
    totalOnboarded,
    everSignedIn,
    activeWithin30d,
    activeWithin7d,
    neverSignedIn,
    sourceConversion,
    utmPerformance,
    monthlyCohorts,
  } = data;

  const onboardingRate = pct(totalOnboarded, totalRegistered);
  const signInRate = pct(everSignedIn, totalRegistered);
  const retention30 = pct(activeWithin30d, totalRegistered);
  const engagement7 = pct(activeWithin7d, totalRegistered);
  const monthlyToWeekly = pct(activeWithin7d, activeWithin30d);
  const neverSignedInRate = pct(neverSignedIn, totalRegistered);
  const inactiveAfterSignin = Math.max(everSignedIn - activeWithin30d, 0);
  const inactiveAfterSigninRate = pct(inactiveAfterSignin, totalRegistered);
  const biggestLeak = Math.max(
    totalRegistered - totalOnboarded,
    totalOnboarded - everSignedIn,
    everSignedIn - activeWithin30d,
    activeWithin30d - activeWithin7d
  );

  const funnelStages = useMemo(
    () => [
      {
        name: "Registered",
        value: totalRegistered,
        share: 100,
        itemStyle: { color: "#635bff" },
      },
      {
        name: "Onboarded",
        value: totalOnboarded,
        share: onboardingRate,
        itemStyle: { color: "#5b93ea" },
      },
      {
        name: "Signed In",
        value: everSignedIn,
        share: signInRate,
        itemStyle: { color: "#1fb98b" },
      },
      {
        name: "Active (30 Days)",
        value: activeWithin30d,
        share: retention30,
        itemStyle: { color: "#f59e0b" },
      },
      {
        name: "Active (7 Days)",
        value: activeWithin7d,
        share: engagement7,
        itemStyle: { color: "#f43f5e" },
      },
    ],
    [
      activeWithin30d,
      activeWithin7d,
      engagement7,
      onboardingRate,
      retention30,
      signInRate,
      totalOnboarded,
      totalRegistered,
      everSignedIn,
    ]
  );

  const funnelTransitions = [
    {
      label: "Registered to onboarded",
      retained: onboardingRate,
      dropped: Math.max(totalRegistered - totalOnboarded, 0),
      detail: `${formatCount(totalOnboarded)} users completed onboarding`,
      badge: "border-blue-200 bg-blue-50 text-blue-700",
    },
    {
      label: "Onboarded to signed in",
      retained: totalOnboarded > 0 ? pct(everSignedIn, totalOnboarded) : 0,
      dropped: Math.max(totalOnboarded - everSignedIn, 0),
      detail: `${formatCount(everSignedIn)} users authenticated at least once`,
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      label: "Signed in to 30-day active",
      retained: everSignedIn > 0 ? pct(activeWithin30d, everSignedIn) : 0,
      dropped: Math.max(everSignedIn - activeWithin30d, 0),
      detail: `${formatCount(activeWithin30d)} users came back within the month`,
      badge: "border-amber-200 bg-amber-50 text-amber-700",
    },
    {
      label: "30-day active to 7-day active",
      retained: monthlyToWeekly,
      dropped: Math.max(activeWithin30d - activeWithin7d, 0),
      detail: `${formatCount(activeWithin7d)} users were active this week`,
      badge: "border-rose-200 bg-rose-50 text-rose-700",
    },
  ];

  const heroCards = [
    {
      label: "Onboarding rate",
      value: `${onboardingRate}%`,
      detail: `${formatCount(totalOnboarded)} completed`,
      icon: CheckCircle,
      border: "border-l-blue-500",
      iconColor: "text-blue-600",
      up: onboardingRate >= 50,
    },
    {
      label: "Sign-in rate",
      value: `${signInRate}%`,
      detail: `${formatCount(everSignedIn)} users signed in`,
      icon: Activity,
      border: "border-l-emerald-500",
      iconColor: "text-emerald-600",
      up: signInRate >= 60,
    },
    {
      label: "30-day retention",
      value: `${retention30}%`,
      detail: `${formatCount(activeWithin30d)} monthly active`,
      icon: TrendingUp,
      border: "border-l-amber-500",
      iconColor: "text-amber-600",
      up: retention30 >= 30,
    },
    {
      label: "7-day engagement",
      value: `${engagement7}%`,
      detail: `${formatCount(activeWithin7d)} weekly active`,
      icon: Zap,
      border: "border-l-violet-500",
      iconColor: "text-violet-600",
      up: engagement7 >= 15,
    },
    {
      label: "Never signed in",
      value: `${neverSignedInRate}%`,
      detail: `${formatCount(neverSignedIn)} users`,
      icon: AlertCircle,
      border: "border-l-rose-500",
      iconColor: "text-rose-600",
      up: neverSignedInRate <= 20,
    },
  ];

  const mainFunnelOption = useMemo((): EChartsOption => ({
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) => {
        const point = params as ChartFormatterParams;
        return (
          `<div style="font-size:13px"><strong>${point.name}</strong></div>` +
          `<div>Users: <strong>${formatCount(Number(point.value ?? 0))}</strong></div>` +
          `<div style="color:#10b981;font-weight:600">${Number(point.data?.share ?? 0)}% of total</div>`
        );
      },
    },
    series: [{
      name: "Journey",
      type: "funnel",
      left: "4%",
      right: "14%",
      top: 12,
      bottom: 8,
      min: 0,
      max: Math.max(totalRegistered, 1),
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) =>
          `{title|${params.name}}\n{meta|${formatCount(Number(params.value ?? 0))}  •  ${Number(params.data?.share ?? 0)}%}`,
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
      data: funnelStages,
    }],
  }), [funnelStages, totalRegistered]);

  const sourceBarOption = useMemo((): EChartsOption => {
    const sources = sourceConversion.map((source) => source.source.replace(/_/g, " "));

    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      color: ["#dbeafe", "#2563eb"],
      legend: {
        top: 0,
        icon: "circle",
        itemWidth: 8,
        textStyle: { fontSize: 11, color: "#6b7280" },
      },
      grid: { left: "3%", right: "4%", top: "40px", bottom: "3%", containLabel: true },
      xAxis: {
        type: "value",
        axisLabel: { color: "#94a3b8", fontSize: 10 },
        splitLine: { lineStyle: { color: "#f1f5f9" } },
        axisLine: { show: false },
      },
      yAxis: {
        type: "category",
        data: sources,
        axisLabel: { color: "#64748b", fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Registered",
          type: "bar",
          data: sourceConversion.map((source) => ({
            value: source.total,
            itemStyle: { color: "#dbeafe", borderRadius: [0, 5, 5, 0] },
          })),
          barMaxWidth: 18,
        },
        {
          name: "Onboarded",
          type: "bar",
          data: sourceConversion.map((source) => ({
            value: source.onboarded,
            itemStyle: { color: "#2563eb", borderRadius: [0, 5, 5, 0] },
          })),
          barMaxWidth: 18,
        },
      ],
    };
  }, [sourceConversion]);

  const cohortOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    color: ["#10b981", "#0f766e"],
    legend: {
      top: 0,
      icon: "circle",
      itemWidth: 8,
      textStyle: { fontSize: 11, color: "#6b7280" },
    },
    grid: { left: "3%", right: "4%", top: "40px", bottom: "5%", containLabel: true },
    xAxis: {
      type: "category",
      data: monthlyCohorts.map((cohort) => {
        const [year, month] = cohort.month.split("-");
        return `${month}/${year.slice(2)}`;
      }),
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      axisLine: { show: false },
    },
    series: [
      {
        name: "Registered",
        type: "bar",
        data: monthlyCohorts.map((cohort) => cohort.registered),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24,
      },
      {
        name: "Onboarded",
        type: "bar",
        data: monthlyCohorts.map((cohort) => cohort.onboarded),
        itemStyle: { borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 24,
      },
    ],
  }), [monthlyCohorts]);

  const dropoffOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    color: ["#10b981", "#f59e0b", "#f43f5e", "#94a3b8"],
    legend: {
      bottom: 0,
      icon: "circle",
      itemWidth: 8,
      textStyle: { fontSize: 10, color: "#6b7280" },
    },
    series: [{
      type: "pie",
      radius: ["40%", "68%"],
      center: ["50%", "44%"],
      data: [
        { name: "Active (7 Days)", value: activeWithin7d },
        { name: "Active (30d) Only", value: Math.max(0, activeWithin30d - activeWithin7d) },
        { name: "Never Signed In", value: neverSignedIn },
        { name: "Inactive (30d+)", value: inactiveAfterSignin },
      ].filter((slice) => slice.value > 0),
      label: { show: false },
      emphasis: { scale: true, scaleSize: 6, label: { show: true, fontWeight: "bold" } },
    }],
  }), [activeWithin30d, activeWithin7d, inactiveAfterSignin, neverSignedIn]);

  const sourceHighlights = [
    {
      label: "Lead conversion source",
      value: sourceConversion[0]?.source.replace(/_/g, " ") ?? "No source data",
      detail: sourceConversion[0]
        ? `${formatCount(sourceConversion[0].total)} registered users tracked here`
        : "Add source attribution to expose the strongest acquisition path.",
    },
    {
      label: "Monthly to weekly retention",
      value: `${monthlyToWeekly}%`,
      detail: `${formatCount(activeWithin7d)} of ${formatCount(activeWithin30d)} monthly-actives returned this week`,
    },
    {
      label: "Largest leak in journey",
      value: formatCount(biggestLeak),
      detail: "This is the biggest single-stage drop-off across the funnel.",
    },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-8 pb-8">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-sm sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_420px]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-violet-700">
              <Sparkles className="h-3.5 w-3.5" />
              Conversion intelligence
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Industrial-grade visibility into registration, onboarding, and retention.
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
                This surface is designed for a fast operator read: where users enter, where
                the funnel leaks, which cohorts retain, and which acquisition sources are
                producing quality users rather than just volume.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {sourceHighlights.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[26px] border border-white/70 bg-white/85 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)] backdrop-blur"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                    {item.value}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.4)] backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Current lens
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              Funnel pulse
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Registered
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {formatCount(totalRegistered)}
                </p>
                <p className="mt-2 text-sm text-slate-500">Total accounts entering the funnel</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Onboarded
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {formatCount(totalOnboarded)}
                </p>
                <p className="mt-2 text-sm text-slate-500">{onboardingRate}% of total registrations</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Monthly active
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {formatCount(activeWithin30d)}
                </p>
                <p className="mt-2 text-sm text-slate-500">{retention30}% reached 30-day activity</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Weekly active
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {formatCount(activeWithin7d)}
                </p>
                <p className="mt-2 text-sm text-slate-500">{engagement7}% stayed active this week</p>
              </div>
            </div>

            <div className="mt-5 rounded-[26px] border border-emerald-100 bg-emerald-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Executive read
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {retention30}% of registered users make it to monthly activity, while only{" "}
                {engagement7}% remain active in the last 7 days. The biggest immediate risk is{" "}
                {neverSignedInRate}% of users never signing in at all.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {heroCards.map((card) => {
          const Icon = card.icon;
          const Trend = card.up ? TrendingUp : TrendingDown;

          return (
            <Card
              key={card.label}
              className={`border border-slate-200 border-l-4 ${card.border} bg-white shadow-sm transition-shadow hover:shadow-md`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {card.label}
                </CardTitle>
                <div className="rounded-2xl bg-slate-50 p-2">
                  <Icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-3xl font-semibold tracking-tight text-slate-950">{card.value}</p>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                      card.up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                    }`}
                  >
                    <Trend className="h-3 w-3" />
                    {card.detail}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Journey analysis"
          title="See where the funnel holds and where it fails"
          description="The main funnel is paired with transition diagnostics so it is possible to distinguish onboarding friction from longer-term retention loss."
        />

        <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-[32px] border border-slate-900 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.24),transparent_32%),linear-gradient(160deg,#020617_0%,#0f172a_70%,#111827_100%)] p-6 text-white shadow-[0_24px_70px_-40px_rgba(2,6,23,0.7)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-300">
                Journey read
              </p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-white">
                {retention30}% of registered users return within 30 days
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                The funnel is healthy only if onboarding, sign-in, and repeat usage stay close
                together. Here the later stages compress sharply, which means activation and
                habit formation still need work.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    30D to 7D retention
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    {monthlyToWeekly}%
                  </p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                    Largest leak
                  </p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                    {formatCount(biggestLeak)}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Never signed in
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  {formatCount(neverSignedIn)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {neverSignedInRate}% of registered users never started the product journey.
                </p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Inactive after sign-in
                </p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  {formatCount(inactiveAfterSignin)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {inactiveAfterSigninRate}% signed in before but did not return in the last 30 days.
                </p>
              </div>
            </div>
          </div>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-indigo-500" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  User journey funnel
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                End-to-end conversion from registration to weekly-active users, with each
                stage labeled directly on the chart.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[28px] border border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-4">
                <div className="h-[360px] w-full">
                  <ReactECharts option={mainFunnelOption} style={{ height: "100%", width: "100%" }} notMerge />
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {funnelTransitions.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {item.label}
                      </p>
                      <Badge variant="outline" className={`border ${item.badge}`}>
                        {item.retained}%
                      </Badge>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.detail}</p>
                    <p className="mt-3 text-xs font-medium text-slate-500">
                      {formatCount(item.dropped)} users drop at this step
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Acquisition quality"
          title="Compare source volume against downstream conversion"
          description="Source reporting should not stop at registrations. This layer shows which channels are bringing users who actually move through onboarding."
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Onboarding by source
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Registered versus onboarded users across each acquisition source.
              </p>
            </CardHeader>
            <CardContent>
              {sourceConversion.length > 0 ? (
                <div className="h-[320px]">
                  <ReactECharts option={sourceBarOption} style={{ height: "100%", width: "100%" }} notMerge />
                </div>
              ) : (
                <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
                  <Globe className="h-8 w-8 text-slate-200" />
                  <p className="text-sm font-medium text-slate-400">No source data tracked</p>
                  <p className="max-w-xs text-[11px] text-slate-400">
                    Users may not have a populated <code className="font-mono text-xs">source</code> value in the database.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Monthly registration cohorts
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Cohort volume compared with onboarding completion by month.
              </p>
            </CardHeader>
            <CardContent>
              {monthlyCohorts.length > 0 ? (
                <div className="h-[320px]">
                  <ReactECharts option={cohortOption} style={{ height: "100%", width: "100%" }} notMerge />
                </div>
              ) : (
                <div className="flex h-[220px] flex-col items-center justify-center gap-2 text-center">
                  <BarChart3 className="h-8 w-8 text-slate-200" />
                  <p className="text-sm font-medium text-slate-400">No cohort data available</p>
                  <p className="text-[11px] text-slate-400">Registration data by month is not available yet.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-violet-500" />
              <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                Source conversion detail
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {sourceConversion.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-3 pl-6 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Source
                      </th>
                      <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Registered
                      </th>
                      <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Onboarded
                      </th>
                      <th className="py-3 pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Rate
                      </th>
                      <th className="w-40 py-3 pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Progress
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {sourceConversion.map((row, index) => {
                      const rate = pct(row.onboarded, row.total);
                      const colorPalette = [
                        "#10b981",
                        "#3b82f6",
                        "#8b5cf6",
                        "#f59e0b",
                        "#f43f5e",
                        "#06b6d4",
                      ];
                      const color = colorPalette[index % colorPalette.length];

                      return (
                        <tr key={row.source} className="transition-colors hover:bg-slate-50/60">
                          <td className="py-3 pl-6">
                            <div className="flex items-center gap-2">
                              <span className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
                              <span className="font-medium capitalize text-slate-700">
                                {row.source.replace(/_/g, " ")}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 text-right font-mono text-slate-700">{formatCount(row.total)}</td>
                          <td className="py-3 text-right font-mono text-slate-700">{formatCount(row.onboarded)}</td>
                          <td className="py-3 pr-6 text-right">
                            <Badge variant="secondary" className={`font-mono text-xs ${toneClass(rate)}`}>
                              {rate}%
                            </Badge>
                          </td>
                          <td className="w-40 py-3 pr-6">
                            <ProgressBar value={row.onboarded} max={row.total} color={color} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex h-24 items-center justify-center text-sm text-slate-400">
                No source conversion data. Check whether the <code className="mx-1 font-mono text-xs">source</code> column is populated.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {utmPerformance.length > 0 ? (
        <section className="space-y-5">
          <SectionHeading
            eyebrow="Campaign lens"
            title="Review campaign-level quality, not just traffic"
            description="Campaigns should be evaluated by how effectively they move registrations into onboarding, not by raw top-of-funnel volume alone."
          />

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  UTM campaign performance
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="py-3 pl-6 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Campaign
                      </th>
                      <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        UTM Source
                      </th>
                      <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Registrations
                      </th>
                      <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Onboarded
                      </th>
                      <th className="py-3 pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Conversion
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {utmPerformance.map((row, index) => {
                      const rate = pct(row.onboarded, row.total);

                      return (
                        <tr key={`${row.campaign}-${index}`} className="transition-colors hover:bg-slate-50/60">
                          <td className="py-3 pl-6 font-medium text-slate-700">{row.campaign}</td>
                          <td className="py-3">
                            {row.utmSource ? (
                              <Badge variant="secondary" className="text-[11px]">
                                {row.utmSource}
                              </Badge>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 text-right font-mono text-slate-700">{formatCount(row.total)}</td>
                          <td className="py-3 text-right font-mono text-slate-700">{formatCount(row.onboarded)}</td>
                          <td className="py-3 pr-6 text-right">
                            <Badge variant="secondary" className={`font-mono text-xs ${toneClass(rate)}`}>
                              {rate}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Retention risk"
          title="Summarize drop-off in one place"
          description="This view condenses the biggest failure modes so retention work can be prioritized against the highest-value leaks in the journey."
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.1fr)]">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Engagement breakdown
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                <ReactECharts option={dropoffOption} style={{ height: "100%", width: "100%" }} notMerge />
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Drop-off summary
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                {[
                  {
                    label: "Not onboarded",
                    value: Math.max(totalRegistered - totalOnboarded, 0),
                    pctVal: pct(Math.max(totalRegistered - totalOnboarded, 0), totalRegistered),
                    tone: "bg-amber-100 text-amber-700",
                    tip: "Registered but never finished onboarding.",
                  },
                  {
                    label: "Never signed in",
                    value: neverSignedIn,
                    pctVal: neverSignedInRate,
                    tone: "bg-rose-100 text-rose-700",
                    tip: "Created an account but never authenticated.",
                  },
                  {
                    label: "Inactive after sign-in",
                    value: inactiveAfterSignin,
                    pctVal: inactiveAfterSigninRate,
                    tone: "bg-violet-100 text-violet-700",
                    tip: "Signed in before but did not return in the last 30 days.",
                  },
                ].map((item) => (
                  <div key={item.label} className="space-y-2 rounded-[24px] border border-slate-100 bg-slate-50/60 p-4">
                    <div className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${item.tone}`}>
                      {item.pctVal}% of total
                    </div>
                    <p className="font-mono text-3xl font-bold text-slate-950">{formatCount(item.value)}</p>
                    <p className="text-sm font-semibold text-slate-800">{item.label}</p>
                    <p className="text-[11px] leading-snug text-slate-500">{item.tip}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
