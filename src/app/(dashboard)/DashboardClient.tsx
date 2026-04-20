"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
      { name: "Logins",  type: "bar", data: data.weeklyActivity.map((d) => d.logins),  itemStyle: { borderRadius: [3, 3, 0, 0] }, barMaxWidth: 24 },
    ],
  }), [data.weeklyActivity]);

  const funnelOption = useMemo((): EChartsOption => {
    const total = data.userJourney.total || 1;
    // Only sequential steps — "Never Signed In" is a branch, not a step, so excluded here
    const steps = [
      { name: "Total Registered", value: data.userJourney.total,          color: "#6366f1" },
      { name: "Active (30 Days)", value: data.userJourney.activeWithin30d, color: "#3b82f6" },
      { name: "Active (7 Days)",  value: data.userJourney.activeWithin7d,  color: "#10b981" },
    ];
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tooltip: { trigger: "item", formatter: (p: any) => `<strong>${p.name}</strong><br/>Users: <b>${Number(p.value).toLocaleString()}</b><br/>${Math.round((Number(p.value) / total) * 100)}% of total` },
      color: steps.map((s) => s.color),
      series: [{
        type: "funnel",
        left: "10%", width: "80%", min: 0, max: total,
        sort: "descending", gap: 6,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        label: { show: true, position: "inside", color: "#fff", fontWeight: "bold", fontSize: 12, formatter: (p: any) => `${p.name}   ${Number(p.value).toLocaleString()}` },
        labelLine: { show: false },
        itemStyle: { borderWidth: 0 },
        data: steps.map((s) => ({ name: s.name, value: s.value, itemStyle: { color: s.color } })),
      }],
    };
  }, [data.userJourney]);


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

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Analytics Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Real-time intelligence · Clerk + Strapi + Database</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
            {DATE_PRESETS.map((p) => (
              <button key={p.value} onClick={() => setDateRange(p.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${dateRange === p.value ? "bg-emerald-500 text-white shadow-sm" : "text-gray-500 hover:text-gray-900"}`}>
                {p.label}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm"
            className="gap-1.5 border-gray-200 text-gray-600 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            onClick={() => exportCSV(data)}>
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
        </div>
      </div>

      {/* ── Quick Actions ──────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Add User", icon: UserPlus, href: "/users" },
          { label: "Publish Article", icon: FileText, href: "/content" },
          { label: "View Funnels", icon: Filter, href: "/funnels" },
          { label: "User Activity", icon: Activity, href: "/user-activity" },
        ].map((a) => (
          <Link key={a.label} href={a.href}>
            <Button variant="outline" className="w-full justify-start gap-2 border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">
              <a.icon className="h-4 w-4" />{a.label}
            </Button>
          </Link>
        ))}
        <Button variant="outline" className="w-full justify-start gap-2 border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => exportCSV(data)}>
          <Download className="h-4 w-4" /> Export Report
        </Button>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className={`border-l-4 ${s.accent} transition-shadow duration-200 hover:shadow-md`}>
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{s.label}</CardTitle>
                <Icon className={`h-4 w-4 ${s.iconColor}`} />
              </CardHeader>
              <CardContent className="pb-3">
                <p className="font-mono text-2xl font-bold tracking-tight text-gray-900">
                  {typeof s.value === "number" ? s.value.toLocaleString() : s.value}
                </p>
                <div className="mt-1 flex items-center gap-1">
                  <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${s.trendUp ? "text-emerald-600" : "text-red-500"}`}>
                    {s.trendUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {s.trend}
                  </span>
                  <span className="text-[10px] text-gray-400">{s.sub}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Row 1: Registration Trend + Source ────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Registration Trend</CardTitle>
            </div>
            <span className="text-[11px] text-gray-400">{filteredRegistrations.length} days · Database</span>
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              {filteredRegistrations.length > 0 ? (
                <ReactECharts option={registrationOption} style={{ height: "100%", width: "100%" }} notMerge />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">No registration data for this period</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Source</CardTitle>
            </div>
            <ChartSwitch value={sourceChart} onChange={setSourceChart} />
          </CardHeader>
          <CardContent>
            <div className="h-[220px] w-full">
              <FlexEChart data={data.bySource} variant={sourceChart} onSliceClick={(v) => handleChartClick("source", v, "Source")} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Industry + Acquisition ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-violet-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Users by Industry</CardTitle>
            </div>
            <ChartSwitch value={industryChart} onChange={setIndustryChart} />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <FlexEChart data={data.byIndustry.slice(0, 12)} variant={industryChart} color="#8b5cf6" onSliceClick={(v) => handleChartClick("industry", v, "Industry")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Acquisition Channel</CardTitle>
            </div>
            <ChartSwitch value={dataSourceChart} onChange={setDataSourceChart} />
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <FlexEChart data={data.byDataSource} variant={dataSourceChart} color="#f59e0b" onSliceClick={(v) => handleChartClick("data_source", v, "Acquisition Channel")} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: State Map + Salutation ─────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-rose-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Users by State</CardTitle>
            </div>
            {mapReady
              ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">🗺 India Map</span>
              : <ChartSwitch value={stateChart} onChange={setStateChart} />}
          </CardHeader>
          <CardContent>
            <div className="h-[340px] w-full">
              {mapReady ? (
                <ReactECharts option={indiaMapOption} style={{ height: "100%", width: "100%" }} notMerge />
              ) : (
                <FlexEChart data={data.byState.slice(0, 12)} variant={stateChart} color="#f43f5e" onSliceClick={(v) => handleChartClick("state", v, "State")} />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Salutation Breakdown</CardTitle>
            </div>
            <ChartSwitch value={salutationChart} onChange={setSalutationChart} />
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <FlexEChart data={data.bySalutation} variant={salutationChart} color="#06b6d4" onSliceClick={(v) => handleChartClick("salutation", v, "Salutation")} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Content Published + Content by Type ─────────  */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Content Published</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              {filteredContent.length > 0 ? (
                <ReactECharts option={contentBarOption} style={{ height: "100%", width: "100%" }} notMerge />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">No published content for this period</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Content by Type</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] w-full">
              {data.contentByType.length > 0 ? (
                <ReactECharts option={contentTypeOption} style={{ height: "100%", width: "100%" }} notMerge />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">No content data</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── User Journey Funnel (ECharts) ──────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-sm font-semibold text-gray-900">User Journey Funnel</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] w-full">
            <ReactECharts option={funnelOption} style={{ height: "100%", width: "100%" }} notMerge />
          </div>
        </CardContent>
      </Card>

      {/* ── Weekly Activity ────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-sm font-semibold text-gray-900">Weekly Activity Pattern</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] w-full">
            <ReactECharts option={weeklyOption} style={{ height: "100%", width: "100%" }} notMerge />
          </div>
        </CardContent>
      </Card>

      {/* ── Recent Users + Recent Content ──────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900">Recent Users</CardTitle>
            <Link href="/users" className="flex items-center gap-1 text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-100 hover:bg-transparent">
                  <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Name</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Source</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">State</TableHead>
                  <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentDbUsers.slice(0, 8).map((u) => (
                  <TableRow key={u.id} className="border-b border-gray-50 transition-colors hover:bg-gray-50/60">
                    <TableCell className="pl-6">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {u.salutation ? `${u.salutation} ` : ""}{u.first_name || ""} {u.last_name || ""}
                          {!u.first_name && !u.last_name && <span className="italic text-gray-400">Unknown</span>}
                        </p>
                        <p className="font-mono text-[11px] text-gray-400">{u.email}</p>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-[11px]">{u.source || "—"}</Badge></TableCell>
                    <TableCell><span className="text-xs text-gray-500">{u.state || "—"}</span></TableCell>
                    <TableCell className="pr-6 text-right">
                      <span className="text-xs text-gray-500">
                        {u.created_at ? new Date(u.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900">Recent Content</CardTitle>
            <Link href="/content" className="flex items-center gap-1 text-xs font-medium text-emerald-600 transition-colors hover:text-emerald-700">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1 px-4">
            {data.recentArticles.map((a, i) => (
              <div key={i} className="group flex items-start gap-3 rounded-lg border-b border-gray-50 px-2 py-3 transition-colors last:border-b-0 hover:bg-gray-50/60">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium leading-snug text-gray-900">{a.title}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${contentPillClass(a.type)}`}>{a.type}</span>
                    {a.publishedAt && <span className="text-[11px] text-gray-400">{new Date(a.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
                  </div>
                </div>
                <ArrowRight className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-300 opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom Nav Tabs ────────────────────────────────────── */}
      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <Card className="transition-shadow duration-200 hover:shadow-md">
            <CardContent className="flex items-center justify-between py-6">
              <div>
                <p className="text-sm font-medium text-gray-900">User Management</p>
                <p className="text-xs text-gray-500">View and manage all {data.dbTotalUsers || data.totalUsers} registered users.</p>
              </div>
              <Link href="/users"><Badge className="cursor-pointer gap-1 bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-800">Go to Users <ArrowRight className="h-3 w-3" /></Badge></Link>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="content">
          <Card className="transition-shadow duration-200 hover:shadow-md">
            <CardContent className="flex items-center justify-between py-6">
              <div>
                <p className="text-sm font-medium text-gray-900">Content Management</p>
                <p className="text-xs text-gray-500">Browse all {data.totalArticles} articles synced from Strapi.</p>
              </div>
              <Link href="/content"><Badge className="cursor-pointer gap-1 bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-800">Go to Content <ArrowRight className="h-3 w-3" /></Badge></Link>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity">
          <Card className="transition-shadow duration-200 hover:shadow-md">
            <CardContent className="flex items-center justify-between py-6">
              <div>
                <p className="text-sm font-medium text-gray-900">User Activity Tracking</p>
                <p className="text-xs text-gray-500">View detailed user journeys, page views, and activity logs.</p>
              </div>
              <Link href="/user-activity"><Badge className="cursor-pointer gap-1 bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-800">Go to Activity <ArrowRight className="h-3 w-3" /></Badge></Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Filtered Users Dialog ──────────────────────────────── */}
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
