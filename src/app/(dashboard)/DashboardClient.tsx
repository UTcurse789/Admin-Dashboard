"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Users, UserPlus, Activity, FileText, ArrowUpRight, ArrowDownRight,
  ArrowRight, Download, Filter, TrendingUp, BarChart3, Calendar,
  Building2, MapPin, Globe, ChevronDown, PieChart as PieChartIcon,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import type { DashboardData, DailyDataPoint } from "./page";
import { JourneyStatsSection } from "./JourneyStatsSection";

// ─── Types ──────────────────────────────────────────────────────────
type DateRange = "7d" | "30d" | "90d" | "1y" | "all";
type ChartVariant = "bar" | "pie" | "area";

interface FilteredUser {
  id: number | string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  salutation?: string | null;
  organization?: string | null;
  source?: string | null;
  created_at?: string | null;
  job_title?: string | null;
}

const DATE_PRESETS: { label: string; value: DateRange }[] = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "1Y", value: "1y" },
  { label: "All", value: "all" },
];

// ─── Palette & Helpers ───────────────────────────────────────────────
const COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e",
  "#06b6d4", "#84cc16", "#ec4899", "#14b8a6", "#a855f7",
  "#f97316", "#6366f1",
];

const STATE_NORM: Record<string, string> = {
  up: "Uttar Pradesh", mp: "Madhya Pradesh", ap: "Andhra Pradesh",
  gj: "Gujarat", mh: "Maharashtra", ka: "Karnataka", tn: "Tamil Nadu",
  wb: "West Bengal", rj: "Rajasthan", hp: "Himachal Pradesh",
  jk: "Jammu and Kashmir", jh: "Jharkhand", hr: "Haryana",
  pb: "Punjab", uk: "Uttarakhand", br: "Bihar", od: "Odisha",
  orissa: "Odisha", kl: "Kerala", ts: "Telangana", cg: "Chhattisgarh",
  as: "Assam", dl: "Delhi", "new delhi": "Delhi", ncr: "Delhi",
  ga: "Goa", goa: "Goa",
};

function normalizeState(name: string): string {
  if (!name) return "";
  return STATE_NORM[name.toLowerCase().trim()] || name;
}

function filterByRange(data: DailyDataPoint[], range: DateRange): DailyDataPoint[] {
  const daysMap: Record<DateRange, number | null> = {
    "7d": 7, "30d": 30, "90d": 90, "1y": 365, all: null,
  };
  const days = daysMap[range];
  if (!days) return data;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return data.filter((d) => d.date >= cutoffStr);
}

function trendPct(cur: number, prev: number): string {
  if (prev === 0) return cur > 0 ? "+100%" : "0%";
  const p = ((cur - prev) / prev) * 100;
  return `${p >= 0 ? "+" : ""}${p.toFixed(1)}%`;
}

function percentOf(value: number, total: number, digits = 0): string {
  if (total <= 0) return "0%";
  return `${((value / total) * 100).toFixed(digits)}%`;
}

function sumCountSeries<T extends { count: number }>(items: T[]) {
  return items.reduce((sum, item) => sum + item.count, 0);
}

function getPeakPoint<T extends { date: string; count: number }>(items: T[]) {
  if (!items.length) return null;

  return items.reduce((peak, item) => (item.count > peak.count ? item : peak));
}

function formatShortDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getPeakWeekday(
  items: { day: string; signups: number; logins: number }[],
  key: "signups" | "logins"
) {
  if (!items.length) return null;

  return items.reduce((peak, item) => (item[key] > peak[key] ? item : peak));
}

function contentPillClass(type: string): string {
  const t = type.toLowerCase();
  if (t.includes("news")) return "bg-blue-50 text-blue-700 border-blue-200";
  if (t.includes("report")) return "bg-amber-50 text-amber-700 border-amber-200";
  if (t.includes("analysis")) return "bg-violet-50 text-violet-700 border-violet-200";
  return "bg-gray-50 text-gray-600 border-gray-200";
}

function escapeCsv(value: unknown): string {
  let stringValue = value == null ? "" : String(value);

  if (/^[=+\-@]/.test(stringValue)) {
    stringValue = `'${stringValue}`;
  }

  return `"${stringValue.replace(/"/g, "\"\"")}"`;
}

