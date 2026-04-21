"use client";

import { useDeferredValue, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { CountRow, DailyCount } from "@/lib/db";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataFilter, FilterField, FilterRule } from "@/components/ui/data-filter";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Briefcase,
  Building2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Globe,
  MapPin,
  Phone,
  Search,
  Sparkles,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

type ActivityTab = "all" | "active" | "recent" | "inactive";
type ProfileState = "complete" | "partial" | "sparse";

interface EnrichedUser {
  id: string;
  clerk_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  salutation: string | null;
  job_title: string | null;
  organization: string | null;
  source: string | null;
  data_source: string | null;
  state: string | null;
  phone: string | null;
  onboarding_completed: boolean | null;
  created_at: Date | null;
  lastSignIn: number | null;
  isActive: boolean;
  isRecent: boolean;
  profileState: ProfileState;
}

interface UserActivityClientProps {
  enrichedUsers: EnrichedUser[];
  totalDbUsers: number;
  bySource: CountRow[];
  byDataSource: CountRow[];
  byIndustry: CountRow[];
  byState: CountRow[];
  dailyRegistrations: DailyCount[];
  growthRate: number;
  thisMonthCount: number;
  lastMonthCount: number;
  queryErrors: string[];
  summary: {
    onboarded: number;
    withPhone: number;
    withOrganization: number;
    active7d: number;
    active30d: number;
    inactive: number;
    completeProfiles: number;
  };
}

const PAGE_SIZE = 12;
const CHART_COLORS = [
  "#10b981",
  "#2563eb",
  "#8b5cf6",
  "#f59e0b",
  "#f43f5e",
  "#06b6d4",
];

const FILTER_FIELDS: FilterField[] = [
  { key: "name", label: "User name / email", type: "text" },
  { key: "organization", label: "Organization", type: "text" },
  { key: "source", label: "Acquisition source", type: "text" },
  { key: "dataSource", label: "Data source", type: "text" },
  { key: "state", label: "State", type: "text" },
  { key: "onboarded", label: "Onboarded", type: "boolean" },
  {
    key: "activity",
    label: "Activity status",
    type: "select",
    options: [
      { label: "Active (7d)", value: "active" },
      { label: "Warm (8-30d)", value: "recent" },
      { label: "Inactive", value: "inactive" },
    ],
  },
  {
    key: "profile",
    label: "Profile quality",
    type: "select",
    options: [
      { label: "Complete", value: "complete" },
      { label: "Partial", value: "partial" },
      { label: "Sparse", value: "sparse" },
    ],
  },
];

function formatNumber(value: number) {
  return value.toLocaleString("en-IN");
}

function formatPct(value: number, total: number, digits = 0) {
  if (!total) {
    return "0%";
  }

  return `${((value / total) * 100).toFixed(digits)}%`;
}

function formatGrowth(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function formatDate(value: Date | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function normalizeLabel(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  return value.replace(/_/g, " ");
}

function getDisplayName(user: EnrichedUser) {
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return fullName || "Unknown";
}

function getInitials(user: EnrichedUser) {
  const first = user.first_name?.charAt(0) ?? "";
  const last = user.last_name?.charAt(0) ?? "";
  const initials = `${first}${last}`.trim().toUpperCase();

  if (initials) {
    return initials;
  }

  return user.email.charAt(0).toUpperCase();
}

function sumCounts(items: CountRow[]) {
  return items.reduce((total, item) => total + item.count, 0);
}

function groupRemaining(items: CountRow[], limit: number) {
  if (items.length <= limit) {
    return items;
  }

  const visible = items.slice(0, limit);
  const remainder = items.slice(limit).reduce((total, item) => total + item.count, 0);

  if (!remainder) {
    return visible;
  }

  return [...visible, { label: "Others", count: remainder }];
}

function countValues(values: Array<string | null>) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    const normalized = value?.trim();

    if (!normalized) {
      return;
    }

    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count);
}

function getActivityStatus(user: EnrichedUser) {
  if (user.isActive) {
    return "active";
  }

  if (user.isRecent) {
    return "recent";
  }

  return "inactive";
}

