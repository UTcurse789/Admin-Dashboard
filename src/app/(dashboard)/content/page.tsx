import { auth } from "@clerk/nextjs/server";
import { strapiFetch, StrapiResponse, StrapiArticle } from "@/lib/strapi";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  FileText,
  CheckCircle,
  Clock,
  Calendar,
} from "lucide-react";

interface NormalisedArticle {
  id: number;
  title: string;
  slug: string;
  publishedAt: string | null;
  Date: string | null;
  author: string;
  category: string;
  sectors: string;
  status: "published" | "draft";
}

async function getArticles() {
  const data = await strapiFetch<StrapiResponse<StrapiArticle>>(
    "/api/contents?populate=*&sort=publishedAt:desc"
  );

  const formattedData: NormalisedArticle[] = data.data.map((article) => {
    const attrs = (article as any).attributes ?? article;

    const authorRaw =
      attrs.author?.data?.attributes?.name ??
      attrs.author?.name ??
      null;

    const typeOfContent =
      attrs.type_of_content?.data?.attributes?.name ??
      attrs.type_of_content?.name ??
      null;

    const sectorsRaw = attrs.sectors?.data
      ? attrs.sectors.data.map((s: any) => s.attributes?.name).join(", ")
      : attrs.sectors
      ? attrs.sectors.map((s: any) => s.name).join(", ")
      : "";

    return {
      id: article.id,
      title: attrs.Title ?? "Untitled",
      slug: attrs.slug ?? "",
      publishedAt: attrs.publishedAt ?? null,
      Date: attrs.Date ?? null,
      author: authorRaw ?? "Unknown",
      category: typeOfContent ?? "Uncategorized",
      sectors: sectorsRaw,
      status: attrs.publishedAt ? ("published" as const) : ("draft" as const),
    };
  });

  return { articles: formattedData, total: data.meta.pagination.total };
}

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
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function SectorsCell({ sectors }: { sectors: string }) {
  if (!sectors) return <span className="text-gray-400">—</span>;
  const items = sectors.split(", ");
  if (items.length <= 1) {
    return <span className="text-gray-600 text-sm">{items[0]}</span>;
  }
  return (
    <span className="text-gray-600 text-sm">
      {items[0]}{" "}
      <span className="text-gray-400 text-xs">+{items.length - 1} more</span>
    </span>
  );
}

function ArticlesTable({
  articles,
}: {
  articles: NormalisedArticle[];
}) {
  if (articles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="flex size-12 items-center justify-center rounded-full bg-gray-100">
          <FileText className="h-6 w-6 text-gray-400" />
        </div>
        <p className="mt-4 text-sm font-medium text-gray-700">
          No content found
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Articles will appear here once published in Strapi.
        </p>
      </div>
    );
  }

  return (
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
        {articles.map((article) => {
          const truncatedTitle =
            article.title.length > 50
              ? article.title.substring(0, 50) + "…"
              : article.title;
          const authorInitial = article.author.charAt(0).toUpperCase();

          return (
            <TableRow key={article.id}>
              {/* Title */}
              <TableCell>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 truncate max-w-[300px]">
                    {truncatedTitle}
                  </p>
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
                  className={`rounded-full text-[11px] font-medium ${getTypeBadgeColor(article.category)}`}
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
                  ? new Date(article.Date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default async function ContentPage() {
  const { userId } = await auth();

  if (!userId) {
    return null;
  }

  let articles: NormalisedArticle[] = [];
  let totalArticles = 0;
  let fetchError = false;

  try {
    const res = await getArticles();
    articles = res.articles;
    totalArticles = res.total;
  } catch (err) {
    console.error("Failed to fetch articles from Strapi:", err);
    fetchError = true;
  }

  const published = articles.filter((a) => a.status === "published").length;
  const drafts = articles.filter((a) => a.status === "draft").length;

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const publishedThisMonth = articles.filter(
    (a) => a.publishedAt && new Date(a.publishedAt) >= startOfMonth
  ).length;

  const publishedArticles = articles.filter((a) => a.status === "published");
  const draftArticles = articles.filter((a) => a.status === "draft");

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

      {/* Tabbed table */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList>
          <TabsTrigger value="all">
            All ({articles.length})
          </TabsTrigger>
          <TabsTrigger value="published">
            Published ({published})
          </TabsTrigger>
          <TabsTrigger value="drafts">
            Drafts ({drafts})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card>
            <CardContent className="p-0">
              <ArticlesTable articles={articles} />
            </CardContent>
            <div className="flex items-center justify-between border-t px-6 py-4">
              <p className="text-sm text-gray-500">
                Showing {articles.length} of {totalArticles} articles
              </p>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="published">
          <Card>
            <CardContent className="p-0">
              <ArticlesTable articles={publishedArticles} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="drafts">
          <Card>
            <CardContent className="p-0">
              <ArticlesTable articles={draftArticles} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
