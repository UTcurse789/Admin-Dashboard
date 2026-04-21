import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  normalizeStrapiArticle,
  strapiFetch,
  StrapiResponse,
  StrapiArticle,
} from "@/lib/strapi";

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pageSize = 100;
    let page = 1;
    let pageCount = 1;
    const articles = [];

    while (page <= pageCount) {
      const data = await strapiFetch<StrapiResponse<StrapiArticle>>(
        `/api/contents?populate=*&sort=publishedAt:desc&pagination[page]=${page}&pagination[pageSize]=${pageSize}`
      );

      pageCount = data.meta.pagination.pageCount;
      articles.push(
        ...data.data.map((article) => {
          const normalized = normalizeStrapiArticle(article);

          return {
            id: normalized.id,
            title: normalized.title,
            slug: normalized.slug,
            publishedAt: normalized.publishedAt,
            Date: normalized.date,
            author: normalized.author,
            category: normalized.category,
            sectors: normalized.sectors,
            status: normalized.status,
          };
        })
      );
      page += 1;
    }

    return NextResponse.json({ articles, total: articles.length });
  } catch (error) {
    console.error("Error fetching content:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}
