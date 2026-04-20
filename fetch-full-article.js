const STRAPI_URL = process.env.STRAPI_URL ?? "https://cms.energdive.com";
const STRAPI_ADMIN_TOKEN = process.env.STRAPI_ADMIN_TOKEN;

async function run() {
  if (!STRAPI_ADMIN_TOKEN) {
    throw new Error("Missing STRAPI_ADMIN_TOKEN");
  }

  const { writeFile } = await import("node:fs/promises");

  const res = await fetch(`${STRAPI_URL}/api/contents?populate=*&sort=publishedAt:desc&pagination[limit]=1`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${STRAPI_ADMIN_TOKEN}`,
    }
  });

  if (!res.ok) {
    throw new Error(`Strapi request failed: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();
  await writeFile("strapi-output.json", JSON.stringify(data, null, 2));
}
run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
