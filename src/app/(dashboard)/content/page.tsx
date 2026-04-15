import { auth } from "@clerk/nextjs/server";
import { strapiFetch, StrapiResponse, StrapiArticle } from "@/lib/strapi";

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

  // ── Stats ──────────────────────────────────────────────────────────────
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
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-5"
        >
          <path
            fillRule="evenodd"
            d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Zm2.25 8.5a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 3a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      label: "Published",
      value: published,
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-5"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
    {
      label: "Drafts",
      value: drafts,
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-5"
        >
          <path d="m5.433 13.917 1.262-3.155A4 4 0 0 1 7.58 9.42l6.92-6.918a2.121 2.121 0 0 1 3 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 0 1-.65-.65Z" />
          <path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0 0 10 3H4.75A2.75 2.75 0 0 0 2 5.75v9.5A2.75 2.75 0 0 0 4.75 18h9.5A2.75 2.75 0 0 0 17 15.25V10a.75.75 0 0 0-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5Z" />
        </svg>
      ),
    },
    {
      label: "Published this month",
      value: publishedThisMonth,
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-5"
        >
          <path
            fillRule="evenodd"
            d="M5.75 2a.75.75 0 0 1 .75.75V4h7V2.75a.75.75 0 0 1 1.5 0V4h.25A2.75 2.75 0 0 1 18 6.75v8.5A2.75 2.75 0 0 1 15.25 18H4.75A2.75 2.75 0 0 1 2 15.25v-8.5A2.75 2.75 0 0 1 4.75 4H5V2.75A.75.75 0 0 1 5.75 2Zm-1 5.5c-.69 0-1.25.56-1.25 1.25v6.5c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25v-6.5c0-.69-.56-1.25-1.25-1.25H4.75Z"
            clipRule="evenodd"
          />
        </svg>
      ),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
          Content Management
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Articles published on EnerDive, synced from Strapi CMS.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="group relative overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/80"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="relative">
              <span className="text-zinc-500">{stat.icon}</span>
              <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-100">
                {stat.value}
              </p>
              <p className="mt-1 text-sm text-zinc-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Error state */}
      {fetchError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm font-medium text-red-400">
            Failed to connect to Strapi CMS
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            Check that STRAPI_URL and STRAPI_ADMIN_TOKEN are configured
            correctly.
          </p>
        </div>
      )}

      {/* Articles Table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="border-b border-zinc-800 bg-zinc-900/50 text-xs uppercase text-zinc-500">
              <tr>
                <th
                  scope="col"
                  className="px-6 py-4 font-medium tracking-wider"
                >
                  Title
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 font-medium tracking-wider"
                >
                  Author
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 font-medium tracking-wider"
                >
                  Type
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 font-medium tracking-wider"
                >
                  Sectors
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 font-medium tracking-wider"
                >
                  Status
                </th>
                <th
                  scope="col"
                  className="px-6 py-4 font-medium tracking-wider text-right"
                >
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {articles.map((article) => (
                <tr
                  key={article.id}
                  className="transition-colors hover:bg-zinc-800/20"
                >
                  {/* Title */}
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-xs font-medium text-zinc-300">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="size-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M4.5 2A1.5 1.5 0 0 0 3 3.5v13A1.5 1.5 0 0 0 4.5 18h11a1.5 1.5 0 0 0 1.5-1.5V7.621a1.5 1.5 0 0 0-.44-1.06l-4.12-4.122A1.5 1.5 0 0 0 11.378 2H4.5Z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-zinc-200 max-w-[280px]">
                          {article.title}
                        </p>
                        <p className="truncate text-xs text-zinc-500 max-w-[280px]">
                          /{article.slug}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Author */}
                  <td className="px-6 py-4 text-zinc-400">{article.author}</td>

                  {/* Category / Type */}
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-zinc-700">
                      {article.category}
                    </span>
                  </td>

                  {/* Sectors */}
                  <td className="px-6 py-4">
                    <span className="text-zinc-400 truncate max-w-[200px] block">
                      {article.sectors || "—"}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4">
                    {article.status === "published" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        Published
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-yellow-500/10 px-2 py-1 text-xs font-medium text-yellow-400 ring-1 ring-inset ring-yellow-500/20">
                        <span className="size-1.5 rounded-full bg-yellow-500" />
                        Draft
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-6 py-4 text-right text-zinc-400">
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
                  </td>
                </tr>
              ))}
              {articles.length === 0 && !fetchError && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-12 text-center text-zinc-500"
                  >
                    No articles found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