function filterUsers(users: EnrichedUser[], rules: FilterRule[]) {
  if (rules.length === 0) {
    return users;
  }

  return users.filter((user) =>
    rules.every((rule) => {
      if (!rule.value) {
        return true;
      }

      const searchValue = rule.value.toLowerCase();
      let fieldValue = "";

      if (rule.field === "name") {
        fieldValue =
          `${user.first_name ?? ""} ${user.last_name ?? ""} ${user.email}`.toLowerCase();
      } else if (rule.field === "organization") {
        fieldValue = (user.organization ?? "").toLowerCase();
      } else if (rule.field === "source") {
        fieldValue = (user.source ?? "").toLowerCase();
      } else if (rule.field === "dataSource") {
        fieldValue = (user.data_source ?? "").toLowerCase();
      } else if (rule.field === "state") {
        fieldValue = (user.state ?? "").toLowerCase();
      } else if (rule.field === "onboarded") {
        fieldValue = user.onboarding_completed ? "true" : "false";
      } else if (rule.field === "activity") {
        fieldValue = getActivityStatus(user);
      } else if (rule.field === "profile") {
        fieldValue = user.profileState;
      }

      if (rule.operator === "equals") {
        return fieldValue === searchValue;
      }

      if (rule.operator === "not_equals") {
        return fieldValue !== searchValue;
      }

      return fieldValue.includes(searchValue);
    })
  );
}

function buildTrendOption(data: DailyCount[]): EChartsOption {
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "line" },
    },
    grid: {
      left: "3%",
      right: "4%",
      top: 20,
      bottom: "2%",
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: data.map((item) => formatShortDate(item.date)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "#94a3b8",
        fontSize: 10,
      },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisLabel: {
        color: "#94a3b8",
        fontSize: 10,
      },
      splitLine: {
        lineStyle: { color: "#e2e8f0" },
      },
    },
    series: [
      {
        name: "Registrations",
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: {
          color: "#10b981",
          width: 3,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(16, 185, 129, 0.24)" },
              { offset: 1, color: "rgba(16, 185, 129, 0.02)" },
            ],
          },
        },
        data: data.map((item) => item.count),
      },
    ],
  };
}

function buildDonutOption(
  data: Array<{ label: string; count: number; color: string }>,
  centerValue: string,
  centerLabel: string
): EChartsOption {
  return {
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)",
    },
    color: data.map((item) => item.color),
    legend: {
      bottom: 0,
      icon: "circle",
      itemWidth: 8,
      textStyle: {
        color: "#64748b",
        fontSize: 10,
      },
    },
    graphic: [
      {
        type: "text",
        left: "center",
        top: "39%",
        style: {
          text: centerValue,
          fontSize: 24,
          fontWeight: 700,
          fill: "#0f172a",
          align: "center",
        },
      },
      {
        type: "text",
        left: "center",
        top: "52%",
        style: {
          text: centerLabel,
          fontSize: 11,
          fill: "#64748b",
          align: "center",
        },
      },
    ],
    series: [
      {
        type: "pie",
        radius: ["48%", "72%"],
        center: ["50%", "42%"],
        label: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: { show: true, fontWeight: "bold" },
        },
        data: data.map((item) => ({
          name: item.label,
          value: item.count,
        })),
      },
    ],
  };
}

function buildHorizontalBarOption(
  items: CountRow[],
  colors: string[] = CHART_COLORS
): EChartsOption {
  return {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    grid: {
      left: "3%",
      right: "4%",
      top: 12,
      bottom: "3%",
      containLabel: true,
    },
    xAxis: {
      type: "value",
      axisLine: { show: false },
      axisLabel: {
        color: "#94a3b8",
        fontSize: 10,
      },
      splitLine: {
        lineStyle: { color: "#e2e8f0" },
      },
    },
    yAxis: {
      type: "category",
      data: items.map((item) => normalizeLabel(item.label)),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        color: "#64748b",
        fontSize: 11,
      },
    },
    series: [
      {
        type: "bar",
        barMaxWidth: 20,
        data: items.map((item, index) => ({
          value: item.count,
          itemStyle: {
            color: colors[index % colors.length],
            borderRadius: [0, 6, 6, 0],
          },
        })),
      },
    ],
  };
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

