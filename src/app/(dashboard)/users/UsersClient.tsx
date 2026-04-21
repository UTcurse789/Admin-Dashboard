"use client";

import { useDeferredValue, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { DailyCount, DbUser } from "@/lib/db";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  FilterX,
  MapPin,
  Search,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

interface UsersClientProps {
  users: DbUser[];
  totalCount: number;
  dailyRegistrations: DailyCount[];
}

interface ForecastPoint {
  date: string;
  actual: number | null;
  forecast: number | null;
}

function hasText(value: string | null): value is string {
  return Boolean(value && value.trim());
}

const PAGE_SIZE = 20;
const FORECAST_DAYS = 14;
const HISTORY_DAYS = 30;

function formatNumber(value: number) {
  return value.toLocaleString("en-IN");
}

function formatDate(value: Date | string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatShortDate(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function toDateKey(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

function getDisplayName(user: DbUser) {
  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  return fullName || "Unknown";
}

function getInitials(user: DbUser) {
  const first = user.first_name?.charAt(0) ?? "";
  const last = user.last_name?.charAt(0) ?? "";
  const initials = `${first}${last}`.trim().toUpperCase();

  if (initials) {
    return initials;
  }

  return user.email.charAt(0).toUpperCase();
}

function getProfileState(user: DbUser) {
  const completenessFields = [user.organization, user.state, user.job_title];
  const populatedFields = completenessFields.filter(Boolean).length;

  if (populatedFields === completenessFields.length) {
    return "complete";
  }

  if (populatedFields === 0) {
    return "empty";
  }

  return "partial";
}

function countItems(values: Array<string | null>) {
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

function buildRegistrationSeries(
  dailyRegistrations: DailyCount[],
  users: DbUser[]
): DailyCount[] {
  if (dailyRegistrations.length > 0) {
    return [...dailyRegistrations].sort((left, right) =>
      left.date.localeCompare(right.date)
    );
  }

  const counts = new Map<string, number>();

  users.forEach((user) => {
    if (!user.created_at) {
      return;
    }

    const key = toDateKey(user.created_at);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

function fillRecentHistory(series: DailyCount[]) {
  if (series.length === 0) {
    return [];
  }

  const recentSlice = series.slice(-HISTORY_DAYS);
  const countMap = new Map(recentSlice.map((item) => [item.date, item.count]));
  const start = new Date(recentSlice[0].date);
  const end = new Date(recentSlice[recentSlice.length - 1].date);
  const filled: DailyCount[] = [];

  while (start <= end) {
    const key = toDateKey(start);
    filled.push({ date: key, count: countMap.get(key) ?? 0 });
    start.setDate(start.getDate() + 1);
  }

  return filled;
}

function buildForecast(history: DailyCount[]) {
  if (history.length === 0) {
    return {
      points: [] as ForecastPoint[],
      projectedAdds: 0,
      projectedDailyAverage: 0,
      trendDelta: 0,
    };
  }

  const recentHistory = fillRecentHistory(history);
  const last14Days = recentHistory.slice(-14);
  const previous14Days = recentHistory.slice(-28, -14);
  const recentAverage =
    last14Days.reduce((total, item) => total + item.count, 0) /
    Math.max(last14Days.length, 1);
  const previousAverage =
    previous14Days.reduce((total, item) => total + item.count, 0) /
    Math.max(previous14Days.length || last14Days.length, 1);
  const trendDelta = recentAverage - previousAverage;
  const dailySlope = trendDelta / Math.max(last14Days.length, 1);
  const lastKnownDate = new Date(
    recentHistory[recentHistory.length - 1]?.date ?? new Date().toISOString()
  );

  const points: ForecastPoint[] = recentHistory.map((item) => ({
    date: item.date,
    actual: item.count,
    forecast: null,
  }));

  let projectedAdds = 0;

  for (let dayIndex = 1; dayIndex <= FORECAST_DAYS; dayIndex += 1) {
    const nextDate = new Date(lastKnownDate);
    nextDate.setDate(lastKnownDate.getDate() + dayIndex);
    const projectedValue = Math.max(
      0,
      Number((recentAverage + dailySlope * dayIndex).toFixed(1))
    );

    projectedAdds += projectedValue;
    points.push({
      date: toDateKey(nextDate),
      actual: null,
      forecast: projectedValue,
    });
  }

  return {
    points,
    projectedAdds: Math.round(projectedAdds),
    projectedDailyAverage: Number(recentAverage.toFixed(1)),
    trendDelta: Number(trendDelta.toFixed(1)),
  };
}

function getForecastOption(points: ForecastPoint[]): EChartsOption {
  return {
    color: ["#10b981", "#f59e0b"],
    tooltip: {
      trigger: "axis",
    },
    legend: {
      top: 0,
      textStyle: {
        color: "#64748b",
        fontSize: 11,
      },
    },
    grid: {
      left: "3%",
      right: "4%",
      bottom: "2%",
      top: 40,
      containLabel: true,
    },
    xAxis: {
      type: "category",
      data: points.map((point) => formatShortDate(point.date)),
      axisLine: {
        show: false,
      },
      axisTick: {
        show: false,
      },
      axisLabel: {
        color: "#94a3b8",
        fontSize: 10,
      },
    },
    yAxis: {
      type: "value",
      axisLine: {
        show: false,
      },
      splitLine: {
        lineStyle: {
          color: "#e2e8f0",
        },
      },
      axisLabel: {
        color: "#94a3b8",
        fontSize: 10,
      },
    },
    series: [
      {
        name: "Actual registrations",
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 3,
          color: "#10b981",
        },
        areaStyle: {
          color: "rgba(16, 185, 129, 0.14)",
        },
        data: points.map((point) => point.actual),
      },
      {
        name: "Forecast",
        type: "line",
        smooth: true,
        showSymbol: false,
        lineStyle: {
          width: 2,
          type: "dashed",
          color: "#f59e0b",
        },
        data: points.map((point) => point.forecast),
      },
    ],
  };
}

function UsersTable({ users }: { users: DbUser[] }) {
  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex size-12 items-center justify-center rounded-full bg-slate-100">
          <Users className="h-6 w-6 text-slate-400" />
        </div>
        <p className="mt-4 text-sm font-medium text-slate-700">
          No users match the current filters
        </p>
        <p className="mt-1 text-xs text-slate-400">
          Try a different search term, clear a filter, or switch tabs.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[320px]">User</TableHead>
          <TableHead>Organization</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Readiness</TableHead>
          <TableHead className="text-right">Joined</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const profileState = getProfileState(user);

          return (
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-start gap-3">
                  <Avatar className="mt-0.5 size-9">
                    <AvatarFallback className="bg-emerald-50 text-xs font-semibold text-emerald-700">
                      {getInitials(user)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-950">
                      {user.salutation ? `${user.salutation} ` : ""}
                      {getDisplayName(user)}
                    </p>
                    <p className="truncate font-mono text-[11px] text-slate-400">
                      {user.email}
                    </p>
                    {user.job_title ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                        <Briefcase className="h-3.5 w-3.5" />
                        {user.job_title}
                      </p>
                    ) : null}
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <div className="min-w-[140px]">
                  <p className="text-sm text-slate-700">
                    {user.organization || "-"}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {user.data_source || "No data source"}
                  </p>
                </div>
              </TableCell>

              <TableCell>
                <Badge
                  variant="outline"
                  className="rounded-full border-slate-200 bg-slate-50 text-[11px] text-slate-700"
                >
                  {user.source || "Unknown"}
                </Badge>
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-1 text-sm text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {user.state || "-"}
                </div>
              </TableCell>

              <TableCell>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={
                      user.onboarding_completed
                        ? "rounded-full border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
                        : "rounded-full border-amber-200 bg-amber-50 text-[11px] text-amber-700"
                    }
                  >
                    {user.onboarding_completed ? "Onboarded" : "Pending"}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={
                      profileState === "complete"
                        ? "rounded-full border-blue-200 bg-blue-50 text-[11px] text-blue-700"
                        : profileState === "partial"
                        ? "rounded-full border-violet-200 bg-violet-50 text-[11px] text-violet-700"
                        : "rounded-full border-slate-200 bg-slate-50 text-[11px] text-slate-600"
                    }
                  >
                    {profileState === "complete"
                      ? "Complete profile"
                      : profileState === "partial"
                      ? "Partial profile"
                      : "Sparse profile"}
                  </Badge>
                </div>
              </TableCell>

              <TableCell className="text-right text-sm text-slate-600">
                {formatDate(user.created_at)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function UsersClient({
  users,
  totalCount,
  dailyRegistrations,
}: UsersClientProps) {
  const [statusTab, setStatusTab] = useState<"all" | "onboarded" | "pending">(
    "all"
  );
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [profileFilter, setProfileFilter] = useState("all");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const sourceOptions = useMemo(() => {
    return Array.from(
      new Set(users.map((user) => user.source).filter(hasText))
    ).sort((left, right) => left.localeCompare(right));
  }, [users]);

  const stateOptions = useMemo(() => {
    return Array.from(
      new Set(users.map((user) => user.state).filter(hasText))
    ).sort((left, right) => left.localeCompare(right));
  }, [users]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      if (statusTab === "onboarded" && !user.onboarding_completed) {
        return false;
      }

      if (statusTab === "pending" && user.onboarding_completed) {
        return false;
      }

      if (sourceFilter !== "all" && user.source !== sourceFilter) {
        return false;
      }

      if (stateFilter !== "all" && user.state !== stateFilter) {
        return false;
      }

      if (profileFilter !== "all" && getProfileState(user) !== profileFilter) {
        return false;
      }

      if (!deferredSearch) {
        return true;
      }

      const haystack = [
        getDisplayName(user),
        user.email,
        user.organization,
        user.job_title,
        user.source,
        user.data_source,
        user.state,
        user.salutation,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [deferredSearch, profileFilter, sourceFilter, stateFilter, statusTab, users]);

  const registrationSeries = useMemo(() => {
    return buildRegistrationSeries(dailyRegistrations, users);
  }, [dailyRegistrations, users]);

  const forecast = useMemo(() => {
    return buildForecast(registrationSeries);
  }, [registrationSeries]);

  const forecastOption = useMemo(() => {
    return getForecastOption(forecast.points);
  }, [forecast.points]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredUsers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredUsers]);

  const filteredCompleteProfiles = filteredUsers.filter(
    (user) => getProfileState(user) === "complete"
  ).length;
  const filteredOnboardedUsers = filteredUsers.filter(
    (user) => user.onboarding_completed
  ).length;
  const topSourceInView = countItems(filteredUsers.map((user) => user.source))[0];
  const topStateInView = countItems(filteredUsers.map((user) => user.state))[0];
  const showingFrom =
    filteredUsers.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, filteredUsers.length);

  function resetPagination() {
    setPage(1);
  }

  function clearFilters() {
    setStatusTab("all");
    setSearch("");
    setSourceFilter("all");
    setStateFilter("all");
    setProfileFilter("all");
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
        <Card className="border-slate-200">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div className="space-y-2">
              <Badge
                variant="outline"
                className="w-fit rounded-full border-emerald-200 bg-emerald-50 text-emerald-700"
              >
                Estimated forecast
              </Badge>
              <div>
                <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                  Registration trend and short-range projection
                </CardTitle>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  The dashed line estimates the next {FORECAST_DAYS} days of
                  registrations from the recent daily trend. Treat it as an
                  operational signal, not a hard forecast.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                Projected adds
              </p>
              <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                {formatNumber(forecast.projectedAdds)}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            {forecast.points.length > 0 ? (
              <div className="h-[300px] w-full">
                <ReactECharts
                  option={forecastOption}
                  style={{ height: "100%", width: "100%" }}
                  notMerge
                />
              </div>
            ) : (
              <div className="flex h-[300px] items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 text-sm text-slate-500">
                Registration history is not available yet, so the forecast
                cannot be estimated.
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Card className="border-slate-200 bg-white">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Users in view
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                    {formatNumber(filteredUsers.length)}
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-500">
                {formatNumber(filteredOnboardedUsers)} onboarded and{" "}
                {formatNumber(filteredCompleteProfiles)} with complete profiles
                inside the current filtered slice.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white">
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-blue-50 p-3 text-blue-700">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Recent pace
                  </p>
                  <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                    {forecast.projectedDailyAverage.toFixed(1)}/day
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-500">
                The recent daily average is{" "}
                {forecast.trendDelta >= 0 ? "ahead of" : "below"} the previous
                two-week baseline by {Math.abs(forecast.trendDelta).toFixed(1)}{" "}
                users per day.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 bg-white sm:col-span-2 xl:col-span-1">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-violet-50 p-3 text-violet-700">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Leading segments in view
                  </p>
                  <p className="mt-1 text-base font-semibold tracking-tight text-slate-950">
                    Filter-aware breakdown
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-medium text-slate-500">Top source</p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                  {topSourceInView?.label ?? "No source signal"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {topSourceInView
                    ? `${formatNumber(topSourceInView.count)} users in the current view`
                    : "Apply broader filters to reveal a source leader."}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-medium text-slate-500">Top state</p>
                <p className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
                  {topStateInView?.label ?? "No geography signal"}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {topStateInView
                    ? `${formatNumber(topStateInView.count)} users in the current view`
                    : "State concentration appears once records include geography."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs
        value={statusTab}
        onValueChange={(value) => {
          setStatusTab(value as "all" | "onboarded" | "pending");
          resetPagination();
        }}
        className="w-full"
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-3">
              <TabsList>
                <TabsTrigger value="all">
                  All ({formatNumber(users.length)})
                </TabsTrigger>
                <TabsTrigger value="onboarded">
                  Onboarded (
                  {formatNumber(
                    users.filter((user) => user.onboarding_completed).length
                  )}
                  )
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Pending (
                  {formatNumber(
                    users.filter((user) => !user.onboarding_completed).length
                  )}
                  )
                </TabsTrigger>
              </TabsList>
              <p className="text-sm text-slate-500">
                Search by name, email, organization, title, source, or state.
                Filters and pagination run against the live database-backed user
                directory.
              </p>
            </div>

            <div className="flex flex-col gap-3 xl:min-w-[760px] xl:flex-row">
              <div className="relative xl:flex-[1.45]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    resetPagination();
                  }}
                  placeholder="Search name, email, company, source..."
                  className="h-10 pl-9"
                />
              </div>

              <select
                value={sourceFilter}
                onChange={(event) => {
                  setSourceFilter(event.target.value);
                  resetPagination();
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500"
              >
                <option value="all">All sources</option>
                {sourceOptions.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>

              <select
                value={stateFilter}
                onChange={(event) => {
                  setStateFilter(event.target.value);
                  resetPagination();
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500"
              >
                <option value="all">All states</option>
                {stateOptions.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>

              <select
                value={profileFilter}
                onChange={(event) => {
                  setProfileFilter(event.target.value);
                  resetPagination();
                }}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-emerald-500"
              >
                <option value="all">All profiles</option>
                <option value="complete">Complete</option>
                <option value="partial">Partial</option>
                <option value="empty">Sparse</option>
              </select>

              <Button
                type="button"
                variant="outline"
                onClick={clearFilters}
                className="h-10 gap-2"
              >
                <FilterX className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>

          <div className="rounded-xl border bg-white">
            <TabsContent value="all" className="mt-0">
              <UsersTable users={paginatedUsers} />
            </TabsContent>
            <TabsContent value="onboarded" className="mt-0">
              <UsersTable users={paginatedUsers} />
            </TabsContent>
            <TabsContent value="pending" className="mt-0">
              <UsersTable users={paginatedUsers} />
            </TabsContent>

            <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1 text-sm text-slate-500">
                <p>
                  Showing {formatNumber(showingFrom)} to{" "}
                  {formatNumber(showingTo)} of{" "}
                  {formatNumber(filteredUsers.length)} matching users
                </p>
                <p>
                  Page {formatNumber(currentPage)} of {formatNumber(pageCount)}{" "}
                  with {PAGE_SIZE} users per page
                  {totalCount > users.length
                    ? ` (${formatNumber(totalCount)} total records in platform)`
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
                  onClick={() =>
                    setPage((current) => Math.min(pageCount, current + 1))
                  }
                  disabled={currentPage === pageCount}
                  className="gap-1"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
}
