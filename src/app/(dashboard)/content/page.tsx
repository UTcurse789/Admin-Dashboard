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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Layers3,
  Radio,
  TrendingUp,
  UserSquare2,
} from "lucide-react";
import { ContentTableClient } from "./ContentTableClient";

type ContentArticle = NormalizedStrapiArticle;
type BreakdownRow = { label: string; count: number };
type InsightTone = "emerald" | "amber" | "blue";

interface ContentInsights {
  headline: string;
  summary: string;
  momentum: {
    title: string;
    description: string;
    tone: InsightTone;
  };
  mix: {
    title: string;
    description: string;
    tone: InsightTone;
  };
  workflow: {
    title: string;
    description: string;
    tone: InsightTone;
  };
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const preferredRegion = ["bom1", "sin1"];
export const maxDuration = 30;

function formatNumber(value: number) {
  return value.toLocaleString("en-IN");
}

function getWindowStart(days: number) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days + 1);
  return date;
}

function countItems(values: string[]) {
  const map = new Map<string, number>();

  values.forEach((value) => {
    const normalized = value.trim();

    if (!normalized) {
      return;
    }

    map.set(normalized, (map.get(normalized) ?? 0) + 1);
  });

  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

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

function getInsightToneStyles(tone: InsightTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-900";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-900";
    case "blue":
    default:
      return "border-blue-200 bg-blue-50 text-blue-900";
  }
}

async function getArticles() {
  const pageSize = 100;
  let page = 1;
  let pageCount = 1;
  const articles: ContentArticle[] = [];

  while (page <= pageCount) {
    const data = await strapiFetch<StrapiResponse<StrapiArticle>>(
      `/api/contents?populate=*&sort=publishedAt:desc&pagination[page]=${page}&pagination[pageSize]=${pageSize}`
    );

    pageCount = data.meta.pagination.pageCount;
    articles.push(
      ...data.data.map((article) => normalizeStrapiArticle(article))
    );
    page += 1;
  }

  return { articles, total: articles.length };
}

