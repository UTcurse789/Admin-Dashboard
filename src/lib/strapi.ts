const STRAPI_URL = process.env.STRAPI_URL || "http://localhost:1337";
const STRAPI_ADMIN_TOKEN = process.env.STRAPI_ADMIN_TOKEN || "";

export interface StrapiResponse<T> {
  data: T[];
  meta: {
    pagination: {
      page: number;
      pageSize: number;
      pageCount: number;
      total: number;
    };
  };
}

export interface StrapiArticle {
  id: number;
  documentId: string;
  Title: string;
  slug: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  Date: string;
  author?: {
    name: string;
  } | null;
  type_of_content?: {
    name: string;
  } | null;
  sectors?: {
    name: string;
  }[];
  tags?: {
    name: string;
  }[];
  [key: string]: unknown;
}

/**
 * Reusable fetch helper for Strapi CMS.
 * Attaches the admin bearer token and returns typed JSON.
 */
export async function strapiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const url = `${STRAPI_URL}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${STRAPI_ADMIN_TOKEN}`,
      ...options?.headers,
    },
    // Revalidate every 60 seconds so the dashboard stays reasonably fresh
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(
      `Strapi request failed: ${res.status} ${res.statusText} – ${url}`
    );
  }

  return res.json() as Promise<T>;
}
