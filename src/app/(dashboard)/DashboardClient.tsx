"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  UserPlus,
  Activity,
  FileText,
  ArrowUpRight,
  ArrowDownRight,
  ArrowRight,
  Download,
  Filter,
  TrendingUp,
  BarChart3,
  Calendar,
  Building2,
  MapPin,
  Globe,
  ChevronDown,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
  RadialBarChart,
  RadialBar,
} from "recharts";
import type { DashboardData, DailyDataPoint } from "./page";

// ─── Types ──────────────────────────────────────────────────────────
type DateRange = "7d" | "30d" | "90d" | "1y" | "all";
type ChartVariant = "bar" | "pie" | "area";

const DATE_PRESETS: { label: string; value: DateRange }[] = [
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "1Y", value: "1y" },
  { label: "All", value: "all" },
];

// ─── Helpers ────────────────────────────────────────────────────────
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

const COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#f43f5e",
  "#06b6d4", "#84cc16", "#ec4899", "#14b8a6", "#a855f7",
  "#f97316", "#6366f1",
];

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

// ─── CSV Export ─────────────────────────────────────────────────────
function exportCSV(data: DashboardData) {
  const header = "Name,Email,Joined,Source,Industry,State,Salutation,Organization\n";
  const rows = data.recentDbUsers
    .map((u) => {
      const name = `${u.first_name || ""} ${u.last_name || ""}`.trim() || "Unknown";
      const joined = u.created_at ? new Date(u.created_at).toISOString().slice(0, 10) : "";
      return `"${name}","${u.email}","${joined}","${u.source || ""}","","${u.state || ""}","${u.salutation || ""}","${u.organization || ""}"`;
    })
    .join("\n");
  const summary = `\n\nSummary\nDB Users,${data.dbTotalUsers}\nClerk Users,${data.totalUsers}\nArticles,${data.totalArticles}\nGrowth Rate,${data.growthRate.toFixed(1)}%\nExported,"${new Date().toISOString()}"`;
  const blob = new Blob([header + rows + summary], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `energdive-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Chart Tooltip ──────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; name: string; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white/95 px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="mb-1 text-[11px] font-medium text-gray-400">{label}</p>
      {payload.map((e, i) => (
        <p key={i} className="text-sm font-bold" style={{ color: e.color }}>
          {e.name}: {e.value}
        </p>
      ))}
    </div>
  );
}

// ─── Chart Type Switcher ────────────────────────────────────────────
function ChartSwitch({
  value,
  onChange,
}: {
  value: ChartVariant;
  onChange: (v: ChartVariant) => void;
}) {
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

// ─── Flexible Chart: renders data as bar, pie, or area ──────────────
function FlexChart({
  data,
  variant,
  color,
  labelKey = "label",
  valueKey = "count",
}: {
  data: { label: string; count: number }[];
  variant: ChartVariant;
  color?: string;
  labelKey?: string;
  valueKey?: string;
}) {
  if (data.length === 0)
    return (
      <div className="flex h-full items-center justify-center text-sm text-gray-400">
        No data available
      </div>
    );

  if (variant === "pie") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            paddingAngle={2}
            dataKey={valueKey}
            nameKey={labelKey}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
            ))}
          </Pie>
          <Tooltip />
          <Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            iconSize={7}
            formatter={(v: string) => <span className="text-[11px] text-gray-600">{v}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (variant === "area") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color || COLORS[0]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color || COLORS[0]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
          <XAxis dataKey={labelKey} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip content={<ChartTooltip />} />
          <Area type="monotone" dataKey={valueKey} name="Count" stroke={color || COLORS[0]} strokeWidth={2} fill="url(#areaGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  // Default: bar
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ left: 80 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey={labelKey} tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} width={75} />
        <Tooltip content={<ChartTooltip />} />
        <Bar dataKey={valueKey} name="Users" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════
export function DashboardClient({ data }: { data: DashboardData }) {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [industryChart, setIndustryChart] = useState<ChartVariant>("bar");
  const [sourceChart, setSourceChart] = useState<ChartVariant>("pie");
  const [stateChart, setStateChart] = useState<ChartVariant>("bar");
  const [salutationChart, setSalutationChart] = useState<ChartVariant>("pie");
  const [dataSourceChart, setDataSourceChart] = useState<ChartVariant>("pie");

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  const filteredSignups = useMemo(() => filterByRange(data.dailySignups, dateRange), [data.dailySignups, dateRange]);
  const filteredContent = useMemo(() => filterByRange(data.dailyContent, dateRange), [data.dailyContent, dateRange]);
  const filteredRegistrations = useMemo(() => filterByRange(data.dailyRegistrations, dateRange), [data.dailyRegistrations, dateRange]);

  // KPI stats
  const stats = [
    {
      label: "Total Users",
      value: data.dbTotalUsers || data.totalUsers,
      icon: Users,
      accent: "border-l-emerald-500",
      iconColor: "text-emerald-600",
      trend: trendPct(data.newThisMonth, data.newPrevMonth),
      trendUp: data.newThisMonth >= data.newPrevMonth,
      sub: "vs prev month",
    },
    {
      label: "New This Month",
      value: data.growthThisMonth || data.newThisMonth,
      icon: UserPlus,
      accent: "border-l-blue-500",
      iconColor: "text-blue-600",
      trend: trendPct(data.growthThisMonth, data.growthLastMonth),
      trendUp: data.growthThisMonth >= data.growthLastMonth,
      sub: "registrations",
    },
    {
      label: "Active (7 Days)",
      value: data.activeLast7Days,
      icon: Activity,
      accent: "border-l-violet-500",
      iconColor: "text-violet-600",
      trend: trendPct(data.activeLast7Days, data.activePrev7Days),
      trendUp: data.activeLast7Days >= data.activePrev7Days,
      sub: "vs prev 7 days",
    },
    {
      label: "Total Articles",
      value: data.totalArticles,
      icon: FileText,
      accent: "border-l-orange-500",
      iconColor: "text-orange-600",
      trend: trendPct(data.articlesThisMonth, data.articlesPrevMonth),
      trendUp: data.articlesThisMonth >= data.articlesPrevMonth,
      sub: "published this month",
    },
    {
      label: "Growth Rate",
      value: `${data.growthRate >= 0 ? "+" : ""}${data.growthRate.toFixed(1)}%`,
      icon: TrendingUp,
      accent: "border-l-cyan-500",
      iconColor: "text-cyan-600",
      trend: data.growthRate >= 0 ? "Positive growth" : "Declining",
      trendUp: data.growthRate >= 0,
      sub: "month-over-month",
      isPercent: true,
    },
  ];

  // Funnel
  const funnelPct30 = data.userJourney.total > 0 ? Math.round((data.userJourney.activeWithin30d / data.userJourney.total) * 100) : 0;
  const funnelPct7 = data.userJourney.total > 0 ? Math.round((data.userJourney.activeWithin7d / data.userJourney.total) * 100) : 0;
  const neverPct = data.userJourney.total > 0 ? Math.round((data.userJourney.neverSignedIn / data.userJourney.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* ── Header + Filters ────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Analytics Dashboard
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Real-time intelligence · Clerk + Strapi + Database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm">
            {DATE_PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setDateRange(p.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  dateRange === p.value
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "text-gray-500 hover:text-gray-900"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-gray-200 text-gray-600 shadow-sm hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
            onClick={() => exportCSV(data)}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: "Add User", icon: UserPlus, href: "/users" },
          { label: "Publish Article", icon: FileText, href: "/content" },
          { label: "View Funnels", icon: Filter, href: "/funnels" },
          { label: "User Activity", icon: Activity, href: "/user-activity" },
        ].map((a) => (
          <Link key={a.label} href={a.href}>
            <Button variant="outline" className="w-full justify-start gap-2 border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700">
              <a.icon className="h-4 w-4" />
              {a.label}
            </Button>
          </Link>
        ))}
        <Button
          variant="outline"
          className="w-full justify-start gap-2 border-gray-200 bg-white text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
          onClick={() => exportCSV(data)}
        >
          <Download className="h-4 w-4" />
          Export Report
        </Button>
      </div>

      {/* ── KPI Stats (5 cards) ─────────────────────────────────── */}
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

      {/* ── Row 1: Registration Trend + Source Breakdown ─────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Daily Registrations (DB) */}
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
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={filteredRegistrations}>
                    <defs>
                      <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "#9ca3af" }}
                      tickFormatter={(v: string) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }}
                      axisLine={false} tickLine={false}
                    />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="count" name="Registrations" stroke="#10b981" strokeWidth={2} fill="url(#regGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">No registration data for this period</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Source Breakdown */}
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
              <FlexChart data={data.bySource} variant={sourceChart} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Industry + Data Source ────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Industry Breakdown */}
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
              <FlexChart data={data.byIndustry.slice(0, 12)} variant={industryChart} color="#8b5cf6" />
            </div>
          </CardContent>
        </Card>

        {/* Data Source (Zoho vs Organic) */}
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
              <FlexChart data={data.byDataSource} variant={dataSourceChart} color="#f59e0b" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: State + Salutation ──────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* State-wise */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-rose-500" />
              <CardTitle className="text-sm font-semibold text-gray-900">Users by State</CardTitle>
            </div>
            <ChartSwitch value={stateChart} onChange={setStateChart} />
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <FlexChart data={data.byState.slice(0, 10)} variant={stateChart} color="#f43f5e" />
            </div>
          </CardContent>
        </Card>

        {/* Salutation-wise */}
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
              <FlexChart data={data.bySalutation} variant={salutationChart} color="#06b6d4" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Content Charts ───────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Content Published Over Time */}
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
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={filteredContent}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#9ca3af" }} tickFormatter={(v: string) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="count" name="Articles" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">No published content for this period</div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Content by Type Donut */}
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
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.contentByType} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="count" nameKey="type">
                      {data.contentByType.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={7} formatter={(v: string) => <span className="text-[11px] text-gray-600">{v}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">No content data</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── User Journey Funnel ─────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-emerald-500" />
            <CardTitle className="text-sm font-semibold text-gray-900">User Journey Funnel</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            {[
              { label: "Total Registered", value: data.userJourney.total, pct: 100, color: "bg-gray-400" },
              { label: "Active (30 Days)", value: data.userJourney.activeWithin30d, pct: funnelPct30, color: "bg-blue-500" },
              { label: "Active (7 Days)", value: data.userJourney.activeWithin7d, pct: funnelPct7, color: "bg-emerald-500" },
              { label: "Never Signed In", value: data.userJourney.neverSignedIn, pct: neverPct, color: "bg-red-400" },
            ].map((f) => (
              <div key={f.label} className="space-y-2 rounded-lg border border-gray-100 bg-gray-50/50 p-4">
                <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{f.label}</p>
                <p className="font-mono text-2xl font-bold text-gray-900">{f.value.toLocaleString()}</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                  <div className={`h-full rounded-full ${f.color} transition-all duration-700`} style={{ width: `${f.pct}%` }} />
                </div>
                <p className="text-right text-[11px] font-semibold text-gray-600">{f.pct}%</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Weekly Activity ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-500" />
            <CardTitle className="text-sm font-semibold text-gray-900">Weekly Activity Pattern</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.weeklyActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend verticalAlign="top" height={28} iconType="circle" iconSize={8} formatter={(v: string) => <span className="text-[11px] text-gray-600">{v}</span>} />
                <Bar dataKey="signups" name="Signups" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Bar dataKey="logins" name="Logins" fill="#8b5cf6" radius={[3, 3, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ── Recent Users + Recent Content ────────────────────────── */}
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
                          {u.salutation ? `${u.salutation} ` : ""}
                          {u.first_name || ""} {u.last_name || ""}
                          {!u.first_name && !u.last_name && <span className="italic text-gray-400">Unknown</span>}
                        </p>
                        <p className="font-mono text-[11px] text-gray-400">{u.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[11px]">{u.source || "—"}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-gray-500">{u.state || "—"}</span>
                    </TableCell>
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

      {/* ── Bottom Nav Tabs ─────────────────────────────────────── */}
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
              <Link href="/users">
                <Badge className="cursor-pointer gap-1 bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-800">Go to Users <ArrowRight className="h-3 w-3" /></Badge>
              </Link>
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
              <Link href="/content">
                <Badge className="cursor-pointer gap-1 bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-800">Go to Content <ArrowRight className="h-3 w-3" /></Badge>
              </Link>
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
              <Link href="/user-activity">
                <Badge className="cursor-pointer gap-1 bg-gray-900 px-3 py-1.5 text-xs text-white hover:bg-gray-800">Go to Activity <ArrowRight className="h-3 w-3" /></Badge>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