function RankedBreakdown({
  items,
  total,
  accentClass,
  emptyLabel,
}: {
  items: CountRow[];
  total: number;
  accentClass: string;
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[160px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 px-4 text-center text-sm text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  const maxValue = Math.max(...items.map((item) => item.count), 1);

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.label}
          className="rounded-[24px] border border-slate-200 bg-white px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">
                {index + 1}. {normalizeLabel(item.label)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatNumber(item.count)}
                {total > 0 ? ` records | ${formatPct(item.count, total)}` : " records"}
              </p>
            </div>
            <span className="font-mono text-xs text-slate-400">{formatNumber(item.count)}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200/70">
            <div
              className={`h-full rounded-full ${accentClass}`}
              style={{ width: `${Math.max((item.count / maxValue) * 100, 8)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof Users;
  tone: string;
}) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              {label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
          </div>
          <div className={`rounded-2xl p-3 ${tone}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-500">{detail}</p>
      </CardContent>
    </Card>
  );
}

export function UserActivityClient({
  enrichedUsers,
  totalDbUsers,
  bySource,
  byDataSource,
  byIndustry,
  byState,
  dailyRegistrations,
  growthRate,
  thisMonthCount,
  lastMonthCount,
  queryErrors,
  summary,
}: UserActivityClientProps) {
  const [statusTab, setStatusTab] = useState<ActivityTab>("all");
  const [search, setSearch] = useState("");
  const [activeRules, setActiveRules] = useState<FilterRule[]>([]);
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const recentRegistrations = useMemo(
    () => dailyRegistrations.slice(-90),
    [dailyRegistrations]
  );
  const averageLast30Days = useMemo(() => {
    const recentWindow = dailyRegistrations.slice(-30);

    if (recentWindow.length === 0) {
      return 0;
    }

    const total = recentWindow.reduce((sum, item) => sum + item.count, 0);
    return total / recentWindow.length;
  }, [dailyRegistrations]);
  const topIndustry = byIndustry[0] ?? null;
  const topSource = bySource[0] ?? null;
  const topState = byState[0] ?? null;
  const totalIndustryTags = useMemo(() => sumCounts(byIndustry), [byIndustry]);
  const topThreeIndustryTags = useMemo(
    () => byIndustry.slice(0, 3).reduce((total, item) => total + item.count, 0),
    [byIndustry]
  );
  const warmUsers = Math.max(summary.active30d - summary.active7d, 0);
  const pendingOnboarding = Math.max(totalDbUsers - summary.onboarded, 0);

  const activityChartData = useMemo(
    () => [
      { label: "Active (7d)", count: summary.active7d, color: "#10b981" },
      { label: "Warm (8-30d)", count: warmUsers, color: "#f59e0b" },
      { label: "Inactive", count: summary.inactive, color: "#94a3b8" },
    ],
    [summary.active7d, summary.inactive, warmUsers]
  );
  const onboardingChartData = useMemo(
    () => [
      { label: "Onboarded", count: summary.onboarded, color: "#2563eb" },
      { label: "Pending", count: pendingOnboarding, color: "#cbd5e1" },
    ],
    [pendingOnboarding, summary.onboarded]
  );
  const sourceChartRows = useMemo(() => groupRemaining(bySource, 5), [bySource]);
  const sourceChartData = useMemo(
    () =>
      sourceChartRows.map((item, index) => ({
        label: normalizeLabel(item.label),
        count: item.count,
        color: CHART_COLORS[index % CHART_COLORS.length],
      })),
    [sourceChartRows]
  );
  const industryChartRows = useMemo(() => byIndustry.slice(0, 8), [byIndustry]);
  const stateChartRows = useMemo(() => byState.slice(0, 8), [byState]);
  const dataSourceRows = useMemo(() => groupRemaining(byDataSource, 6), [byDataSource]);

  const filteredUsers = useMemo(() => {
    let result = filterUsers(enrichedUsers, activeRules);

    if (statusTab === "active") {
      result = result.filter((user) => user.isActive);
    } else if (statusTab === "recent") {
      result = result.filter((user) => user.isRecent && !user.isActive);
    } else if (statusTab === "inactive") {
      result = result.filter((user) => !user.isRecent);
    }

    if (!deferredSearch) {
      return result;
    }

    return result.filter((user) => {
      const haystack = [
        getDisplayName(user),
        user.email,
        user.organization,
        user.job_title,
        user.phone,
        user.source,
        user.data_source,
        user.state,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [activeRules, deferredSearch, enrichedUsers, statusTab]);

  const filteredOnboarded = useMemo(
    () => filteredUsers.filter((user) => user.onboarding_completed).length,
    [filteredUsers]
  );
  const filteredActive = useMemo(
    () => filteredUsers.filter((user) => user.isActive).length,
    [filteredUsers]
  );
  const filteredTopSource = useMemo(
    () => countValues(filteredUsers.map((user) => user.source))[0] ?? null,
    [filteredUsers]
  );

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredUsers]);
  const showingFrom = filteredUsers.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, filteredUsers.length);

  const quickStats = [
    {
      label: "Tracked users",
      value: formatNumber(totalDbUsers),
      detail: "Profiles currently visible from the database snapshot.",
      icon: Users,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Weekly active",
      value: formatNumber(summary.active7d),
      detail: `${formatPct(summary.active7d, totalDbUsers)} of tracked users signed in within 7 days.`,
      icon: Activity,
      tone: "bg-blue-50 text-blue-700",
    },
    {
      label: "30-day active",
      value: formatNumber(summary.active30d),
      detail: `${formatPct(summary.active30d, totalDbUsers)} returned in the last 30 days.`,
      icon: TrendingUp,
      tone: "bg-amber-50 text-amber-700",
    },
    {
      label: "Onboarded",
      value: formatNumber(summary.onboarded),
      detail: `${formatPct(summary.onboarded, totalDbUsers)} completed onboarding.`,
      icon: UserCheck,
      tone: "bg-violet-50 text-violet-700",
    },
    {
      label: "Phone coverage",
      value: formatNumber(summary.withPhone),
      detail: `${formatPct(summary.withPhone, totalDbUsers)} include a phone number.`,
      icon: Phone,
      tone: "bg-cyan-50 text-cyan-700",
    },
    {
      label: "Complete profiles",
      value: formatNumber(summary.completeProfiles),
      detail: `${formatPct(summary.completeProfiles, totalDbUsers)} contain company, state, title, and phone.`,
      icon: Building2,
      tone: "bg-rose-50 text-rose-700",
    },
  ];

  return (
    <div className="mx-auto max-w-[1500px] space-y-8 pb-8">
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.16),transparent_30%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.12),transparent_28%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-sm sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_420px]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              User intelligence
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                User activity now reads like the rest of the admin system: growth,
                engagement, market mix, and operator detail in one place.
              </h1>
              <p className="max-w-3xl text-sm leading-relaxed text-slate-600 sm:text-base">
                This surface combines registration momentum, activity recency,
                onboarding coverage, acquisition mix, geography concentration, and
                industry mapping so you can read both user health and market shape
                without switching pages.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-[26px] border border-white/70 bg-white/85 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)] backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Weekly activity
                </p>
                <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                  {formatPct(summary.active7d, totalDbUsers)}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {formatNumber(summary.active7d)} tracked users signed in within the last 7
                  days.
                </p>
              </div>

              <div className="rounded-[26px] border border-white/70 bg-white/85 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)] backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Dominant sector
                </p>
                <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                  {topIndustry ? normalizeLabel(topIndustry.label) : "No industry tags"}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {topIndustry
                    ? `${formatPct(topIndustry.count, totalIndustryTags)} of mapped industry tags.`
                    : "Add industry mappings to unlock sector-level analysis."}
                </p>
              </div>

              <div className="rounded-[26px] border border-white/70 bg-white/85 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.35)] backdrop-blur">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Acquisition leader
                </p>
                <p className="mt-3 text-xl font-semibold tracking-tight text-slate-950">
                  {topSource ? normalizeLabel(topSource.label) : "Unknown"}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {topSource
                    ? `${formatNumber(topSource.count)} users, ${formatPct(topSource.count, totalDbUsers)} of tracked profiles.`
                    : "Populate source data to compare where demand is coming from."}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/70 bg-white/80 p-5 shadow-[0_22px_60px_-42px_rgba(15,23,42,0.4)] backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Current lens
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
              Operator brief
            </h2>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  This month
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {formatNumber(thisMonthCount)}
                </p>
                <p className="mt-2 text-sm text-slate-500">Registrations added this month</p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Last month
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {formatNumber(lastMonthCount)}
                </p>
                <p className="mt-2 text-sm text-slate-500">Previous month comparison base</p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Strongest state
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {topState ? normalizeLabel(topState.label) : "-"}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {topState
                    ? `${formatPct(topState.count, totalDbUsers)} of tracked profiles.`
                    : "No geography signal is available yet."}
                </p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Company mapped
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
                  {formatNumber(summary.withOrganization)}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {formatPct(summary.withOrganization, totalDbUsers)} include organization data.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-[26px] border border-emerald-100 bg-emerald-50/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
                Executive read
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                {formatPct(summary.active7d, totalDbUsers)} of tracked users were active in the
                last 7 days, while {formatPct(summary.onboarded, totalDbUsers)} completed
                onboarding.{" "}
                {topIndustry
                  ? `${normalizeLabel(topIndustry.label)} is the most common mapped sector, and the top three sector tags account for ${formatPct(topThreeIndustryTags, totalIndustryTags)} of all mapped industry assignments.`
                  : "Industry mappings are still too sparse for a credible sector view."}
              </p>
            </div>
          </div>
        </div>
      </section>

      {queryErrors.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="rounded-2xl bg-amber-100 p-2 text-amber-700">
              <CircleAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-900">Partial analytics response</p>
              <p className="mt-1 text-sm leading-relaxed text-amber-800/90">
                Some data blocks failed to load from the database. The page is still rendered
                from the available snapshot.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {quickStats.map((item) => (
          <MetricCard key={item.label} {...item} />
        ))}
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Growth and engagement"
          title="Read registration momentum against activity recency"
          description="This layer gives you the time-series view, current activity split, and onboarding coverage needed to tell whether the user base is compounding or stalling."
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)]">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-4 pb-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Registration momentum
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                The curve below tracks the most recent 90 registration days so spikes and slow
                periods stand out quickly.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">This month</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {formatNumber(thisMonthCount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Current calendar month registrations</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Month-over-month</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {formatGrowth(growthRate)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Change versus the previous calendar month
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500">Recent pace</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {averageLast30Days.toFixed(1)}/day
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Average daily registrations across 30 days</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {recentRegistrations.length > 0 ? (
                <div className="h-[320px] w-full">
                  <ReactECharts
                    option={buildTrendOption(recentRegistrations)}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                </div>
              ) : (
                <div className="flex h-[320px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500">
                  Registration history is not available yet.
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6">
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-blue-600" />
                  <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                    Activity status mix
                  </CardTitle>
                </div>
                <p className="text-sm text-slate-500">
                  Weekly-active, warm, and inactive users split across the tracked base.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[250px]">
                  {totalDbUsers > 0 ? (
                    <ReactECharts
                      option={buildDonutOption(
                        activityChartData,
                        formatNumber(totalDbUsers),
                        "tracked users"
                      )}
                      style={{ height: "100%", width: "100%" }}
                      notMerge
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500">
                      No activity data is available yet.
                    </div>
                  )}
                </div>
                <div className="rounded-[24px] border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                    Interpretation
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {formatPct(summary.active7d, totalDbUsers)} of tracked users are active this
                    week, while {formatPct(warmUsers, totalDbUsers)} are still warm but not active
                    in the last 7 days. That middle segment is the easiest short-term win for
                    reactivation.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardHeader className="space-y-3 pb-2">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-violet-600" />
                  <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                    Onboarding coverage
                  </CardTitle>
                </div>
                <p className="text-sm text-slate-500">
                  A quick read on how much of the database made it past basic setup.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="h-[250px]">
                  {totalDbUsers > 0 ? (
                    <ReactECharts
                      option={buildDonutOption(
                        onboardingChartData,
                        formatPct(summary.onboarded, totalDbUsers),
                        "onboarded"
                      )}
                      style={{ height: "100%", width: "100%" }}
                      notMerge
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500">
                      No onboarding data is available yet.
                    </div>
                  )}
                </div>
                <div className="rounded-[24px] border border-blue-100 bg-blue-50/70 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-700">
                    Readiness signal
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {formatNumber(summary.onboarded)} users completed onboarding, leaving{" "}
                    {formatNumber(pendingOnboarding)} still pending. This is the fastest way to
                    size top-of-funnel leakage before deeper feature analytics are wired in.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Industry and market mix"
          title="Show which sectors, channels, and geographies dominate the base"
          description="These views push the page beyond a plain user table. They give you the industry-level and regional perspective needed for market reading and campaign planning."
        />

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-violet-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Industry tag distribution
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Based on mapped industry tags. A user can belong to more than one industry tag.
              </p>
            </CardHeader>
            <CardContent>
              {industryChartRows.length > 0 ? (
                <div className="h-[300px]">
                  <ReactECharts
                    option={buildHorizontalBarOption(industryChartRows)}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                </div>
              ) : (
                <div className="flex h-[300px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500">
                  No industry mappings are available yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-emerald-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Acquisition mix
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Relative concentration by source, grouped to keep the chart readable.
              </p>
            </CardHeader>
            <CardContent>
              {sourceChartData.length > 0 ? (
                <div className="h-[300px]">
                  <ReactECharts
                    option={buildDonutOption(
                      sourceChartData,
                      formatNumber(totalDbUsers),
                      "tracked users"
                    )}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                </div>
              ) : (
                <div className="flex h-[300px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500">
                  No source attribution is available yet.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  State concentration
                </CardTitle>
              </div>
              <p className="text-sm text-slate-500">
                Where the tracked audience is clustering geographically.
              </p>
            </CardHeader>
            <CardContent>
              {stateChartRows.length > 0 ? (
                <div className="h-[300px]">
                  <ReactECharts
                    option={buildHorizontalBarOption(stateChartRows, [
                      "#2563eb",
                      "#06b6d4",
                      "#10b981",
                      "#8b5cf6",
                      "#f59e0b",
                      "#f43f5e",
                    ])}
                    style={{ height: "100%", width: "100%" }}
                    notMerge
                  />
                </div>
              ) : (
                <div className="flex h-[300px] items-center justify-center rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500">
                  No state data is available yet.
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                Top industries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RankedBreakdown
                items={byIndustry.slice(0, 5)}
                total={totalIndustryTags}
                accentClass="bg-gradient-to-r from-violet-500 to-fuchsia-500"
                emptyLabel="Add industry-tag mappings to reveal sector concentration."
              />
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                Top states
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RankedBreakdown
                items={byState.slice(0, 5)}
                total={totalDbUsers}
                accentClass="bg-gradient-to-r from-blue-500 to-cyan-500"
                emptyLabel="State concentration appears once users include geography."
              />
            </CardContent>
          </Card>

          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                Data source mix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RankedBreakdown
                items={dataSourceRows}
                total={sumCounts(byDataSource)}
                accentClass="bg-gradient-to-r from-emerald-500 to-lime-500"
                emptyLabel="No data-source attribution is available yet."
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="space-y-5">
        <SectionHeading
          eyebrow="Operator directory"
          title="Move from market read to individual profiles"
          description="Search, tab by recency, and stack custom rules against the database-backed user directory. The filtered view updates the counts below so you can pivot from trends to action."
        />

        <Tabs value={statusTab} onValueChange={(value) => {
          setStatusTab(value as ActivityTab);
          setPage(1);
        }}>
          <div className="space-y-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="space-y-3">
                <TabsList variant="line">
                  <TabsTrigger value="all">All ({formatNumber(enrichedUsers.length)})</TabsTrigger>
                  <TabsTrigger value="active">
                    Active ({formatNumber(summary.active7d)})
                  </TabsTrigger>
                  <TabsTrigger value="recent">Warm ({formatNumber(warmUsers)})</TabsTrigger>
                  <TabsTrigger value="inactive">
                    Inactive ({formatNumber(summary.inactive)})
                  </TabsTrigger>
                </TabsList>
                <p className="text-sm text-slate-500">
                  Search by name, email, company, title, source, state, or phone, then stack
                  saved filter rules for a tighter operational slice.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 xl:max-w-[460px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search name, email, company, source..."
                    className="h-11 pl-9"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-medium text-slate-500">Users in view</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      {formatNumber(filteredUsers.length)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-medium text-slate-500">Onboarded in view</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                      {formatNumber(filteredOnboarded)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-xs font-medium text-slate-500">Leading source</p>
                    <p className="mt-2 truncate text-lg font-semibold tracking-tight text-slate-950">
                      {filteredTopSource ? normalizeLabel(filteredTopSource.label) : "-"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {filteredTopSource
                        ? `${formatNumber(filteredTopSource.count)} users in current view`
                        : "No source signal"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <DataFilter
              fields={FILTER_FIELDS}
              storageKey="user-activity-module"
              onFilterChange={(rules) => {
                setActiveRules(rules);
                setPage(1);
              }}
            />

            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-100 bg-slate-50/70 hover:bg-slate-50/70">
                        <TableHead className="pl-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          User
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Organization
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Activity
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Readiness
                        </TableHead>
                        <TableHead className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Source
                        </TableHead>
                        <TableHead className="pr-6 text-right text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Joined
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedUsers.length > 0 ? (
                        paginatedUsers.map((user) => (
                          <TableRow
                            key={user.id}
                            className="border-b border-slate-50 transition-colors hover:bg-slate-50/60"
                          >
                            <TableCell className="pl-6">
                              <div className="flex min-w-[260px] items-start gap-3">
                                <Avatar className="mt-0.5 size-10">
                                  <AvatarFallback className="bg-emerald-50 text-xs font-semibold text-emerald-700">
                                    {getInitials(user)}
                                  </AvatarFallback>
                                </Avatar>

                                <div className="min-w-0">
                                  <p className="truncate text-sm font-medium text-slate-950">
                                    {user.salutation ? `${user.salutation} ` : ""}
                                    {getDisplayName(user)}
                                  </p>
                                  <p className="truncate font-mono text-[11px] text-slate-400">
                                    {user.email}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                                    {user.job_title ? (
                                      <span className="inline-flex items-center gap-1">
                                        <Briefcase className="h-3.5 w-3.5" />
                                        {user.job_title}
                                      </span>
                                    ) : null}
                                    {user.phone ? (
                                      <span className="inline-flex items-center gap-1">
                                        <Phone className="h-3.5 w-3.5" />
                                        {user.phone}
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="min-w-[180px]">
                                <p className="text-sm text-slate-700">
                                  {user.organization || "-"}
                                </p>
                                <p className="mt-1 text-[11px] text-slate-400">
                                  {user.state ? `State: ${user.state}` : "No geography"}
                                </p>
                              </div>
                            </TableCell>

                            <TableCell>
                              {user.isActive ? (
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
                                >
                                  Active
                                </Badge>
                              ) : user.isRecent ? (
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-amber-200 bg-amber-50 text-[11px] text-amber-700"
                                >
                                  Warm
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="rounded-full border-slate-200 bg-slate-50 text-[11px] text-slate-600"
                                >
                                  Inactive
                                </Badge>
                              )}
                            </TableCell>

                            <TableCell>
                              <div className="flex flex-wrap gap-2">
                                <Badge
                                  variant="outline"
                                  className={
                                    user.onboarding_completed
                                      ? "rounded-full border-blue-200 bg-blue-50 text-[11px] text-blue-700"
                                      : "rounded-full border-slate-200 bg-slate-50 text-[11px] text-slate-600"
                                  }
                                >
                                  {user.onboarding_completed ? "Onboarded" : "Pending"}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={
                                    user.profileState === "complete"
                                      ? "rounded-full border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
                                      : user.profileState === "partial"
                                      ? "rounded-full border-violet-200 bg-violet-50 text-[11px] text-violet-700"
                                      : "rounded-full border-amber-200 bg-amber-50 text-[11px] text-amber-700"
                                  }
                                >
                                  {user.profileState === "complete"
                                    ? "Complete profile"
                                    : user.profileState === "partial"
                                    ? "Partial profile"
                                    : "Sparse profile"}
                                </Badge>
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex min-w-[140px] flex-col gap-1">
                                <Badge
                                  variant="secondary"
                                  className="w-fit border border-slate-200 bg-slate-50 text-[11px] text-slate-700 shadow-none"
                                >
                                  {normalizeLabel(user.source)}
                                </Badge>
                                <span className="text-[11px] text-slate-400">
                                  {normalizeLabel(user.data_source)}
                                </span>
                              </div>
                            </TableCell>

                            <TableCell className="pr-6 text-right">
                              <div>
                                <p className="text-sm text-slate-600">{formatDate(user.created_at)}</p>
                                <p className="mt-1 text-[11px] text-slate-400">
                                  {user.lastSignIn
                                    ? `Last sign-in ${new Date(user.lastSignIn).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                      })}`
                                    : "No sign-in recorded"}
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow className="hover:bg-transparent">
                          <TableCell
                            colSpan={6}
                            className="py-16 text-center text-sm text-slate-500"
                          >
                            No users match the current search, tab, and filter combination.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 text-sm text-slate-500">
                    <p>
                      Showing {formatNumber(showingFrom)} to {formatNumber(showingTo)} of{" "}
                      {formatNumber(filteredUsers.length)} matching users
                    </p>
                    <p>
                      Page {formatNumber(currentPage)} of {formatNumber(pageCount)} with{" "}
                      {PAGE_SIZE} users per page
                      {filteredActive > 0
                        ? ` | ${formatNumber(filteredActive)} active users in current slice`
                        : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.max(1, current - 1))}
                      disabled={currentPage === 1}
                      className="gap-1"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                      disabled={currentPage === pageCount}
                      className="gap-1"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </Tabs>
      </section>
    </div>
  );
}
