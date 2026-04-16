"use client";

import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  FileText,
  CheckCircle,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  X,
  Filter,
} from "lucide-react";

interface NormalisedArticle {
  id: number;
  title: string;
  slug: string;
  publishedAt: string | null;
  Date: string | null;
  author: string;
  category: string;
  sectors: string[];
  status: "published" | "draft";
}

const ITEMS_PER_PAGE = 50;
const SITE_URL = "https://energdive.com";

function getTypeBadgeColor(type: string): string {
  switch (type.toLowerCase()) {
    case "news":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "article":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "analysis":
      return "bg-violet-50 text-violet-700 border-violet-200";
    case "editorial":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "opinion":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "interview":
      return "bg-cyan-50 text-cyan-700 border-cyan-200";
    case "feature":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    case "cover-story":
      return "bg-pink-50 text-pink-700 border-pink-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function SectorsCell({ sectors }: { sectors: string[] }) {
  if (!sectors || sectors.length === 0)
    return <span className="text-gray-400">—</span>;
  if (sectors.length === 1) {
    return <span className="text-gray-600 text-sm">{sectors[0]}</span>;
  }
  return (
    <span className="text-gray-600 text-sm">
      {sectors[0]}{" "}
      <span className="text-gray-400 text-xs">+{sectors.length - 1} more</span>
    </span>
  );
}

export default function ContentDashboard({
  articles,
  totalArticles,
  fetchError,
}: {
  articles: NormalisedArticle[];
  totalArticles: number;
  fetchError: boolean;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"all" | "published" | "drafts">(
    "all"
  );
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedSector, setSelectedSector] = useState<string>("all");

  // Derive unique types and sectors for filter dropdowns
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    articles.forEach((a) => {
      if (a.category && a.category !== "Uncategorized") types.add(a.category);
    });
    return Array.from(types).sort();
  }, [articles]);

  const allSectors = useMemo(() => {
    const sectors = new Set<string>();
    articles.forEach((a) => {
      a.sectors.forEach((s) => sectors.add(s));
    });
    return Array.from(sectors).sort();
  }, [articles]);

  // Apply all filters
  const filteredArticles = useMemo(() => {
    let filtered = articles;

    // Tab filter
    if (activeTab === "published") {
      filtered = filtered.filter((a) => a.status === "published");
    } else if (activeTab === "drafts") {
      filtered = filtered.filter((a) => a.status === "draft");
    }

    // Type filter
    if (selectedType !== "all") {
      filtered = filtered.filter((a) => a.category === selectedType);
    }

    // Sector filter
    if (selectedSector !== "all") {
      filtered = filtered.filter((a) => a.sectors.includes(selectedSector));
    }

    return filtered;
  }, [articles, activeTab, selectedType, selectedSector]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredArticles.length / ITEMS_PER_PAGE));
  const paginatedArticles = filteredArticles.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  const handleTabChange = (tab: "all" | "published" | "drafts") => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  const handleTypeChange = (type: string) => {
    setSelectedType(type);
    setCurrentPage(1);
  };

  const handleSectorChange = (sector: string) => {
    setSelectedSector(sector);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSelectedType("all");
    setSelectedSector("all");
    setCurrentPage(1);
  };

  const hasActiveFilters = selectedType !== "all" || selectedSector !== "all";

  // Stats
  const published = articles.filter((a) => a.status === "published").length;
  const drafts = articles.filter((a) => a.status === "draft").length;
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const publishedThisMonth = articles.filter(
    (a) => a.publishedAt && new Date(a.publishedAt) >= startOfMonth
  ).length;

  const stats = [
    {
      label: "Total Articles",
      value: totalArticles,
      icon: FileText,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Published",
      value: published,
      icon: CheckCircle,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Drafts",
      value: drafts,
      icon: Clock,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "Published This Month",
      value: publishedThisMonth,
      icon: Calendar,
      color: "text-orange-600 bg-orange-50",
    },
  ];

  // Build article URL
  function getArticleUrl(article: NormalisedArticle): string {
    const typeSlug = article.category?.toLowerCase().replace(/\s+/g, "-") || "news";
    return `${SITE_URL}/${typeSlug}/${article.slug}`;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Content Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Articles synced from Strapi CMS.
          </p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.label}
              className="transition-shadow duration-200 hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">
                  {stat.label}
                </CardTitle>
                <div
                  className={`flex size-8 items-center justify-center rounded-lg ${stat.color}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Error state */}
      {fetchError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 text-center">
            <p className="text-sm font-medium text-red-700">
              Failed to connect to Strapi CMS
            </p>
            <p className="mt-1 text-xs text-red-500">
              Check that STRAPI_URL and STRAPI_ADMIN_TOKEN are configured
              correctly.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Tabs + Filters */}
      <div className="space-y-4">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-lg border border-gray-200 bg-gray-50/80 p-1">
            {(
              [
                { key: "all", label: `All (${articles.length})` },
                { key: "published", label: `Published (${published})` },
                { key: "drafts", label: `Drafts (${drafts})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                  activeTab === tab.key
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-500">
            <Filter className="h-4 w-4" />
            <span className="font-medium">Filters:</span>
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm transition-all hover:border-gray-300 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-200"
          >
            <option value="all">All Types</option>
            {allTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          {/* Sector Filter */}
          <select
            value={selectedSector}
            onChange={(e) => handleSectorChange(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 shadow-sm transition-all hover:border-gray-300 focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-200"
          >
            <option value="all">All Sectors</option>
            {allSectors.map((sector) => (
              <option key={sector} value={sector}>
                {sector}
              </option>
            ))}
          </select>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-gray-100 hover:text-gray-800"
            >
              <X className="h-3 w-3" />
              Clear filters
            </button>
          )}

          {/* Result count */}
          <span className="ml-auto text-sm text-gray-400">
            {filteredArticles.length} result{filteredArticles.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {paginatedArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="flex size-12 items-center justify-center rounded-full bg-gray-100">
                <FileText className="h-6 w-6 text-gray-400" />
              </div>
              <p className="mt-4 text-sm font-medium text-gray-700">
                No content found
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {hasActiveFilters
                  ? "Try adjusting your filters."
                  : "Articles will appear here once published in Strapi."}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[300px]">Title</TableHead>
                  <TableHead>Author</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Sectors</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedArticles.map((article) => {
                  const truncatedTitle =
                    article.title.length > 50
                      ? article.title.substring(0, 50) + "…"
                      : article.title;
                  const authorInitial = article.author
                    .charAt(0)
                    .toUpperCase();
                  const articleUrl = getArticleUrl(article);

                  return (
                    <TableRow
                      key={article.id}
                      className="group cursor-pointer transition-colors hover:bg-gray-50/80"
                      onClick={() =>
                        window.open(articleUrl, "_blank", "noopener")
                      }
                    >
                      {/* Title */}
                      <TableCell>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-900 truncate max-w-[280px] group-hover:text-blue-700 transition-colors">
                              {truncatedTitle}
                            </p>
                            <ExternalLink className="h-3 w-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          </div>
                          <p className="text-xs text-gray-400 truncate max-w-[300px]">
                            /{article.slug}
                          </p>
                        </div>
                      </TableCell>

                      {/* Author */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="size-6">
                            <AvatarFallback className="text-[10px] bg-gray-100 text-gray-600 font-semibold">
                              {authorInitial}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-gray-600 truncate max-w-[120px]">
                            {article.author}
                          </span>
                        </div>
                      </TableCell>

                      {/* Type */}
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`rounded-full text-[11px] font-medium ${getTypeBadgeColor(
                            article.category
                          )}`}
                        >
                          {article.category}
                        </Badge>
                      </TableCell>

                      {/* Sectors */}
                      <TableCell>
                        <SectorsCell sectors={article.sectors} />
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        {article.status === "published" ? (
                          <Badge
                            variant="outline"
                            className="rounded-full bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] gap-1"
                          >
                            <span className="size-1.5 rounded-full bg-emerald-500" />
                            Published
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-full bg-yellow-50 text-yellow-700 border-yellow-200 text-[11px] gap-1"
                          >
                            <span className="size-1.5 rounded-full bg-yellow-500" />
                            Draft
                          </Badge>
                        )}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="text-right text-gray-600">
                        {article.Date
                          ? new Date(article.Date).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              }
                            )
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>

        {/* Pagination Footer */}
        {filteredArticles.length > 0 && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <p className="text-sm text-gray-500">
              Showing{" "}
              <span className="font-medium text-gray-700">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              </span>
              –
              <span className="font-medium text-gray-700">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredArticles.length)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-gray-700">
                {filteredArticles.length}
              </span>{" "}
              articles
            </p>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 gap-1 text-sm"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>

              {/* Page numbers */}
              <div className="hidden items-center gap-1 sm:flex">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    // Show first, last, current, and neighbors
                    if (p === 1 || p === totalPages) return true;
                    if (Math.abs(p - currentPage) <= 1) return true;
                    return false;
                  })
                  .reduce<(number | "ellipsis")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                      acc.push("ellipsis");
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "ellipsis" ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="px-1 text-gray-400"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setCurrentPage(item as number)}
                        className={`flex h-8 min-w-[32px] items-center justify-center rounded-md text-sm font-medium transition-all ${
                          currentPage === item
                            ? "bg-gray-900 text-white shadow-sm"
                            : "text-gray-600 hover:bg-gray-100"
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
              </div>

              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                className="h-8 gap-1 text-sm"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
