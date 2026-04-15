import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { strapiFetch, StrapiResponse, StrapiArticle } from "@/lib/strapi";

export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await strapiFetch<StrapiResponse<StrapiArticle>>(
      "/api/contents?populate=*&sort=publishedAt:desc"
    );

    const articles = data.data.map((article) => {
      // Strapi v4/v5 may nest fields inside `attributes` or flatten them.
      // We handle both shapes defensively.
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
        status: attrs.publishedAt ? "published" : "draft",
      };
    });

    return NextResponse.json({ articles, total: data.meta.pagination.total });
  } catch (error) {
    console.error("Error fetching content:", error);
    return NextResponse.json(
      { error: "Failed to fetch content" },
      { status: 500 }
    );
  }
}
