const isProduction = process.env.NODE_ENV === "production";
const STRAPI_URL =
  process.env.STRAPI_URL?.trim() || (isProduction ? "" : "http://localhost:1337");
const STRAPI_ADMIN_TOKEN = process.env.STRAPI_ADMIN_TOKEN?.trim() || "";
const STRAPI_FETCH_TIMEOUT_MS = Number.isFinite(
  Number.parseInt(process.env.STRAPI_FETCH_TIMEOUT_MS ?? "", 10)
)
  ? Math.min(
      Math.max(Number.parseInt(process.env.STRAPI_FETCH_TIMEOUT_MS ?? "", 10), 1000),
      30000
    )
  : 8000;

interface StrapiNamedEntity {
  name?: string | null;
  attributes?: {
    name?: string | null;
  } | null;
}

interface StrapiSingleRelation<T> {
  data?: T | null;
}

interface StrapiManyRelation<T> {
  data?: T[] | null;
}

type StrapiNamedRelation =
  | StrapiNamedEntity
  | StrapiSingleRelation<StrapiNamedEntity>
  | null;

type StrapiNamedListRelation =
  | StrapiNamedEntity[]
  | StrapiManyRelation<StrapiNamedEntity>
  | null;

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
  documentId?: string;
  Title?: string;
  slug?: string;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  Date?: string | null;
  author?: StrapiNamedRelation;
  type_of_content?: StrapiNamedRelation;
  sectors?: StrapiNamedListRelation;
  tags?: StrapiNamedListRelation;
  attributes?: Omit<StrapiArticle, "id" | "attributes"> | null;
  [key: string]: unknown;
}

export interface NormalizedStrapiArticle {
  id: number;
  title: string;
  slug: string;
  publishedAt: string | null;
  date: string | null;
  author: string;
  category: string;
  sectors: string;
  status: "published" | "draft";
}

export class StrapiUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StrapiUnavailableError";
  }
}

export function isStrapiUnavailableError(
  error: unknown
): error is StrapiUnavailableError {
  return error instanceof StrapiUnavailableError;
}

export function getStrapiConfigurationMessage() {
  if (!STRAPI_URL) {
    return "STRAPI_URL is not configured for this deployment.";
  }

  if (!STRAPI_ADMIN_TOKEN) {
    return "STRAPI_ADMIN_TOKEN is not configured for this deployment.";
  }

  return null;
}

export function getStrapiUnavailableMessage(error: unknown) {
  if (isStrapiUnavailableError(error)) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "The CMS could not be reached.";
}

function readNamedEntityName(entity: StrapiNamedEntity | null | undefined) {
  return entity?.attributes?.name ?? entity?.name ?? null;
}

function readRelationName(relation: StrapiNamedRelation | undefined) {
  if (!relation) {
    return null;
  }

  if (typeof relation === "object" && "data" in relation) {
    return readNamedEntityName(relation.data);
  }

  return readNamedEntityName(relation as StrapiNamedEntity);
}

function readRelationNames(relation: StrapiNamedListRelation | undefined) {
  if (!relation) {
    return "";
  }

  const entries = Array.isArray(relation) ? relation : relation.data ?? [];

  return entries
    .map((entry) => readNamedEntityName(entry))
    .filter((name): name is string => Boolean(name))
    .join(", ");
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

export function normalizeStrapiArticle(
  article: StrapiArticle
): NormalizedStrapiArticle {
  const attrs: Omit<StrapiArticle, "id" | "attributes"> =
    article.attributes ?? article;

  return {
    id: article.id,
    title: readString(attrs.Title, "Untitled"),
    slug: readString(attrs.slug, `article-${article.id}`),
    publishedAt: readNullableString(attrs.publishedAt),
    date: readNullableString(attrs.Date),
    author:
      readRelationName(attrs.author as StrapiNamedRelation | undefined) ??
      "Unknown",
    category:
      readRelationName(attrs.type_of_content as StrapiNamedRelation | undefined) ??
      "Uncategorized",
    sectors: readRelationNames(
      attrs.sectors as StrapiNamedListRelation | undefined
    ),
    status: readNullableString(attrs.publishedAt) ? "published" : "draft",
  };
}

/**
 * Reusable fetch helper for Strapi CMS.
 * Attaches the admin bearer token and returns typed JSON.
 */
export async function strapiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const configurationMessage = getStrapiConfigurationMessage();

  if (configurationMessage) {
    throw new StrapiUnavailableError(configurationMessage);
  }

  const url = `${STRAPI_URL}${path}`;

  let res: Response;

  try {
    res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${STRAPI_ADMIN_TOKEN}`,
        ...options?.headers,
      },
      signal:
        options?.signal ??
        (typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
          ? AbortSignal.timeout(STRAPI_FETCH_TIMEOUT_MS)
          : undefined),
      // Revalidate every 60 seconds so the dashboard stays reasonably fresh.
      next: { revalidate: 60 },
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Unknown connection error";

    throw new StrapiUnavailableError(
      `Failed to reach Strapi at ${STRAPI_URL}: ${message}`
    );
  }

  if (!res.ok) {
    throw new StrapiUnavailableError(
      `Strapi request failed with ${res.status} ${res.statusText}.`
    );
  }

  return res.json() as Promise<T>;
}
