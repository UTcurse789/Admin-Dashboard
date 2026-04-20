const STRAPI_URL = process.env.STRAPI_URL ?? "https://cms.energdive.com";
const STRAPI_ADMIN_TOKEN = process.env.STRAPI_ADMIN_TOKEN;

interface StrapiAuthor {
  name?: string | null;
  data?: {
    attributes?: {
      name?: string | null;
    } | null;
  } | null;
}

interface StrapiArticle {
  Title?: string | null;
  author?: StrapiAuthor | null;
}

interface StrapiResponse {
  data: StrapiArticle[];
}

async function run() {
  if (!STRAPI_ADMIN_TOKEN) {
    throw new Error("Missing STRAPI_ADMIN_TOKEN");
  }

  const res = await fetch(`${STRAPI_URL}/api/contents?populate=*&pagination[limit]=100&sort=publishedAt:desc`, {
    headers: {
      Authorization: `Bearer ${STRAPI_ADMIN_TOKEN}`,
    }
  });

  if (!res.ok) {
    throw new Error(`Strapi request failed: ${res.status} ${res.statusText}`);
  }

  const data: StrapiResponse = await res.json();
  const list = data.data.slice(0, 5);
  list.forEach((article) => {
    console.log(
      article.Title ?? "Untitled",
      "=> Author:",
      article.author?.name || article.author?.data?.attributes?.name || "NULL"
    );
  });
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