function exportCSV(data: DashboardData) {
  const header = "Name,Email,Joined,Source,State,Salutation,Organization\n";
  const rows = data.recentDbUsers
    .map((u) => {
      const name = `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Unknown";
      const joined = u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : "";
      return [
        escapeCsv(name),
        escapeCsv(u.email),
        escapeCsv(joined),
        escapeCsv(u.source || ""),
        escapeCsv(u.state || ""),
        escapeCsv(u.salutation || ""),
        escapeCsv(u.organization || ""),
      ].join(",");
    })
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `energdive-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h2>
        <p className="max-w-3xl text-sm leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function RankedBreakdown({
  items,
  total,
  accentClass,
  onItemClick,
  emptyLabel = "No ranked data available.",
}: {
  items: { label: string; count: number }[];
  total?: number;
  accentClass: string;
  onItemClick?: (label: string) => void;
  emptyLabel?: string;
}) {
  if (!items.length) {
    return (
      <div className="flex h-full min-h-[120px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-4 text-center text-sm text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  const maxCount = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        const progress = `${Math.max((item.count / maxCount) * 100, 8)}%`;
        const content = (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {index + 1}. {item.label}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {item.count.toLocaleString("en-IN")}
                  {typeof total === "number" ? ` • ${percentOf(item.count, total)} ` : " "}
                  records
                </p>
              </div>
              <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300" />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/70">
              <div className={`h-full rounded-full ${accentClass}`} style={{ width: progress }} />
            </div>
          </>
        );

        if (onItemClick) {
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => onItemClick(item.label)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left transition-all hover:border-slate-300 hover:shadow-sm"
            >
              {content}
            </button>
          );
        }

        return (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
}

// ─── Chart Switch ─────────────────────────────────────────────────────
function ChartSwitch({ value, onChange }: { value: ChartVariant; onChange: (v: ChartVariant) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="xs" className="gap-1 text-[11px] text-gray-400">
          {value === "bar" ? "Bar" : value === "pie" ? "Pie" : "Area"}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[100px]">
        <DropdownMenuItem onClick={() => onChange("bar")}>Bar Chart</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("pie")}>Pie Chart</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("area")}>Area Chart</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── ECharts option builders ─────────────────────────────────────────
function buildPieOption(data: { label: string; count: number }[]): EChartsOption {
  return {
    tooltip: {
      trigger: "item",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (p: any) => `<strong>${p.name}</strong><br/>Count: <b>${p.value}</b> (${p.percent}%)`,
    },
    color: COLORS,
    legend: {
      bottom: 0, icon: "circle", itemWidth: 7,
      textStyle: { fontSize: 10, color: "#6b7280" }, type: "scroll",
    },
    series: [{
      type: "pie",
      radius: ["35%", "64%"],
      center: ["50%", "44%"],
      data: data.map((d) => ({ name: d.label, value: d.count })),
      label: { show: false },
      emphasis: { scale: true, scaleSize: 8, label: { show: true, fontWeight: "bold", fontSize: 12 } },
    }],
  };
}

function buildBarOption(data: { label: string; count: number }[], color?: string): EChartsOption {
  return {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    color: COLORS,
    grid: { left: "3%", right: "6%", top: "4%", bottom: "4%", containLabel: true },
    xAxis: {
      type: "value",
      axisLabel: { color: "#9ca3af", fontSize: 10 },
      splitLine: { lineStyle: { color: "#f3f4f6" } },
      axisLine: { show: false },
    },
    yAxis: {
      type: "category",
      data: data.map((d) => d.label),
      axisLabel: { color: "#6b7280", fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [{
      type: "bar",
      data: data.map((d, i) => ({
        value: d.count,
        itemStyle: { color: color || COLORS[i % COLORS.length], borderRadius: [0, 4, 4, 0] },
      })),
      barMaxWidth: 20,
    }],
  };
}

function buildAreaOption(data: { label: string; count: number }[], color?: string): EChartsOption {
  const c = color || COLORS[0];
  return {
    tooltip: { trigger: "axis" },
    grid: { left: "3%", right: "4%", bottom: "4%", top: "4%", containLabel: true },
    xAxis: {
      type: "category",
      data: data.map((d) => d.label),
      axisLabel: { color: "#9ca3af", fontSize: 10, rotate: data.length > 6 ? 25 : 0 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f3f4f6" } },
      axisLabel: { color: "#9ca3af", fontSize: 10 },
      axisLine: { show: false },
    },
    series: [{
      type: "line", smooth: true,
      data: data.map((d) => d.count),
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: c + "4D" }, { offset: 1, color: c + "00" }] } },
      lineStyle: { color: c, width: 2 },
      itemStyle: { color: c },
      showSymbol: false,
    }],
  };
}

// ─── FlexEChart ───────────────────────────────────────────────────────
function FlexEChart({
  data,
  variant,
  color,
  onSliceClick,
}: {
  data: { label: string; count: number }[];
  variant: ChartVariant;
  color?: string;
  onSliceClick?: (label: string) => void;
}) {
  const option = useMemo((): EChartsOption => {
    if (!data.length) return {};
    if (variant === "pie") return buildPieOption(data);
    if (variant === "area") return buildAreaOption(data, color);
    return buildBarOption(data, color);
  }, [data, variant, color]);

  if (!data.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No data available
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: "100%", width: "100%" }}
      notMerge
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onEvents={onSliceClick ? { click: (p: any) => onSliceClick(p.name || "") } : {}}
    />
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export function DashboardClient({ data }: { data: DashboardData }) {
  const FILTER_DIALOG_LIMIT = 1000;
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [industryChart, setIndustryChart] = useState<ChartVariant>("bar");
  const [sourceChart, setSourceChart] = useState<ChartVariant>("pie");
  const [stateChart, setStateChart] = useState<ChartVariant>("bar");
  const [salutationChart, setSalutationChart] = useState<ChartVariant>("pie");
  const [dataSourceChart, setDataSourceChart] = useState<ChartVariant>("pie");
  const [mapReady, setMapReady] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<{ key: string; value: string; label: string } | null>(null);
  const [filteredUsers, setFilteredUsers] = useState<FilteredUser[]>([]);
  const [isDialogLoading, setIsDialogLoading] = useState(false);
  const [dialogPage, setDialogPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Load India GeoJSON from /public/india-states.json and register with ECharts
  useEffect(() => {
    fetch("/india-states.json")
      .then((r) => r.json())
      .then((raw) => {
        // Geohacker GeoJSON uses NAME_1 for state name — normalise to 'name'
        const geoJson = {
          ...raw,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          features: raw.features.map((f: any) => ({
            ...f,
            properties: { ...f.properties, name: f.properties.NAME_1 || f.properties.name || "" },
          })),
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        echarts.registerMap("India", geoJson as any);
        setMapReady(true);
      })
      .catch(() => { /* silently fall back to bar chart */ });
  }, []);

  const handleChartClick = async (key: string, value: string, label: string) => {
    if (!value) return;
    setSelectedFilter({ key, value, label });
    setIsDialogLoading(true);
    setFilteredUsers([]);
    setDialogPage(1);
    try {
      const res = await fetch(
        `/api/users/filter?key=${key}&value=${encodeURIComponent(value)}&limit=${FILTER_DIALOG_LIMIT}`
      );

      if (!res.ok) {
        console.error("Failed to fetch filtered users:", res.status, await res.text());
        return;
      }

      const json = await res.json();

      if (Array.isArray(json.users)) {
        setFilteredUsers(json.users);
        return;
      }

      console.error("Invalid filtered users response:", json);
    } catch (e) {
      console.error(e);
    } finally {
      setIsDialogLoading(false);
    }
  };

  const filteredRegistrations = useMemo(() => filterByRange(data.dailyRegistrations, dateRange), [data.dailyRegistrations, dateRange]);
  const filteredContent = useMemo(() => filterByRange(data.dailyContent, dateRange), [data.dailyContent, dateRange]);

  const stats = [
    { label: "Total Users", value: data.dbTotalUsers || data.totalUsers, icon: Users, accent: "border-l-emerald-500", iconColor: "text-emerald-600", trend: trendPct(data.newThisMonth, data.newPrevMonth), trendUp: data.newThisMonth >= data.newPrevMonth, sub: "vs prev month" },
    { label: "New This Month", value: data.growthThisMonth || data.newThisMonth, icon: UserPlus, accent: "border-l-blue-500", iconColor: "text-blue-600", trend: trendPct(data.growthThisMonth, data.growthLastMonth), trendUp: data.growthThisMonth >= data.growthLastMonth, sub: "registrations" },
    { label: "Active (7 Days)", value: data.activeLast7Days, icon: Activity, accent: "border-l-violet-500", iconColor: "text-violet-600", trend: trendPct(data.activeLast7Days, data.activePrev7Days), trendUp: data.activeLast7Days >= data.activePrev7Days, sub: "vs prev 7 days" },
    { label: "Total Articles", value: data.totalArticles, icon: FileText, accent: "border-l-orange-500", iconColor: "text-orange-600", trend: trendPct(data.articlesThisMonth, data.articlesPrevMonth), trendUp: data.articlesThisMonth >= data.articlesPrevMonth, sub: "published this month" },
    { label: "Growth Rate", value: `${data.growthRate >= 0 ? "+" : ""}${data.growthRate.toFixed(1)}%`, icon: TrendingUp, accent: "border-l-cyan-500", iconColor: "text-cyan-600", trend: data.growthRate >= 0 ? "Positive growth" : "Declining", trendUp: data.growthRate >= 0, sub: "month-over-month" },
  ];

  // ─── ECharts options ─────────────────────────────────────────────
  const registrationOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: "axis", axisPointer: { type: "cross" } },
    color: ["#10b981"],
    grid: { left: "3%", right: "4%", bottom: "3%", top: "5%", containLabel: true },
    xAxis: {
      type: "category",
      data: filteredRegistrations.map((d) => d.date),
      axisLabel: { color: "#9ca3af", fontSize: 10, formatter: (v: string) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; } },
      axisLine: { show: false }, axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f3f4f6" } },
      axisLabel: { color: "#9ca3af", fontSize: 10 }, axisLine: { show: false },
    },
    series: [{
      name: "Registrations", type: "line", smooth: true,
      data: filteredRegistrations.map((d) => d.count),
      lineStyle: { color: "#10b981", width: 2.5 },
      itemStyle: { color: "#10b981" },
      areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(16,185,129,0.3)" }, { offset: 1, color: "rgba(16,185,129,0)" }] } },
      showSymbol: false,
    }],
  }), [filteredRegistrations]);

  const contentBarOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    color: ["#3b82f6"],
    grid: { left: "3%", right: "4%", bottom: "4%", top: "5%", containLabel: true },
    xAxis: {
      type: "category",
      data: filteredContent.map((d) => d.date),
      axisLabel: { color: "#9ca3af", fontSize: 10, formatter: (v: string) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; } },
      axisLine: { show: false }, axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f3f4f6" } },
      axisLabel: { color: "#9ca3af", fontSize: 10 }, axisLine: { show: false },
    },
    series: [{
      name: "Articles", type: "bar",
      data: filteredContent.map((d) => d.count),
      itemStyle: { color: "#3b82f6", borderRadius: [4, 4, 0, 0] },
      barMaxWidth: 28,
    }],
  }), [filteredContent]);

  const contentTypeOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    color: COLORS,
    legend: { bottom: 0, icon: "circle", itemWidth: 7, textStyle: { fontSize: 10, color: "#6b7280" }, type: "scroll" },
    series: [{
      type: "pie", radius: ["40%", "70%"], center: ["50%", "44%"],
      data: data.contentByType.map((d) => ({ name: d.type, value: d.count })),
      label: { show: false },
      emphasis: { scale: true, scaleSize: 6, label: { show: true, fontWeight: "bold" } },
    }],
  }), [data.contentByType]);

  const weeklyOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    color: ["#10b981", "#8b5cf6"],
    legend: { top: 0, icon: "circle", itemWidth: 8, textStyle: { fontSize: 11, color: "#6b7280" } },
    grid: { left: "3%", right: "4%", bottom: "3%", top: "40px", containLabel: true },
    xAxis: {
      type: "category",
      data: data.weeklyActivity.map((d) => d.day),
      axisLabel: { color: "#9ca3af", fontSize: 11 },
      axisLine: { show: false }, axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f3f4f6" } },
      axisLabel: { color: "#9ca3af", fontSize: 10 }, axisLine: { show: false },
    },
    series: [
      { name: "Signups", type: "bar", data: data.weeklyActivity.map((d) => d.signups), itemStyle: { borderRadius: [3, 3, 0, 0] }, barMaxWidth: 24 },
      { name: "Logins", type: "bar", data: data.weeklyActivity.map((d) => d.logins), itemStyle: { borderRadius: [3, 3, 0, 0] }, barMaxWidth: 24 },
    ],
  }), [data.weeklyActivity]);

  const journeyFunnel = useMemo(() => {
    const total = data.userJourney.total;
    const safeTotal = Math.max(total, 1);
    const activeWithin30d = Math.min(data.userJourney.activeWithin30d, total);
    const activeWithin7d = Math.min(data.userJourney.activeWithin7d, activeWithin30d);
    const neverSignedIn = Math.min(data.userJourney.neverSignedIn, total);
    const inactiveOver30d = Math.max(total - activeWithin30d, 0);
    const signedInAtLeastOnce = Math.max(total - neverSignedIn, 0);
    const monthlyActivationPct = Math.round((activeWithin30d / safeTotal) * 100);
    const weeklyActivationPct = Math.round((activeWithin7d / safeTotal) * 100);
    const signedInPct = Math.round((signedInAtLeastOnce / safeTotal) * 100);
    const monthlyToWeeklyPct =
      activeWithin30d > 0 ? Math.round((activeWithin7d / activeWithin30d) * 100) : 0;
    const registrationDropOff = Math.max(total - activeWithin30d, 0);
    const monthlyDropOff = Math.max(activeWithin30d - activeWithin7d, 0);

    return {
      chartStages: [
        {
          name: "Registered",
          value: total,
          sharePct: 100,
          itemStyle: { color: "#6366f1" },
        },
        {
          name: "Signed In",
          value: signedInAtLeastOnce,
          sharePct: signedInPct,
          itemStyle: { color: "#5b93ea" },
        },
        {
          name: "Active (30 Days)",
          value: activeWithin30d,
          sharePct: monthlyActivationPct,
          itemStyle: { color: "#f59e0b" },
        },
        {
          name: "Active (7 Days)",
          value: activeWithin7d,
          sharePct: weeklyActivationPct,
          itemStyle: { color: "#f43f5e" },
        },
      ],
      transitions: [
        {
          id: "registered-to-signed",
          label: "Registration to signed in",
          retainedPct: signedInPct,
          dropOff: neverSignedIn,
          detail: `${signedInAtLeastOnce.toLocaleString("en-IN")} users signed in at least once`,
          toneClass: "border-blue-200 bg-blue-50 text-blue-700",
        },
        {
          id: "signed-to-30d",
          label: "Signed in to 30-day active",
          retainedPct: signedInAtLeastOnce > 0 ? Math.round((activeWithin30d / signedInAtLeastOnce) * 100) : 0,
          dropOff: registrationDropOff,
          detail: `${activeWithin30d.toLocaleString("en-IN")} users came back within 30 days`,
          toneClass: "border-amber-200 bg-amber-50 text-amber-700",
        },
        {
          id: "30d-to-7d",
          label: "30-day active to 7-day active",
          retainedPct: monthlyToWeeklyPct,
          dropOff: monthlyDropOff,
          detail: `${activeWithin7d.toLocaleString("en-IN")} users stayed active in the last week`,
          toneClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
        },
      ],
      summary: {
        headline: `${monthlyActivationPct}% of registered users return within 30 days`,
        detail: `${weeklyActivationPct}% are active in the last 7 days, so the biggest retention gap happens before repeat usage becomes habitual.`,
        badges: [
          {
            label: "Signed in at least once",
            value: `${signedInPct}%`,
          },
          { label: "30D to 7D retention", value: `${monthlyToWeeklyPct}%` },
        ],
      },
      topStats: [
        {
          label: "Monthly Activation",
          value: `${monthlyActivationPct}%`,
          detail: `${activeWithin30d.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} users returned in 30 days`,
        },
        {
          label: "Weekly Activation",
          value: `${weeklyActivationPct}%`,
          detail: `${activeWithin7d.toLocaleString("en-IN")} users were active in the last week`,
        },
      ],
      stats: [
        {
          label: "Never Signed In",
          value: neverSignedIn,
          detail: `${Math.round((neverSignedIn / safeTotal) * 100)}% of the audience has not started their journey`,
          tone: "rose" as const,
        },
        {
          label: "Not Active in 30 Days",
          value: inactiveOver30d,
          detail: `${Math.round((inactiveOver30d / safeTotal) * 100)}% of registered users did not return within the last month`,
          tone: "amber" as const,
        },
        {
          label: "30D to 7D Retention",
          value: `${monthlyToWeeklyPct}%`,
          detail: `${activeWithin7d.toLocaleString("en-IN")} of ${activeWithin30d.toLocaleString("en-IN")} active users`,
          tone: "emerald" as const,
        },
        {
          label: "Signed In At Least Once",
          value: signedInAtLeastOnce,
          detail: `${signedInPct}% of total audience`,
          tone: "indigo" as const,
        },
      ],
    };
  }, [data.userJourney]);

  const journeyFunnelOption = useMemo((): EChartsOption => ({
    tooltip: {
      trigger: "item",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      formatter: (params: any) => {
        const value = Number(params.value ?? 0);
        const share = Number(params.data?.sharePct ?? 0);
        return `
          <div style="font-size:13px">
            <div style="font-weight:700;margin-bottom:4px">${params.name}</div>
            <div>Users: <strong>${value.toLocaleString("en-IN")}</strong></div>
            <div style="color:#10b981;font-weight:600">${share}% of total</div>
          </div>
        `;
      },
    },
    series: [{
      type: "funnel",
      left: "4%",
      right: "18%",
      top: 16,
      bottom: 16,
      min: 0,
      max: Math.max(data.userJourney.total, 1),
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
        formatter: (params: any) => {
          const value = Number(params.value ?? 0).toLocaleString("en-IN");
          const share = Number(params.data?.sharePct ?? 0);
          return `{title|${params.name}}\n{meta|${value}  •  ${share}%}`;
        },
        rich: {
          title: { fontSize: 12, fontWeight: 700, color: "#334155", lineHeight: 18 },
          meta: { fontSize: 11, fontWeight: 600, color: "#64748b", lineHeight: 16 },
        },
      },
      labelLine: {
        show: true,
        length: 22,
        lineStyle: { color: "#cbd5e1", width: 1.2 },
      },
      emphasis: {
        itemStyle: { opacity: 0.92 },
      },
      data: journeyFunnel.chartStages,
    }],
  }), [data.userJourney.total, journeyFunnel.chartStages]);


  const indiaMapOption = useMemo((): EChartsOption => {
    const mapData = data.byState.map((s) => ({ name: normalizeState(s.label), value: s.count }));
    const maxVal = Math.max(...data.byState.map((s) => s.count), 1);
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { trigger: "item", formatter: (p: any) => `<strong>${p.name}</strong><br/>Users: <b>${p.value ?? 0}</b>` },
      visualMap: {
        min: 0, max: maxVal, left: "left", bottom: 10,
        text: ["High", "Low"], calculable: true,
        inRange: { color: ["#ecfdf5", "#10b981"] },
        textStyle: { fontSize: 10, color: "#6b7280" },
      },
      series: [{
        name: "Users", type: "map", map: "India", roam: true,
        data: mapData,
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 10, fontWeight: "bold" }, itemStyle: { areaColor: "#059669" } },
        itemStyle: { areaColor: "#f0fdf4", borderColor: "#a1a1aa", borderWidth: 0.8 },
      }],
    };
  }, [data.byState]);

  const totalAudience = data.dbTotalUsers || data.totalUsers;
  const safeAudience = Math.max(totalAudience, 1);
  const registrationTotalInRange = useMemo(
    () => sumCountSeries(filteredRegistrations),
    [filteredRegistrations]
  );
  const contentTotalInRange = useMemo(
    () => sumCountSeries(filteredContent),
    [filteredContent]
  );
  const registrationPeak = useMemo(
    () => getPeakPoint(filteredRegistrations),
    [filteredRegistrations]
  );
  const contentPeak = useMemo(() => getPeakPoint(filteredContent), [filteredContent]);
  const averageRegistrationsPerDay =
    filteredRegistrations.length > 0
      ? registrationTotalInRange / filteredRegistrations.length
      : 0;
  const averageContentPerDay =
    filteredContent.length > 0 ? contentTotalInRange / filteredContent.length : 0;
  const peakSignupDay = getPeakWeekday(data.weeklyActivity, "signups");
  const peakLoginDay = getPeakWeekday(data.weeklyActivity, "logins");
  const topSource = data.bySource[0];
  const topDataSource = data.byDataSource[0];
  const topIndustry = data.byIndustry[0];
  const topState = data.byState[0];
  const topContentType = data.contentByType[0];
  const monthlyActivationRate = percentOf(
    data.userJourney.activeWithin30d,
    safeAudience
  );
  const weeklyActivationRate = percentOf(data.activeLast7Days, safeAudience);

  const heroMetrics = [
    {
      label: "Audience base",
      value: totalAudience.toLocaleString("en-IN"),
      detail: `${data.newThisMonth.toLocaleString("en-IN")} new users this month`,
    },
    {
      label: "7-day activity",
      value: weeklyActivationRate,
      detail: `${data.activeLast7Days.toLocaleString("en-IN")} active users in the last week`,
    },
    {
      label: "Content published",
      value: data.totalArticles.toLocaleString("en-IN"),
      detail: `${data.articlesThisMonth.toLocaleString("en-IN")} articles published this month`,
    },
    {
      label: "Growth rate",
      value: `${data.growthRate >= 0 ? "+" : ""}${data.growthRate.toFixed(1)}%`,
      detail: `${data.growthThisMonth.toLocaleString("en-IN")} vs ${data.growthLastMonth.toLocaleString("en-IN")} last month`,
    },
  ];

  const overviewBullets = [
    topSource
      ? `${topSource.label} is the strongest source, contributing ${percentOf(topSource.count, safeAudience)} of registered users.`
      : "Source data will surface here once registrations are tagged.",
    `${monthlyActivationRate} of the audience returned in the last 30 days, and ${weeklyActivationRate} was active in the last 7 days.`,
    topContentType
      ? `${topContentType.type} is the leading content format at ${percentOf(topContentType.count, Math.max(data.totalArticles, 1))} of the published library.`
      : "Content mix insights will appear here when articles are available.",
  ];

  const executiveHighlights = [
    {
      label: "Audience momentum",
      value: `${data.growthRate >= 0 ? "+" : ""}${data.growthRate.toFixed(1)}%`,
      description: `${data.growthThisMonth.toLocaleString("en-IN")} users registered this month versus ${data.growthLastMonth.toLocaleString("en-IN")} last month.`,
      accent: "from-emerald-500/15 via-emerald-50 to-white",
      icon: TrendingUp,
    },
    {
      label: "Acquisition leader",
      value: topSource?.label ?? "No source data",
      description: topSource
        ? `${topSource.count.toLocaleString("en-IN")} users, or ${percentOf(topSource.count, safeAudience)}, came from this source.`
        : "Tag registrations by source to see which channels drive the highest volume.",
      accent: "from-blue-500/15 via-blue-50 to-white",
      icon: Globe,
    },
    {
      label: "Content signal",
      value: topContentType?.type ?? "No content",
      description: topContentType
        ? `${topContentType.count.toLocaleString("en-IN")} published pieces sit in this category, with ${data.articlesThisMonth.toLocaleString("en-IN")} articles shipped this month.`
        : "Once articles are available, the dashboard will surface the format mix and publishing velocity.",
      accent: "from-amber-500/15 via-amber-50 to-white",
      icon: FileText,
    },
  ];

  const audienceActions = [
    { label: "Open users", href: "/users" },
    { label: "Open funnels", href: "/funnels" },
    { label: "Open content", href: "/content" },
    { label: "User activity", href: "/user-activity" },
  ];

  const navigationCards = [
    {
      title: "User management",
      description: `Review ${totalAudience.toLocaleString("en-IN")} registered users and drill into their source, geography, and signup pattern.`,
      href: "/users",
    },
    {
      title: "Content operations",
      description: `Jump into the publishing workspace to review ${data.totalArticles.toLocaleString("en-IN")} articles and the latest content mix.`,
      href: "/content",
    },
    {
      title: "Retention analysis",
      description: `Open the deeper activity views to investigate weekly engagement, drop-off, and funnel performance.`,
      href: "/user-activity",
    },
  ];

  const activePresetLabel =
    DATE_PRESETS.find((preset) => preset.value === dateRange)?.label ?? "30D";

  const performanceLenses = [
    {
      key: "acquisition",
      label: "Acquisition",
      title: topSource?.label ?? "No source data",
      value: `${registrationTotalInRange.toLocaleString("en-IN")} registrations in ${activePresetLabel}`,
      detail: topSource
        ? `${topSource.count.toLocaleString("en-IN")} users from the leading source (${percentOf(topSource.count, safeAudience)}).`
        : "Tag registrations by source to surface the strongest channel.",
      icon: Globe,
      accent: "border-emerald-200 bg-emerald-50/75 text-emerald-800",
    },
    {
      key: "retention",
      label: "Retention",
      title: `${monthlyActivationRate} monthly activation`,
      value: `${weeklyActivationRate} weekly activity`,
      detail: `${data.userJourney.activeWithin7d.toLocaleString("en-IN")} of ${data.userJourney.activeWithin30d.toLocaleString("en-IN")} monthly-active users returned in 7 days.`,
      icon: Activity,
      accent: "border-blue-200 bg-blue-50/75 text-blue-800",
    },
    {
      key: "publishing",
      label: "Publishing",
      title: `${contentTotalInRange.toLocaleString("en-IN")} pieces in ${activePresetLabel}`,
      value: `${averageContentPerDay.toFixed(1)} avg per tracked day`,
      detail: topContentType
        ? `${topContentType.type} leads with ${percentOf(topContentType.count, Math.max(data.totalArticles, 1))} of the published library.`
        : "Publishing mix will appear once content type data is available.",
      icon: FileText,
      accent: "border-amber-200 bg-amber-50/75 text-amber-800",
    },
  ];

  const audienceSnapshot = [
    {
      label: "Top source",
      value: topSource?.label ?? "No source data",
      detail: topSource
        ? `${topSource.count.toLocaleString("en-IN")} users from this source`
        : "Add source tagging to expose the acquisition leader.",
    },
    {
      label: "Leading industry",
      value: topIndustry?.label ?? "No industry data",
      detail: topIndustry
        ? `${percentOf(topIndustry.count, safeAudience)} of registered users`
        : "Industry enrichment is needed for this cut.",
    },
    {
      label: "Strongest geography",
      value: topState?.label ?? "No state data",
      detail: topState
        ? `${topState.count.toLocaleString("en-IN")} users from this state`
        : "State data is still sparse across the audience.",
    },
    {
      label: "30-day activation",
      value: monthlyActivationRate,
      detail: `${data.userJourney.activeWithin30d.toLocaleString("en-IN")} users returned in the last 30 days`,
    },
  ];

  const weeklyHighlights = [
    {
      label: "Peak signup day",
      value: peakSignupDay?.day ?? "No data",
      detail: peakSignupDay
        ? `${peakSignupDay.signups.toLocaleString("en-IN")} signups`
        : "Signup activity will appear once events are tracked.",
    },
    {
      label: "Peak login day",
      value: peakLoginDay?.day ?? "No data",
      detail: peakLoginDay
        ? `${peakLoginDay.logins.toLocaleString("en-IN")} logins`
        : "Login activity will appear once events are tracked.",
    },
    {
      label: "7-day active users",
      value: data.activeLast7Days.toLocaleString("en-IN"),
      detail: `${weeklyActivationRate} of the registered audience`,
    },
  ];

  const contentHighlights = [
    {
      label: "Published in range",
      value: contentTotalInRange.toLocaleString("en-IN"),
      detail: `${filteredContent.length.toLocaleString("en-IN")} tracked days in view`,
    },
    {
      label: "Average per day",
      value: averageContentPerDay.toFixed(1),
      detail: "Articles published per tracked day",
    },
    {
      label: "Peak publishing day",
      value: contentPeak ? formatShortDate(contentPeak.date) : "No data",
      detail: contentPeak
        ? `${contentPeak.count.toLocaleString("en-IN")} pieces published`
        : "No publishing spikes in the selected period.",
    },
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-8 pb-8">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_30%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-sm sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_minmax(360px,420px)]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
              <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              Executive overview
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                A clearer picture of acquisition, retention, and publishing performance.
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
                This dashboard is structured to answer the core operating questions at a
                glance: how the audience is growing, which channels and segments are
                driving registrations, how many users stay active, and what content is
                being published across the selected time window.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {performanceLenses.map((lens) => {
                const Icon = lens.icon;
                return (
                  <div
                    key={lens.key}
                    className="rounded-[26px] border border-white/70 bg-white/85 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)] backdrop-blur"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                          {lens.label}
                        </p>
                        <p className="mt-3 text-lg font-semibold tracking-tight text-slate-950">
                          {lens.title}
                        </p>
                      </div>
                      <div className={`rounded-2xl border px-3 py-2 ${lens.accent}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-700">{lens.value}</p>
                    <p className="mt-1 text-xs leading-relaxed text-slate-500">{lens.detail}</p>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {DATE_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setDateRange(preset.value)}
                  className={`rounded-full border px-4 py-2 text-xs font-semibold tracking-[0.18em] transition-all ${dateRange === preset.value
                      ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-900"
                    }`}
                >
                  {preset.label}
                </button>
              ))}
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
                        Key takeaway
                      </p>
                    </div>
                    <p className="pr-2 text-base leading-8 text-slate-600">{bullet}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              {audienceActions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                >
                  {action.label}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-slate-200 bg-white px-4 text-slate-700 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                onClick={() => exportCSV(data)}
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                Export snapshot
              </Button>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.4)] backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                  Current lens
                </p>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
                  Dashboard pulse
                </h2>
              </div>
              <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
                {activePresetLabel} view
              </Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {heroMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-[26px] border border-slate-200 bg-slate-50/85 p-4"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {metric.label}
                  </p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                    {metric.value}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {metric.detail}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50/80 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                Period pulse
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Registrations in range</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {registrationTotalInRange.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Content in range</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {contentTotalInRange.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-2xl border border-white bg-white px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">30-day activation</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {monthlyActivationRate}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className={`border border-slate-200 border-l-4 ${stat.accent} bg-white shadow-sm transition-shadow hover:shadow-md`}
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  {stat.label}
                </CardTitle>
                <div className="rounded-2xl bg-slate-50 p-2">
                  <Icon className={`h-4 w-4 ${stat.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-3xl font-semibold tracking-tight text-slate-950">
                  {typeof stat.value === "number"
                    ? stat.value.toLocaleString("en-IN")
                    : stat.value}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${stat.trendUp
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700"
                      }`}
                  >
                    {stat.trendUp ? (
                      <ArrowUpRight className="h-3 w-3" />
                    ) : (
                      <ArrowDownRight className="h-3 w-3" />
                    )}
                    {stat.trend}
                  </span>
                  <span className="text-xs text-slate-500">{stat.sub}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Executive readout"
          title="The main signals surfaced first"
          description="These takeaways summarize growth, acquisition, and publishing movement so the headline story is visible before you dive into the charts."
        />
        <div className="grid gap-4 xl:grid-cols-3">
          {executiveHighlights.map((highlight) => {
            const Icon = highlight.icon;
            return (
              <Card
                key={highlight.label}
                className={`overflow-hidden border border-slate-200 bg-gradient-to-br ${highlight.accent} shadow-sm`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
                        {highlight.label}
                      </p>
                      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
                        {highlight.value}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/85 p-3 shadow-sm">
                      <Icon className="h-5 w-5 text-slate-700" />
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-relaxed text-slate-600">
                    {highlight.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Audience and acquisition"
          title="See who is joining and what is driving signups"
          description="The next layer explains volume, leading channels, user segmentation, and geographic concentration so acquisition performance can be interpreted with context."
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-4 pb-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                      Registration trend
                    </CardTitle>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    View how registration volume has moved across the selected window.
                  </p>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                  {filteredRegistrations.length.toLocaleString("en-IN")} tracked days
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Registrations in {activePresetLabel}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {registrationTotalInRange.toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Average per day</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {averageRegistrationsPerDay.toFixed(1)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Peak day</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {registrationPeak ? formatShortDate(registrationPeak.date) : "No data"}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {registrationPeak
                      ? `${registrationPeak.count.toLocaleString("en-IN")} signups`
                      : "No signups recorded in this period"}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[320px] w-full">
                {filteredRegistrations.length > 0 ? (
                  <ReactECharts
                    option={registrationOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500">
                    No registration data for this period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                      Source quality
                    </CardTitle>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Compare the strongest registration sources and click any source to inspect the underlying users.
                  </p>
                </div>
                <ChartSwitch value={sourceChart} onChange={setSourceChart} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="h-[250px] w-full">
                <FlexEChart
                  data={data.bySource}
                  variant={sourceChart}
                  onSliceClick={(value) => handleChartClick("source", value, "Source")}
                />
              </div>
              <RankedBreakdown
                items={data.bySource.slice(0, 5)}
                total={safeAudience}
                accentClass="bg-gradient-to-r from-blue-500 to-cyan-500"
                onItemClick={(value) => handleChartClick("source", value, "Source")}
                emptyLabel="No source data is available yet."
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-violet-600" />
                    <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                      Industry mix
                    </CardTitle>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Understand which industries dominate the audience profile.
                  </p>
                </div>
                <ChartSwitch value={industryChart} onChange={setIndustryChart} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="h-[230px] w-full">
                <FlexEChart
                  data={data.byIndustry.slice(0, 12)}
                  variant={industryChart}
                  color="#8b5cf6"
                  onSliceClick={(value) => handleChartClick("industry", value, "Industry")}
                />
              </div>
              <RankedBreakdown
                items={data.byIndustry.slice(0, 5)}
                total={safeAudience}
                accentClass="bg-gradient-to-r from-violet-500 to-fuchsia-500"
                onItemClick={(value) => handleChartClick("industry", value, "Industry")}
                emptyLabel="No industry data is available yet."
              />
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4 text-amber-600" />
                    <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                      Acquisition channel
                    </CardTitle>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    See how registration channels are distributed across the audience.
                  </p>
                </div>
                <ChartSwitch value={dataSourceChart} onChange={setDataSourceChart} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="h-[230px] w-full">
                <FlexEChart
                  data={data.byDataSource}
                  variant={dataSourceChart}
                  color="#f59e0b"
                  onSliceClick={(value) =>
                    handleChartClick("data_source", value, "Acquisition Channel")
                  }
                />
              </div>
              <RankedBreakdown
                items={data.byDataSource.slice(0, 5)}
                total={safeAudience}
                accentClass="bg-gradient-to-r from-amber-500 to-orange-500"
                onItemClick={(value) =>
                  handleChartClick("data_source", value, "Acquisition Channel")
                }
                emptyLabel="No acquisition channel data is available yet."
              />
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-rose-600" />
                    <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                      Geographic concentration
                    </CardTitle>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Identify the states with the strongest audience presence.
                  </p>
                </div>
                {mapReady ? (
                  <Badge
                    variant="outline"
                    className="border-emerald-200 bg-emerald-50 text-emerald-700"
                  >
                    India map
                  </Badge>
                ) : (
                  <ChartSwitch value={stateChart} onChange={setStateChart} />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="h-[250px] w-full">
                {mapReady ? (
                  <ReactECharts
                    option={indiaMapOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                ) : (
                  <FlexEChart
                    data={data.byState.slice(0, 12)}
                    variant={stateChart}
                    color="#f43f5e"
                    onSliceClick={(value) => handleChartClick("state", value, "State")}
                  />
                )}
              </div>
              <RankedBreakdown
                items={data.byState.slice(0, 5)}
                total={safeAudience}
                accentClass="bg-gradient-to-r from-rose-500 to-red-500"
                onItemClick={(value) => handleChartClick("state", value, "State")}
                emptyLabel="No state-level user data is available yet."
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-cyan-600" />
                    <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                      Salutation breakdown
                    </CardTitle>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Review how the database is distributed across recorded salutations.
                  </p>
                </div>
                <ChartSwitch value={salutationChart} onChange={setSalutationChart} />
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="h-[250px] w-full">
                <FlexEChart
                  data={data.bySalutation}
                  variant={salutationChart}
                  color="#06b6d4"
                  onSliceClick={(value) => handleChartClick("salutation", value, "Salutation")}
                />
              </div>
              <div className="rounded-[26px] border border-cyan-100 bg-cyan-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">
                  Data note
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Salutation is useful as a completeness signal for the profile dataset.
                  Clicking a category opens the associated users for review.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-700" />
                  <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                    Audience profile snapshot
                  </CardTitle>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  A condensed view of the defining audience traits in the current dataset.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2">
                {audienceSnapshot.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[26px] border border-slate-200 bg-slate-50/80 p-4"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                      {item.value}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-500">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>

              <div className="rounded-[28px] border border-amber-100 bg-amber-50/70 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                  Acquisition context
                </p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-lg font-semibold tracking-tight text-slate-950">
                      {topDataSource?.label ?? "No acquisition channel data"}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {topDataSource
                        ? `${topDataSource.count.toLocaleString("en-IN")} users are attributed to the leading registration channel.`
                        : "Populate acquisition channel data to add more strategic context here."}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-amber-200 bg-white text-amber-700"
                  >
                    {topDataSource
                      ? `${percentOf(topDataSource.count, safeAudience)} of users`
                      : "Pending"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <JourneyStatsSection data={data} />

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Engagement and retention"
          title="Make drop-off and returning usage obvious"
          description="This section pairs the journey funnel with weekly behavior so it is easy to understand how many users return and how regularly they stay active."
        />

        <div className="space-y-6">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-emerald-600" />
                  <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                    User journey funnel
                  </CardTitle>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Track how the registered audience narrows into monthly and weekly active users.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {data.userJourney.total > 0 ? (
                <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
                  <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
                    <div className="overflow-hidden rounded-[32px] border border-slate-900 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.28),transparent_32%),linear-gradient(160deg,#020617_0%,#0f172a_70%,#111827_100%)] p-6 text-white shadow-[0_24px_70px_-40px_rgba(2,6,23,0.7)]">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-300">
                        Journey read
                      </p>
                      <h3 className="mt-3 max-w-sm text-2xl font-semibold tracking-tight text-white">
                        {journeyFunnel.summary.headline}
                      </h3>
                      <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-300">
                        {journeyFunnel.summary.detail}
                      </p>
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {journeyFunnel.summary.badges.map((badge) => (
                          <div
                            key={badge.label}
                            className="rounded-[24px] border border-white/10 bg-white/8 px-4 py-3 backdrop-blur"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
                              {badge.label}
                            </p>
                            <p className="mt-2 text-2xl font-semibold tracking-tight text-white">
                              {badge.value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {journeyFunnel.topStats.map((stat) => (
                        <div
                          key={stat.label}
                          className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm"
                        >
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            {stat.label}
                          </p>
                          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                            {stat.value}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            {stat.detail}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      {journeyFunnel.stats.map((stat) => {
                        const toneClass =
                          stat.tone === "rose"
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : stat.tone === "amber"
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : stat.tone === "emerald"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-indigo-200 bg-indigo-50 text-indigo-700";
                        const toneDotClass =
                          stat.tone === "rose"
                            ? "bg-rose-500"
                            : stat.tone === "amber"
                              ? "bg-amber-500"
                              : stat.tone === "emerald"
                                ? "bg-emerald-500"
                                : "bg-indigo-500";

                        return (
                          <div
                            key={stat.label}
                            className="rounded-[26px] border border-slate-100 bg-slate-50/70 p-4 shadow-[0_16px_40px_-36px_rgba(15,23,42,0.4)]"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <Badge variant="outline" className={`border ${toneClass}`}>
                                {stat.label}
                              </Badge>
                              <span
                                className={`mt-1 inline-flex h-2.5 w-2.5 rounded-full ${toneDotClass}`}
                              />
                            </div>
                            <p className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
                              {typeof stat.value === "number"
                                ? stat.value.toLocaleString("en-IN")
                                : stat.value}
                            </p>
                            <p className="mt-2 text-sm leading-relaxed text-slate-500">
                              {stat.detail}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[32px] border border-slate-100 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_34%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm">
                    <div className="rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_18px_50px_-40px_rgba(15,23,42,0.35)] backdrop-blur">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
                            From sign-up to retention
                          </p>
                          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                            Follow the audience through each commitment step
                          </h3>
                          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-500">
                            The funnel now reads like a real conversion flow, with stage labels
                            on the right and supporting transition cards underneath.
                          </p>
                        </div>
                        <Badge variant="outline" className="border-slate-200 bg-white text-slate-600">
                          4 stages
                        </Badge>
                      </div>

                      <div className="mt-4 rounded-[28px] border border-slate-100 bg-white px-2 py-3">
                        <div className="h-[320px] w-full">
                          <ReactECharts
                            option={journeyFunnelOption}
                            style={{ height: "100%", width: "100%" }}
                            notMerge
                          />
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        {journeyFunnel.transitions.map((transition) => (
                          <div
                            key={transition.id}
                            className="rounded-[24px] border border-slate-200 bg-white px-4 py-4 shadow-sm"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {transition.label}
                              </p>
                              <Badge variant="outline" className={`border ${transition.toneClass}`}>
                                {transition.retainedPct}% continue
                              </Badge>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-slate-600">
                              {transition.detail}
                            </p>
                            <p className="mt-3 text-xs font-medium text-slate-500">
                              {transition.dropOff.toLocaleString("en-IN")} users drop off at this step
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-[220px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500">
                  No user journey data available yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-violet-600" />
                  <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                    Weekly activity pattern
                  </CardTitle>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Contrast weekly signups with weekly logins to see whether recent growth is turning into repeat usage.
                </p>
              </div>
            </CardHeader>
            <CardContent className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
              <div className="grid gap-3">
                {weeklyHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-[24px] border border-slate-200 bg-slate-50/80 px-4 py-3"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      {item.label}
                    </p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      {item.value}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-white p-4">
                  <div className="h-[300px] w-full">
                    <ReactECharts
                      option={weeklyOption}
                      style={{ height: "100%", width: "100%" }}
                      notMerge
                    />
                  </div>
                </div>

                <div className="rounded-[28px] border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                    Interpretation
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {weeklyActivationRate} of the audience was active in the last 7 days.
                    Pair this with the funnel to judge whether new registrations are turning
                    into repeat users or stalling after sign-up.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Content performance"
          title="Publishing output and format mix"
          description="This section connects publishing velocity with content type distribution so the editorial picture is immediately visible."
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-4 pb-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-amber-600" />
                    <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                      Content published
                    </CardTitle>
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    Review publishing cadence across the selected time window.
                  </p>
                </div>
                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
                  {activePresetLabel} view
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {contentHighlights.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
                  >
                    <p className="text-xs font-medium text-slate-500">{item.label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
                  </div>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                {filteredContent.length > 0 ? (
                  <ReactECharts
                    option={contentBarOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500">
                    No published content for this period.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                    Content by type
                  </CardTitle>
                </div>
                <p className="mt-2 text-sm text-slate-500">
                  Understand which formats dominate the published library.
                </p>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="h-[250px] w-full">
                {data.contentByType.length > 0 ? (
                  <ReactECharts
                    option={contentTypeOption}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                ) : (
                  <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500">
                    No content type data is available yet.
                  </div>
                )}
              </div>
              <RankedBreakdown
                items={data.contentByType.slice(0, 5).map((item) => ({
                  label: item.type,
                  count: item.count,
                }))}
                total={Math.max(data.totalArticles, 1)}
                accentClass="bg-gradient-to-r from-blue-500 to-indigo-500"
                emptyLabel="No content categories are available yet."
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Operational view"
          title="Stay close to the latest user and content activity"
          description="The final layer keeps the newest records visible and gives direct paths into the deeper operational surfaces when the high-level summary suggests follow-up."
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,1fr)]">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Recent users
                </CardTitle>
                <p className="mt-2 text-sm text-slate-500">
                  The newest registrations available in the database snapshot.
                </p>
              </div>
              <Link
                href="/users"
                className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-slate-100 hover:bg-transparent">
                    <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Name
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Source
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      State
                    </TableHead>
                    <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Joined
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentDbUsers.slice(0, 8).length > 0 ? (
                    data.recentDbUsers.slice(0, 8).map((user) => (
                      <TableRow
                        key={user.id}
                        className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                      >
                        <TableCell className="pl-6">
                          <div>
                            <p className="text-sm font-medium text-slate-950">
                              {user.salutation ? `${user.salutation} ` : ""}
                              {user.first_name || ""} {user.last_name || ""}
                              {!user.first_name && !user.last_name ? (
                                <span className="italic text-slate-400">Unknown</span>
                              ) : null}
                            </p>
                            <p className="font-mono text-[11px] text-slate-400">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[11px]">
                            {user.source || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-xs text-slate-500">{user.state || "-"}</span>
                        </TableCell>
                        <TableCell className="pr-6 text-right">
                          <span className="text-xs text-slate-500">
                            {user.created_at
                              ? new Date(user.created_at).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })
                              : "-"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={4}
                        className="py-10 text-center text-sm text-slate-500"
                      >
                        No recent users available.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Recent content
                </CardTitle>
                <p className="mt-2 text-sm text-slate-500">
                  The latest articles published through the connected content system.
                </p>
              </div>
              <Link
                href="/content"
                className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 transition-colors hover:text-emerald-700"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 px-4">
              {data.recentArticles.length > 0 ? (
                data.recentArticles.map((article, index) => (
                  <div
                    key={index}
                    className="group flex items-start gap-3 rounded-2xl border border-slate-100 px-3 py-3 transition-colors hover:bg-slate-50/70"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                      <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-snug text-slate-950">
                        {article.title}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${contentPillClass(
                            article.type
                          )}`}
                        >
                          {article.type}
                        </span>
                        {article.publishedAt ? (
                          <span className="text-[11px] text-slate-400">
                            {new Date(article.publishedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100" />
                  </div>
                ))
              ) : (
                <div className="flex min-h-[200px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500">
                  No recent content is available.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          {navigationCards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="group rounded-[30px] border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-slate-950">
                    {card.title}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {card.description}
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-slate-400 transition-colors group-hover:bg-slate-900 group-hover:text-white">
                  <ArrowRight className="h-4 w-4" />
                </div>
              </div>
            </Link>
          ))}
        </div>

      </section>

      <Dialog open={!!selectedFilter} onOpenChange={(open) => !open && setSelectedFilter(null)}>
        <DialogContent className="sm:max-w-[900px] w-[95vw] max-h-[85vh] p-0 overflow-hidden flex flex-col gap-0 border-none shadow-2xl">
          <DialogHeader className="px-6 py-4 border-b border-gray-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0">
            <DialogTitle className="text-xl font-bold tracking-tight text-gray-900">
              {selectedFilter?.label}: <span className="text-emerald-600">{selectedFilter?.value}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto bg-gray-50/30 p-6">
            {isDialogLoading ? (
              <div className="py-12 flex justify-center text-sm text-gray-500">Loading user data...</div>
            ) : filteredUsers.length > 0 ? (
              <div className="flex flex-col gap-4 h-full">
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden flex-shrink-0">
                  <div className="overflow-x-auto">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow className="bg-gray-50/80 hover:bg-gray-50/80 border-b border-gray-100">
                          <TableHead className="w-[35%] text-[11px] font-semibold uppercase tracking-wider text-gray-500 py-3">User Profile</TableHead>
                          <TableHead className="w-[30%] text-[11px] font-semibold uppercase tracking-wider text-gray-500 py-3">Organization</TableHead>
                          <TableHead className="w-[15%] text-[11px] font-semibold uppercase tracking-wider text-gray-500 py-3">Source</TableHead>
                          <TableHead className="w-[20%] text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 py-3">Joined Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.slice((dialogPage - 1) * ITEMS_PER_PAGE, dialogPage * ITEMS_PER_PAGE).map((u) => (
                          <TableRow key={u.id} className="transition-colors hover:bg-gray-50/60 group">
                            <TableCell className="w-[35%] py-3">
                              <p className="truncate font-medium text-sm text-gray-900 pr-2">
                                {u.salutation ? `${u.salutation} ` : ""}{u.first_name || ""} {u.last_name || ""}
                                {!u.first_name && !u.last_name && <span className="italic text-gray-400">Unknown</span>}
                              </p>
                              <p className="truncate text-[12px] text-gray-500 pr-2 mt-0.5">{u.email}</p>
                              {u.job_title && <p className="truncate text-[11px] text-gray-400 pr-2 mt-0.5 font-medium">{u.job_title}</p>}
                            </TableCell>
                            <TableCell className="w-[30%] py-3"><span className="truncate block text-xs text-gray-700 pr-2">{u.organization || "—"}</span></TableCell>
                            <TableCell className="w-[15%] py-3"><Badge variant="secondary" className="text-[10px]">{u.source || "—"}</Badge></TableCell>
                            <TableCell className="w-[20%] py-3 text-right">
                              <span className="whitespace-nowrap text-xs text-gray-500 pr-2">
                                {u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                {filteredUsers.length > ITEMS_PER_PAGE && (
                  <div className="flex items-center justify-between border border-gray-200 bg-white rounded-lg px-4 py-3 shadow-sm mt-auto">
                    <p className="text-[11px] text-gray-500">
                      Showing <span className="font-medium text-gray-900">{(dialogPage - 1) * ITEMS_PER_PAGE + 1}</span> to <span className="font-medium text-gray-900">{Math.min(dialogPage * ITEMS_PER_PAGE, filteredUsers.length)}</span> of <span className="font-medium text-gray-900">{filteredUsers.length}</span>
                    </p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setDialogPage((p) => Math.max(1, p - 1))} disabled={dialogPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" onClick={() => setDialogPage((p) => Math.min(Math.ceil(filteredUsers.length / ITEMS_PER_PAGE), p + 1))} disabled={dialogPage >= Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)}><ChevronRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-gray-500">No users found for this filter.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
