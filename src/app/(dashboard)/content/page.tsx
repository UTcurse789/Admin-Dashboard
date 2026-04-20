import {
  normalizeStrapiArticle,
  type NormalizedStrapiArticle,
  strapiFetch,
  StrapiResponse,
  StrapiArticle,
} from "@/lib/strapi";
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

type NormalisedArticle = NormalizedStrapiArticle;

export const dynamic = "force-dynamic";

async function getArticles() {
  const data = await strapiFetch<StrapiResponse<StrapiArticle>>(
    "/api/contents?populate=*&sort=publishedAt:desc"
  );

  const formattedData = data.data.map((article) => normalizeStrapiArticle(article));

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
  if (!sectors) return <span className="text-gray-400">-</span>;
  const items = sectors.split(", ");
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
              ? article.title.substring(0, 50) + "..."
              : article.title;
          const authorInitial = article.author.charAt(0).toUpperCase();

          return (
            <TableRow key={article.id}>
              <TableCell>
                <div className="min-w-0">
                  <p className="max-w-[300px] truncate font-medium text-gray-900">
                    {truncatedTitle}
                  </p>
                  <p className="max-w-[300px] truncate text-xs text-gray-400">
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
                  <span className="max-w-[120px] truncate text-sm text-gray-600">
                    {article.author}
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
                {article.date
                  ? new Date(article.date).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "-"}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

export default async function ContentPage() {
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
