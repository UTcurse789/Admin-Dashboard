"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Megaphone, ExternalLink, Calendar, Eye, ArrowRight,
  LayoutGrid, CheckCircle, PauseCircle, XCircle, ImageIcon,
} from "lucide-react";
import type { AdsListData, NormalizedAd } from "@/lib/ads";

/* ── helpers ─────────────────────────────────────────────────────── */
function statusBadge(s: NormalizedAd["status"]) {
  const map = {
    Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Paused: "bg-amber-50 text-amber-700 border-amber-200",
    Ended: "bg-slate-100 text-slate-500 border-slate-200",
  };
  return map[s];
}

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysRemaining(endDate: string | null): string {
  if (!endDate) return "No end date";
  const diff = Math.ceil(
    (new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (diff < 0) return "Ended";
  if (diff === 0) return "Ends today";
  return `${diff}d remaining`;
}

/* ═══════════════════════════════════════════════════════════════════
   LISTING COMPONENT — Shows all ads as clickable cards
   ═══════════════════════════════════════════════════════════════════ */
export function AdsListClient({ data }: { data: AdsListData }) {
  const [filterPlacement, setFilterPlacement] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    let result = data.ads;
    if (filterPlacement !== "all")
      result = result.filter((a) => a.placement === filterPlacement);
    if (filterStatus !== "all")
      result = result.filter((a) => a.status === filterStatus);
    return result;
  }, [data.ads, filterPlacement, filterStatus]);

  /* ── placement distribution pie ─────────────────────────────── */
  const placementPie = useMemo(
    (): EChartsOption => ({
      tooltip: { trigger: "item", formatter: "{b}: {c} ({d}%)" },
      color: [
        "#1d4ed8", "#10b981", "#8b5cf6", "#f59e0b", "#f43f5e",
        "#06b6d4", "#84cc16", "#ec4899", "#14b8a6", "#a855f7", "#f97316",
      ],
      legend: {
        bottom: 0,
        icon: "circle",
        itemWidth: 7,
        textStyle: { fontSize: 10, color: "#6b7280" },
        type: "scroll",
      },
      series: [
        {
          type: "pie",
          radius: ["38%", "68%"],
          center: ["50%", "42%"],
          data: data.placementCounts.map((p) => ({
            name: p.label,
            value: p.count,
          })),
          label: { show: false },
          emphasis: {
            scale: true,
            scaleSize: 6,
            label: { show: true, fontWeight: "bold", fontSize: 11 },
          },
        },
      ],
    }),
    [data.placementCounts]
  );

  return (
    <div className="mx-auto max-w-[1500px] space-y-8 pb-8">
      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="overflow-hidden rounded-[36px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_26%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-6 shadow-sm sm:p-8">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-blue-700">
            <Megaphone className="h-3.5 w-3.5" /> Advertising
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
            All Advertisements
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
            All live ads fetched from Strapi CMS. Click on any ad to see
            detailed insights — impressions, clicks, area-wise distribution,
            device breakdown, and more.
          </p>
        </div>
      </section>

      {/* ── SUMMARY CARDS ───────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="border border-slate-200 border-l-4 border-l-blue-500 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Total Ads
            </CardTitle>
            <div className="rounded-2xl bg-slate-50 p-2">
              <LayoutGrid className="h-4 w-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-semibold tracking-tight text-slate-950">
              {data.totalAds}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              From Strapi CMS
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 border-l-4 border-l-emerald-500 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Active
            </CardTitle>
            <div className="rounded-2xl bg-slate-50 p-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-semibold tracking-tight text-emerald-700">
              {data.activeCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">Currently running</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 border-l-4 border-l-amber-500 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Paused
            </CardTitle>
            <div className="rounded-2xl bg-slate-50 p-2">
              <PauseCircle className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-semibold tracking-tight text-amber-700">
              {data.pausedCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">Temporarily paused</p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200 border-l-4 border-l-slate-400 bg-white shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Ended
            </CardTitle>
            <div className="rounded-2xl bg-slate-50 p-2">
              <XCircle className="h-4 w-4 text-slate-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-3xl font-semibold tracking-tight text-slate-600">
              {data.endedCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">Past end date</p>
          </CardContent>
        </Card>
      </section>

      {/* ── PLACEMENT DISTRIBUTION + FILTERS ────────────────────── */}
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        {/* Filters & count */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterPlacement}
              onChange={(e) => setFilterPlacement(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Placements</option>
              {data.placements.map((p) => (
                <option key={p} value={p}>
                  {p.replace(/_/g, " ")}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Paused">Paused</option>
              <option value="Ended">Ended</option>
            </select>
            <span className="text-sm text-slate-500">
              Showing {filtered.length} of {data.totalAds}
            </span>
          </div>

          {/* ── ADS GRID ──────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((ad) => (
              <Link key={ad.documentId} href={`/ads/${ad.documentId}`}>
                <Card className="group cursor-pointer border border-slate-200 bg-white shadow-sm transition-all hover:border-blue-300 hover:shadow-md">
                  {/* Creative preview */}
                  <div className="relative h-40 overflow-hidden rounded-t-xl bg-slate-50">
                    {ad.creativeUrl ? (
                      <Image
                        src={ad.creativeUrl}
                        alt={ad.title}
                        fill
                        className="object-contain p-3 transition-transform group-hover:scale-105"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <ImageIcon className="h-10 w-10 text-slate-200" />
                      </div>
                    )}
                    <Badge
                      variant="outline"
                      className={`absolute right-3 top-3 border ${statusBadge(ad.status)}`}
                    >
                      {ad.status}
                    </Badge>
                  </div>

                  <CardContent className="space-y-3 p-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm leading-tight group-hover:text-blue-700 transition-colors">
                        {ad.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {ad.companyName}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700 text-[10px]"
                      >
                        {ad.placementLabel}
                      </Badge>
                      {ad.sectors.map((s) => (
                        <Badge
                          key={s}
                          variant="outline"
                          className="border-slate-200 text-slate-500 text-[10px]"
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {formatDate(ad.startDate)} → {formatDate(ad.endDate)}
                        </span>
                      </div>
                      <span
                        className={`font-medium ${
                          ad.status === "Active"
                            ? "text-emerald-600"
                            : ad.status === "Ended"
                            ? "text-slate-400"
                            : "text-amber-600"
                        }`}
                      >
                        {daysRemaining(ad.endDate)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                      {ad.targetUrl ? (
                        <span className="flex items-center gap-1 text-xs text-blue-600 truncate max-w-[200px]">
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          {new URL(ad.targetUrl).hostname}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No URL</span>
                      )}
                      <span className="flex items-center gap-1 text-xs font-medium text-blue-600 group-hover:text-blue-800 transition-colors">
                        View Insights
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {filtered.length === 0 && (
            <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
              No ads match the current filters.
            </div>
          )}
        </div>

        {/* Placement distribution chart */}
        <Card className="h-fit border border-slate-200 bg-white shadow-sm">
          <CardHeader className="space-y-1 pb-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-blue-600" />
              <CardTitle className="text-lg font-semibold tracking-tight text-slate-950">
                Placement Distribution
              </CardTitle>
            </div>
            <p className="text-sm text-slate-500">
              Where ads are placed across the site
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ReactECharts
                option={placementPie}
                style={{ height: "100%", width: "100%" }}
                notMerge
              />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
