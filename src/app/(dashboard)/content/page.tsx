import { strapiFetch, StrapiResponse, StrapiArticle } from "@/lib/strapi";
import ContentDashboard from "./content-dashboard";

export const dynamic = "force-dynamic";

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

async function getArticles() {
  let allArticles: any[] = [];
  let page = 1;
  let pageCount = 1;
  let total = 0;

  while (page <= pageCount) {
    const data = await strapiFetch<StrapiResponse<StrapiArticle>>(
      `/api/contents?populate=*&sort=publishedAt:desc&pagination[page]=${page}&pagination[pageSize]=100`
    );

    if (data.data) {
      allArticles = [...allArticles, ...data.data];
    }

    total = data.meta.pagination.total;
    pageCount = data.meta.pagination.pageCount;
    page++;
  }

  const formattedData: NormalisedArticle[] = allArticles.map((article) => {
    const attrs = (article as any).attributes ?? article;

    const authorRaw =
      attrs.author?.data?.attributes?.name ??
      attrs.author?.name ??
      null;

    const typeOfContent =
      attrs.type_of_content?.data?.attributes?.name ??
      attrs.type_of_content?.name ??
      null;

    const sectorsArr: string[] = attrs.sectors?.data
      ? attrs.sectors.data.map((s: any) => s.attributes?.name).filter(Boolean)
      : attrs.sectors
      ? attrs.sectors.map((s: any) => s.name).filter(Boolean)
      : [];

    return {
      id: article.id,
      title: attrs.Title ?? "Untitled",
      slug: attrs.slug ?? "",
      publishedAt: attrs.publishedAt ?? null,
      Date: attrs.Date ?? null,
      author: authorRaw ?? "Unknown",
      category: typeOfContent ?? "Uncategorized",
      sectors: sectorsArr,
      status: attrs.publishedAt ? ("published" as const) : ("draft" as const),
    };
  });

  return { articles: formattedData, total };
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

  return (
    <ContentDashboard
      articles={articles}
      totalArticles={totalArticles}
      fetchError={fetchError}
    />
  );
}
