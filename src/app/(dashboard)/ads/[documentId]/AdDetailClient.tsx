"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Calendar, ExternalLink, Eye, MousePointerClick,
  Percent, MapPin, Monitor, Smartphone, Tablet, ImageIcon,
  Globe, BarChart3, Clock,
} from "lucide-react";
import type { NormalizedAd } from "@/lib/ads";
import type { AdStats } from "@/lib/ad-tracking";

/* ── helpers ─────────────────────────────────────────────────────── */
function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function statusBadge(s: NormalizedAd["status"]) {
  const map = {
    Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Paused: "bg-amber-50 text-amber-700 border-amber-200",
    Ended: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return map[s];
}

function campaignDuration(start: string | null, end: string | null): string {
  if (!start) return "—";
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const days = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
  return `${days} days`;
}

function daysRemaining(endDate: string | null): string {
  if (!endDate) return "No end date";
  const diff = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "Ended";
  if (diff === 0) return "Ends today";
  return `${diff} days remaining`;
}

/* ── Empty state placeholder ─────────────────────────────────────── */
function EmptyChart({ icon: Icon, title, subtitle }: {
  icon: React.ElementType; title: string; subtitle: string;
}) {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
      <div className="rounded-2xl bg-slate-100 p-3">
        <Icon className="h-6 w-6 text-slate-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-600">{title}</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-slate-400">{subtitle}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   AD DETAIL COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export function AdDetailClient({ ad }: { ad: NormalizedAd }) {
  /* ── Fetch real tracking stats ──────────────────────────────── */
  const [stats, setStats] = useState<AdStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/ads/${ad.documentId}/stats`);
      if (res.ok) {
        const data: AdStats = await res.json();
        setStats(data);
      }
    } catch (e) {
      console.error("Failed to fetch ad stats:", e);
    } finally {
      setLoading(false);
    }
  }, [ad.documentId]);

  useEffect(() => {
    fetchStats();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStats, 60_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const hasTrackingData = (stats?.impressions ?? 0) > 0 || (stats?.clicks ?? 0) > 0;

  const fmtNum = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);


  /* ── Area-wise clicks chart ─────────────────────────────────── */
  const areaChartOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    color: ["#1d4ed8", "#10b981", "#f59e0b", "#8b5cf6", "#f43f5e", "#06b6d4", "#84cc16"],
    legend: {
      bottom: 0, icon: "circle", itemWidth: 7,
      textStyle: { fontSize: 10, color: "#6b7280" }, type: "scroll",
    },
    series: [{
      type: "pie", radius: ["36%", "66%"], center: ["50%", "42%"],
      data: stats?.regionBreakdown ?? [],
      label: { show: false },
      emphasis: { scale: true, scaleSize: 6, label: { show: true, fontWeight: "bold", fontSize: 11 } },
    }],
  }), [stats?.regionBreakdown]);

  /* ── Device breakdown chart ─────────────────────────────────── */
  const deviceChartOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
    color: ["#3b82f6", "#8b5cf6", "#f59e0b"],
    legend: {
      bottom: 0, icon: "circle", itemWidth: 8,
      textStyle: { fontSize: 11, color: "#6b7280" },
    },
    series: [{
      type: "pie", radius: ["40%", "70%"], center: ["50%", "44%"],
      data: stats?.deviceBreakdown ?? [],
      label: { show: false },
      emphasis: { scale: true, scaleSize: 6, label: { show: true, fontWeight: "bold" } },
    }],
  }), [stats?.deviceBreakdown]);

  /* ── Daily performance chart ────────────────────────────────── */
  const daily = stats?.dailyPerformance ?? [];
  const dailyChartOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    color: ["#1d4ed8", "#10b981"],
    grid: { left: "3%", right: "4%", bottom: "4%", top: "12%", containLabel: true },
    legend: {
      top: 0, icon: "circle", itemWidth: 8,
      textStyle: { fontSize: 11, color: "#6b7280" },
    },
    xAxis: {
      type: "category",
      data: daily.map((d) => d.date.slice(5)),
      axisLabel: { color: "#94a3b8", fontSize: 11 },
      axisLine: { show: false }, axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      splitLine: { lineStyle: { color: "#f1f5f9" } },
      axisLabel: { color: "#94a3b8", fontSize: 10 },
      axisLine: { show: false },
    },
    series: [
      { name: "Impressions", type: "bar", data: daily.map((d) => d.impressions), itemStyle: { color: "#1d4ed8", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 28 },
      { name: "Clicks", type: "bar", data: daily.map((d) => d.clicks), itemStyle: { color: "#10b981", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 28 },
    ],
  }), [daily]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-8 pb-8">
      {/* ── BACK NAV ────────────────────────────────────────────── */}
      <Link
        href="/ads"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" /> Back to all ads
      </Link>

      {/* ── HERO CARD ───────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-sm">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_400px]">
          {/* Left info */}
          <div className="space-y-5 p-6 sm:p-8">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={`border ${statusBadge(ad.status)}`}>
                {ad.status}
              </Badge>
              <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]">
                {ad.placementLabel}
              </Badge>
              {ad.sectors.map((s) => (
                <Badge key={s} variant="outline" className="border-slate-200 text-slate-500 text-[10px]">
                  {s}
                </Badge>
              ))}
            </div>

            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
                {ad.title}
              </h1>
              <p className="mt-1 text-sm text-slate-500">{ad.companyName}</p>
            </div>

            {/* Meta grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-[20px] border border-slate-200 bg-white/80 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <Calendar className="h-3 w-3" /> Start Date
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-950">{formatDate(ad.startDate)}</p>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-white/80 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <Calendar className="h-3 w-3" /> End Date
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-950">{formatDate(ad.endDate)}</p>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-white/80 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <Clock className="h-3 w-3" /> Duration
                </div>
                <p className="mt-2 text-lg font-semibold text-slate-950">{campaignDuration(ad.startDate, ad.endDate)}</p>
              </div>
              <div className="rounded-[20px] border border-slate-200 bg-white/80 p-4">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  <Clock className="h-3 w-3" /> Remaining
                </div>
                <p className={`mt-2 text-lg font-semibold ${ad.status === "Active" ? "text-emerald-700" : "text-slate-500"}`}>
                  {daysRemaining(ad.endDate)}
                </p>
              </div>
            </div>

            {ad.targetUrl && (
              <a
                href={ad.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {new URL(ad.targetUrl).hostname}
              </a>
            )}
          </div>

          {/* Right — creative preview */}
          <div className="flex items-center justify-center border-l border-slate-100 bg-slate-50/50 p-6">
            {ad.creativeUrl ? (
              <div className="relative w-full max-w-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <Image
                  src={ad.creativeUrl}
                  alt={ad.title}
                  width={ad.creativeWidth || 300}
                  height={ad.creativeHeight || 250}
                  className="w-full object-contain"
                  unoptimized
                />
                {ad.creativeWidth && ad.creativeHeight && (
                  <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-center text-[10px] font-medium text-slate-400">
                    {ad.creativeWidth} × {ad.creativeHeight}px
                  </p>
                )}
              </div>
            ) : (
              <div className="flex h-48 w-full max-w-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white">
                <ImageIcon className="h-12 w-12 text-slate-200" />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── KPI CARDS ──────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Impressions", value: loading ? "…" : fmtNum(stats?.impressions ?? 0), icon: Eye, border: "border-l-blue-500", iconColor: "text-blue-600", hint: hasTrackingData ? "Total ad views" : "No data yet" },
          { label: "Clicks", value: loading ? "…" : fmtNum(stats?.clicks ?? 0), icon: MousePointerClick, border: "border-l-emerald-500", iconColor: "text-emerald-600", hint: hasTrackingData ? "Total ad clicks" : "No data yet" },
          { label: "CTR", value: loading ? "…" : `${(stats?.ctr ?? 0).toFixed(2)}%`, icon: Percent, border: "border-l-violet-500", iconColor: "text-violet-600", hint: "clicks / impressions × 100" },
          { label: "Unique Visitors", value: loading ? "…" : fmtNum(stats?.uniqueVisitors ?? 0), icon: Globe, border: "border-l-amber-500", iconColor: "text-amber-600", hint: hasTrackingData ? "Distinct IPs" : "No data yet" },
        ].map((kpi) => (
          <Card key={kpi.label} className={`border border-slate-200 border-l-4 ${kpi.border} bg-white shadow-sm`}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{kpi.label}</CardTitle>
              <div className="rounded-2xl bg-slate-50 p-2">
                <kpi.icon className={`h-4 w-4 ${kpi.iconColor}`} />
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-3xl font-semibold tracking-tight text-slate-950">{kpi.value}</p>
              <p className="mt-1 text-xs text-slate-400">{kpi.hint}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      {/* ── DAILY PERFORMANCE CHART ─────────────────────────────── */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="space-y-1 pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-600" />
            <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
              Daily Performance
            </CardTitle>
          </div>
          <p className="text-sm text-slate-500">Impressions and clicks over the last 30 days</p>
        </CardHeader>
        <CardContent>
          {hasTrackingData ? (
            <div className="h-[320px]">
              <ReactECharts option={dailyChartOption} style={{ height: "100%", width: "100%" }} notMerge />
            </div>
          ) : (
            <EmptyChart
              icon={BarChart3}
              title="No performance data yet"
              subtitle="Impression and click tracking needs to be configured. Once a tracking pixel or beacon is added to the ad placements, daily performance data will appear here."
            />
          )}
        </CardContent>
      </Card>

      {/* ── AREA-WISE + DEVICE CHARTS ──────────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-2">
        {/* Area-wise clicks */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-rose-500" />
              <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                Clicks by Region
              </CardTitle>
            </div>
            <p className="text-sm text-slate-500">Geographic distribution of ad clicks</p>
          </CardHeader>
          <CardContent>
            {hasTrackingData ? (
              <div className="h-[320px]">
                <ReactECharts option={areaChartOption} style={{ height: "100%", width: "100%" }} notMerge />
              </div>
            ) : (
              <EmptyChart
                icon={MapPin}
                title="No geographic data yet"
                subtitle="Region-level click tracking needs to be wired up. This chart will show a breakdown of clicks by state/city once geo-IP data is captured via ad click events."
              />
            )}
          </CardContent>
        </Card>

        {/* Device breakdown */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-violet-500" />
              <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                Device Breakdown
              </CardTitle>
            </div>
            <p className="text-sm text-slate-500">Desktop vs Mobile vs Tablet</p>
          </CardHeader>
          <CardContent>
            {hasTrackingData ? (
              <div className="h-[320px]">
                <ReactECharts option={deviceChartOption} style={{ height: "100%", width: "100%" }} notMerge />
              </div>
            ) : (
              <EmptyChart
                icon={Smartphone}
                title="No device data yet"
                subtitle="Device detection requires a tracking pixel that captures the user-agent on impression/click events. Once configured, Desktop, Mobile, and Tablet breakdown will display here."
              />
            )}
          </CardContent>
        </Card>
      </section>

      {/* ── AD METADATA TABLE ──────────────────────────────────── */}
      <Card className="border border-slate-200 bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
            Ad Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {[
              { label: "Strapi ID", value: `#${ad.id}` },
              { label: "Document ID", value: ad.documentId },
              { label: "Placement", value: ad.placementLabel },
              { label: "Placement Key", value: ad.placement },
              { label: "Partner Name", value: ad.companyName },
              { label: "Target URL", value: ad.targetUrl || "—" },
              { label: "Sectors", value: ad.sectors.length ? ad.sectors.join(", ") : "None" },
              { label: "Created", value: formatDate(ad.createdAt) },
              { label: "Last Updated", value: formatDate(ad.updatedAt) },
              { label: "Creative Size", value: ad.creativeWidth && ad.creativeHeight ? `${ad.creativeWidth}×${ad.creativeHeight}px` : "—" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-6 py-3">
                <span className="text-sm text-slate-500">{row.label}</span>
                <span className="max-w-[400px] truncate text-right text-sm font-medium text-slate-800">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
