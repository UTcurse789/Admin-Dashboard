"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { NormalizedStrapiArticle } from "@/lib/strapi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, ChevronLeft, ChevronRight, FilterX, FileText } from "lucide-react";

type ContentArticle = NormalizedStrapiArticle;

const PAGE_SIZE = 25;

function formatDate(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNumber(value: number) {
  return value.toLocaleString("en-IN");
}

function splitMultiValueField(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getTypeBadgeColor(type: string) {
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
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function SectorsCell({ sectors }: { sectors: string }) {
  if (!sectors) {
    return <span className="text-gray-400">-</span>;
  }

  const items = splitMultiValueField(sectors);

  if (items.length <= 1) {
    return <span className="text-sm text-gray-600">{items[0]}</span>;
  }

  return (
    <span className="text-sm text-gray-600">
      {items[0]}{" "}
      <span className="text-xs text-gray-400">+{items.length - 1} more</span>
    </span>
  );
}

function ArticlesTable({ articles }: { articles: ContentArticle[] }) {
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex size-12 items-center justify-center rounded-full bg-gray-100">
          <FileText className="h-6 w-6 text-gray-400" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-700">
          No articles match the current filters
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Try a different search term or clear one of the active filters.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[320px]">Title</TableHead>
          <TableHead>Author</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Sectors</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {articles.map((article) => {
          const authorInitial = article.author?.charAt(0).toUpperCase() || "?";

          return (
            <TableRow key={article.id}>
              <TableCell>
                <div className="min-w-0">
                  <p className="max-w-[320px] truncate font-medium text-gray-900">
                    {article.title}
                  </p>
                  <p className="max-w-[320px] truncate text-xs text-gray-400">
                    /{article.slug}
                  </p>
                </div>
              </TableCell>

              <TableCell>
                <div className="flex items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarFallback className="bg-gray-100 text-[10px] font-semibold text-gray-600">
                      {authorInitial}
                    </AvatarFallback>
                  </Avatar>
                  <span className="max-w-[140px] truncate text-sm text-gray-600">
                    {article.author || "Unknown"}
                  </span>
                </div>
              </TableCell>

              <TableCell>
                <Badge
                  variant="outline"
                  className={`rounded-full text-[11px] font-medium ${getTypeBadgeColor(article.category)}`}
                >
                  {article.category}
                </Badge>
              </TableCell>

              <TableCell>
                <SectorsCell sectors={article.sectors} />
              </TableCell>

              <TableCell>
                {article.status === "published" ? (
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-full border-emerald-200 bg-emerald-50 text-[11px] text-emerald-700"
                  >
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Published
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="gap-1 rounded-full border-yellow-200 bg-yellow-50 text-[11px] text-yellow-700"
                  >
                    <span className="size-1.5 rounded-full bg-yellow-500" />
                    Draft
                  </Badge>
                )}
              </TableCell>

              <TableCell className="text-right text-gray-600">
                {formatDate(article.date ?? article.publishedAt)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function ContentTableClient({ articles }: { articles: ContentArticle[] }) {
  const [statusTab, setStatusTab] = useState<"all" | "published" | "drafts">("all");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [page, setPage] = useState(1);
  const deferredSearch = useDeferredValue(search.trim().toLowerCase());

  const categories = useMemo(() => {
    return Array.from(
      new Set(
        articles
          .map((article) => article.category)
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [articles]);

  const authors = useMemo(() => {
    return Array.from(
      new Set(
        articles
          .map((article) => article.author)
          .filter((author): author is string => Boolean(author && author !== "Unknown"))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [articles]);

  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      if (statusTab === "published" && article.status !== "published") {
        return false;
      }

      if (statusTab === "drafts" && article.status !== "draft") {
        return false;
      }

      if (categoryFilter !== "all" && article.category !== categoryFilter) {
        return false;
      }

      if (authorFilter !== "all" && article.author !== authorFilter) {
        return false;
      }

      if (!deferredSearch) {
        return true;
      }

      const haystack = [
        article.title,
        article.slug,
        article.author,
        article.category,
        article.sectors,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredSearch);
    });
  }, [articles, authorFilter, categoryFilter, deferredSearch, statusTab]);

  const pageCount = Math.max(1, Math.ceil(filteredArticles.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedArticles = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredArticles.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredArticles]);

  const showingFrom = filteredArticles.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(currentPage * PAGE_SIZE, filteredArticles.length);

  function resetPagination() {
    setPage(1);
  }

  function clearFilters() {
    setSearch("");
    setCategoryFilter("all");
    setAuthorFilter("all");
    setStatusTab("all");
    setPage(1);
  }

  return (
    <Tabs
      value={statusTab}
      onValueChange={(value) => {
        setStatusTab(value as "all" | "published" | "drafts");
        resetPagination();
      }}
      className="w-full"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <TabsList>
              <TabsTrigger value="all">All ({formatNumber(articles.length)})</TabsTrigger>
              <TabsTrigger value="published">
                Published ({formatNumber(articles.filter((article) => article.status === "published").length)})
              </TabsTrigger>
              <TabsTrigger value="drafts">
                Drafts ({formatNumber(articles.filter((article) => article.status === "draft").length)})
              </TabsTrigger>
            </TabsList>
            <p className="text-sm text-gray-500">
              Search by title, slug, author, type, or sectors. Filters and pagination work on the live synced dataset.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:min-w-[720px] xl:flex-row">
            <div className="relative xl:flex-[1.4]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  resetPagination();
                }}
                placeholder="Search title, slug, author, sector..."
                className="h-10 pl-9"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(event) => {
                setCategoryFilter(event.target.value);
                resetPagination();
              }}
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-emerald-500"
            >
              <option value="all">All types</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>

            <select
              value={authorFilter}
              onChange={(event) => {
                setAuthorFilter(event.target.value);
                resetPagination();
              }}
              className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-emerald-500"
            >
              <option value="all">All authors</option>
              {authors.map((author) => (
                <option key={author} value={author}>
                  {author}
                </option>
              ))}
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
            <ArticlesTable articles={paginatedArticles} />
          </TabsContent>
          <TabsContent value="published" className="mt-0">
            <ArticlesTable articles={paginatedArticles} />
          </TabsContent>
          <TabsContent value="drafts" className="mt-0">
            <ArticlesTable articles={paginatedArticles} />
          </TabsContent>

          <div className="flex flex-col gap-3 border-t px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1 text-sm text-gray-500">
              <p>
                Showing {formatNumber(showingFrom)} to {formatNumber(showingTo)} of{" "}
                {formatNumber(filteredArticles.length)} matching articles
              </p>
              <p>
                Page {formatNumber(currentPage)} of {formatNumber(pageCount)} with{" "}
                {PAGE_SIZE} articles per page
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
        </div>
      </div>
    </Tabs>
  );
}
