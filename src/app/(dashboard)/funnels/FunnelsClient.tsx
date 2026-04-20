"use client";

import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Filter, CheckCircle, Activity, TrendingUp, TrendingDown,
  Globe, Zap, Target, AlertCircle, BarChart3,
} from "lucide-react";
import type { SourceConversionRow, MonthlyCoHortRow, UtmPerformanceRow } from "@/lib/db";

// ─── Types ──────────────────────────────────────────────────────────
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
  percent?: number;
}

// ─── Palettes ────────────────────────────────────────────────────────
const FUNNEL_COLORS = ["#6366f1", "#3b82f6", "#10b981", "#f59e0b", "#f43f5e"];
const PALETTE = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4", "#84cc16", "#ec4899"];

// ─── Helpers ─────────────────────────────────────────────────────────
function pct(num: number, denom: number): number {
  if (!denom) return 0;
  return Math.round((num / denom) * 100);
}

// ─── Progress bar ────────────────────────────────────────────────────
function ProgressBar({ value, max, color = "#10b981" }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${w}%`, backgroundColor: color }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════
export function FunnelsClient({ data }: { data: FunnelData }) {
  const {
    totalRegistered, totalOnboarded, everSignedIn,
    activeWithin30d, activeWithin7d, neverSignedIn,
    sourceConversion, utmPerformance, monthlyCohorts,
  } = data;

  // ─── KPI rates ──────────────────────────────────────────────────
  const onboardingRate = pct(totalOnboarded, totalRegistered);
  const activationRate = pct(everSignedIn, totalRegistered);
  const retention30    = pct(activeWithin30d, totalRegistered);
  const engagement7    = pct(activeWithin7d, totalRegistered);
  const dropoffRate    = pct(neverSignedIn, totalRegistered);

  // ─── ECharts: Main Funnel ────────────────────────────────────────
  const mainFunnelOption = useMemo((): EChartsOption => ({
    backgroundColor: "transparent",
    color: FUNNEL_COLORS,
    tooltip: {
      trigger: "item",
      formatter: (params: unknown) => {
        const point = params as ChartFormatterParams;
        return (
          `<div style="font-size:13px"><strong>${point.name}</strong></div>` +
          `<div>Users: <strong>${Number(point.value ?? 0).toLocaleString()}</strong></div>` +
          `<div style="color:#10b981;font-weight:600">${pct(Number(point.value ?? 0), totalRegistered)}% of total</div>`
        );
      },
    },
    series: [{
      name: "User Journey",
      type: "funnel",
      left: "5%",
      right: "5%",
      top: 10,
      bottom: 10,
      width: "55%",
      min: 0,
      max: totalRegistered || 1,
      minSize: "20%",
      maxSize: "100%",
      sort: "none",
      gap: 5,
      label: {
        show: true,
        position: "right",
        color: "#374151",
        fontSize: 13,
        fontWeight: "bold",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (p: any) =>
          `{name|${p.name}}\n{val|${Number(p.value).toLocaleString()}  ·  ${pct(Number(p.value), totalRegistered)}%}`,
        rich: {
          name: { fontSize: 12, fontWeight: "bold", color: "#374151", lineHeight: 20 },
          val:  { fontSize: 11, color: "#6b7280", lineHeight: 18 },
        },
      },
      labelLine: { show: true, length: 20, lineStyle: { color: "#e5e7eb" } },
      itemStyle: { borderWidth: 0, borderRadius: 4 },
      emphasis: { label: { fontSize: 14 }, itemStyle: { opacity: 0.85 } },
      data: [
        { name: "Registered",       value: totalRegistered,  itemStyle: { color: "#6366f1" } },
        { name: "Onboarded",        value: totalOnboarded,   itemStyle: { color: "#3b82f6" } },
        { name: "Ever Signed In",   value: everSignedIn,     itemStyle: { color: "#10b981" } },
        { name: "Active (30 Days)", value: activeWithin30d,  itemStyle: { color: "#f59e0b" } },
        { name: "Active (7 Days)",  value: activeWithin7d,   itemStyle: { color: "#f43f5e" } },
      ],
    }],
  }), [totalRegistered, totalOnboarded, everSignedIn, activeWithin30d, activeWithin7d]);

  // ─── ECharts: Source Conversion grouped bar ──────────────────────
  const sourceBarOption = useMemo((): EChartsOption => {
    const sources = sourceConversion.map((s) => s.source.replace(/_/g, " "));
    return {
      tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
      color: ["#e0e7ff", "#6366f1"],
      legend: {
        top: 0, icon: "circle", itemWidth: 8,
        textStyle: { fontSize: 11, color: "#6b7280" },
      },
      grid: { left: "3%", right: "4%", top: "40px", bottom: "3%", containLabel: true },
      xAxis: {
        type: "value",
        axisLabel: { color: "#9ca3af", fontSize: 10 },
        splitLine: { lineStyle: { color: "#f3f4f6" } },
        axisLine: { show: false },
      },
      yAxis: {
        type: "category",
        data: sources,
        axisLabel: { color: "#6b7280", fontSize: 11 },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Total",
          type: "bar",
          data: sourceConversion.map((s) => ({ value: s.total, itemStyle: { color: "#e0e7ff", borderRadius: [0, 4, 4, 0] } })),
          barMaxWidth: 20,
        },
        {
          name: "Onboarded",
          type: "bar",
          data: sourceConversion.map((s) => ({ value: s.onboarded, itemStyle: { color: "#6366f1", borderRadius: [0, 4, 4, 0] } })),
          barMaxWidth: 20,
        },
      ],
    };
  }, [sourceConversion]);

  // ─── ECharts: Monthly Cohorts grouped bar ───────────────────────
  const cohortOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    color: ["#10b981", "#3b82f6"],
    legend: {
      top: 0, icon: "circle", itemWidth: 8,
      textStyle: { fontSize: 11, color: "#6b7280" },
    },
    grid: { left: "3%", right: "4%", top: "40px", bottom: "5%", containLabel: true },
    xAxis: {
      type: "category",
      data: monthlyCohorts.map((c) => {
        const [yr, mo] = c.month.split("-");
        return `${mo}/${yr.slice(2)}`;
      }),
      axisLabel: { color: "#9ca3af", fontSize: 10 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f3f4f6" } },
      axisLabel: { color: "#9ca3af", fontSize: 10 },
      axisLine: { show: false },
    },
    series: [
      {
        name: "Registered",
        type: "bar",
        data: monthlyCohorts.map((c) => c.registered),
        itemStyle: { borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 24,
      },
      {
        name: "Onboarded",
        type: "bar",
        data: monthlyCohorts.map((c) => c.onboarded),
        itemStyle: { borderRadius: [3, 3, 0, 0] },
        barMaxWidth: 24,
      },
    ],
  }), [monthlyCohorts]);

  // ─── ECharts: Drop-off pie ───────────────────────────────────────
  const dropoffOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    color: ["#10b981", "#f59e0b", "#f43f5e", "#94a3b8"],
    legend: {
      bottom: 0, icon: "circle", itemWidth: 8,
      textStyle: { fontSize: 10, color: "#6b7280" },
    },
    series: [{
      type: "pie",
      radius: ["40%", "68%"],
      center: ["50%", "44%"],
      data: [
        { name: "Active (7 Days)",     value: activeWithin7d },
        { name: "Active (30d) Only",   value: Math.max(0, activeWithin30d - activeWithin7d) },
        { name: "Never Signed In",     value: neverSignedIn },
        { name: "Inactive (30d+)",     value: Math.max(0, everSignedIn - activeWithin30d) },
      ].filter((d) => d.value > 0),
      label: { show: false },
      emphasis: { scale: true, scaleSize: 6, label: { show: true, fontWeight: "bold" } },
    }],
  }), [activeWithin7d, activeWithin30d, neverSignedIn, everSignedIn]);

  const kpiCards = [
    { label: "Onboarding Rate",    value: `${onboardingRate}%`,  sub: `${totalOnboarded.toLocaleString()} completed`,   icon: CheckCircle, border: "border-l-blue-500",   color: "text-blue-600",   up: onboardingRate >= 50 },
    { label: "Activation Rate",    value: `${activationRate}%`,  sub: `${everSignedIn.toLocaleString()} ever logged in`, icon: Activity,    border: "border-l-emerald-500", color: "text-emerald-600", up: activationRate >= 60 },
    { label: "30-Day Retention",   value: `${retention30}%`,     sub: `${activeWithin30d.toLocaleString()} active`,   icon: TrendingUp,  border: "border-l-amber-500",   color: "text-amber-600",  up: retention30 >= 30 },
    { label: "7-Day Engagement",   value: `${engagement7}%`,     sub: `${activeWithin7d.toLocaleString()} active`,    icon: Zap,         border: "border-l-violet-500",  color: "text-violet-600", up: engagement7 >= 15 },
    { label: "Drop-off Rate",      value: `${dropoffRate}%`,     sub: `${neverSignedIn.toLocaleString()} never signed`, icon: AlertCircle, border: "border-l-rose-500",    color: "text-rose-600",   up: dropoffRate <= 20 },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <Filter className="h-6 w-6 text-emerald-500" />
          Conversion Funnels
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Track how users move from registration → onboarding → active engagement.
        </p>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {kpiCards.map((s) => {
          const Icon = s.icon;
          const Trend = s.up ? TrendingUp : TrendingDown;
          return (
            <Card key={s.label} className={`border-l-4 ${s.border}`}>
              <CardContent className="pb-3 pt-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">{s.label}</p>
                  <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                </div>
                <p className="font-mono text-2xl font-bold text-gray-900">{s.value}</p>
                <div className="mt-1 flex items-center gap-1">
                  <Trend className={`h-3 w-3 ${s.up ? "text-emerald-500" : "text-rose-500"}`} />
                  <p className="text-[11px] text-gray-400">{s.sub}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Main ECharts Funnel ──────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-1">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-indigo-500" />
            <CardTitle className="text-sm font-semibold text-gray-900">User Journey Funnel</CardTitle>
          </div>
          <p className="text-[12px] text-gray-400">End-to-end conversion from registration to weekly-active users</p>
        </CardHeader>
        <CardContent>
          <div className="h-[340px] w-full">
            <ReactECharts option={mainFunnelOption} style={{ height: "100%", width: "100%" }} notMerge />
          </div>

          {/* Step drop-off annotation row */}
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 sm:grid-cols-4">
            {[
              { from: "Registered → Onboarded",     dropped: totalRegistered - totalOnboarded, color: "text-blue-600", bg: "bg-blue-50" },
              { from: "Onboarded → Signed In",      dropped: Math.max(0, totalOnboarded - everSignedIn), color: "text-emerald-600", bg: "bg-emerald-50" },
              { from: "Signed In → Active (30d)",   dropped: Math.max(0, everSignedIn - activeWithin30d), color: "text-amber-600", bg: "bg-amber-50" },
              { from: "Active 30d → Active 7d",     dropped: Math.max(0, activeWithin30d - activeWithin7d), color: "text-rose-600", bg: "bg-rose-50" },
            ].map((item) => (
              <div key={item.from} className={`rounded-lg p-3 ${item.bg}`}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{item.from}</p>
                <p className={`mt-1 font-mono text-lg font-bold ${item.color}`}>
                  {item.dropped > 0 ? `↓ ${item.dropped.toLocaleString()}` : "—"}
                </p>
                <p className="text-[11px] text-gray-500">
                  {pct(item.dropped, totalRegistered)}% drop-off
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Source Conversion + Monthly Cohorts ─────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Onboarding by Source</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {sourceConversion.length > 0 ? (
              <div className="h-[260px]">
                <ReactECharts option={sourceBarOption} style={{ height: "100%", width: "100%" }} notMerge />
              </div>
            ) : (
              <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-center">
                <Globe className="h-8 w-8 text-gray-200" />
                <p className="text-sm font-medium text-gray-400">No source data tracked</p>
                <p className="max-w-xs text-[11px] text-gray-400">
                  Users may not have a <code className="font-mono text-xs">source</code> value set in the database.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Monthly Registration Cohorts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {monthlyCohorts.length > 0 ? (
              <div className="h-[260px]">
                <ReactECharts option={cohortOption} style={{ height: "100%", width: "100%" }} notMerge />
              </div>
            ) : (
              <div className="flex h-[180px] flex-col items-center justify-center gap-2 text-center">
                <BarChart3 className="h-8 w-8 text-gray-200" />
                <p className="text-sm font-medium text-gray-400">No cohort data available</p>
                <p className="text-[11px] text-gray-400">Registration data by month not yet available.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Source Conversion Detail Table ───────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-sm font-semibold text-gray-900">Source Conversion Detail</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sourceConversion.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-3 pl-6 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Source</th>
                    <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Registered</th>
                    <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Onboarded</th>
                    <th className="py-3 pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Rate</th>
                    <th className="w-36 py-3 pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sourceConversion.map((row, i) => {
                    const rate = pct(row.onboarded, row.total);
                    const color = PALETTE[i % PALETTE.length];
                    return (
                      <tr key={row.source} className="transition-colors hover:bg-gray-50/60">
                        <td className="py-3 pl-6">
                          <div className="flex items-center gap-2">
                            <span className="inline-block size-2 rounded-full" style={{ backgroundColor: color }} />
                            <span className="font-medium capitalize text-gray-700">{row.source.replace(/_/g, " ")}</span>
                          </div>
                        </td>
                        <td className="py-3 text-right font-mono text-gray-700">{row.total.toLocaleString()}</td>
                        <td className="py-3 text-right font-mono text-gray-700">{row.onboarded.toLocaleString()}</td>
                        <td className="py-3 pr-6 text-right">
                          <Badge variant="secondary" className={`font-mono text-xs ${rate >= 70 ? "bg-emerald-50 text-emerald-700" : rate >= 40 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
                            {rate}%
                          </Badge>
                        </td>
                        <td className="w-36 py-3 pr-6">
                          <ProgressBar value={row.onboarded} max={row.total} color={color} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex h-24 items-center justify-center text-sm text-gray-400">
              No source conversion data — check if <code className="mx-1 font-mono text-xs">source</code> column is populated in the database.
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── UTM Campaign Performance ─────────────────────────────── */}
      {utmPerformance.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">UTM Campaign Performance</CardTitle>
            </div>
            <p className="text-[12px] text-gray-400">Top campaigns by registrations and onboarding conversion</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-3 pl-6 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Campaign</th>
                    <th className="py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">UTM Source</th>
                    <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Registrations</th>
                    <th className="py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Onboarded</th>
                    <th className="py-3 pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Conv. Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {utmPerformance.map((row, i) => {
                    const rate = pct(row.onboarded, row.total);
                    return (
                      <tr key={`${row.campaign}-${i}`} className="transition-colors hover:bg-gray-50/60">
                        <td className="py-3 pl-6 font-medium text-gray-700">{row.campaign}</td>
                        <td className="py-3">
                          {row.utmSource ? <Badge variant="secondary" className="text-[11px]">{row.utmSource}</Badge> : <span className="text-gray-400">—</span>}
                        </td>
                        <td className="py-3 text-right font-mono text-gray-700">{row.total.toLocaleString()}</td>
                        <td className="py-3 text-right font-mono text-gray-700">{row.onboarded.toLocaleString()}</td>
                        <td className="py-3 pr-6 text-right">
                          <Badge variant="secondary" className={`font-mono text-xs ${rate >= 70 ? "bg-emerald-50 text-emerald-700" : rate >= 40 ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>
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
      )}

      {/* ── Drop-off Pie + Summary Cards ─────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-1">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Engagement Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[220px]">
              <ReactECharts option={dropoffOption} style={{ height: "100%", width: "100%" }} notMerge />
            </div>
          </CardContent>
        </Card>

        <Card className="border-rose-100 bg-rose-50/30 lg:col-span-3">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Drop-off Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {[
                {
                  label: "Not Onboarded",
                  value: totalRegistered - totalOnboarded,
                  pctVal: pct(totalRegistered - totalOnboarded, totalRegistered),
                  color: "text-amber-600", bg: "bg-amber-100",
                  tip: "Signed up but never finished onboarding.",
                },
                {
                  label: "Never Signed In",
                  value: neverSignedIn,
                  pctVal: pct(neverSignedIn, totalRegistered),
                  color: "text-rose-600", bg: "bg-rose-100",
                  tip: "Registered but never authenticated.",
                },
                {
                  label: "Inactive (30d+)",
                  value: Math.max(0, everSignedIn - activeWithin30d),
                  pctVal: pct(Math.max(0, everSignedIn - activeWithin30d), totalRegistered),
                  color: "text-violet-600", bg: "bg-violet-100",
                  tip: "Logged in before but gone quiet for 30+ days.",
                },
              ].map((item) => (
                <div key={item.label} className="space-y-2 rounded-lg border border-gray-100 bg-white p-4">
                  <div className={`inline-flex rounded-md px-2 py-0.5 text-xs font-semibold ${item.bg} ${item.color}`}>
                    {item.pctVal}% of total
                  </div>
                  <p className={`font-mono text-2xl font-bold ${item.color}`}>{item.value.toLocaleString()}</p>
                  <p className="text-xs font-semibold text-gray-700">{item.label}</p>
                  <p className="text-[11px] leading-snug text-gray-400">{item.tip}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