function InsightCard({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: InsightTone;
}) {
  return (
    <Card className={getInsightToneStyles(tone)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6">{description}</p>
      </CardContent>
    </Card>
  );
}

function buildInsights({
  totalArticles,
  published,
  drafts,
  publishedThisMonth,
  previousMonthPublished,
  publishedLast30Days,
  previous30DaysPublished,
  topCategory,
  topSector,
  topAuthor,
  latestPublishedArticle,
  averagePublishedPerWeek,
}: {
  totalArticles: number;
  published: number;
  drafts: number;
  publishedThisMonth: number;
  previousMonthPublished: number;
  publishedLast30Days: number;
  previous30DaysPublished: number;
  topCategory?: BreakdownRow;
  topSector?: BreakdownRow;
  topAuthor?: BreakdownRow;
  latestPublishedArticle?: ContentArticle;
  averagePublishedPerWeek: number;
}): ContentInsights {
  if (totalArticles === 0) {
    return {
      headline: "No live content records are available yet.",
      summary:
        "Once the CMS starts returning articles, this page will convert the live dataset into publishing, mix, and workflow insights.",
      momentum: {
        title: "Publishing momentum unavailable",
        description:
          "There are no article records yet, so velocity and trend insights cannot be calculated.",
        tone: "blue",
      },
      mix: {
        title: "Format mix unavailable",
        description:
          "Content category and sector patterns will appear here after the first records are synced.",
        tone: "blue",
      },
      workflow: {
        title: "Editorial workflow unavailable",
        description:
          "Draft backlog, latest publication, and author concentration need live records before they can be interpreted.",
        tone: "blue",
      },
    };
  }

  const publishedShare = published > 0 ? Math.round((published / totalArticles) * 100) : 0;
  const draftShare = drafts > 0 ? Math.round((drafts / totalArticles) * 100) : 0;
  const topCategoryShare =
    topCategory && published > 0
      ? Math.round((topCategory.count / published) * 100)
      : 0;
  const topSectorShare =
    topSector && published > 0
      ? Math.round((topSector.count / published) * 100)
      : 0;
  const topAuthorShare =
    topAuthor && totalArticles > 0
      ? Math.round((topAuthor.count / totalArticles) * 100)
      : 0;
  const momentumDelta = publishedLast30Days - previous30DaysPublished;

  const momentum =
    publishedLast30Days > previous30DaysPublished
      ? {
          title: "Publishing momentum is accelerating",
          description: `The team published ${formatNumber(
            publishedLast30Days
          )} pieces in the last 30 days, up by ${formatNumber(
            momentumDelta
          )} from the prior 30-day window. ${formatNumber(
            publishedThisMonth
          )} pieces have already shipped this month, so the current pace is ahead of the recent baseline.`,
          tone: "emerald" as const,
        }
      : publishedLast30Days < previous30DaysPublished
      ? {
          title: "Publishing momentum has cooled",
          description: `The last 30 days produced ${formatNumber(
            publishedLast30Days
          )} published pieces versus ${formatNumber(
            previous30DaysPublished
          )} in the preceding window. This month is currently at ${formatNumber(
            publishedThisMonth
          )} published pieces, so the cadence is slower than the recent run rate.`,
          tone: "amber" as const,
        }
      : {
          title: "Publishing momentum is stable",
          description: `Publishing volume is flat across the last two 30-day windows at ${formatNumber(
            publishedLast30Days
          )} pieces. The team is averaging ${averagePublishedPerWeek.toFixed(
            1
          )} published articles per week, which points to a steady editorial rhythm.`,
          tone: "blue" as const,
        };

  const mix = topCategory
    ? {
        title: `${topCategory.label} leads the content mix`,
        description: topSector
          ? `${topCategory.label} accounts for ${topCategoryShare}% of published content, while ${topSector.label} appears in ${topSectorShare}% of published pieces. The library is leaning toward this format-and-sector combination more than any other theme right now.`
          : `${topCategory.label} accounts for ${topCategoryShare}% of published content, making it the clearest format bias in the live library.`,
        tone:
          topCategoryShare >= 45 ? ("amber" as const) : ("blue" as const),
      }
    : {
        title: "Format mix is still forming",
        description:
          "Published records do not yet show a strong category pattern, so the library remains broadly distributed.",
        tone: "blue" as const,
      };

  const workflow =
    drafts > published
      ? {
          title: "Draft backlog is heavier than the live library",
          description: `${formatNumber(
            drafts
          )} drafts are still waiting behind ${formatNumber(
            published
          )} published pieces. That suggests editorial throughput may be constrained between drafting and release.`,
          tone: "amber" as const,
        }
      : latestPublishedArticle
      ? {
          title: `Latest live signal: ${latestPublishedArticle.title}`,
          description: `${latestPublishedArticle.author} published the most recent live piece on ${formatDate(
            latestPublishedArticle.publishedAt
          )}. ${
            topAuthor
              ? `${topAuthor.label} currently contributes ${topAuthorShare}% of the total library, which indicates how concentrated authorship is.`
              : `Published content is currently ${publishedShare}% of the total library, with drafts representing ${draftShare}%.`
          }`,
          tone: "emerald" as const,
        }
      : {
          title: "Drafts dominate the current workflow",
          description: `${formatNumber(
            drafts
          )} drafts are present, but there is no recent published timestamp to anchor a release trend yet.`,
          tone: "amber" as const,
        };

  const headline =
    published > 0
      ? `${formatNumber(published)} published articles are live, with ${formatNumber(
          drafts
        )} drafts still in the pipeline.`
      : `${formatNumber(totalArticles)} content records are synced, but none are currently published.`;

  const summary = topCategory
    ? `${topCategory.label} is the strongest format signal in the dataset${
        topAuthor ? `, and ${topAuthor.label} is the most frequent contributor` : ""
      }. ${
        previousMonthPublished > 0
          ? `This month has ${formatNumber(
              publishedThisMonth
            )} publications compared with ${formatNumber(
              previousMonthPublished
            )} last month.`
          : `The current month has ${formatNumber(
              publishedThisMonth
            )} publications so far.`
      }`
    : `The page is reading the live CMS dataset, but there is not yet enough published variety to describe a meaningful format concentration.`;

  return { headline, summary, momentum, mix, workflow };
}

export default async function ContentPage() {
  let articles: ContentArticle[] = [];
  let fetchError = false;

  try {
    const result = await getArticles();
    articles = result.articles;
  } catch (error) {
    console.error("Failed to fetch content dataset:", error);
    fetchError = true;
  }

  const totalArticles = articles.length;
  const publishedArticles = articles.filter((article) => article.status === "published");
  const draftArticles = articles.filter((article) => article.status === "draft");
  const published = publishedArticles.length;
  const drafts = draftArticles.length;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const startOfPreviousMonth = new Date(startOfMonth);
  startOfPreviousMonth.setMonth(startOfPreviousMonth.getMonth() - 1);

  const last30DaysStart = getWindowStart(30);
  const previous30DaysStart = getWindowStart(60);

  const publishedThisMonth = publishedArticles.filter((article) => {
    return article.publishedAt && new Date(article.publishedAt) >= startOfMonth;
  }).length;

  const previousMonthPublished = publishedArticles.filter((article) => {
    if (!article.publishedAt) {
      return false;
    }

    const publishedAt = new Date(article.publishedAt);
    return (
      publishedAt >= startOfPreviousMonth && publishedAt < startOfMonth
    );
  }).length;

  const publishedLast30Days = publishedArticles.filter((article) => {
    return (
      article.publishedAt && new Date(article.publishedAt) >= last30DaysStart
    );
  }).length;

  const previous30DaysPublished = publishedArticles.filter((article) => {
    if (!article.publishedAt) {
      return false;
    }

    const publishedAt = new Date(article.publishedAt);
    return (
      publishedAt >= previous30DaysStart && publishedAt < last30DaysStart
    );
  }).length;

  const contentByType = countItems(publishedArticles.map((article) => article.category));
  const contentBySector = countItems(
    publishedArticles.flatMap((article) =>
      article.sectors
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
  const contentByAuthor = countItems(
    articles
      .map((article) => article.author)
      .filter((author): author is string => Boolean(author && author !== "Unknown"))
  );

  const latestPublishedArticle = publishedArticles[0];
  const topCategory = contentByType[0];
  const topSector = contentBySector[0];
  const topAuthor = contentByAuthor[0];
  const averagePublishedPerWeek =
    published > 0 ? publishedLast30Days / (30 / 7) : 0;

  const insights = buildInsights({
    totalArticles,
    published,
    drafts,
    publishedThisMonth,
    previousMonthPublished,
    publishedLast30Days,
    previous30DaysPublished,
    topCategory,
    topSector,
    topAuthor,
    latestPublishedArticle,
    averagePublishedPerWeek,
  });

  const stats = [
    {
      label: "Total Records",
      value: totalArticles,
      description: "All content records synced from the live CMS dataset.",
      icon: FileText,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Published",
      value: published,
      description:
        published > 0
          ? `${Math.round((published / Math.max(totalArticles, 1)) * 100)}% of the library is live.`
          : "No records are published yet.",
      icon: CheckCircle,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Drafts",
      value: drafts,
      description:
        drafts > 0
          ? `${Math.round((drafts / Math.max(totalArticles, 1)) * 100)}% of records are still in draft.`
          : "No drafts are currently pending.",
      icon: Clock,
      color: "text-violet-600 bg-violet-50",
    },
    {
      label: "Published This Month",
      value: publishedThisMonth,
      description:
        previousMonthPublished > 0
          ? `${formatNumber(previousMonthPublished)} pieces were published last month.`
          : "No published baseline from the previous month.",
      icon: Calendar,
      color: "text-orange-600 bg-orange-50",
    },
  ];

  const breakdownCards = [
    {
      label: "Top format",
      value: topCategory?.label ?? "No published type",
      description: topCategory
        ? `${formatNumber(topCategory.count)} published pieces`
        : "Waiting for published content",
      icon: Layers3,
    },
    {
      label: "Top sector",
      value: topSector?.label ?? "No sector tagged",
      description: topSector
        ? `${formatNumber(topSector.count)} published mentions`
        : "Waiting for sector tagging",
      icon: Radio,
    },
    {
      label: "Top author",
      value: topAuthor?.label ?? "No author signal",
      description: topAuthor
        ? `${formatNumber(topAuthor.count)} total records`
        : "Waiting for author metadata",
      icon: UserSquare2,
    },
    {
      label: "30-day output",
      value: formatNumber(publishedLast30Days),
      description:
        publishedLast30Days >= previous30DaysPublished
          ? "Holding or improving versus the prior 30 days"
          : "Below the prior 30-day window",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Content Intelligence
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-gray-500">
            Live article records are fetched server-side from the connected CMS,
            then converted into publishing and editorial insights from the
            current dataset.
          </p>
        </div>
      </div>

      <Card className="border-slate-200 bg-white">
        <CardHeader className="space-y-3">
          <Badge
            variant="outline"
            className="w-fit rounded-full border-emerald-200 bg-emerald-50 text-emerald-700"
          >
            Live insight summary
          </Badge>
          <div className="space-y-2">
            <CardTitle className="text-xl font-semibold tracking-tight text-slate-950">
              {insights.headline}
            </CardTitle>
            <CardDescription className="max-w-3xl text-sm leading-6 text-slate-600">
              {insights.summary}
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.label} className="border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-sm font-medium text-gray-500">
                    {stat.label}
                  </CardTitle>
                </div>
                <div
                  className={`flex size-9 items-center justify-center rounded-xl ${stat.color}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold tracking-tight text-gray-900">
                  {formatNumber(stat.value)}
                </p>
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {fetchError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6 text-center">
            <p className="text-sm font-medium text-red-700">
              Failed to connect to the content source
            </p>
            <p className="mt-1 text-xs text-red-500">
              Check that `STRAPI_URL` and `STRAPI_ADMIN_TOKEN` are configured
              correctly.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <InsightCard
          title={insights.momentum.title}
          description={insights.momentum.description}
          tone={insights.momentum.tone}
        />
        <InsightCard
          title={insights.mix.title}
          description={insights.mix.description}
          tone={insights.mix.tone}
        />
        <InsightCard
          title={insights.workflow.title}
          description={insights.workflow.description}
          tone={insights.workflow.tone}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        {breakdownCards.map((item) => {
          const Icon = item.icon;

          return (
            <Card key={item.label} className="border-slate-200 bg-slate-50/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2 text-slate-500">
                  <Icon className="h-4 w-4" />
                  <CardTitle className="text-sm font-medium text-slate-600">
                    {item.label}
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold tracking-tight text-slate-950">
                  {item.value}
                </p>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ContentTableClient articles={articles} />
    </div>
  );
}
